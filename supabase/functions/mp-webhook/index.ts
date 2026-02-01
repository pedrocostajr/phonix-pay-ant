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
    // Handle both 'payment' and 'subscription_preapproval'
    const isPayment = body.type === "payment" || body.action === "payment.updated";
    const isSubscription = body.type === "subscription_preapproval" || body.topic === "preapproval";

    if (isPayment || isSubscription) {
      const entityId = body.data?.id || body.id; // Payments use data.id, Preapprovals use id sometimes

      if (!entityId) {
        console.log("No ID in webhook");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      console.log(`Processing webhook for ${isSubscription ? "Subscription" : "Payment"} ID: ${entityId}`);

      // Find the payment in our database
      const { data: payment, error: findError } = await supabase
        .from("payments")
        .select("*, mercado_pago_accounts(access_token), products(name, success_message, success_url, success_button_text, whatsapp_number, resend_api_key, sender_email, email_subject, email_body)")
        .eq("external_id", String(entityId))
        .maybeSingle();

      if (findError || !payment) {
        console.log("Payment/Subscription not found:", entityId);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      let status = "pending";
      let approved = false;

      if (isSubscription) {
        // Fetch Preapproval Status
        const subResponse = await fetch(`https://api.mercadopago.com/preapproval/${entityId}`, {
          headers: {
            "Authorization": `Bearer ${payment.mercado_pago_accounts.access_token}`,
          },
        });

        if (!subResponse.ok) {
          console.error("Failed to fetch subscription from MP");
          return new Response("OK", { status: 200, headers: corsHeaders });
        }

        const subData = await subResponse.json();
        console.log("MP Subscription status:", subData.status);

        // Map 'authorized' to 'approved' for our logic
        status = subData.status === "authorized" ? "approved" : subData.status;
        approved = status === "approved";

      } else {
        // Fetch Payment Status
        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${entityId}`, {
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

        status = mpPayment.status;
        approved = status === "approved";
      }

      // Update payment status in database
      const updateData: Record<string, unknown> = {
        status: status,
      };

      if (approved) {
        updateData.paid_at = new Date().toISOString();

        // Send Email if configured
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
          } else {
            console.log("Email not configured for this product");
          }
        } catch (emailError) {
          console.error("Failed to send email:", emailError);
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
