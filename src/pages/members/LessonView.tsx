import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
    ArrowLeft,
    Loader2,
    MessageCircle,
    Download,
    CheckCircle2,
    ChevronRight,
    Play,
    FileText
} from "lucide-react";

interface Lesson {
    id: string;
    name: string;
    description: string | null;
    video_url: string | null;
    module_id: string;
    order: number;
}

interface Module {
    id: string;
    name: string;
    lessons: Lesson[];
}

interface Material {
    id: string;
    name: string;
    file_url: string;
}

export default function LessonView() {
    const { lessonId } = useParams();
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [module, setModule] = useState<Module | null>(null);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) navigate("/login");
    }, [user, authLoading, navigate]);

    useEffect(() => {
        const fetchLessonData = async () => {
            if (!lessonId) return;
            setLoading(true);

            const [lessonRes, materialsRes] = await Promise.all([
                supabase
                    .from("course_lessons")
                    .select(`
            *,
            course_modules (
              id,
              name,
              course_lessons (*)
            )
          `)
                    .eq("id", lessonId)
                    .single(),
                supabase
                    .from("lesson_materials")
                    .select("*")
                    .eq("lesson_id", lessonId)
            ]);

            if (lessonRes.error) {
                console.error("Error fetching lesson:", lessonRes.error);
                setLoading(false);
                return;
            }

            const lessonData = lessonRes.data as any;
            setLesson({
                id: lessonData.id,
                name: lessonData.name,
                description: lessonData.description,
                video_url: lessonData.video_url,
                module_id: lessonData.module_id,
                order: lessonData.order
            });

            const moduleData = lessonData.course_modules;
            setModule({
                id: moduleData.id,
                name: moduleData.name,
                lessons: (moduleData.course_lessons || []).sort((a: any, b: any) => a.order - b.order)
            });

            if (!materialsRes.error) {
                setMaterials(materialsRes.data || []);
            }

            setLoading(false);
        };

        if (user && lessonId) fetchLessonData();
    }, [user, lessonId]);

    const getYouTubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const videoId = lesson?.video_url ? getYouTubeId(lesson.video_url) : null;

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!lesson) {
        return (
            <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
                <h2 className="text-xl font-bold mb-4">Aula não encontrada</h2>
                <Link to="/members" className="text-primary hover:underline">Voltar ao painel</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-white pb-20 font-sans">
            {/* Top Bar */}
            <div className="sticky top-0 z-50 bg-neutral-950/80 backdrop-blur-md border-b border-white/5">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <Link to="/members" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium">Painel</span>
                    </Link>
                    <div className="text-sm font-medium truncate max-w-[200px] sm:max-w-none text-neutral-300">
                        {module?.name} <span className="text-neutral-600 mx-2">/</span> <span className="text-white">{lesson.name}</span>
                    </div>
                    <a
                        href="https://wa.me/5554996895454"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors border border-primary/20"
                    >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Suporte
                    </a>
                </div>
            </div>

            <main className="container mx-auto px-4 pt-8 lg:pt-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Player Area */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="relative aspect-video bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl shadow-black/50 border border-white/5">
                            {videoId ? (
                                <iframe
                                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
                                    title={lesson.name}
                                    className="absolute inset-0 w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                ></iframe>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 p-8 text-center">
                                    <Play className="w-12 h-12 mb-4 opacity-10" />
                                    <p className="text-sm font-medium">Contéudo de vídeo não disponível.</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <h1 className="text-2xl md:text-3xl font-black tracking-tight">{lesson.name}</h1>
                                <button className="flex items-center gap-2 px-6 py-2.5 bg-primary rounded-xl font-black text-sm hover:opacity-90 transition-opacity">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Concluir Aula
                                </button>
                            </div>

                            <div className="bg-neutral-900/50 rounded-3xl p-8 border border-white/5 backdrop-blur-sm">
                                <h2 className="text-xs font-black text-primary uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    Sobre esta aula
                                </h2>
                                <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap text-base">
                                    {lesson.description || "Nenhuma descrição disponível."}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-neutral-900 rounded-3xl border border-white/5 overflow-hidden">
                            <div className="p-6 border-b border-white/5 bg-gradient-to-r from-neutral-900 to-neutral-800">
                                <h3 className="font-black text-lg">Conteúdo</h3>
                                <p className="text-xs text-neutral-500 mt-1 uppercase tracking-wider">{module?.name}</p>
                            </div>
                            <div className="p-2 space-y-1 bg-neutral-900/40">
                                {module?.lessons.map((l, index) => {
                                    const isCurrent = l.id === lessonId;
                                    return (
                                        <Link
                                            key={l.id}
                                            to={`/members/lesson/${l.id}`}
                                            className={`flex items-center gap-4 p-4 rounded-2xl transition-all group ${isCurrent
                                                    ? "bg-primary/10 border border-primary/20"
                                                    : "hover:bg-white/5"
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${isCurrent ? "bg-primary text-white" : "bg-neutral-800 text-neutral-500"
                                                }`}>
                                                {index + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold truncate ${isCurrent ? "text-white" : "text-neutral-400 group-hover:text-white"}`}>
                                                    {l.name}
                                                </p>
                                            </div>
                                            <ChevronRight className={`w-4 h-4 ${isCurrent ? "text-primary" : "text-neutral-600"}`} />
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        {materials.length > 0 && (
                            <div className="bg-gradient-to-br from-primary/10 to-blue-600/5 rounded-3xl p-6 border border-primary/20 space-y-4">
                                <h3 className="font-black flex items-center gap-2 text-sm uppercase tracking-widest">
                                    <Download className="w-4 h-4 text-primary" />
                                    Materiais
                                </h3>
                                <div className="space-y-2">
                                    {materials.map(m => (
                                        <a
                                            key={m.id}
                                            href={m.file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full flex items-center justify-between p-3 bg-black/40 rounded-xl hover:bg-black/60 transition-colors text-sm font-medium border border-white/5 group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <FileText className="w-4 h-4 text-neutral-500 group-hover:text-primary transition-colors" />
                                                <span className="truncate max-w-[150px]">{m.name}</span>
                                            </div>
                                            <Download className="w-3.5 h-3.5 text-neutral-600" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
