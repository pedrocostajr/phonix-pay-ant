import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Mail, Lock, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function ClaimAccess() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [email, setEmail] = useState(searchParams.get("email") || "");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<"email" | "password">("email");

    const checkAccess = async () => {
        setLoading(true);
        try {
            // Check if any approved payment exists for this email
            const { data, error } = await supabase
                .from("payments")
                .select("id")
                .eq("payer_email", email.trim().toLowerCase())
                .eq("status", "approved")
                .limit(1);

            if (error) throw error;

            if (!data || data.length === 0) {
                toast({
                    title: "Acesso não encontrado",
                    description: "Não encontramos nenhuma compra aprovada para este e-mail.",
                    variant: "destructive",
                });
            } else {
                setStep("password");
            }
        } catch (error: any) {
            toast({
                title: "Erro ao verificar acesso",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email: email.trim().toLowerCase(),
                password,
            });

            if (error) throw error;

            toast({
                title: "Conta criada!",
                description: "Você já pode acessar a área de membros.",
            });
            navigate("/members");
        } catch (error: any) {
            toast({
                title: "Erro ao criar conta",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8 animate-fade-up">
                <div className="text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-black">Resgatar Acesso</h1>
                    <p className="text-muted-foreground mt-2">
                        Use o mesmo e-mail da sua compra para acessar o conteúdo.
                    </p>
                </div>

                <div className="phoenix-card phoenix-card-elevated p-6 space-y-4">
                    {step === "email" ? (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Seu E-mail</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="voce@exemplo.com"
                                        className="admin-input pl-10"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={checkAccess}
                                disabled={loading || !email}
                                className="phoenix-btn phoenix-btn-primary w-full flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verificar E-mail"}
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">E-mail verificado</label>
                                <div className="p-3 bg-secondary/50 rounded-lg text-sm font-medium">
                                    {email}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Crie uma Senha</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="admin-input pl-10"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleRegister}
                                disabled={loading || password.length < 6}
                                className="phoenix-btn phoenix-btn-primary w-full flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Acesso"}
                                <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setStep("email")}
                                className="text-xs text-muted-foreground w-full text-center hover:underline"
                            >
                                Voltar e trocar e-mail
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
