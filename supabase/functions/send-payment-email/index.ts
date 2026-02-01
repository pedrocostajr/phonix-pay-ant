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

        const { paymentId } = await req.json();

        if (!paymentId) {
            return new Response(
                JSON.stringify({ error: "Missing paymentId" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 1. Fetch Payment & Product
        const { data: payment, error: findError } = await supabase
            .from("payments")
            .select("*, products(name, success_message, success_url, success_button_text, whatsapp_number, resend_api_key, sender_email, email_subject, email_body)")
            .eq("id", paymentId)
            .maybeSingle();

        if (findError || !payment) {
            return new Response(
                JSON.stringify({ error: "Payment not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Idempotency Check
        if (payment.email_sent) {
            return new Response(
                JSON.stringify({ skipped: true, message: "Email already sent" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const product = payment.products;

        if (!product || !product.resend_api_key || !product.sender_email) {
            return new Response(
                JSON.stringify({ error: "Email configuration missing" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Prepare Email
        const resendUrl = "https://api.resend.com/emails";
        let emailBody;

        if (product.email_body && product.email_body.trim() !== "") {
            // Use Custom Body
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

        // 4. Send Email
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

        if (!emailResponse.ok) {
            console.error("Resend Error:", emailResult);
            return new Response(
                JSON.stringify({ error: "Failed to send email via Resend", details: emailResult }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 5. Update Database (Mark as Sent)
        await supabase
            .from("payments")
            .update({ email_sent: true })
            .eq("id", paymentId);

        return new Response(
            JSON.stringify({ success: true, message: "Email sent successfully" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
