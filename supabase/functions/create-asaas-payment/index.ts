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

interface AsaasPaymentRequest {
    productId: string;
    payerEmail: string;
    payerName: string;
    payerCpfCnpj: string;
    payerPhone?: string;
    installments?: number;
    cardData?: CardData;
    billingType?: 'CREDIT_CARD' | 'PIX' | 'BOLETO';
    postalCode?: string;
    addressNumber?: string;
    phone?: string;
}

const getAsaasUrl = (environment: string) => {
    return environment === 'production'
        ? 'https://api.asaas.com/v3'
        : 'https://sandbox.asaas.com/api/v3';
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const body: AsaasPaymentRequest = await req.json();
        const {
            productId,
            payerEmail,
            payerName,
            payerCpfCnpj,
            payerPhone,
            installments,
            cardData,
            billingType = "CREDIT_CARD",
            postalCode,
            addressNumber,
            phone, // phone from payload if provided
        } = body;

        // 1. Fetch Product and Asaas Account
        const { data: product, error: productError } = await supabase
            .from("products")
            .select("*, asaas_accounts(*)")
            .eq("id", productId)
            .single();

        if (productError || !product || !product.asaas_accounts) {
            throw new Error("Product or Asaas account not found");
        }

        const startIdx = product.asaas_accounts.api_key.indexOf('$aact');
        const apiKey = startIdx >= 0 ? product.asaas_accounts.api_key.substring(startIdx) : product.asaas_accounts.api_key;
        const baseUrl = getAsaasUrl(product.asaas_accounts.environment);

        // 2. Create/Get Customer
        // Check if customer exists by email (simple check)
        const customerResponse = await fetch(`${baseUrl}/customers?email=${payerEmail}`, {
            method: "GET",
            headers: { "access_token": apiKey },
        });
        const customerData = await customerResponse.json();

        let customerId = customerData.data && customerData.data.length > 0 ? customerData.data[0].id : null;

        if (!customerId) {
            console.log("Creating new Asaas customer for", payerEmail);
            const createCustomerRes = await fetch(`${baseUrl}/customers`, {
                method: "POST",
                headers: {
                    "access_token": apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: payerName,
                    email: payerEmail,
                    cpfCnpj: payerCpfCnpj,
                    mobilePhone: payerPhone,
                }),
            });
            const newCustomer = await createCustomerRes.json();
            if (newCustomer.errors) throw new Error(newCustomer.errors[0].description);
            customerId = newCustomer.id;
        }

        // 3. Process Payment or Subscription
        let endpoint = "/payments";
        let payload: any = {
            customer: customerId,
            billingType: billingType,
            value: product.price / 100,
            dueDate: new Date().toISOString().split('T')[0],
        };

        if (billingType === "CREDIT_CARD") {
            if (!cardData) throw new Error("Card Data is required for Credit Card payments");

            payload.creditCard = {
                holderName: cardData.cardholderName,
                number: cardData.cardNumber,
                expiryMonth: cardData.expirationMonth,
                expiryYear: cardData.expirationYear,
                ccv: cardData.securityCode,
            };

            payload.creditCardHolderInfo = {
                name: payerName,
                email: payerEmail,
                cpfCnpj: payerCpfCnpj,
                postalCode: postalCode || "00000000",
                addressNumber: addressNumber || "SN",
                phone: phone || payerPhone || "11999999999",
            };
        }

        // Check if we should process as a subscription or a one-time payment with installments
        // Asaas Subscriptions DO NOT support installments on the recurring value.
        // So if the user selected installments > 1, we treat it as a standard credit card payment
        // for the full amount (e.g. 1 Year Access), but processed as a one-time transaction.
        const isInstallmentSubscription = product.subscription_cycle && billingType === "CREDIT_CARD" && installments && installments > 1;

        if (product.subscription_cycle && billingType === "CREDIT_CARD" && !isInstallmentSubscription) {
            endpoint = "/subscriptions";
            payload.cycle = product.subscription_cycle;
            payload.nextDueDate = payload.dueDate;
            delete payload.dueDate;
            delete payload.installmentCount;
            delete payload.installmentValue;
        } else {
            // One-time payment (Card or PIX) or Annual Plan with Installments
            if (billingType === "CREDIT_CARD" && installments && installments > 1) {
                payload.installmentCount = installments;
                payload.installmentValue = payload.value / installments;
                delete payload.value;
            }
        }

        console.log(`Sending to ${baseUrl}${endpoint}`, payload);

        const paymentRes = await fetch(`${baseUrl}${endpoint}`, {
            method: "POST",
            headers: {
                "access_token": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const paymentData = await paymentRes.json();

        if (paymentData.errors) {
            console.error("Asaas Error:", paymentData.errors);
            return new Response(
                JSON.stringify({
                    error: "Erro no processamento Asaas",
                    details: paymentData.errors[0].description
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Save to local DB
        const { data: savedPayment, error: saveError } = await supabase
            .from("payments")
            .insert({
                product_id: productId,
                external_id: paymentData.id,
                status: paymentData.status, // PENDING, CONFIRMED, etc.
                amount: product.price,
                payer_email: payerEmail,
                payer_name: payerName,
                payment_method: "credit_card", // or "asaas_subscription"
                // asaas_account_id could be stored if we had a column, but mp_account_id is separate
            })
            .select()
            .single();

        if (saveError) console.error("Error saving payment to DB:", saveError);

        // Fetch PIX QR Code if applicable
        let qrCodeData = null;
        if (billingType === 'PIX' && paymentData.id) {
            // Asaas usually returns pending status. We need to get the QR Code.
            // Sometimes it's in the response, sometimes we need to call /payments/{id}/pixQrCode
            try {
                const qrRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, {
                    method: "GET",
                    headers: { "access_token": apiKey },
                });
                qrCodeData = await qrRes.json();
            } catch (err) {
                console.error("Error fetching PIX QR Code:", err);
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                paymentId: savedPayment?.id,
                externalId: paymentData.id,
                status: paymentData.status,
                qrCode: qrCodeData?.payload, // Copy-paste string
                qrCodeBase64: qrCodeData?.encodedImage, // Base64 image
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("Internal Error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Erro interno no servidor" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
