import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, DollarSign, ListChecks, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import EditDueDate from "./EditDueDate";

interface ProjectSummaryProps {
  project: {
    id: string;
    name: string;
    due_date: string | null;
    hourly_rate: number;
  };
  refreshKey: number;
  onProjectUpdated?: () => void;
}

const ProjectSummary = ({ project, refreshKey, onProjectUpdated }: ProjectSummaryProps) => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    hoursWorked: 0,
    budgetUsed: 0,
  });

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, refreshKey]);

  const fetchMetrics = async () => {
    try {
      // Paraleliza: tareas (para progreso) + todas las entradas (para horas/budget)
      const [tasksRes, entriesRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("actual_hours, estimated_hours_max")
          .eq("project_id", project.id),
        supabase
          .from("daily_entries")
          .select("hours")
          .eq("project_id", project.id)
          .or("entry_type.eq.regular,entry_type.is.null"),
      ]);

      const tasks = tasksRes.data ?? [];
      const entries = entriesRes.data ?? [];

      // 1) Horas totales trabajadas (incluye entradas sin tarea)
      const totalHours = entries.reduce((sum: number, e: any) => sum + (Number(e.hours) || 0), 0);

      setMetrics({
        hoursWorked: totalHours,
        budgetUsed: totalHours * (Number(project.hourly_rate) || 0),
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching metrics:", error);
      }
    }
  };

  const metricCards = [
    {
      title: "Horas Trabajadas",
      value: `${metrics.hoursWorked.toFixed(1)}h`,
      icon: Clock,
      color: "text-primary",
      bgColor: "bg-primary-light",
    },
    {
      title: "Presupuesto Usado",
      value: `$${metrics.budgetUsed.toFixed(0)}`,
      icon: DollarSign,
      color: "text-secondary",
      bgColor: "bg-secondary-light",
    },
    {
      title: "Fases del Proyecto",
      value: "Ver fases",
      icon: ListChecks,
      color: "text-accent",
      bgColor: "bg-accent-light",
    },
    {
      title: "Fecha de Entrega",
      value: project.due_date
        ? format(new Date(project.due_date), "d MMM yyyy", { locale: es })
        : "No definida",
      icon: Calendar,
      color: "text-warning",
      bgColor: "bg-warning-light",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metricCards.map((metric) => {
        const Icon = metric.icon;
        const isDueDateCard = metric.title === "Fecha de Entrega";
        const isPhasesCard = metric.title === "Fases del Proyecto";

        return (
          <Card
            key={metric.title}
            className={`border-0 shadow-md ${isPhasesCard ? "cursor-pointer hover:shadow-lg transition-shadow" : ""}`}
            onClick={isPhasesCard ? () => navigate(`/project/${project.id}/phases`) : undefined}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isDueDateCard ? (
                <EditDueDate
                  projectId={project.id}
                  value={project.due_date}
                  onUpdated={onProjectUpdated ?? (() => {})}
                />
              ) : (
                <div className="text-2xl font-bold">{metric.value}</div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ProjectSummary;