import { useState, useEffect } from "react";
import { Copy, CheckCircle2, Clock, QrCode, Loader2, AlertCircle } from "lucide-react";
import { ProductConfig, formatBRL, getPixPrice } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PixPaymentProps {
  config: ProductConfig;
  mercadoPagoAccountId?: string | null;
}

interface PixPaymentData {
  paymentId: string;
  externalId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  expiresAt: string;
  status: string;
}

export function PixPayment({ config, mercadoPagoAccountId }: PixPaymentProps) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pixData, setPixData] = useState<PixPaymentData | null>(null);
  
  const pixPrice = getPixPrice(config);

  // Countdown timer
  useEffect(() => {
    if (!pixData) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [pixData]);

  // Poll for payment status
  useEffect(() => {
    if (!pixData || pixData.status === "approved") return;

    const pollInterval = setInterval(async () => {
      const { data: payment } = await supabase
        .from("payments")
        .select("status")
        .eq("id", pixData.paymentId)
        .maybeSingle();

      if (payment?.status === "approved") {
        // Redirect to success or show success message
        window.location.href = `/success?payment=${pixData.paymentId}`;
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [pixData]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleGeneratePix = async () => {
    if (!email) {
      setError("Por favor, informe seu e-mail");
      return;
    }

    if (!mercadoPagoAccountId) {
      setError("Este produto não está configurado para receber pagamentos PIX");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-pix-payment", {
        body: {
          productId: config.id,
          payerEmail: email,
          payerName: name || undefined,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setPixData(data);
      setTimeLeft(15 * 60);
    } catch (err) {
      console.error("PIX generation error:", err);
      setError(err instanceof Error ? err.message : "Erro ao gerar PIX");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!pixData?.qrCode) return;
    await navigator.clipboard.writeText(pixData.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Show form if no PIX data yet
  if (!pixData) {
    return (
      <div className="phoenix-card phoenix-card-elevated">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pix-email">E-mail *</Label>
            <Input
              id="pix-email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pix-name">Nome (opcional)</Label>
            <Input
              id="pix-name"
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Price Summary */}
          <div 
            className="rounded-xl p-4"
            style={{ backgroundColor: `hsl(${config.accentColor} / 0.1)` }}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total no PIX</span>
              <span 
                className="text-xl font-black"
                style={{ color: `hsl(${config.accentColor})` }}
              >
                {formatBRL(pixPrice)}
              </span>
            </div>
          </div>

          <button
            onClick={handleGeneratePix}
            disabled={loading || !mercadoPagoAccountId}
            className="phoenix-btn phoenix-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, hsl(${config.buttonGradientStart}) 0%, hsl(${config.buttonGradientEnd}) 100%)`,
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Gerando PIX...
              </>
            ) : (
              <>
                <QrCode className="w-5 h-5" />
                Gerar QR Code PIX
              </>
            )}
          </button>

          {!mercadoPagoAccountId && (
            <p className="text-xs text-center text-destructive">
              ⚠️ Este produto não possui conta Mercado Pago configurada
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show QR Code and copy button
  return (
    <div className="phoenix-card phoenix-card-elevated">
      {/* Timer */}
      <div className="flex items-center justify-center gap-2 mb-6 text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span className="text-sm">
          Código expira em{" "}
          <span className="font-mono font-bold text-foreground">
            {formatTime(timeLeft)}
          </span>
        </span>
      </div>

      {/* QR Code */}
      <div className="aspect-square max-w-[200px] mx-auto mb-6 rounded-2xl overflow-hidden bg-white p-2">
        {pixData.qrCodeBase64 ? (
          <img 
            src={`data:image/png;base64,${pixData.qrCodeBase64}`}
            alt="QR Code PIX"
            className="w-full h-full object-contain"
          />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: `hsl(${config.accentColor} / 0.1)` }}
          >
            <QrCode 
              className="w-24 h-24"
              style={{ color: `hsl(${config.accentColor})` }}
            />
          </div>
        )}
      </div>

      {/* Price Summary */}
      <div 
        className="rounded-xl p-4 mb-6"
        style={{ backgroundColor: `hsl(${config.accentColor} / 0.1)` }}
      >
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Total no PIX</span>
          <span 
            className="text-xl font-black"
            style={{ color: `hsl(${config.accentColor})` }}
          >
            {formatBRL(pixPrice)}
          </span>
        </div>
      </div>

      {/* Copy Button */}
      <button
        onClick={handleCopy}
        className="phoenix-btn phoenix-btn-primary w-full flex items-center justify-center gap-2"
        style={{
          background: `linear-gradient(135deg, hsl(${config.buttonGradientStart}) 0%, hsl(${config.buttonGradientEnd}) 100%)`,
        }}
      >
        {copied ? (
          <>
            <CheckCircle2 className="w-5 h-5" />
            Código Copiado!
          </>
        ) : (
          <>
            <Copy className="w-5 h-5" />
            Copiar Código PIX
          </>
        )}
      </button>

      <p className="text-xs text-center text-muted-foreground mt-4">
        Após o pagamento, você receberá acesso imediato por e-mail
      </p>
    </div>
  );
}
