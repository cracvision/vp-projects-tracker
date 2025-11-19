import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { generateDailyReportPdf, generateStatusReportPdf } from "@/lib/reports";

interface ReportsSectionProps {
  project: {
    id: string;
    name: string;
  };
}

const ReportsSection = ({ project }: ReportsSectionProps) => {
  const { toast } = useToast();
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  async function generateDaily() {
    try {
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("id, date_iso, hours, notes, created_at, tasks(name)")
        .eq("project_id", project.id)
        .eq("date_iso", date)
        .order("created_at", { ascending: true });
      if (error) throw error;

      await generateDailyReportPdf({
        projectName: project.name,
        date,
        entries: entries || [],
      });

      toast({
        title: "Reporte generado",
        description: "El reporte diario se ha descargado correctamente",
      });
    } catch (_e) {
      toast({ title: "Error", description: "No se pudo generar el reporte diario.", variant: "destructive" });
    }
  }

  async function generateStatus() {
    try {
      // 1) Traer tareas (para progreso y tabla)
      const { data: tasks, error: tErr } = await supabase
        .from("tasks")
        .select("id, name, description, estimated_hours_min, estimated_hours_max, actual_hours, progress")
        .eq("project_id", project.id)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (tErr) throw tErr;

      // 2) Traer TODAS las entradas ordenadas cronológicamente
      const { data: entries, error: eErr } = await supabase
        .from("daily_entries")
        .select("task_id, date_iso, hours, notes, created_at, tasks(name)")
        .eq("project_id", project.id)
        .order("date_iso", { ascending: true });
      if (eErr) throw eErr;

      // 3) Totales y progreso general
      const totalsFromTasks = (tasks || []).reduce(
        (acc: any, t: any) => {
          acc.actual += t.actual_hours || 0;
          acc.estMax += t.estimated_hours_max || 0;
          return acc;
        },
        { actual: 0, estMax: 0 }
      );
      const overall =
        totalsFromTasks.estMax > 0
          ? Math.min(100, Math.round((totalsFromTasks.actual / totalsFromTasks.estMax) * 100))
          : 0;

      // 4) Totales desde entradas (incluye sin asignar)
      const totalWorked = (entries || []).reduce((s, e) => s + (e.hours || 0), 0);

      // 5) Calcular horas sin asignar
      const unassignedHours = (entries || [])
        .filter(e => !e.task_id)
        .reduce((s, e) => s + (e.hours || 0), 0);

      const timestamp = format(new Date(), "yyyy-MM-dd_HHmm");

      // Generate PDF using pdfmake
      await generateStatusReportPdf({
        projectName: project.name,
        tasks: tasks || [],
        entries: entries || [],
        totalWorked,
        unassignedHours,
        overallProgress: overall,
      });

      toast({
        title: "Reporte generado",
        description: "El reporte de estado se ha descargado correctamente",
      });
    } catch (_e) {
      toast({ title: "Error", description: "No se pudo generar el reporte de estado.", variant: "destructive" });
    }
  }

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle>Reportes</CardTitle>
        <CardDescription>Genera reportes diarios y de estado del proyecto</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 items-end">
          <div>
            <label className="text-sm text-muted-foreground">Fecha del reporte diario</label>
            <Input
              type="date"
              value={date}
              max={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-10" onClick={generateDaily}>
            <Calendar className="h-5 w-5 mr-2" /> Reporte Diario
          </Button>
          <Button variant="outline" className="h-10" onClick={generateStatus}>
            <FileText className="h-5 w-5 mr-2" /> Reporte de Estado
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportsSection;
