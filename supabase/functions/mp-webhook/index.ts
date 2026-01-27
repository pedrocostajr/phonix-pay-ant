import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    // Mercado Pago sends different notification types
    if (body.type === "payment" || body.action === "payment.updated") {
      const paymentId = body.data?.id;
      
      if (!paymentId) {
        console.log("No payment ID in webhook");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // Find the payment in our database
      const { data: payment, error: findError } = await supabase
        .from("payments")
        .select("*, mercado_pago_accounts(access_token)")
        .eq("external_id", String(paymentId))
        .maybeSingle();

      if (findError || !payment) {
        console.log("Payment not found:", paymentId);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // Fetch payment status from Mercado Pago
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          "Authorization": `Bearer ${payment.mercado_pago_accounts.access_token}`,
        },
      });

      if (!mpResponse.ok) {
        console.error("Failed to fetch payment from MP");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const mpPayment = await mpResponse.json();
      console.log("MP Payment status:", mpPayment.status);

      // Update payment status in database
      const updateData: Record<string, unknown> = {
        status: mpPayment.status,
      };

      if (mpPayment.status === "approved") {
        updateData.paid_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("payments")
        .update(updateData)
        .eq("id", payment.id);

      if (updateError) {
        console.error("Failed to update payment:", updateError);
      }
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
