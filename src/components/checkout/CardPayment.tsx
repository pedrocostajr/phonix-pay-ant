import { useState } from "react";
import { CreditCard, Lock, Loader2, User, AlertCircle } from "lucide-react";
import { ProductConfig, formatBRL } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CardPaymentProps {
  config: ProductConfig;
  mercadoPagoAccountId?: string | null;
}

// Mercado Pago public key - will be fetched from the MP account
declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale: string }) => MercadoPagoInstance;
  }
}

interface MercadoPagoInstance {
  createCardToken: (cardData: CardData) => Promise<{ id: string }>;
  getPaymentMethods: (options: { bin: string }) => Promise<{ results: PaymentMethod[] }>;
  getIssuers: (options: { payment_method_id: string; bin: string }) => Promise<Issuer[]>;
  getInstallments: (options: { amount: string; bin: string }) => Promise<InstallmentOption[]>;
}

interface CardData {
  cardNumber: string;
  cardholderName: string;
  cardExpirationMonth: string;
  cardExpirationYear: string;
  securityCode: string;
  identificationType?: string;
  identificationNumber?: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  payment_type_id: string;
  thumbnail: string;
}

interface Issuer {
  id: string;
  name: string;
}

interface InstallmentOption {
  payment_method_id: string;
  payer_costs: PayerCost[];
}

interface PayerCost {
  installments: number;
  installment_rate: number;
  total_amount: number;
  recommended_message: string;
}

export function CardPayment({ config, mercadoPagoAccountId }: CardPaymentProps) {
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [installments, setInstallments] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payerCosts, setPayerCosts] = useState<PayerCost[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [issuerId, setIssuerId] = useState<string>("");

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(" ") : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4);
    }
    return v;
  };

  const formatCPF = (value: string) => {
    const v = value.replace(/\D/g, "");
    if (v.length <= 3) return v;
    if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
    if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
    return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9, 11)}`;
  };

  const getInstallmentPrice = (numInstallments: number) => {
    const cost = payerCosts.find(c => c.installments === numInstallments);
    if (cost) {
      return formatBRL(Math.round(cost.total_amount * 100 / numInstallments));
    }
    const total = config.price;
    const installmentValue = total / numInstallments;
    return formatBRL(Math.round(installmentValue));
  };

  const getTotalPrice = (numInstallments: number) => {
    const cost = payerCosts.find(c => c.installments === numInstallments);
    if (cost) {
      return formatBRL(Math.round(cost.total_amount * 100));
    }
    return formatBRL(config.price);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError("Por favor, informe seu e-mail");
      return;
    }

    if (!cpf || cpf.replace(/\D/g, "").length !== 11) {
      setError("Por favor, informe um CPF válido");
      return;
    }

    if (!mercadoPagoAccountId) {
      setError("Este produto não está configurado para receber pagamentos");
      return;
    }

    const cardNumberClean = cardNumber.replace(/\s/g, "");
    if (cardNumberClean.length < 13 || cardNumberClean.length > 19) {
      setError("Número do cartão inválido");
      return;
    }

    const [month, year] = expiry.split("/");
    if (!month || !year || month.length !== 2 || year.length !== 2) {
      setError("Data de validade inválida");
      return;
    }

    if (cvv.length < 3 || cvv.length > 4) {
      setError("CVV inválido");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Send card data directly to edge function which handles tokenization server-side
      const { data, error: fnError } = await supabase.functions.invoke("create-card-payment", {
        body: {
          productId: config.id,
          payerEmail: email,
          payerName: cardName,
          installments,
          paymentMethodId: paymentMethodId || "master",
          issuerId: issuerId || undefined,
          identificationNumber: cpf.replace(/\D/g, ""),
          identificationType: "CPF",
          // Send card data directly for server-side tokenization
          cardData: {
            cardNumber: cardNumberClean,
            cardholderName: cardName,
            expirationMonth: month,
            expirationYear: "20" + year,
            securityCode: cvv,
          },
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.details || data.error);
      }

      if (data.approved) {
        // Payment approved - redirect to success
        window.location.href = `/success?payment=${data.paymentId}`;
      } else if (data.pending) {
        // Payment pending review
        setError("Pagamento em análise. Você receberá uma confirmação por e-mail.");
      } else {
        // Payment rejected
        throw new Error(getStatusMessage(data.statusDetail));
      }

    } catch (err) {
      console.error("Card payment error:", err);
      setError(err instanceof Error ? err.message : "Erro ao processar pagamento");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusMessage = (statusDetail: string): string => {
    const messages: Record<string, string> = {
      cc_rejected_bad_filled_card_number: "Número do cartão inválido",
      cc_rejected_bad_filled_date: "Data de validade inválida",
      cc_rejected_bad_filled_other: "Dados do cartão inválidos",
      cc_rejected_bad_filled_security_code: "CVV inválido",
      cc_rejected_blacklist: "Cartão não autorizado",
      cc_rejected_call_for_authorize: "Ligue para o banco para autorizar",
      cc_rejected_card_disabled: "Cartão desabilitado",
      cc_rejected_duplicated_payment: "Pagamento duplicado",
      cc_rejected_high_risk: "Pagamento recusado por segurança",
      cc_rejected_insufficient_amount: "Saldo insuficiente",
      cc_rejected_invalid_installments: "Parcelas inválidas",
      cc_rejected_max_attempts: "Limite de tentativas excedido",
      cc_rejected_other_reason: "Pagamento recusado",
    };
    return messages[statusDetail] || "Pagamento recusado. Tente outro cartão.";
  };

  return (
    <div className="phoenix-card phoenix-card-elevated">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="card-email">E-mail *</Label>
          <Input
            id="card-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
          />
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="card-name">Nome no Cartão *</Label>
          <div className="relative">
            <Input
              id="card-name"
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value.toUpperCase())}
              placeholder="NOME COMO NO CARTÃO"
              className="pl-10"
              required
            />
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        {/* CPF */}
        <div className="space-y-2">
          <Label htmlFor="card-cpf">CPF *</Label>
          <Input
            id="card-cpf"
            type="text"
            value={cpf}
            onChange={(e) => setCpf(formatCPF(e.target.value))}
            placeholder="000.000.000-00"
            maxLength={14}
            required
          />
        </div>

        {/* Card Number */}
        <div className="space-y-2">
          <Label htmlFor="card-number">Número do Cartão *</Label>
          <div className="relative">
            <Input
              id="card-number"
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="0000 0000 0000 0000"
              maxLength={19}
              className="pl-10"
              required
            />
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        {/* Expiry & CVV */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="card-expiry">Validade *</Label>
            <Input
              id="card-expiry"
              type="text"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              placeholder="MM/AA"
              maxLength={5}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-cvv">CVV *</Label>
            <Input
              id="card-cvv"
              type="text"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))}
              placeholder="123"
              maxLength={4}
              required
            />
          </div>
        </div>

        {/* Installments */}
        <div className="space-y-2">
          <Label htmlFor="card-installments">Parcelas</Label>
          <select
            id="card-installments"
            value={installments}
            onChange={(e) => setInstallments(Number(e.target.value))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
              <option key={n} value={n}>
                {n}x de {getInstallmentPrice(n)} {n === 1 ? "à vista" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-lg bg-destructive/10">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Total */}
        <div 
          className="rounded-xl p-4"
          style={{ backgroundColor: `hsl(${config.accentColor} / 0.1)` }}
        >
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total</span>
            <span 
              className="text-xl font-black"
              style={{ color: `hsl(${config.accentColor})` }}
            >
              {getTotalPrice(installments)}
            </span>
          </div>
          {installments > 1 && (
            <p className="text-xs text-muted-foreground mt-1">
              {installments}x de {getInstallmentPrice(installments)}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isProcessing || !mercadoPagoAccountId}
          className="phoenix-btn phoenix-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-70"
          style={{
            background: `linear-gradient(135deg, hsl(${config.buttonGradientStart}) 0%, hsl(${config.buttonGradientEnd}) 100%)`,
          }}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Lock className="w-5 h-5" />
              Pagar Agora
            </>
          )}
        </button>

        {!mercadoPagoAccountId && (
          <p className="text-xs text-center text-destructive">
            ⚠️ Este produto não possui conta Mercado Pago configurada
          </p>
        )}

        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" />
          Pagamento 100% seguro e criptografado
        </p>
      </form>
    </div>
  );
}
