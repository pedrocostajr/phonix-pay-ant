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

    const isPayment = body.type === "payment" || body.action === "payment.updated";
    const isSubscription = body.type === "subscription_preapproval" || body.topic === "preapproval";

    if (isPayment || isSubscription) {
      const entityId = body.data?.id || body.id;

      if (!entityId) {
        console.log("No ID in webhook");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      console.log(`Processing webhook for ${isSubscription ? "Subscription" : "Payment"} ID: ${entityId}`);

      let payment = null;
      for (let i = 0; i < 3; i++) {
        const { data, error } = await supabase
          .from("payments")
          .select("*, mercado_pago_accounts(access_token), products(name, success_message, success_url, success_button_text, whatsapp_number, resend_api_key, sender_email, email_subject, email_body, webhook_url)")
          .eq("external_id", String(entityId))
          .maybeSingle();

        if (data) {
          payment = data;
          break;
        }

        console.log(`Attempt ${i + 1}: Payment/Subscription not found for ID ${entityId}. Retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000));
      }

      if (!payment) {
        console.log("Payment/Subscription not found after retries:", entityId);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      let status = "pending";
      let approved = false;

      if (isSubscription) {
        const subResponse = await fetch(`https://api.mercadopago.com/preapproval/${entityId}`, {
          headers: { "Authorization": `Bearer ${payment.mercado_pago_accounts.access_token}` },
        });

        if (!subResponse.ok) {
          console.error("Failed to fetch subscription from MP");
          return new Response("OK", { status: 200, headers: corsHeaders });
        }

        const subData = await subResponse.json();
        status = subData.status === "authorized" ? "approved" : subData.status;
        approved = status === "approved";
      } else {
        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${entityId}`, {
          headers: { "Authorization": `Bearer ${payment.mercado_pago_accounts.access_token}` },
        });

        if (!mpResponse.ok) {
          console.error("Failed to fetch payment from MP");
          return new Response("OK", { status: 200, headers: corsHeaders });
        }

        const mpPayment = await mpResponse.json();
        status = mpPayment.status;
        approved = status === "approved";
      }

      const updateData: Record<string, any> = { status: status };

      if (approved) {
        updateData.paid_at = new Date().toISOString();

        // 1. Send Email if configured AND not already sent
        if (!payment.email_sent) {
          try {
            const product = payment.products;
            if (product && product.resend_api_key && product.sender_email) {
              const resendUrl = "https://api.resend.com/emails";
              let emailBody;

              if (product.email_body && product.email_body.trim() !== "") {
                emailBody = product.email_body
                  .replace(/{{nome}}/g, payment.payer_name || "Cliente")
                  .replace(/{{email}}/g, payment.payer_email)
                  .replace(/{{produto}}/g, product.name)
                  .replace(/{{valor}}/g, new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(payment.amount / 100))
                  .replace(/{{link_acesso}}/g, product.success_url || "#");
              } else {
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
                  emailBody += `<p>Precisa de ajuda? <a href="https://wa.me/${product.whatsapp_number.replace(/\D/g, "")}">Fale conosco no WhatsApp</a></p>`;
                }
              }

              const subject = product.email_subject || `Compra Aprovada: ${product.name}`;
              await fetch(resendUrl, {
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
              updateData.email_sent = true;
            }
          } catch (emailError) {
            console.error("Failed to send email:", emailError);
          }
        }

        // 2. Trigger External Webhook if configured
        if (payment.products?.webhook_url) {
          try {
            console.log("Triggering external webhook:", payment.products.webhook_url);
            await fetch(payment.products.webhook_url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "payment.approved",
                payment_id: payment.id,
                amount: payment.amount,
                payer_name: payment.payer_name,
                payer_email: payment.payer_email,
                product_name: payment.products.name,
                external_id: entityId,
                status: "approved",
                paid_at: updateData.paid_at,
              }),
            });
          } catch (webhookError) {
            console.error("Failed to trigger external webhook:", webhookError);
          }
        }
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
