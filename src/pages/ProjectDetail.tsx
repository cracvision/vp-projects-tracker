import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useToast } from "@/hooks/use-toast";
import ProjectSummary from "@/components/project-detail/ProjectSummary";
import TaskSection from "@/components/project-detail/TaskSection";
import DailyWorkLog from "@/components/project-detail/DailyWorkLog";
import ReportsSection from "@/components/project-detail/ReportsSection";
import ExcessHoursSection from "@/components/project-detail/ExcessHoursSection";

interface Project {
  id: string;
  name: string;
  sow: string | null;
  due_date: string | null;
  hourly_rate: number;
  owner_uid: string;
}

const ProjectDetail = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (projectId) {
      fetchProject();
    } else {
      setError("ID del proyecto no válido.");
      setLoading(false);
    }
  }, [projectId]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setError("Proyecto no encontrado o eliminado.");
        return;
      }

      setProject(data);
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error("Error al cargar el proyecto:", err);
      }
      setError("No se pudo cargar el proyecto. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    fetchProject();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">
          Cargando proyecto...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex flex-col items-center justify-center text-center px-4">
        <h2 className="text-xl font-semibold mb-2">Error</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => navigate("/")}>Volver al inicio</Button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center">
        <p className="text-muted-foreground mb-4">
          No se encontró información del proyecto.
        </p>
        <Button onClick={() => navigate("/")}>Volver</Button>
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
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 flex-1">
              <BrandLogo className="h-8 w-auto" />
              <div>
                <h1 className="text-xl font-bold">
                  {project?.name || "Proyecto sin nombre"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Dashboard del proyecto
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {project && (
          <>
            <ProjectSummary project={project} refreshKey={refreshKey} onProjectUpdated={handleRefresh} />
            <TaskSection projectId={project.id} onTaskUpdate={handleRefresh} />
            <DailyWorkLog
              projectId={project.id}
              onEntryAdded={handleRefresh}
            />
            <ExcessHoursSection projectId={project.id} onEntryChanged={handleRefresh} />
            <ReportsSection project={project} />
            
            {/* Facturación */}
            <div className="bg-card rounded-lg border shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Facturación</h2>
              <div className="flex gap-3">
                <Button onClick={() => navigate(`/project/${project.id}/billing`)}>
                  Ver Facturas
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ProjectDetail;