import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock, DollarSign, TrendingUp, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    due_date: string | null;
    created_at: string;
    hourly_rate: number;
  };
  onProjectUpdated: () => void;
}

const ProjectCard = ({ project, onProjectUpdated }: ProjectCardProps) => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    totalHours: 0,
    budgetUsed: 0,
    progress: 0,
  });

  useEffect(() => {
    fetchMetrics();
  }, [project.id]);

  const fetchMetrics = async () => {
    try {
      // Fetch tasks
      const { data: tasks } = await supabase
        .from("tasks")
        .select("actual_hours, estimated_hours_max")
        .eq("project_id", project.id);

      if (tasks) {
        const totalActual = tasks.reduce((sum, task) => sum + (task.actual_hours || 0), 0);
        const totalEstimated = tasks.reduce((sum, task) => sum + (task.estimated_hours_max || 0), 0);
        const progress = totalEstimated > 0 ? Math.min(100, Math.round((totalActual / totalEstimated) * 100)) : 0;

        setMetrics({
          totalHours: totalActual,
          budgetUsed: totalActual * project.hourly_rate,
          progress,
        });
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    }
  };

  return (
    <Card 
      className="hover:shadow-lg transition-all cursor-pointer group border-0 shadow-md"
      onClick={() => navigate(`/project/${project.id}`)}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-xl group-hover:text-primary transition-colors">
            {project.name}
          </CardTitle>

          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <TrendingUp className="h-3 w-3 mr-1" />
              {metrics.progress}%
            </Badge>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => e.stopPropagation()}
                  title="Eliminar proyecto"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar este proyecto?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará el proyecto y todas sus tareas y entradas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      const { error } = await supabase.from("projects").delete().eq("id", project.id);
                      if (!error) onProjectUpdated();
                    }}
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <Progress value={metrics.progress} className="h-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-primary" />
            <div>
              <p className="text-muted-foreground text-xs">Horas</p>
              <p className="font-semibold">{metrics.totalHours.toFixed(1)}h</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-primary" />
            <div>
              <p className="text-muted-foreground text-xs">Costo del trabajo realizado</p>
              <p className="font-semibold">${metrics.budgetUsed.toFixed(0)}</p>
            </div>
          </div>
        </div>
        
        {project.due_date && (
          <div className="flex items-center gap-2 text-sm pt-2 border-t">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Vence: {format(new Date(project.due_date), "d 'de' MMMM, yyyy", { locale: es })}
            </span>
          </div>
        )}
        
        <Button 
          className="w-full mt-2"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/project/${project.id}`);
          }}
        >
          Ver Detalles
        </Button>
      </CardContent>
    </Card>
  );
};

export default ProjectCard;