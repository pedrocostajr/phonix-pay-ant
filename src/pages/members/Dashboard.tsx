import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
    Play,
    BookOpen,
    Loader2,
    LogOut,
    ChevronRight,
    ChevronLeft
} from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { ThumbnailRenderer } from "@/components/ThumbnailRenderer";

interface Lesson {
    id: string;
    name: string;
    module_id: string;
    thumbnail_url?: string | null;
    order: number;
}

interface Module {
    id: string;
    name: string;
    product_id: string;
    thumbnail_url?: string | null;
    order: number;
    lessons: Lesson[];
}

interface Product {
    id: string;
    name: string;
    accent_color: string;
    thumbnail_url?: string | null;
    modules: Module[];
}

export default function MembersDashboard() {
    const { user, loading: authLoading, signOut } = useAuth();
    const navigate = useNavigate();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate("/login");
        }
    }, [user, authLoading, navigate]);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;

            // 1. Fetch modules (RLS will filter by purchase)
            const { data: modulesData, error: modulesError } = await supabase
                .from("course_modules")
                .select(`
          *,
          products (id, name, accent_color, thumbnail_url),
          course_lessons (id, name, description, video_url, thumbnail_url, "order")
        `)
                .order("order");

            if (modulesError) {
                console.error("Error fetching modules:", modulesError);
                setLoading(false);
                return;
            }

            // Group by product
            const productsMap: Record<string, Product> = {};

            (modulesData || []).forEach((m: any) => {
                const prod = m.products;
                if (!productsMap[prod.id]) {
                    productsMap[prod.id] = {
                        id: prod.id,
                        name: prod.name,
                        accent_color: prod.accent_color,
                        thumbnail_url: prod.thumbnail_url,
                        modules: []
                    };
                }

                productsMap[prod.id].modules.push({
                    id: m.id,
                    name: m.name,
                    product_id: m.product_id,
                    thumbnail_url: m.thumbnail_url,
                    order: m.order,
                    lessons: (m.course_lessons || []).sort((a: any, b: any) => a.order - b.order)
                });
            });

            setProducts(Object.values(productsMap));
            setLoading(false);
        };

        if (user) fetchData();
    }, [user]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-primary/30">
            {/* Header */}
            <header className="fixed top-0 z-50 w-full bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
                <div className="container mx-auto px-4 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center font-black text-white text-xl">
                            P
                        </div>
                        <span className="font-black text-xl tracking-tight hidden sm:block">PHOENIX <span className="text-primary">MEMBERS</span></span>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end hidden md:flex">
                            <span className="text-xs text-neutral-400">Bem-vindo</span>
                            <span className="text-sm font-bold truncate max-w-[150px]">{user?.email}</span>
                        </div>
                        <button
                            onClick={() => signOut()}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative h-[70vh] w-full flex items-end pb-20 overflow-hidden">
                {/* Abstract Background Gradient */}
                <div className="absolute inset-0 bg-neutral-900">
                    <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/10 blur-[100px] rounded-full" />
                </div>

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />

                <div className="container mx-auto px-4 relative z-10 animate-fade-up">
                    <span className="inline-block px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold mb-4 border border-primary/30 uppercase tracking-widest">
                        Acesso Liberado
                    </span>
                    <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter">
                        Sua <span className="text-primary">Evolução</span> <br className="hidden md:block" /> Começa Agora.
                    </h1>
                    <p className="text-neutral-400 text-lg md:text-xl max-w-2xl mb-8 leading-relaxed">
                        Acesse todos os seus conteúdos exclusivos em um só lugar. Navegue pelos módulos abaixo e continue seu aprendizado de onde parou.
                    </p>
                    <div className="flex flex-wrap gap-4">
                        <button className="px-8 py-4 bg-white text-black rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-200 transition-colors">
                            <Play className="w-5 h-5 fill-current" />
                            Continuar Assistindo
                        </button>
                        <button className="px-8 py-4 bg-white/10 text-white border border-white/20 rounded-xl font-bold hover:bg-white/20 transition-colors">
                            Explorar Treinamentos
                        </button>
                    </div>
                </div>
            </section>

            {/* Rows */}
            <main className="container mx-auto px-4 -mt-10 pb-20 relative z-20 space-y-16">
                {products.length === 0 && (
                    <div className="text-center py-20 bg-neutral-900/50 rounded-3xl border border-white/5">
                        <BookOpen className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold">Nenhum treinamento encontrado</h3>
                        <p className="text-neutral-400 mt-2">Você ainda não possui acesso a produtos vinculados a este e-mail.</p>
                    </div>
                )}

                {products.map((product) => (
                    <div key={product.id} className="space-y-8">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                                    <span className="w-2 h-8 bg-primary rounded-full" />
                                    {product.name}
                                </h2>
                                <button className="text-sm font-bold text-neutral-400 hover:text-white flex items-center gap-1 transition-colors">
                                    Ver Tudo <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            {product.thumbnail_url && (
                                <div className="w-full h-48 md:h-64 rounded-3xl overflow-hidden border border-white/5 relative group">
                                    <ThumbnailRenderer
                                        content={product.thumbnail_url}
                                        alt={product.name}
                                        className="transition-transform duration-700 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                                </div>
                            )}
                        </div>

                        {product.modules.map((module) => (
                            <ModuleRow key={module.id} module={module} />
                        ))}
                    </div>
                ))}
            </main >

            <footer className="container mx-auto px-4 py-10 border-t border-white/5 flex justify-between items-center text-neutral-600 text-[10px] uppercase tracking-widest font-bold">
                <span>&copy; 2026 PHOENIX MEMBERS</span>
                <span>V2.0.1</span>
            </footer>
        </div >
    );
}

interface ModuleRowProps {
    module: Module;
    key?: string | number;
}

function ModuleRow({ module }: ModuleRowProps) {
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: 'start',
        containScroll: 'trimSnaps',
        dragFree: true
    });

    const scrollPrev = () => emblaApi && emblaApi.scrollPrev();
    const scrollNext = () => emblaApi && emblaApi.scrollNext();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h3 className="text-2xl font-black text-white flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-primary rounded-full" />
                        {module.name}
                    </h3>
                    {module.thumbnail_url && (
                        <div className="w-full rounded-2xl overflow-hidden border border-white/5 mb-4 max-h-[200px]">
                            <ThumbnailRenderer
                                content={module.thumbnail_url}
                                alt={module.name}
                                className="opacity-50"
                                isCover
                            />
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={scrollPrev}
                        className="w-8 h-8 rounded-full bg-neutral-900 border border-white/5 flex items-center justify-center hover:bg-neutral-800 transition-colors disabled:opacity-30"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={scrollNext}
                        className="w-8 h-8 rounded-full bg-neutral-900 border border-white/5 flex items-center justify-center hover:bg-neutral-800 transition-colors disabled:opacity-30"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex gap-4">
                    {module.lessons.map((lesson) => (
                        <div
                            key={lesson.id}
                            className="flex-[0_0_280px] sm:flex-[0_0_320px] min-w-0"
                        >
                            <Link
                                to={`/members/lesson/${lesson.id}`}
                                className="group block relative aspect-video bg-neutral-900 rounded-2xl overflow-hidden border border-white/5 hover:border-primary/50 transition-all active:scale-95"
                            >
                                {/* Thumbnail */}
                                <div className="absolute inset-0 bg-neutral-800">
                                    {lesson.thumbnail_url ? (
                                        <ThumbnailRenderer
                                            content={lesson.thumbnail_url}
                                            alt={lesson.name}
                                            className="transition-transform duration-500 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center">
                                            <Play className="w-10 h-10 text-white/10" />
                                        </div>
                                    )}
                                </div>

                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                                    <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center translate-y-2 group-hover:translate-y-0 transition-transform">
                                        <Play className="w-6 h-6 fill-current" />
                                    </div>
                                </div>

                                {/* Content Overlay */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/60 to-transparent">
                                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 block">Aula {lesson.order + 1}</span>
                                    <h4 className="font-bold text-sm truncate">{lesson.name}</h4>
                                </div>
                            </Link>
                        </div>
                    ))}
                    {module.lessons.length === 0 && (
                        <div className="w-full text-center py-10 text-neutral-500 text-sm italic">
                            Nenhuma aula disponível neste módulo.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
