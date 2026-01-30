import { useState, useEffect } from "react";
import { CreditCard, Plus, Trash2, Loader2, Eye, EyeOff, Edit2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface MercadoPagoAccount {
  id: string;
  name: string;
  public_key?: string;
  access_token: string;
  created_at: string;
}

export function MercadoPagoAccounts() {
  const [accounts, setAccounts] = useState<MercadoPagoAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPublicKey, setNewPublicKey] = useState("");
  const [newToken, setNewToken] = useState("");
  const [showToken, setShowToken] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fetchAccounts = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("mercado_pago_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching MP accounts:", error);
      toast({
        title: "Erro ao carregar contas",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setAccounts(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim() || !newToken.trim()) {
      toast({
        title: "Erro",
        description: "Preencha o nome e o token",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);

    const { error } = await supabase
      .from("mercado_pago_accounts")
      .insert({
        name: newName.trim(),
        public_key: newPublicKey.trim(),
        access_token: newToken.trim(),
      });

    if (error) {
      toast({
        title: "Erro ao adicionar conta",
        description: error.message,
        variant: "destructive",
      });
      setAdding(false);
      return;
    }

    toast({
      title: "Conta adicionada!",
      description: `${newName} foi configurada com sucesso`,
    });

    setNewName("");
    setNewPublicKey("");
    setNewToken("");
    setShowAddForm(false);
    setAdding(false);
    fetchAccounts();
  };

  const handleDeleteAccount = async (account: MercadoPagoAccount) => {
    if (!confirm(`Excluir a conta "${account.name}"?`)) return;

    const { error } = await supabase
      .from("mercado_pago_accounts")
      .delete()
      .eq("id", account.id);

    if (error) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Conta excluída",
      description: `${account.name} foi removida`,
    });

    fetchAccounts();
  };

  const handleUpdateName = async (account: MercadoPagoAccount) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }

    const { error } = await supabase
      .from("mercado_pago_accounts")
      .update({ name: editName.trim() })
      .eq("id", account.id);

    if (error) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setEditingId(null);
    fetchAccounts();
  };

  const maskToken = (token: string) => {
    if (token.length <= 8) return "****";
    return token.slice(0, 4) + "****" + token.slice(-4);
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
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">Contas Mercado Pago</h2>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Nova Conta
        </button>
      </div>

      {/* Add Account Form */}
      {showAddForm && (
        <form onSubmit={handleAddAccount} className="admin-card space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Nome da Conta
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="admin-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Public Key
            </label>
            <input
              type="text"
              value={newPublicKey}
              onChange={(e) => setNewPublicKey(e.target.value)}
              className="admin-input"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Obtenha em: Mercado Pago → Seu Negócio → Credenciais → Chave pública
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Access Token
            </label>
            <input
              type="password"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              className="admin-input"
              required
            />
            <p className="text-xs text-muted-foreground mt-2">
              Obtenha em: Mercado Pago → Seu Negócio → Credenciais → Access Token (Produção)
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={adding}
              className="phoenix-btn phoenix-btn-primary flex items-center gap-2 !py-3"
            >
              {adding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Adicionar Conta
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Accounts List */}
      <div className="admin-card">
        {accounts.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Nenhuma conta configurada ainda
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Adicione sua primeira conta Mercado Pago
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 rounded-xl bg-secondary/50"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-[#00A8E8]/20 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-[#00A8E8]" />
                  </div>
                  <div className="flex-1">
                    {editingId === account.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="admin-input !py-1 !px-2 text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateName(account)}
                          className="p-1 text-primary hover:bg-primary/10 rounded"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-muted-foreground hover:bg-secondary rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <p className="font-medium flex items-center gap-2">
                        {account.name}
                        <button
                          onClick={() => {
                            setEditingId(account.id);
                            setEditName(account.name);
                          }}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground font-mono">
                      {showToken === account.id
                        ? account.access_token
                        : maskToken(account.access_token)}
                    </p>
                    {account.public_key && (
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        PK: {account.public_key.substring(0, 8)}...
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowToken(showToken === account.id ? null : account.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    {showToken === account.id ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(account)}
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
    </div>
  );
}

