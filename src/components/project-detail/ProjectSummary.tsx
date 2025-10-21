import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, DollarSign, TrendingUp, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ProjectSummaryProps {
  project: {
    id: string;
    name: string;
    due_date: string | null;
    hourly_rate: number;
  };
  refreshKey: number;
}

const ProjectSummary = ({ project, refreshKey }: ProjectSummaryProps) => {
  const [metrics, setMetrics] = useState({
    hoursWorked: 0,
    budgetUsed: 0,
    progress: 0,
  });

  useEffect(() => {
    fetchMetrics();
  }, [project.id, refreshKey]);

  const fetchMetrics = async () => {
    try {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("actual_hours, estimated_hours_max")
        .eq("project_id", project.id);

      if (tasks) {
        const totalActual = tasks.reduce((sum, task) => sum + (task.actual_hours || 0), 0);
        const totalEstimated = tasks.reduce((sum, task) => sum + (task.estimated_hours_max || 0), 0);
        const progress = totalEstimated > 0 ? Math.min(100, Math.round((totalActual / totalEstimated) * 100)) : 0;

        setMetrics({
          hoursWorked: totalActual,
          budgetUsed: totalActual * project.hourly_rate,
          progress,
        });
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
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
      title: "Progreso General",
      value: `${metrics.progress}%`,
      icon: TrendingUp,
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
        return (
          <Card key={metric.title} className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ProjectSummary;