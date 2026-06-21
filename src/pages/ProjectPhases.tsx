import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import TaskSection from "@/components/project-detail/TaskSection";

interface Project {
  id: string;
  name: string;
}

const ProjectPhases = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!projectId) {
        setError("ID del proyecto no válido.");
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("id, name")
          .eq("id", projectId)
          .maybeSingle();
        if (error) throw error;
        if (!data) setError("Proyecto no encontrado.");
        else setProject(data);
      } catch (err) {
        if (import.meta.env.DEV) console.error(err);
        setError("No se pudo cargar el proyecto.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Cargando...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex flex-col items-center justify-center text-center px-4">
        <p className="text-muted-foreground mb-4">{error ?? "Proyecto no disponible."}</p>
        <Button onClick={() => navigate("/")}>Volver al inicio</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/project/${project.id}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 flex-1">
              <BrandLogo className="h-8 w-auto" />
              <div>
                <h1 className="text-xl font-bold">{project.name}</h1>
                <p className="text-sm text-muted-foreground">Tareas del proyecto</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <TaskSection projectId={project.id} onTaskUpdate={() => {}} />
      </main>
    </div>
  );
};

export default ProjectPhases;