import { useState, useEffect } from "react";
import { CreditCard, Lock, Loader2, User, AlertCircle } from "lucide-react";
import { ProductConfig, formatBRL } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CardPaymentProps {
  config: ProductConfig;
  mercadoPagoAccountId?: string | null;
  asaasAccountId?: string | null;
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
  installment_amount: number;
  recommended_message: string;
}

export function CardPayment({ config, mercadoPagoAccountId, asaasAccountId }: CardPaymentProps) {
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [installments, setInstallments] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payerCosts, setPayerCosts] = useState<PayerCost[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [issuerId, setIssuerId] = useState<string>("");

  const [mpInstance, setMpInstance] = useState<MercadoPagoInstance | null>(null);

  // Initialize Mercado Pago SDK
  useEffect(() => {
    if (mercadoPagoAccountId) {
      // We need to fetch the public key associated with this account or use a passed one.
      // For now, assuming we might need to fetch it or it's passed.
      // Actually, relying on the fact that if we have an ID, we assume standard flow.
      // Ideally we need the PUBLIC KEY here to init the SDK. 
      // The previous code assumed 'MercadoPago' is on window.
      // We will try to init if we have a public key.
      // WAIT: The edge function has the access token, but frontend needs PUBLIC KEY.
      // The current code lacks fetching the Public Key for the account.
      // We added 'public_key' to the database earlier. We need to fetch it!
    }
  }, [mercadoPagoAccountId]);

  // FETCH PUBLIC KEY AND INIT SDK
  useEffect(() => {
    if (!mercadoPagoAccountId) return;

    const fetchPublicKey = async () => {
      const { data, error } = await supabase
        .from('mercado_pago_accounts')
        .select('public_key')
        .eq('id', mercadoPagoAccountId)
        .single();

      if (data?.public_key && window.MercadoPago) {
        const mp = new window.MercadoPago(data.public_key, { locale: 'pt-BR' });
        setMpInstance(mp);
      }
    };

    fetchPublicKey();
  }, [mercadoPagoAccountId]);


  // Fetch default installments (generic BIN) if no card number entered yet
  useEffect(() => {
    if (mpInstance && config.price && cardNumber.length < 6) {
      const fetchDefaultInstallments = async () => {
        try {
          // MasterCard generic BIN
          const response = await mpInstance.getInstallments({
            amount: String(config.price / 100),
            bin: "550209"
          });

          if (response.length > 0) {
            setPayerCosts(response[0].payer_costs);
            setPaymentMethodId(response[0].payment_method_id);
            setIssuerId(response[0].issuer.id);
          }
        } catch (e) {
          console.error("Error fetching default installments:", e);
        }
      };

      fetchDefaultInstallments();
    }
  }, [mpInstance, config.price, cardNumber]);


  // Update installments when Card Number (BIN) changes
  useEffect(() => {
    const fetchInstallments = async () => {
      const bin = cardNumber.replace(/\D/g, "").substring(0, 6);
      if (bin.length < 6 || !mpInstance || !config.price) return;

      try {
        const response = await mpInstance.getInstallments({
          amount: String(config.price / 100), // MP expects string amount in Reais
          bin: bin
        });

        if (response.length > 0) {
          // Usually response[0] contains the data for the card brand
          setPayerCosts(response[0].payer_costs);
          setPaymentMethodId(response[0].payment_method_id);
          setIssuerId(response[0].issuer.id);
        }
      } catch (e) {
        console.error("Error fetching installments:", e);
      }
    };

    // Debounce to avoid too many requests
    const timer = setTimeout(() => {
      fetchInstallments();
    }, 500);

    return () => clearTimeout(timer);
  }, [cardNumber, mpInstance, config.price]);


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

  const formatPhone = (value: string) => {
    const v = value.replace(/\D/g, "");
    if (v.length <= 2) return v;
    if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7, 11)}`;
  };

  const formatCEP = (value: string) => {
    const v = value.replace(/\D/g, "");
    if (v.length <= 5) return v;
    return `${v.slice(0, 5)}-${v.slice(5, 8)}`;
  };

  const calculateInstallmentWithInterest = (principal: number, months: number) => {
    if (months === 1) return { installment: principal, total: principal };

    // Fallback simples caso a API falhe (apenas para exibição)
    // Usando uma taxa média de mercado se necessário, mas o ideal é vir da API
    const simpleInterestRate = 0.0299; // 2.99% a.m. fallback

    // Fórmula Price: R = P * [i * (1+i)^n] / [(1+i)^n - 1]
    const i = simpleInterestRate;
    const n = months;

    const factor = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    const installmentValue = principal * factor;
    const totalValue = installmentValue * n;

    return {
      installment: Math.round(installmentValue),
      total: Math.round(totalValue)
    };
  };

  const getInstallmentPrice = (numInstallments: number) => {
    // If Seller pays interest, we just divide the price by N (interest-free display)
    if (config.installmentType === 'seller') {
      return formatBRL(Math.round(config.price / numInstallments));
    }

    const cost = payerCosts.find(c => c.installments === numInstallments);
    if (cost) {
      if (cost.installment_amount) {
        return formatBRL(Math.round(cost.installment_amount * 100));
      }
      // Fallback if MP doesn't return installment_amount (rare)
      return formatBRL(Math.round((cost.total_amount * 100) / numInstallments));
    }

    // Fallback logic with interest (only for buyer type)
    const { installment } = calculateInstallmentWithInterest(config.price, numInstallments);
    return formatBRL(installment);
  };

  const getInstallmentValueRaw = (numInstallments: number) => {
    const cost = payerCosts.find(c => c.installments === numInstallments);
    if (cost) return cost.installment_amount * 100;

    const { installment } = calculateInstallmentWithInterest(config.price, numInstallments);
    return installment;
  }

  const getTotalPrice = (numInstallments: number) => {
    // If Seller pays interest, total remains the product price
    if (config.installmentType === 'seller') {
      return formatBRL(config.price);
    }

    const cost = payerCosts.find(c => c.installments === numInstallments);
    if (cost) {
      return formatBRL(Math.round(cost.total_amount * 100));
    }

    const { total } = calculateInstallmentWithInterest(config.price, numInstallments);
    return formatBRL(total);
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

    if (!mercadoPagoAccountId && !asaasAccountId) {
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
      // Asaas Payment Flow
      if (config.paymentProvider === 'asaas') {
        const { data, error: fnError } = await supabase.functions.invoke("create-asaas-payment", {
          body: {
            productId: config.id,
            payerEmail: email,
            payerName: cardName,
            payerCpfCnpj: cpf.replace(/\D/g, ""),
            installments: installments, // Only used if not subscription
            postalCode: postalCode.replace(/\D/g, ""),
            addressNumber: addressNumber,
            phone: phone.replace(/\D/g, ""),
            cardData: {
              cardNumber: cardNumberClean,
              cardholderName: cardName,
              expirationMonth: month,
              expirationYear: "20" + year,
              securityCode: cvv,
            },
          },
        });

        if (fnError) throw new Error(fnError.message);
        if (data.error) throw new Error(data.details || data.error);

        // Success for Asaas
        window.location.href = `/success?payment=${data.paymentId}`;
        return;
      }

      // Mercado Pago Payment Flow
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

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="card-phone">Telefone / WhatsApp *</Label>
          <Input
            id="card-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="(11) 99999-9999"
            maxLength={15}
            required
          />
        </div>

        {/* Address Info (Required for Asaas) */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="card-cep">CEP *</Label>
            <Input
              id="card-cep"
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(formatCEP(e.target.value))}
              placeholder="00000-000"
              maxLength={9}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-number-address">Número *</Label>
            <Input
              id="card-number-address"
              type="text"
              value={addressNumber}
              onChange={(e) => setAddressNumber(e.target.value)}
              placeholder="123"
              required
            />
          </div>
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
          <Label htmlFor="card-installments">
            {config.subscriptionCycle ? "Ciclo da Assinatura" : "Parcelas"}
          </Label>

          {config.subscriptionCycle ? (
            <div className="flex h-10 w-full items-center rounded-md border border-input bg-secondary/50 px-3 text-sm text-muted-foreground">
              {config.subscriptionCycle === "MONTHLY" && "Assinatura Mensal"}
              {config.subscriptionCycle === "QUARTERLY" && "Assinatura Trimestral"}
              {config.subscriptionCycle === "SEMIANNUALLY" && "Assinatura Semestral"}
              {config.subscriptionCycle === "YEARLY" && "Assinatura Anual"}
              {!["MONTHLY", "QUARTERLY", "SEMIANNUALLY", "YEARLY"].includes(config.subscriptionCycle) &&
                config.subscriptionCycle}
            </div>
          ) : (
            <select
              id="card-installments"
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {payerCosts.length > 0 ? (
                payerCosts.map((cost) => {
                  const isSellerType = config.installmentType === 'seller';
                  const installmentPrice = isSellerType
                    ? formatBRL(Math.round(config.price / cost.installments))
                    : formatBRL(Math.round(cost.installment_amount * 100));

                  const totalText = !isSellerType && cost.total_amount > (config.price / 100)
                    ? ` (Total: ${formatBRL(Math.round(cost.total_amount * 100))})`
                    : "";

                  const suffix = isSellerType && cost.installments > 1 ? " sem juros" : "";

                  return (
                    <option key={cost.installments} value={cost.installments}>
                      {cost.installments}x de {installmentPrice}{suffix} {cost.installments === 1 ? "à vista" : ""}
                      {totalText}
                    </option>
                  );
                })
              ) : (
                // Fallback while loading or if no bin
                Array.from({ length: 12 }, (_, i) => i + 1)
                  .filter(n => config.price >= n * 500 || n === 1)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n}x de {getInstallmentPrice(n)} {n === 1 ? "à vista" : ""}
                      {n > 1 ? ` (Total: ${getTotalPrice(n)})` : ""}
                    </option>
                  ))
              )}
            </select>
          )}
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
            <span className="text-sm font-medium">
              {config.subscriptionCycle ? "Valor da Cobrança" : "Total com Juros"}
            </span>
            <span
              className="text-xl font-black"
              style={{ color: `hsl(${config.accentColor})` }}
            >
              {getTotalPrice(installments)}
            </span>
          </div>
          {installments > 1 && (
            <p className="text-xs text-muted-foreground mt-1">
              Opção: {installments}x de {getInstallmentPrice(installments)}
              {config.installmentType === 'seller' ? " sem juros" : ""}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isProcessing || (!mercadoPagoAccountId && !asaasAccountId)}
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

        {!mercadoPagoAccountId && !asaasAccountId && (
          <p className="text-xs text-center text-destructive">
            ⚠️ Este produto não possui conta de pagamento configurada
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
