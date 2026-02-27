import { useState, useEffect } from "react";
import {
    BookOpen,
    Plus,
    Trash2,
    Loader2,
    Edit2,
    ChevronRight,
    ChevronDown,
    Video,
    FileText,
    X,
    Save,
    Download,
    ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ThumbnailRenderer } from "@/components/ThumbnailRenderer";

interface Product {
    id: string;
    name: string;
    thumbnail_url?: string | null;
}

interface Module {
    id: string;
    name: string;
    thumbnail_url?: string | null;
    order: number;
}

interface Lesson {
    id: string;
    module_id: string;
    name: string;
    description: string | null;
    video_url: string | null;
    thumbnail_url?: string | null;
    order: number;
}

interface Material {
    id: string;
    lesson_id: string;
    name: string;
    file_url: string;
}

export function MembersAreaManager() {
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [modules, setModules] = useState<Module[]>([]);
    const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
    const [loading, setLoading] = useState(true);
    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

    // Module Editor State
    const [editingModule, setEditingModule] = useState<Module | null>(null);
    const [isSavingModule, setIsSavingModule] = useState(false);

    // Lesson Editor State
    const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
    const [lessonMaterials, setLessonMaterials] = useState<Material[]>([]);
    const [isSavingLesson, setIsSavingLesson] = useState(false);

    const fetchProducts = async () => {
        const { data, error } = await supabase
            .from("products")
            .select("id, name, thumbnail_url")
            .order("name");
        if (error) {
            toast({ title: "Erro ao buscar produtos", description: error.message, variant: "destructive" });
        } else {
            setProducts(data || []);
            if (data && data.length > 0 && !selectedProductId) {
                setSelectedProductId(data[0].id);
            }
        }
    };

    const fetchModulesAndLessons = async (productId: string) => {
        setLoading(true);
        const { data: modulesData, error: modulesError } = await supabase
            .from("course_modules")
            .select("*")
            .eq("product_id", productId)
            .order("order");

        if (modulesError) {
            toast({ title: "Erro ao buscar módulos", description: modulesError.message, variant: "destructive" });
            setLoading(false);
            return;
        }

        setModules(modulesData || []);

        const { data: lessonsData, error: lessonsError } = await supabase
            .from("course_lessons")
            .select("*")
            .in("module_id", (modulesData || []).map(m => m.id))
            .order("order");

        if (lessonsError) {
            toast({ title: "Erro ao buscar aulas", description: lessonsError.message, variant: "destructive" });
        } else {
            const lessonsMap: Record<string, Lesson[]> = {};
            (lessonsData || []).forEach(lesson => {
                if (!lessonsMap[lesson.module_id]) lessonsMap[lesson.module_id] = [];
                lessonsMap[lesson.module_id].push(lesson);
            });
            setLessons(lessonsMap);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        if (selectedProductId) {
            fetchModulesAndLessons(selectedProductId);
        }
    }, [selectedProductId]);

    const toggleModule = (moduleId: string) => {
        const newExpanded = new Set(expandedModules);
        if (newExpanded.has(moduleId)) {
            newExpanded.delete(moduleId);
        } else {
            newExpanded.add(moduleId);
        }
        setExpandedModules(newExpanded);
    };

    const addModule = async () => {
        if (!selectedProductId) return;
        const name = prompt("Nome do Módulo:");
        if (!name) return;

        const { error } = await supabase
            .from("course_modules")
            .insert({
                product_id: selectedProductId,
                name,
                order: modules.length
            });

        if (error) {
            toast({ title: "Erro ao criar módulo", description: error.message, variant: "destructive" });
        } else {
            fetchModulesAndLessons(selectedProductId);
        }
    };

    const openModuleEditor = (module: Module) => {
        setEditingModule(module);
    };

    const saveModule = async () => {
        if (!editingModule || !selectedProductId) return;
        setIsSavingModule(true);
        const { error } = await supabase
            .from("course_modules")
            .update({
                name: editingModule.name,
                thumbnail_url: editingModule.thumbnail_url
            })
            .eq("id", editingModule.id);

        if (error) {
            toast({ title: "Erro ao salvar módulo", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Módulo salvo com sucesso" });
            setEditingModule(null);
            fetchModulesAndLessons(selectedProductId);
        }
        setIsSavingModule(false);
    };

    const addLesson = async (moduleId: string) => {
        const name = prompt("Nome da Aula:");
        if (!name) return;

        const { error } = await supabase
            .from("course_lessons")
            .insert({
                module_id: moduleId,
                name,
                order: (lessons[moduleId]?.length || 0)
            });

        if (error) {
            toast({ title: "Erro ao criar aula", description: error.message, variant: "destructive" });
        } else {
            if (selectedProductId) fetchModulesAndLessons(selectedProductId);
        }
    };

    const openLessonEditor = async (lesson: Lesson) => {
        setEditingLesson(lesson);
        const { data, error } = await supabase
            .from("lesson_materials")
            .select("*")
            .eq("lesson_id", lesson.id);
        if (!error) setLessonMaterials(data || []);
    };

    const saveLesson = async () => {
        if (!editingLesson) return;
        setIsSavingLesson(true);
        const { error } = await supabase
            .from("course_lessons")
            .update({
                name: editingLesson.name,
                description: editingLesson.description,
                video_url: editingLesson.video_url,
                thumbnail_url: editingLesson.thumbnail_url
            })
            .eq("id", editingLesson.id);

        if (error) {
            toast({ title: "Erro ao salvar aula", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Aula salva com sucesso" });
            setEditingLesson(null);
            if (selectedProductId) fetchModulesAndLessons(selectedProductId);
        }
        setIsSavingLesson(false);
    };

    const addMaterial = async () => {
        if (!editingLesson) return;
        const name = prompt("Nome do Material (ex: PDF da Aula):");
        const url = prompt("Link do arquivo (Google Drive, Dropbox, ou link direto):");
        if (!name || !url) return;

        const { data, error } = await supabase
            .from("lesson_materials")
            .insert({
                lesson_id: editingLesson.id,
                name,
                file_url: url
            })
            .select()
            .single();

        if (error) {
            toast({ title: "Erro ao adicionar material", description: error.message, variant: "destructive" });
        } else {
            setLessonMaterials([...lessonMaterials, data]);
        }
    };

    const deleteMaterial = async (id: string) => {
        const { error } = await supabase.from("lesson_materials").delete().eq("id", id);
        if (!error) setLessonMaterials(lessonMaterials.filter(m => m.id !== id));
    };

    const deleteModule = async (moduleId: string) => {
        if (!confirm("Excluir este módulo e todas as suas aulas?")) return;
        const { error } = await supabase.from("course_modules").delete().eq("id", moduleId);
        if (error) toast({ title: "Erro ao excluir", variant: "destructive" });
        else if (selectedProductId) fetchModulesAndLessons(selectedProductId);
    };

    const deleteLesson = async (lessonId: string) => {
        if (!confirm("Excluir esta aula?")) return;
        const { error } = await supabase.from("course_lessons").delete().eq("id", lessonId);
        if (error) toast({ title: "Erro ao excluir", variant: "destructive" });
        else if (selectedProductId) fetchModulesAndLessons(selectedProductId);
    };

    if (loading && products.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    <h2 className="font-bold text-lg">Gerenciar Conteúdo</h2>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Produto Selecionado</label>
                        <select
                            value={selectedProductId || ""}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            className="admin-input min-w-[200px] cursor-pointer"
                        >
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Capa do Treinamento (URL ou HTML Embed)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={products.find(p => p.id === selectedProductId)?.thumbnail_url || ""}
                                onChange={async (e) => {
                                    const newUrl = e.target.value;
                                    if (!selectedProductId) return;

                                    // Update local state immediately for better UX
                                    setProducts(prev => prev.map(p => p.id === selectedProductId ? { ...p, thumbnail_url: newUrl } : p));

                                    // Debounce or just save on blur would be better, but for now let's do a simple update
                                    // Actually, let's just make it a text input and add a "Save" button or do it on blur
                                }}
                                onBlur={async (e) => {
                                    if (!selectedProductId) return;
                                    const { error } = await supabase
                                        .from("products")
                                        .update({ thumbnail_url: e.target.value })
                                        .eq("id", selectedProductId);
                                    if (error) toast({ title: "Erro ao salvar capa", variant: "destructive" });
                                    else toast({ title: "Capa do curso atualizada" });
                                }}
                                className="admin-input min-w-[250px]"
                                placeholder="https://... ou <iframe ...>"
                            />
                        </div>
                    </div>

                    <div className="flex items-end gap-2 h-full pb-0.5">
                        <a
                            href="/members"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors h-[42px]"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Visualizar
                        </a>

                        <button
                            onClick={addModule}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity h-[42px]"
                        >
                            <Plus className="w-4 h-4" />
                            Novo Módulo
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {modules.length === 0 && !loading && (
                    <div className="admin-card text-center py-12 text-muted-foreground text-sm">
                        Nenhum módulo cadastrado para este produto.
                    </div>
                )}

                {modules.map((module) => (
                    <div key={module.id} className="admin-card overflow-hidden">
                        <div
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/20 transition-colors"
                            onClick={() => toggleModule(module.id)}
                        >
                            <div className="flex items-center gap-3">
                                {expandedModules.has(module.id) ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-white" />}
                                <span className="font-bold text-white">{module.name}</span>
                                <span className="text-xs text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
                                    {lessons[module.id]?.length || 0} aulas
                                </span>
                            </div>
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <button
                                    onClick={() => openModuleEditor(module)}
                                    className="p-2 hover:bg-white/10 rounded-lg text-white/70 transition-colors"
                                    title="Editar Módulo"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => addLesson(module.id)}
                                    className="p-2 hover:bg-primary/10 rounded-lg text-primary transition-colors"
                                    title="Adicionar Aula"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => deleteModule(module.id)}
                                    className="p-2 hover:bg-destructive/10 rounded-lg text-destructive transition-colors"
                                    title="Excluir Módulo"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {expandedModules.has(module.id) && (
                            <div className="border-t border-border p-4 bg-secondary/5 space-y-2">
                                {lessons[module.id]?.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-2">Nenhuma aula neste módulo.</p>
                                )}
                                {lessons[module.id]?.map((lesson) => (
                                    <div key={lesson.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border group hover:border-primary/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                                                <Video className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{lesson.name}</p>
                                                {lesson.video_url && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{lesson.video_url}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openLessonEditor(lesson)}
                                                className="p-1.5 hover:bg-secondary rounded-md"
                                                title="Editar Aula"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => deleteLesson(lesson.id)}
                                                className="p-1.5 hover:bg-destructive/10 rounded-md text-destructive"
                                                title="Excluir Aula"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Lesson Editor Modal */}
            {editingLesson && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-card w-full max-w-2xl rounded-3xl border border-border overflow-hidden shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between p-6 border-b border-border bg-secondary/20">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Edit2 className="w-5 h-5 text-primary" />
                                Editar Aula
                            </h3>
                            <button
                                onClick={() => setEditingLesson(null)}
                                className="p-2 hover:bg-secondary rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div>
                                <label className="block text-sm font-bold mb-2">Nome da Aula</label>
                                <input
                                    type="text"
                                    value={editingLesson.name}
                                    onChange={e => setEditingLesson({ ...editingLesson, name: e.target.value })}
                                    className="admin-input"
                                    placeholder="Ex: Aula 01 - Introdução"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-2">Link do Vídeo (YouTube)</label>
                                <div className="relative">
                                    <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={editingLesson.video_url || ""}
                                        onChange={e => setEditingLesson({ ...editingLesson, video_url: e.target.value })}
                                        className="admin-input pl-10"
                                        placeholder="https://www.youtube.com/watch?v=..."
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-2">Capa da Aula (URL ou HTML Embed)</label>
                                <div className="relative">
                                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={editingLesson.thumbnail_url || ""}
                                        onChange={e => setEditingLesson({ ...editingLesson, thumbnail_url: e.target.value })}
                                        className="admin-input pl-10"
                                        placeholder="https://... ou <iframe ...>"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Aceita link de imagem ou código de incorporação do Canva.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-2">Descrição</label>
                                <textarea
                                    value={editingLesson.description || ""}
                                    onChange={e => setEditingLesson({ ...editingLesson, description: e.target.value })}
                                    className="admin-input h-32 resize-none pt-3"
                                    placeholder="Instruções e resumo da aula..."
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold flex items-center gap-2">
                                        <Download className="w-4 h-4 text-primary" />
                                        Materiais de Apoio
                                    </label>
                                    <button
                                        onClick={addMaterial}
                                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Adicionar Material
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {lessonMaterials.length === 0 && (
                                        <p className="text-xs text-muted-foreground text-center py-4 bg-secondary/20 rounded-xl border border-dashed border-border">
                                            Nenhum material adicionado.
                                        </p>
                                    )}
                                    {lessonMaterials.map(m => (
                                        <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border">
                                            <div className="flex items-center gap-3">
                                                <FileText className="w-4 h-4 text-muted-foreground" />
                                                <span className="text-sm font-medium">{m.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <a href={m.file_url} target="_blank" rel="noreferrer" className="p-1 hover:text-primary transition-colors">
                                                    <Download className="w-3.5 h-3.5" />
                                                </a>
                                                <button onClick={() => deleteMaterial(m.id)} className="p-1 hover:text-destructive transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-border flex justify-end gap-3 bg-secondary/10">
                            <button
                                onClick={() => setEditingLesson(null)}
                                className="px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-secondary transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveLesson}
                                disabled={isSavingLesson}
                                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity"
                            >
                                {isSavingLesson ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Module Editor Modal */}
            {editingModule && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-card w-full max-w-lg rounded-3xl border border-border overflow-hidden shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between p-6 border-b border-border bg-secondary/20">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Edit2 className="w-5 h-5 text-primary" />
                                Editar Módulo
                            </h3>
                            <button
                                onClick={() => setEditingModule(null)}
                                className="p-2 hover:bg-secondary rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-bold mb-2">Nome do Módulo</label>
                                <input
                                    type="text"
                                    value={editingModule.name}
                                    onChange={e => setEditingModule({ ...editingModule, name: e.target.value })}
                                    className="admin-input"
                                    placeholder="Ex: Módulo 1 - Comece aqui"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-2">Capa do Módulo (URL ou HTML Embed)</label>
                                <div className="relative">
                                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={editingModule.thumbnail_url || ""}
                                        onChange={e => setEditingModule({ ...editingModule, thumbnail_url: e.target.value })}
                                        className="admin-input pl-10"
                                        placeholder="https://... ou <iframe ...>"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Aceita link de imagem ou código de incorporação do Canva.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 border-t border-border flex justify-end gap-3 bg-secondary/10">
                            <button
                                onClick={() => setEditingModule(null)}
                                className="px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-secondary transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveModule}
                                disabled={isSavingModule}
                                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity"
                            >
                                {isSavingModule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
