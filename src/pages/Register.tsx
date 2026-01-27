import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { UserPlus, Loader2, Eye, EyeOff, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export default function Register() {
    const navigate = useNavigate();
    const { signUp } = useAuth();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim() || !email.trim() || !password.trim()) {
            toast({
                title: "Erro",
                description: "Preencha todos os campos",
                variant: "destructive",
            });
            return;
        }

        if (password.length < 6) {
            toast({
                title: "Erro",
                description: "A senha deve ter pelo menos 6 caracteres",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);

        const { error } = await signUp(email, password, name);

        setLoading(false);

        if (error) {
            toast({
                title: "Erro ao cadastrar",
                description: error.message,
                variant: "destructive",
            });
            return;
        }

        toast({
            title: "Conta criada!",
            description: "Verifique seu e-mail para confirmar o cadastro",
        });

        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4" data-theme="admin">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto mb-4">
                        <span className="font-black text-white text-2xl">P</span>
                    </div>
                    <h1 className="text-2xl font-bold">Phoenix Pay</h1>
                    <p className="text-muted-foreground mt-2">Crie sua conta</p>
                </div>

                {/* Register Form */}
                <form onSubmit={handleSubmit} className="admin-card space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Nome Completo</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Seu nome"
                                className="admin-input pl-10"
                                autoComplete="name"
                                disabled={loading}
                            />
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            className="admin-input"
                            autoComplete="email"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Senha</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="admin-input pr-12"
                                autoComplete="new-password"
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="phoenix-btn phoenix-btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Criando conta...
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-5 h-5" />
                                Criar Conta
                            </>
                        )}
                    </button>
                </form>

                <p className="text-center text-sm text-muted-foreground mt-6">
                    Já tem uma conta?{" "}
                    <Link to="/login" className="text-primary hover:underline">
                        Entrar
                    </Link>
                </p>
            </div>
        </div>
    );
}
