import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);

  async function generateDaily() {
    try {
      if (startDate > endDate) {
        toast({ title: "Rango inválido", description: "La fecha inicial debe ser anterior o igual a la final.", variant: "destructive" });
        return;
      }
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("id, date_iso, hours, notes, created_at, tasks(name)")
        .eq("project_id", project.id)
        .gte("date_iso", startDate)
        .lte("date_iso", endDate)
        .order("date_iso", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;

      await generateDailyReportPdf({
        projectName: project.name,
        startDate,
        endDate,
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

      // 3) Totales desde entradas (incluye sin asignar)
      const totalWorked = (entries || []).reduce((s, e) => s + (e.hours || 0), 0);

      // 4) Calcular horas sin asignar
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Desde</Label>
              <Input
                type="date"
                value={startDate}
                max={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Hasta</Label>
              <Input
                type="date"
                value={endDate}
                max={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button variant="outline" className="h-10 w-full" onClick={generateDaily}>
              <Calendar className="h-5 w-5 mr-2" /> Reporte por Rango de Fechas
            </Button>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" className="h-10 w-full" onClick={generateStatus}>
              <FileText className="h-5 w-5 mr-2" /> Reporte Completo
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportsSection;
