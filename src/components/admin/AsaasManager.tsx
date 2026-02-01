import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AsaasAccount {
    id: string;
    name: string;
    api_key: string;
    wallet_id: string | null;
    environment: string;
    created_at: string;
}

export function AsaasManager() {
    const [accounts, setAccounts] = useState<AsaasAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        api_key: "",
        wallet_id: "",
        environment: "sandbox",
    });

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("asaas_accounts")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setAccounts(data || []);
        } catch (error: any) {
            toast({
                title: "Erro ao carregar contas",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const { error } = await supabase
                .from("asaas_accounts")
                .insert({
                    name: formData.name,
                    api_key: formData.api_key,
                    wallet_id: formData.wallet_id || null,
                    environment: formData.environment,
                });

            if (error) throw error;

            toast({
                title: "Conta adicionada",
                description: "Conta Asaas vinculada com sucesso",
            });

            setFormData({ name: "", api_key: "", wallet_id: "", environment: "sandbox" });
            setShowForm(false);
            fetchAccounts();
        } catch (error: any) {
            toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja remover esta conta?")) return;

        try {
            const { error } = await supabase
                .from("asaas_accounts")
                .delete()
                .eq("id", id);

            if (error) throw error;

            toast({
                title: "Conta removida",
                description: "Conta Asaas removida com sucesso",
            });

            fetchAccounts();
        } catch (error: any) {
            toast({
                title: "Erro ao remover",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    if (loading) {
        return <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Building2 className="w-6 h-6 text-blue-600" />
                    <h2 className="font-bold text-xl">Contas Asaas</h2>
                </div>

                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nova Conta
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="admin-card space-y-4 animate-in fade-in slide-in-from-top-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Nome da Conta</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex: Minha Empresa (Asaas)"
                                className="admin-input"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">API Key</label>
                            <input
                                type="password"
                                value={formData.api_key}
                                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                                placeholder="$aact_..."
                                className="admin-input"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Ambiente</label>
                            <select
                                value={formData.environment}
                                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                                className="admin-input"
                            >
                                <option value="sandbox">Sandbox (Teste)</option>
                                <option value="production">Produção</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Wallet ID (Opcional)</label>
                            <input
                                type="text"
                                value={formData.wallet_id}
                                onChange={(e) => setFormData({ ...formData, wallet_id: e.target.value })}
                                placeholder="Para split de pagamento"
                                className="admin-input"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? "Salvando..." : "Salvar Conta"}
                        </button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((account) => (
                    <div key={account.id} className="admin-card relative group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">{account.name}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${account.environment === 'production'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {account.environment === 'production' ? 'Produção' : 'Sandbox'}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => handleDelete(account.id)}
                                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="text-xs text-muted-foreground break-all">
                            Key: {account.api_key.substring(0, 16)}...
                        </div>
                    </div>
                ))}

                {accounts.length === 0 && !showForm && (
                    <div className="col-span-full text-center py-12 text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border">
                        Nenhuma conta Asaas vinculada
                    </div>
                )}
            </div>
        </div>
    );
}
