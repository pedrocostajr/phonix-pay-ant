import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Users, CreditCard, Package, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TeamManagement } from "@/components/admin/TeamManagement";
import { MercadoPagoAccounts } from "@/components/admin/MercadoPagoAccounts";
import { ProductsManager } from "@/components/admin/ProductsManager";

type Tab = "products" | "mercadopago" | "team";

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading, isTeamMember, role, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("products");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
    if (!loading && user && !isTeamMember) {
      navigate("/");
    }
  }, [user, loading, isTeamMember, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-theme="admin">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isTeamMember) {
    return null;
  }

  const tabs = [
    { id: "products" as Tab, label: "Produtos", icon: Package },
    { id: "mercadopago" as Tab, label: "Mercado Pago", icon: CreditCard },
    { id: "team" as Tab, label: "Equipe", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background" data-theme="admin">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <span className="font-black text-white text-lg">P</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">Phoenix Pay</h1>
              <p className="text-xs text-muted-foreground">
                {role === "admin" ? "Administrador" : "Membro"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-foreground font-medium transition-all hover:bg-secondary/80"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "products" && <ProductsManager />}
        {activeTab === "mercadopago" && <MercadoPagoAccounts />}
        {activeTab === "team" && <TeamManagement isAdmin={role === "admin"} />}
      </div>
    </div>
  );
}
