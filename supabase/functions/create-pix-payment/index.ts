import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  productId: string;
  payerEmail: string;
  payerName?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { productId, payerEmail, payerName }: PaymentRequest = await req.json();

    if (!productId || !payerEmail) {
      return new Response(
        JSON.stringify({ error: "productId and payerEmail are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch product
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, price, pix_discount, mercado_pago_account_id")
      .eq("id", productId)
      .eq("is_active", true)
      .maybeSingle();

    if (productError || !product) {
      console.error("Product fetch error:", productError);
      return new Response(
        JSON.stringify({ error: "Product not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!product.mercado_pago_account_id) {
      return new Response(
        JSON.stringify({ error: "No Mercado Pago account configured for this product" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch MP account
    const { data: mpAccount, error: mpError } = await supabase
      .from("mercado_pago_accounts")
      .select("id, access_token")
      .eq("id", product.mercado_pago_account_id)
      .single();

    if (mpError || !mpAccount) {
      console.error("MP account fetch error:", mpError);
      return new Response(
        JSON.stringify({ error: "Mercado Pago account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate PIX price (with discount)
    const pixPrice = Math.round(product.price * (1 - product.pix_discount / 100));
    const pixPriceInReais = pixPrice / 100; // MP expects value in reais, not cents

    // Generate unique idempotency key
    const idempotencyKey = crypto.randomUUID();

    // Create payment in Mercado Pago
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpAccount.access_token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: pixPriceInReais,
        description: product.name,
        payment_method_id: "pix",
        payer: {
          email: payerEmail,
          first_name: payerName || undefined,
        },
        notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      }),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago error:", mpData);
      return new Response(
        JSON.stringify({ 
          error: "Failed to create payment", 
          details: mpData.message || mpData.cause?.[0]?.description 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract PIX data
    const pixData = mpData.point_of_interaction?.transaction_data;
    
    if (!pixData) {
      console.error("No PIX data in response:", mpData);
      return new Response(
        JSON.stringify({ error: "PIX data not available" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate expiration (15 minutes from now)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Save payment to database
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        product_id: productId,
        mercado_pago_account_id: mpAccount.id,
        external_id: String(mpData.id),
        status: mpData.status,
        amount: pixPrice,
        payer_email: payerEmail,
        payer_name: payerName,
        payment_method: "pix",
        qr_code: pixData.qr_code,
        qr_code_base64: pixData.qr_code_base64,
        ticket_url: pixData.ticket_url,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Payment save error:", paymentError);
      // Continue anyway - payment was created in MP
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentId: payment?.id || mpData.id,
        externalId: String(mpData.id),
        status: mpData.status,
        qrCode: pixData.qr_code,
        qrCodeBase64: pixData.qr_code_base64,
        ticketUrl: pixData.ticket_url,
        expiresAt,
        amount: pixPrice,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
