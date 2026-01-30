import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Package, Mail, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/constants";

interface PaymentDetails {
  id: string;
  status: string;
  amount: number;
  payer_email: string;
  payer_name: string | null;
  paid_at: string | null;
  product: {
    name: string;
    accent_color: string;
    button_gradient_start: string;
    button_gradient_end: string;
    success_message?: string | null;
    whatsapp_number?: string | null;
    success_url?: string | null;
    success_button_text?: string | null;
  } | null;
}

export default function Success() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("payment");
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<PaymentDetails | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setLoading(false);
      return;
    }

    const fetchPayment = async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          id,
          status,
          amount,
          payer_email,
          payer_name,
          paid_at,
          products (
            name,
            accent_color,
            button_gradient_start,
            button_gradient_end,
            success_message,
            whatsapp_number,
            success_url,
            success_button_text
          )
        `)
        .eq("id", paymentId)
        .maybeSingle();

      if (!error && data) {
        setPayment({
          ...data,
          product: data.products as PaymentDetails["product"],
        });
      }
      setLoading(false);
    };

    fetchPayment();
  }, [paymentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const accentColor = payment?.product?.accent_color || "142 76% 36%";
  const gradientStart = payment?.product?.button_gradient_start || "142 76% 36%";
  const gradientEnd = payment?.product?.button_gradient_end || "142 70% 28%";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="py-6 border-b border-border">
        <div className="container max-w-md mx-auto px-4">
          <div className="flex items-center justify-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm"
              style={{
                background: `linear-gradient(135deg, hsl(${accentColor}) 0%, hsl(${gradientEnd}) 100%)`
              }}
            >
              P
            </div>
            <span className="font-bold text-lg">Phoenix Pay</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-md mx-auto px-4 py-12">
        <div className="text-center animate-fade-up">
          {/* Success Icon */}
          <div
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: `hsl(${accentColor} / 0.1)` }}
          >
            <CheckCircle2
              className="w-10 h-10"
              style={{ color: `hsl(${accentColor})` }}
            />
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-black text-foreground mb-2">
            Pagamento Aprovado!
          </h1>
          <p className="text-muted-foreground mb-8">
            Obrigado pela sua compra. Seu acesso foi liberado!
          </p>
        </div>

        {/* Payment Details Card */}
        {payment && (
          <div
            className="phoenix-card phoenix-card-elevated mb-6 animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="space-y-4">
              {/* Product */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `hsl(${accentColor} / 0.1)` }}
                >
                  <Package
                    className="w-5 h-5"
                    style={{ color: `hsl(${accentColor})` }}
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Produto</p>
                  <p className="font-semibold">{payment.product?.name || "Produto"}</p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Email */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `hsl(${accentColor} / 0.1)` }}
                >
                  <Mail
                    className="w-5 h-5"
                    style={{ color: `hsl(${accentColor})` }}
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Enviado para</p>
                  <p className="font-semibold">{payment.payer_email}</p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Amount */}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Valor pago</span>
                <span
                  className="text-xl font-black"
                  style={{ color: `hsl(${accentColor})` }}
                >
                  {formatBRL(payment.amount)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Custom Message & WhatsApp */}
        {(payment?.product?.success_message || payment?.product?.whatsapp_number) && (
          <div
            className="phoenix-card phoenix-card-elevated mb-6 animate-fade-up text-center space-y-4"
            style={{ animationDelay: "0.15s" }}
          >
            {payment?.product?.success_message && (
              <div className="whitespace-pre-wrap text-sm text-foreground/80">
                {payment.product.success_message}
              </div>
            )}

            {payment?.product?.whatsapp_number && (
              <a
                href={`https://wa.me/${payment.product.whatsapp_number.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90 w-full justify-center"
                style={{ backgroundColor: '#25D366' }}
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                <span>Falar no WhatsApp</span>
              </a>
            )}

            {payment?.product?.success_url && payment?.product?.success_button_text && (
              <a
                href={payment.product.success_url}
                className="phoenix-btn phoenix-btn-primary w-full flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, hsl(${gradientStart}) 0%, hsl(${gradientEnd}) 100%)`,
                }}
              >
                {payment.product.success_button_text}
                <ArrowRight className="w-5 h-5" />
              </a>
            )}
          </div>
        )}

        {/* Info Box */}
        <div
          className="rounded-xl p-4 mb-6 animate-fade-up"
          style={{
            backgroundColor: `hsl(${accentColor} / 0.1)`,
            animationDelay: "0.2s"
          }}
        >
          <p className="text-sm text-center">
            📧 Enviamos os detalhes do acesso para o seu e-mail.
            Verifique também a pasta de spam.
          </p>
        </div>

        {/* CTA */}
        <Link
          to="/"
          className="phoenix-btn phoenix-btn-primary w-full flex items-center justify-center gap-2 animate-fade-up"
          style={{
            background: `linear-gradient(135deg, hsl(${gradientStart}) 0%, hsl(${gradientEnd}) 100%)`,
            animationDelay: "0.3s",
          }}
        >
          Voltar ao Início
          <ArrowRight className="w-5 h-5" />
        </Link>
      </main>
    </div>
  );
}
