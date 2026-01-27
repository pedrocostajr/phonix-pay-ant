import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CardData {
  cardNumber: string;
  cardholderName: string;
  expirationMonth: string;
  expirationYear: string;
  securityCode: string;
}

interface CardPaymentRequest {
  productId: string;
  payerEmail: string;
  payerName?: string;
  token?: string;
  installments: number;
  paymentMethodId: string;
  issuerId?: string;
  identificationNumber?: string;
  identificationType?: string;
  cardData?: CardData;
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

    const body: CardPaymentRequest = await req.json();
    const { 
      productId, 
      payerEmail, 
      payerName, 
      installments, 
      paymentMethodId,
      issuerId,
      identificationNumber,
      identificationType,
      cardData,
    } = body;

    if (!productId || !payerEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: productId, payerEmail" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!cardData) {
      return new Response(
        JSON.stringify({ error: "Card data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch product
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, price, mercado_pago_account_id")
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

    // Price in reais (MP expects value in reais, not cents)
    const priceInReais = product.price / 100;

    // Generate unique idempotency key
    const idempotencyKey = crypto.randomUUID();

    // Build payer object
    const payer: Record<string, unknown> = {
      email: payerEmail,
    };

    if (payerName) {
      const nameParts = payerName.trim().split(" ");
      payer.first_name = nameParts[0];
      payer.last_name = nameParts.slice(1).join(" ") || nameParts[0];
    }

    if (identificationNumber && identificationType) {
      payer.identification = {
        type: identificationType,
        number: identificationNumber,
      };
    }

    // Detect card brand from first digits
    const cardBin = cardData.cardNumber.substring(0, 6);
    const detectedPaymentMethod = detectCardBrand(cardBin);

    // Create payment directly with card data (for Brazil)
    const paymentBody: Record<string, unknown> = {
      transaction_amount: priceInReais,
      description: product.name,
      payment_method_id: detectedPaymentMethod || paymentMethodId || "master",
      installments: installments || 1,
      payer,
      notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      card: {
        card_number: cardData.cardNumber,
        cardholder: {
          name: cardData.cardholderName,
          identification: {
            type: identificationType || "CPF",
            number: identificationNumber,
          },
        },
        expiration_month: parseInt(cardData.expirationMonth),
        expiration_year: parseInt(cardData.expirationYear),
        security_code: cardData.securityCode,
      },
    };

    if (issuerId) {
      paymentBody.issuer_id = issuerId;
    }

    console.log("Creating card payment for product:", product.name, "Amount:", priceInReais);

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpAccount.access_token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(paymentBody),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago error:", mpData);
      
      // Handle specific errors
      let errorMessage = "Erro ao processar pagamento";
      if (mpData.cause && mpData.cause.length > 0) {
        errorMessage = mpData.cause[0].description || mpData.message || errorMessage;
      } else if (mpData.message) {
        errorMessage = mpData.message;
      }

      return new Response(
        JSON.stringify({ 
          error: "Failed to create payment", 
          details: errorMessage,
          statusDetail: mpData.status_detail || "unknown",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("MP Response status:", mpData.status, "detail:", mpData.status_detail);

    // Save payment to database
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        product_id: productId,
        mercado_pago_account_id: mpAccount.id,
        external_id: String(mpData.id),
        status: mpData.status,
        amount: product.price,
        payer_email: payerEmail,
        payer_name: payerName,
        payment_method: "credit_card",
        paid_at: mpData.status === "approved" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Payment save error:", paymentError);
    }

    // Check if payment was approved
    const isApproved = mpData.status === "approved";
    const isPending = mpData.status === "in_process" || mpData.status === "pending";

    return new Response(
      JSON.stringify({
        success: true,
        paymentId: payment?.id || mpData.id,
        externalId: String(mpData.id),
        status: mpData.status,
        statusDetail: mpData.status_detail,
        approved: isApproved,
        pending: isPending,
        amount: product.price,
        installments: installments || 1,
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

function detectCardBrand(bin: string): string {
  // Visa
  if (/^4/.test(bin)) return "visa";
  // Mastercard
  if (/^5[1-5]/.test(bin) || /^2[2-7]/.test(bin)) return "master";
  // Amex
  if (/^3[47]/.test(bin)) return "amex";
  // Elo
  if (/^(636368|438935|504175|451416|509|6362|650|6516|6550)/.test(bin)) return "elo";
  // Hipercard
  if (/^(606282|3841)/.test(bin)) return "hipercard";
  // Default
  return "master";
}
