import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CheckoutCard } from "@/components/checkout/CheckoutCard";
import { ProductConfig, PRODUCT_CONFIG } from "@/lib/constants";

interface DbProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  pix_discount: number;
  accent_color: string;
  button_gradient_start: string;
  button_gradient_end: string;
  mercado_pago_account_id: string | null;
  asaas_account_id: string | null;
  payment_provider: 'mercadopago' | 'asaas';
  subscription_cycle: string | null;
  banner_url: string | null;
  bottom_banner_url: string | null;
  facebook_pixel_id: string | null;
  installment_type: string | null;
  is_active: boolean;
}

export default function Checkout() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!!productId);
  const [product, setProduct] = useState<ProductConfig & { facebookPixelId?: string } | null>(null);
  const [mpAccountId, setMpAccountId] = useState<string | null>(null);
  const [asaasAccountId, setAsaasAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      // Use static config when no product ID
      setProduct(PRODUCT_CONFIG);
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        console.error("Product not found:", error);
        navigate("/");
        return;
      }

      const dbProduct = data as DbProduct;

      setProduct({
        id: dbProduct.id,
        name: dbProduct.name,
        description: dbProduct.description || "",
        price: dbProduct.price,
        originalPrice: dbProduct.original_price || undefined,
        pixDiscount: dbProduct.pix_discount,
        accentColor: dbProduct.accent_color,
        buttonGradientStart: dbProduct.button_gradient_start,
        buttonGradientEnd: dbProduct.button_gradient_end,
        bannerUrl: dbProduct.banner_url || undefined,
        bottomBannerUrl: dbProduct.bottom_banner_url || undefined,
        facebookPixelId: dbProduct.facebook_pixel_id || undefined,
        asaasAccountId: dbProduct.asaas_account_id || undefined,
        paymentProvider: dbProduct.payment_provider || "mercadopago",
        subscriptionCycle: dbProduct.subscription_cycle || undefined,
        installmentType: (dbProduct.installment_type as "buyer" | "seller") || "buyer",
      });

      setMpAccountId(dbProduct.mercado_pago_account_id);
      setAsaasAccountId(dbProduct.asaas_account_id);
      setLoading(false);
    };

    fetchProduct();
  }, [productId, navigate]);

  // Facebook Pixel Implementation
  useEffect(() => {
    if (!product || !product.facebookPixelId) return;

    // Load Pixel Script
    !function (f, b, e, v, n, t, s)
    // @ts-ignore
    {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ?
          n.callMethod.apply(n, arguments) : n.queue.push(arguments)
      };
      // @ts-ignore
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0];
      // @ts-ignore
      s.parentNode.insertBefore(t, s)
    }(window, document, 'script',
      'https://connect.facebook.net/en_US/fbevents.js');

    // Initialize Pixel
    // @ts-ignore
    window.fbq('init', product.facebookPixelId);

    // Track PageView
    // @ts-ignore
    window.fbq('track', 'PageView');

    // Track InitiateCheckout
    // @ts-ignore
    window.fbq('track', 'InitiateCheckout', {
      content_ids: [product.id],
      content_name: product.name,
      currency: 'BRL',
      value: product.price / 100,
      content_type: 'product'
    });

    console.log("Pixel Fired:", product.facebookPixelId, "InitiateCheckout");

  }, [product]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Produto não encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="py-6 border-b border-border">
        <div className="container max-w-md mx-auto px-4">
          <div className="flex items-center justify-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm"
              style={{
                background: `linear-gradient(135deg, hsl(${product.accentColor}) 0%, hsl(${product.buttonGradientEnd}) 100%)`
              }}
            >
              P
            </div>
            <span className="font-bold text-lg">Phoenix Pay</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-md mx-auto px-4 py-8 pb-32 md:pb-8">
        <CheckoutCard config={product} mercadoPagoAccountId={mpAccountId} asaasAccountId={asaasAccountId} />
      </main>

      {/* Mobile Sticky CTA */}
      <div className="phoenix-sticky-cta md:hidden">
        <p className="text-center text-sm text-muted-foreground">
          🔒 Ambiente 100% seguro
        </p>
      </div>
    </div>
  );
}
