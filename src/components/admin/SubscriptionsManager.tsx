
import { useState, useEffect } from "react";
import { Loader2, Search, Calendar, AlertTriangle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Subscription {
    id: string;
    payer_name: string;
    payer_email: string;
    amount: number;
    paid_at: string;
    expires_at: string;
    product_id: string;
    products: {
        name: string;
        success_url?: string; // We use this or base URL for renewal link? Ideally we point to product checkout
    };
}

export function SubscriptionsManager() {
    const [loading, setLoading] = useState(true);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    const fetchSubscriptions = async () => {
        try {
            setLoading(true);
            // Fetch payments with expires_at set (Annual/Recurring)
            // Status should be approved
            const { data, error } = await supabase
                .from("payments")
                .select(`
          id,
          payer_name,
          payer_email,
          amount,
          paid_at,
          expires_at,
          product_id,
          products (
            name
          )
        `)
                .not("expires_at", "is", null)
                .eq("status", "approved")
                .order("expires_at", { ascending: true }); // Expiring soonest first

            if (error) throw error;
            setSubscriptions((data || []) as unknown as Subscription[]);
        } catch (error) {
            console.error("Error fetching subscriptions:", error);
        } finally {
            setLoading(false);
        }
    };

    const getDaysUntilExpiration = (expiresAt: string) => {
        const today = new Date();
        const expiration = new Date(expiresAt);
        const diffTime = expiration.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const filteredSubscriptions = subscriptions.filter(
        (sub) =>
            sub.payer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sub.payer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sub.products?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getWhatsAppLink = (sub: any) => {
        try {
            const checkoutLink = `${window.location.origin}/checkout/${sub.product_id}`;

            // Safe access to product name - handle Array or Object response from Supabase
            let productName = "Produto";
            if (Array.isArray(sub.products) && sub.products.length > 0) {
                productName = sub.products[0]?.name || "Produto";
            } else if (sub.products && typeof sub.products === 'object') {
                productName = (sub.products as any).name || "Produto";
            }

            let dateStr = "";
            try {
                if (sub.expires_at) {
                    dateStr = format(new Date(sub.expires_at), "dd/MM/yyyy");
                } else {
                    dateStr = "Data Indisponível";
                }
            } catch (e) {
                dateStr = "Data Inválida";
            }

            const message = `Olá ${sub.payer_name || "Cliente"}, sua assinatura do pacote ${productName} vence em ${dateStr}. Renove agora e garanta a continuidade do seu acesso: ${checkoutLink}`;

            return `https://wa.me/?text=${encodeURIComponent(message)}`;
        } catch (e) {
            console.error("Error generating link", e);
            return "#";
        }
    };

    return (
        <div className="space-y-6 animate-fade-up">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Gerenciar Assinaturas</h2>
                    <p className="text-muted-foreground">
                        Acompanhe vencimentos e renovações de planos anuais
                    </p>
                </div>
            </div>

            <div className="phoenix-card p-4">
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome, e-mail ou produto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : filteredSubscriptions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhuma assinatura encontrada</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border/50 text-left text-sm text-muted-foreground">
                                    <th className="pb-3 pl-4">Cliente</th>
                                    <th className="pb-3">Produto</th>
                                    <th className="pb-3">Expira em</th>
                                    <th className="pb-3">Status</th>
                                    <th className="pb-3 pr-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filteredSubscriptions.map((sub) => {
                                    // Safe date calculation
                                    let daysLeft = 0;
                                    let isExpiring = false;
                                    let isExpired = false;
                                    let dateDisplay = "Data inválida";

                                    try {
                                        if (sub.expires_at) {
                                            daysLeft = getDaysUntilExpiration(sub.expires_at);
                                            isExpiring = daysLeft <= 30;
                                            isExpired = daysLeft < 0;
                                            dateDisplay = format(new Date(sub.expires_at), "dd/MM/yyyy");
                                        }
                                    } catch (e) {
                                        console.error("Date error", e);
                                    }

                                    // Handle product name safely for display
                                    let displayProductName = "Produto";
                                    if (Array.isArray(sub.products) && sub.products.length > 0) {
                                        displayProductName = sub.products[0]?.name;
                                    } else if (sub.products && typeof sub.products === 'object') {
                                        displayProductName = (sub.products as any).name;
                                    }

                                    return (
                                        <tr key={sub.id || Math.random()} className="group hover:bg-secondary/20 transition-colors">
                                            <td className="py-4 pl-4">
                                                <div className="font-medium">{sub.payer_name || "Sem Nome"}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {sub.payer_email || ""}
                                                </div>
                                            </td>
                                            <td className="py-4 text-sm">{displayProductName || "Sem produto"}</td>
                                            <td className="py-4 text-sm">
                                                <div className="flex flex-col">
                                                    <span>{dateDisplay}</span>
                                                    <span className={`text-xs ${isExpired ? "text-red-500" : isExpiring ? "text-amber-500" : "text-muted-foreground"}`}>
                                                        {isExpired ? "Expirado" : `${daysLeft} dias restantes`}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                {isExpired ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
                                                        expirado
                                                    </span>
                                                ) : isExpiring ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        Renovar
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                                                        Ativo
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 pr-4 text-right">
                                                {(isExpiring || isExpired) && (
                                                    <a
                                                        href={getWhatsAppLink(sub)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-colors"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                        Cobrar no WhatsApp
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
