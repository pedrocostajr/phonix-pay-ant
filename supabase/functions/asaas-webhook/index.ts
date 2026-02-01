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
        console.log("Asaas Webhook received:", JSON.stringify(body));

        // Asaas sends "event" and "payment" object
        // Events: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_CREDIT_CARD_CAPTURE_REFUSED
        const event = body.event;
        const paymentData = body.payment;

        if (!paymentData || !paymentData.id) {
            console.log("No payment data in webhook");
            return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders });
        }

        // Map Asaas status to our status
        let status = paymentData.status; // CONFIRMED, RECEIVED, PENDING, OVERDUE, etc.
        let approved = false;

        if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
            status = "approved";
            approved = true;
        } else if (event === "PAYMENT_OVERDUE" || event === "PAYMENT_REFUNDED") {
            status = "cancelled"; // or specific status
        } else {
            // Keep Asaas status for others
            status = paymentData.status.toLowerCase();
        }

        // Find the payment in our database
        const { data: payment, error: findError } = await supabase
            .from("payments")
            .select("*, products(name, success_message, success_url, success_button_text, whatsapp_number, resend_api_key, sender_email, email_subject, email_body)")
            .eq("external_id", String(paymentData.id))
            .maybeSingle();

        if (findError || !payment) {
            console.log("Payment not found by external_id:", paymentData.id);
            // Try to find by ID if we stored it differently or if it's a subscription payment
            // For subscriptions, Asaas generates a new payment ID for each charge. 
            // We might not have this new ID in our DB yet if it's a recurring charge.
            // But for the FIRST payment (checkout), we should have it.
            return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders });
        }

        // Update payment status in database
        const updateData: Record<string, unknown> = {
            status: status,
        };

        if (approved) {
            updateData.paid_at = new Date().toISOString();

            // Send Email if configured AND not already sent
            if (!payment.email_sent) {
                try {
                    // Fetch product email config
                    const product = payment.products;

                    if (product && product.resend_api_key && product.sender_email) {
                        console.log("Sending email for product:", product.name);

                        const resendUrl = "https://api.resend.com/emails";
                        let emailBody;

                        if (product.email_body && product.email_body.trim() !== "") {
                            // Use Custom Body with Validations
                            emailBody = product.email_body
                                .replace(/{{nome}}/g, payment.payer_name || "Cliente")
                                .replace(/{{email}}/g, payment.payer_email)
                                .replace(/{{produto}}/g, product.name)
                                .replace(/{{valor}}/g, new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(payment.amount / 100))
                                .replace(/{{link_acesso}}/g, product.success_url || "#");
                        } else {
                            // Default Template
                            emailBody = `
                        <h1>Obrigado pela sua compra!</h1>
                        <p>Olá,</p>
                        <p>O pagamento do pedido <strong>#${payment.id.slice(0, 8)}</strong> foi confirmado.</p>
                        <p><strong>Produto:</strong> ${product.name}</p>
                        <p><strong>Valor:</strong> ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(payment.amount / 100)}</p>
                        `;

                            if (product.success_message) {
                                emailBody += `
                            <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 8px;">
                                <h3>Instruções:</h3>
                                <p>${product.success_message.replace(/\n/g, "<br>")}</p>
                            </div>
                            `;
                            }

                            if (product.success_url) {
                                const btnText = product.success_button_text || "Acessar Agora";
                                emailBody += `
                            <div style="margin: 30px 0; text-align: center;">
                                <a href="${product.success_url}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                ${btnText}
                                </a>
                            </div>
                            `;
                            }

                            if (product.whatsapp_number) {
                                emailBody += `
                            <p>Precisa de ajuda? <a href="https://wa.me/${product.whatsapp_number.replace(/\D/g, "")}">Fale conosco no WhatsApp</a></p>
                            `;
                            }
                        }

                        const subject = product.email_subject || `Compra Aprovada: ${product.name}`;

                        const emailResponse = await fetch(resendUrl, {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${product.resend_api_key}`,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                from: product.sender_email,
                                to: payment.payer_email,
                                subject: subject,
                                html: emailBody,
                            }),
                        });

                        const emailResult = await emailResponse.json();
                        console.log("Email sent result:", emailResult);

                        // Mark as sent
                        updateData.email_sent = true;

                    } else {
                        console.log("Email not configured for this product");
                    }
                } catch (emailError) {
                    console.error("Failed to send email:", emailError);
                }
            } else {
                console.log("Email already sent for this payment.");
            }
        }

        const { error: updateError } = await supabase
            .from("payments")
            .update(updateData)
            .eq("id", payment.id);

        if (updateError) {
            console.error("Failed to update payment:", updateError);
        }

        return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders });
    } catch (error) {
        console.error("Webhook error:", error);
        return new Response(JSON.stringify({ error: "Internal Error" }), { status: 500, headers: corsHeaders });
    }
});
