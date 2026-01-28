import { useState } from "react";
import { CreditCard, QrCode, Shield, Check, Zap } from "lucide-react";
import { ProductConfig, formatBRL, getPixPrice } from "@/lib/constants";
import { PixPayment } from "./PixPayment";
import { CardPayment } from "./CardPayment";

interface CheckoutCardProps {
  config: ProductConfig;
  mercadoPagoAccountId?: string | null;
}

type PaymentMethod = "pix" | "card";

export function CheckoutCard({ config, mercadoPagoAccountId }: CheckoutCardProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const pixPrice = getPixPrice(config);

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Banner */}
      {config.bannerUrl && (
        <div className="mb-6 rounded-xl overflow-hidden shadow-lg animate-fade-up">
          <img
            src={config.bannerUrl}
            alt={config.name}
            className="w-full h-auto object-cover max-h-48"
          />
        </div>
      )}

      {/* Product Header */}
      <div className="text-center mb-8 animate-fade-up">
        <div className="phoenix-badge mb-4">
          <Zap className="w-3 h-3 mr-1" />
          Oferta Especial
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-foreground mb-2 text-balance">
          {config.name}
        </h1>
        <p className="text-muted-foreground">{config.description}</p>
      </div>

      {/* Price Display */}
      <div
        className="phoenix-card phoenix-card-elevated mb-6 animate-fade-up"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              {paymentMethod === "pix" ? `PIX com ${config.pixDiscount}% OFF` : "Cartão de Crédito"}
            </p>
            <div className="flex items-baseline gap-3">
              <span
                className="phoenix-price"
                style={{ color: `hsl(${config.accentColor})` }}
              >
                {formatBRL(paymentMethod === "pix" ? pixPrice : config.price)}
              </span>
              {config.originalPrice && (
                <span className="phoenix-price-crossed">
                  {formatBRL(config.originalPrice)}
                </span>
              )}
            </div>
          </div>
          {paymentMethod === "pix" && (
            <div
              className="px-3 py-1 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: `hsl(${config.accentColor})` }}
            >
              -{config.pixDiscount}%
            </div>
          )}
        </div>
      </div>

      {/* Payment Method Selector */}
      <div
        className="grid grid-cols-2 gap-3 mb-6 animate-fade-up"
        style={{ animationDelay: "0.2s" }}
      >
        <button
          onClick={() => setPaymentMethod("pix")}
          className={`phoenix-card flex flex-col items-center gap-2 py-4 cursor-pointer transition-all ${paymentMethod === "pix"
            ? "ring-2 ring-offset-2 ring-primary"
            : "hover:bg-secondary/50"
            }`}
          style={paymentMethod === "pix" ? {
            "--tw-ring-color": `hsl(${config.accentColor})`
          } as React.CSSProperties : undefined}
        >
          <QrCode
            className="w-6 h-6"
            style={{ color: paymentMethod === "pix" ? `hsl(${config.accentColor})` : undefined }}
          />
          <span className="font-semibold text-sm">PIX</span>
          <span className="text-xs text-muted-foreground">Aprovação imediata</span>
        </button>

        <button
          onClick={() => setPaymentMethod("card")}
          className={`phoenix-card flex flex-col items-center gap-2 py-4 cursor-pointer transition-all ${paymentMethod === "card"
            ? "ring-2 ring-offset-2 ring-primary"
            : "hover:bg-secondary/50"
            }`}
          style={paymentMethod === "card" ? {
            "--tw-ring-color": `hsl(${config.accentColor})`
          } as React.CSSProperties : undefined}
        >
          <CreditCard
            className="w-6 h-6"
            style={{ color: paymentMethod === "card" ? `hsl(${config.accentColor})` : undefined }}
          />
          <span className="font-semibold text-sm">Cartão</span>
          <span className="text-xs text-muted-foreground">Até 12x</span>
        </button>
      </div>

      {/* Payment Form */}
      <div
        className="animate-fade-up"
        style={{ animationDelay: "0.3s" }}
      >
        {paymentMethod === "pix" ? (
          <PixPayment config={config} mercadoPagoAccountId={mercadoPagoAccountId} />
        ) : (
          <CardPayment config={config} mercadoPagoAccountId={mercadoPagoAccountId} />
        )}
      </div>

      {/* Trust Badges */}
      <div
        className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground animate-fade-up"
        style={{ animationDelay: "0.4s" }}
      >
        <div className="flex items-center gap-1">
          <Shield className="w-4 h-4" />
          <span>Compra Segura</span>
        </div>
        <div className="flex items-center gap-1">
          <Check className="w-4 h-4" />
          <span>Garantia 7 dias</span>
        </div>
      </div>

      {/* Bottom Banner */}
      {config.bottomBannerUrl && (
        <div className="mt-6 mb-2 rounded-lg overflow-hidden animate-fade-up" style={{ animationDelay: "0.5s" }}>
          <img
            src={config.bottomBannerUrl}
            alt="Informações adicionais"
            className="w-full h-auto object-cover"
          />
        </div>
      )}
    </div>
  );
}
