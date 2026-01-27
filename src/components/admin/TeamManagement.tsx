import { useState, useEffect } from "react";
import { Users, Plus, Trash2, Loader2, UserPlus, Shield, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { AppRole } from "@/hooks/useAuth";

interface TeamMember {
  id: string;
  user_id: string;
  role: AppRole;
  email: string;
  full_name: string | null;
}

interface TeamManagementProps {
  isAdmin: boolean;
}

export function TeamManagement({ isAdmin }: TeamManagementProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("member");

  const fetchMembers = async () => {
    setLoading(true);
    
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("id, user_id, role");

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
      setLoading(false);
      return;
    }

    if (!rolesData || rolesData.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    // Fetch profiles for each role
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", rolesData.map(r => r.user_id));

    const membersWithProfiles = rolesData.map(role => {
      const profile = profilesData?.find(p => p.user_id === role.user_id);
      return {
        id: role.id,
        user_id: role.user_id,
        role: role.role as AppRole,
        email: profile?.email || "Email não encontrado",
        full_name: profile?.full_name || null,
      };
    });

    setMembers(membersWithProfiles);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail || !newPassword) {
      toast({
        title: "Erro",
        description: "Preencha email e senha",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);

    try {
      // Use edge function to create user (avoids auth session issues)
      const { data, error: fnError } = await supabase.functions.invoke("create-team-member", {
        body: {
          email: newEmail,
          password: newPassword,
          fullName: newName || undefined,
          role: newRole,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Membro adicionado!",
        description: `${newEmail} foi adicionado à equipe`,
      });

      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewRole("member");
      setShowAddForm(false);
      fetchMembers();
    } catch (err) {
      console.error("Error creating team member:", err);
      toast({
        title: "Erro ao criar usuário",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (!confirm(`Remover ${member.email} da equipe?`)) return;

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", member.id);

    if (error) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Membro removido",
      description: `${member.email} foi removido da equipe`,
    });

    fetchMembers();
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
          <Users className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">Equipe</h2>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <UserPlus className="w-4 h-4" />
            Adicionar Membro
          </button>
        )}
      </div>

      {/* Add Member Form */}
      {showAddForm && isAdmin && (
        <form onSubmit={handleAddMember} className="admin-card space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="admin-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Senha</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="admin-input"
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nome (opcional)</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome completo"
                className="admin-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Permissão</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as AppRole)}
                className="admin-input cursor-pointer"
              >
                <option value="member">Membro</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
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
                  Adicionar
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

      {/* Members List */}
      <div className="admin-card">
        {members.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum membro na equipe ainda
          </p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 rounded-xl bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    {member.role === "admin" ? (
                      <ShieldCheck className="w-5 h-5 text-primary" />
                    ) : (
                      <Shield className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {member.full_name || member.email}
                    </p>
                    {member.full_name && (
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    member.role === "admin" 
                      ? "bg-primary/20 text-primary" 
                      : "bg-secondary text-muted-foreground"
                  }`}>
                    {member.role === "admin" ? "Admin" : "Membro"}
                  </span>

                  {isAdmin && (
                    <button
                      onClick={() => handleRemoveMember(member)}
                      className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
