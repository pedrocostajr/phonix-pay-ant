import { useState, useEffect } from "react";
import { Package, Plus, Trash2, Loader2, Edit2, Eye, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/constants";

interface MercadoPagoAccount {
  id: string;
  name: string;
}

interface Product {
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
  created_at: string;
  banner_url: string | null;
  bottom_banner_url: string | null;
  mercado_pago_account?: MercadoPagoAccount | null;
}

const COLOR_PRESETS = [
  { name: "Esmeralda", value: "142 76% 36%", gradient: "142 76% 28%" },
  { name: "Azul Royal", value: "217 91% 60%", gradient: "217 91% 50%" },
  { name: "Roxo Premium", value: "263 70% 50%", gradient: "263 70% 40%" },
  { name: "Laranja Energia", value: "25 95% 53%", gradient: "25 95% 43%" },
  { name: "Rosa Moderno", value: "340 82% 52%", gradient: "340 82% 42%" },
  { name: "Dourado", value: "45 93% 47%", gradient: "45 93% 37%" },
];

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [mpAccounts, setMpAccounts] = useState<MercadoPagoAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    original_price: "",
    pix_discount: "10",
    accent_color: "142 76% 36%",
    button_gradient_start: "142 76% 36%",
    button_gradient_end: "142 76% 28%",
    mercado_pago_account_id: "",
    banner_url: "",
    bottom_banner_url: "",
    is_active: true,
  });

  const fetchData = async () => {
    try {
      setLoading(true);

      const [productsRes, accountsRes] = await Promise.all([
        supabase
          .from("products")
          .select("*, mercado_pago_accounts(id, name)")
          .order("created_at", { ascending: false }),
        supabase
          .from("mercado_pago_accounts")
          .select("id, name")
          .order("name"),
      ]);

      if (productsRes.error) {
        console.error("Error fetching products:", productsRes.error);
        toast({
          title: "Erro ao carregar produtos",
          description: productsRes.error.message,
          variant: "destructive",
        });
      } else {
        setProducts(
          (productsRes.data || []).map((p) => ({
            ...p,
            mercado_pago_account: p.mercado_pago_accounts as MercadoPagoAccount | null,
          }))
        );
      }

      if (accountsRes.error) {
        console.error("Error fetching MP accounts:", accountsRes.error);
        toast({
          title: "Erro ao carregar contas MP",
          description: accountsRes.error.message,
          variant: "destructive",
        });
      } else {
        setMpAccounts(accountsRes.data || []);
      }
    } catch (error: any) {
      console.error("Critical error in fetchData:", error);
      toast({
        title: "Erro crítico",
        description: error.message || "Falha ao carregar dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      original_price: "",
      pix_discount: "10",
      accent_color: "142 76% 36%",
      button_gradient_start: "142 76% 36%",
      button_gradient_end: "142 76% 28%",
      mercado_pago_account_id: "",
      is_active: true,
    });
    setEditingProduct(null);
    setSaveError(null);
  };

  const openEditForm = (product: Product) => {
    setFormData({
      name: product.name,
      description: product.description || "",
      price: String(product.price / 100),
      original_price: product.original_price ? String(product.original_price / 100) : "",
      pix_discount: String(product.pix_discount),
      accent_color: product.accent_color,
      button_gradient_start: product.button_gradient_start,
      button_gradient_end: product.button_gradient_end,
      mercado_pago_account_id: product.mercado_pago_account_id || "",
      banner_url: product.banner_url || "",
      bottom_banner_url: product.bottom_banner_url || "",
      is_active: product.is_active,
    });
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleColorSelect = (preset: typeof COLOR_PRESETS[0]) => {
    setFormData({
      ...formData,
      accent_color: preset.value,
      button_gradient_start: preset.value,
      button_gradient_end: preset.gradient,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    const safeToast = (title: string, description: string, variant: "default" | "destructive" = "default") => {
      try {
        toast({ title, description, variant });
      } catch (e) {
        console.error("Toast failed:", e);
      }
    };

    if (!formData.name.trim() || !formData.price) {
      safeToast("Erro", "Preencha o nome e o preço", "destructive");
      setSaveError("Preencha o nome e o preço");
      return;
    }

    setSaving(true);
    console.log("Starting product save (aggressive debug)...", formData);

    try {
      const price = parseFloat(formData.price.replace(",", "."));
      const originalPrice = formData.original_price ? parseFloat(formData.original_price.replace(",", ".")) : null;

      if (isNaN(price)) {
        throw new Error("Preço inválido");
      }

      // Proper handling of foreign key
      const mercadoPagoAccountId = formData.mercado_pago_account_id && formData.mercado_pago_account_id !== ""
        ? formData.mercado_pago_account_id
        : null;

      const productData = {
        name: formData.name?.trim() ?? "",
        description: formData.description?.trim() || null,
        price: Math.round(price * 100),
        original_price: originalPrice
          ? Math.round(originalPrice * 100)
          : null,
        pix_discount: parseInt(formData.pix_discount) || 10,
        accent_color: formData.accent_color,
        button_gradient_start: formData.button_gradient_start,
        button_gradient_end: formData.button_gradient_end,
        mercado_pago_account_id: mercadoPagoAccountId,
        banner_url: formData.banner_url?.trim() || null,
        bottom_banner_url: formData.bottom_banner_url?.trim() || null,
        is_active: formData.is_active,
      };

      console.log("Reduced data payload:", productData);

      let error;

      // Timeout promise - Reduced to 5 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Time out: O banco de dados demorou muito para responder (5s).")), 5000);
      });

      const dbPromise = (async () => {
        if (editingProduct) {
          console.log("Updating existing product:", editingProduct.id);
          const result = await supabase
            .from("products")
            .update(productData)
            .eq("id", editingProduct.id);
          return result.error;
        } else {
          console.log("Creating new product");
          const result = await supabase.from("products").insert(productData);
          return result.error;
        }
      })();

      // Race against timeout
      console.log("Starting race...");
      error = await Promise.race([dbPromise, timeoutPromise]);
      console.log("Race finished. Error:", error);

      if (error) {
        console.error("Database error details:", error);
        // @ts-ignore
        throw error;
      }

      console.log("Product save successful!");

      safeToast(
        editingProduct ? "Produto atualizado!" : "Produto criado!",
        `${formData.name} foi ${editingProduct ? "atualizado" : "adicionado"} com sucesso`
      );

      resetForm();
      setShowForm(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving product (caught):", error);
      const errorMessage = error.message || "Erro desconhecido ao salvar produto";
      setSaveError(errorMessage);
      safeToast("Erro ao salvar", errorMessage, "destructive");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Excluir o produto "${product.name}"?`)) return;

    const { error } = await supabase.from("products").delete().eq("id", product.id);

    if (error) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Produto excluído",
      description: `${product.name} foi removido`,
    });

    fetchData();
  };

  const toggleActive = async (product: Product) => {
    const { error } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);

    if (error) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    fetchData();
  };

  const copyCheckoutLink = (productId: string) => {
    const url = `${window.location.origin}/checkout/${productId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copiado!",
      description: "Link do checkout copiado para a área de transferência",
    });
  };

  if (loading) {
    return (
      <div className="admin-card flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">Produtos</h2>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Novo Produto
        </button>
      </div>

      {/* Product Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="admin-card space-y-4">
          <h3 className="font-semibold">
            {editingProduct ? "Editar Produto" : "Novo Produto"}
          </h3>

          {saveError && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm font-medium border border-destructive/20">
              Erro: {saveError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nome</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do produto"
                className="admin-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Descrição</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição breve"
                className="admin-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              URL do Banner (opcional)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={formData.banner_url}
                onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                placeholder="https://... (Link direto da imagem: .png, .jpg)"
                className="admin-input flex-1"
              />
              {formData.banner_url && (
                <div className="w-10 h-10 rounded border border-border overflow-hidden bg-secondary">
                  <img
                    src={formData.banner_url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cole o link direto da imagem gerada no Canva ou hospedada online.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              URL do Banner Inferior (opcional)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={formData.bottom_banner_url}
                onChange={(e) => setFormData({ ...formData, bottom_banner_url: e.target.value })}
                placeholder="https://... (Link direto da imagem)"
                className="admin-input flex-1"
              />
              {formData.bottom_banner_url && (
                <div className="w-10 h-10 rounded border border-border overflow-hidden bg-secondary">
                  <img
                    src={formData.bottom_banner_url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Banner exibido ao final do checkout.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Preço (R$)</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="97.00"
                className="admin-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Preço Original</label>
              <input
                type="number"
                step="0.01"
                value={formData.original_price}
                onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                placeholder="297.00"
                className="admin-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Desconto PIX (%)</label>
              <input
                type="number"
                value={formData.pix_discount}
                onChange={(e) => setFormData({ ...formData, pix_discount: e.target.value })}
                placeholder="10"
                className="admin-input"
                min="0"
                max="50"
              />
            </div>
          </div>

          {/* Mercado Pago Account Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Conta Mercado Pago
            </label>
            <select
              value={formData.mercado_pago_account_id}
              onChange={(e) =>
                setFormData({ ...formData, mercado_pago_account_id: e.target.value })
              }
              className="admin-input cursor-pointer"
            >
              <option value="">Selecione uma conta</option>
              {mpAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
            {mpAccounts.length === 0 && (
              <p className="text-xs text-destructive mt-1">
                Adicione uma conta Mercado Pago primeiro
              </p>
            )}
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Cor do Checkout</label>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleColorSelect(preset)}
                  className={`p-2 rounded-lg border-2 transition-all ${formData.accent_color === preset.value
                    ? "border-primary"
                    : "border-transparent hover:border-border"
                    }`}
                >
                  <div
                    className="w-full h-6 rounded"
                    style={{
                      background: `linear-gradient(135deg, hsl(${preset.value}) 0%, hsl(${preset.gradient}) 100%)`,
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-secondary rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
            </label>
            <span className="text-sm font-medium">Produto ativo</span>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="phoenix-btn phoenix-btn-primary flex items-center gap-2 !py-3"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando (v2)...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {editingProduct ? "Atualizar" : "Criar Produto"}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="px-4 py-2 rounded-xl bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Products List */}
      <div className="admin-card">
        {products.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum produto criado ainda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className={`flex items-center justify-between p-4 rounded-xl bg-secondary/50 ${!product.is_active ? "opacity-60" : ""
                  }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-10 h-10 rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, hsl(${product.accent_color}) 0%, hsl(${product.button_gradient_end}) 100%)`,
                    }}
                  />
                  <div className="flex-1">
                    <p className="font-medium flex items-center gap-2">
                      {product.name}
                      {!product.is_active && (
                        <span className="text-xs bg-secondary px-2 py-0.5 rounded">
                          Inativo
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {formatBRL(product.price)}
                      </span>
                      {product.mercado_pago_account && (
                        <>
                          <span>•</span>
                          <span>{product.mercado_pago_account.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyCheckoutLink(product.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title="Copiar link do checkout"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleActive(product)}
                    className={`p-2 rounded-lg transition-colors ${product.is_active
                      ? "text-primary hover:bg-primary/10"
                      : "text-muted-foreground hover:bg-secondary"
                      }`}
                    title={product.is_active ? "Desativar" : "Ativar"}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditForm(product)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(product)}
                    className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div >
  );
}
