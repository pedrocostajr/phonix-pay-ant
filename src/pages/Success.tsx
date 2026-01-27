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
            button_gradient_end
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
