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
  subscriptionCycle?: string;
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
      subscriptionCycle,
    } = body;

    if (!productId || !payerEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: productId, payerEmail" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!cardData) {
      return new Response(
        JSON.stringify({ error: "Card data is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!product.mercado_pago_account_id) {
      return new Response(
        JSON.stringify({ error: "No Mercado Pago account configured for this product" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Fix expiration year (ensure 4 digits)
    let finalExpirationYear = parseInt(cardData.expirationYear);
    if (finalExpirationYear < 100) finalExpirationYear += 2000;

    // 1. Generate Card Token (Backend Tokenization)
    const tokenResponse = await fetch("https://api.mercadopago.com/v1/card_tokens", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpAccount.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        card_number: cardData.cardNumber,
        expiration_month: parseInt(cardData.expirationMonth),
        expiration_year: finalExpirationYear,
        security_code: cardData.securityCode,
        cardholder: {
          name: cardData.cardholderName,
          identification: {
            type: identificationType || "CPF",
            number: identificationNumber,
          },
        },
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Token generation error:", tokenData);
      return new Response(
        JSON.stringify({
          error: "Failed to tokenize card",
          details: tokenData.message || "Invalid card data",
          statusDetail: tokenData.cause?.[0]?.description || "unknown"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- SUBSCRIPTION FLOW ---
    // If it's a subscription cycle BUT installments > 1, we treat it as a standard one-time payment
    // giving the user 1 year of access (or whatever the cycle is), but processed as a standard credit card transaction
    // so that installments can be applied. MP Subscriptions DO NOT support installments on the recurring value.
    const isInstallmentSubscription = subscriptionCycle && installments > 1;

    if (subscriptionCycle && !isInstallmentSubscription) {
      console.log("Processing subscription:", subscriptionCycle);

      // 1. Determine frequency
      let frequency = 1;
      let frequencyType = "months";

      switch (subscriptionCycle) {
        case "MONTHLY": frequency = 1; break;
        case "QUARTERLY": frequency = 3; break;
        case "SEMIANNUALLY": frequency = 6; break;
        case "YEARLY": frequency = 12; break;
        default: frequency = 1;
      }

      // 2. Create Preapproval Plan
      const planBody = {
        reason: product.name,
        auto_recurring: {
          frequency,
          frequency_type: frequencyType,
          transaction_amount: priceInReais,
          currency_id: "BRL"
        },
        back_url: "https://google.com", // Placeholder
        status: "active"
      };

      console.log("Creating MP Plan:", JSON.stringify(planBody));

      const planResponse = await fetch("https://api.mercadopago.com/preapproval_plan", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mpAccount.access_token}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": crypto.randomUUID(), // New key for plan
        },
        body: JSON.stringify(planBody),
      });

      const planData = await planResponse.json();

      if (!planResponse.ok) {
        console.error("Plan creation error:", planData);
        return new Response(
          JSON.stringify({
            error: "Failed to create subscription plan",
            details: planData.message || "Unknown MP Error",
            statusDetail: planData.error || "unknown"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 3. Create Subscription (Preapproval)
      const subscriptionBody = {
        preapproval_plan_id: planData.id,
        card_token_id: tokenData.id,
        payer_email: payerEmail,
        status: "authorized",
        reason: product.name,
        auto_recurring: {
          frequency,
          frequency_type: frequencyType,
          transaction_amount: priceInReais,
          currency_id: "BRL"
        }
      };

      console.log("Creating Subscription:", JSON.stringify(subscriptionBody));

      const subResponse = await fetch("https://api.mercadopago.com/preapproval", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mpAccount.access_token}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(subscriptionBody),
      });

      const subData = await subResponse.json();

      if (!subResponse.ok) {
        console.error("Subscription creation error:", subData);
        return new Response(
          JSON.stringify({
            error: "Failed to create subscription",
            details: subData.message || "Unknown MP Error",
            statusDetail: subData.error || "unknown"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save to DB
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          product_id: productId,
          mercado_pago_account_id: mpAccount.id,
          external_id: String(subData.id),
          status: subData.status === "authorized" ? "approved" : "pending",
          amount: product.price,
          payer_email: payerEmail,
          payer_name: payerName,
          payment_method: "credit_card_subscription",
          paid_at: subData.status === "authorized" ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (paymentError) console.error("DB Save error:", paymentError);

      return new Response(
        JSON.stringify({
          success: true,
          paymentId: payment?.id || subData.id,
          externalId: String(subData.id),
          status: subData.status === "authorized" ? "approved" : "pending",
          approved: subData.status === "authorized",
          amount: product.price,
          installments: 1,
          isSubscription: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // --- END SUBSCRIPTION FLOW ---

    // 2. Create Payment with Token (Standard One-Time)
    const paymentBody: Record<string, unknown> = {
      transaction_amount: priceInReais,
      description: product.name,
      payment_method_id: detectedPaymentMethod || paymentMethodId || "master",
      installments: installments || 1,
      token: tokenData.id,
      payer,
      notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("MP Response status:", mpData.status, "detail:", mpData.status_detail);

    // Calculate expiration date if it's a subscription-like payment (e.g. Annual Installment)
    let expiresAt = null;
    if (subscriptionCycle) {
      const now = new Date();
      if (subscriptionCycle === "YEARLY") {
        now.setFullYear(now.getFullYear() + 1);
        expiresAt = now.toISOString();
      } else if (subscriptionCycle === "MONTHLY") {
        now.setMonth(now.getMonth() + 1);
        expiresAt = now.toISOString();
      } else if (subscriptionCycle === "QUARTERLY") {
        now.setMonth(now.getMonth() + 3);
        expiresAt = now.toISOString();
      } else if (subscriptionCycle === "SEMIANNUALLY") {
        now.setMonth(now.getMonth() + 6);
        expiresAt = now.toISOString();
      }
    }

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
        expires_at: expiresAt,
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
      JSON.stringify({ error: "Internal server error: " + error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
