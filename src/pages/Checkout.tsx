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
  is_active: boolean;
}

export default function Checkout() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!!productId);
  const [product, setProduct] = useState<ProductConfig | null>(null);
  const [mpAccountId, setMpAccountId] = useState<string | null>(null);

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
      });

      setMpAccountId(dbProduct.mercado_pago_account_id);
      setLoading(false);
    };

    fetchProduct();
  }, [productId, navigate]);

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
        <CheckoutCard config={product} mercadoPagoAccountId={mpAccountId} />
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
