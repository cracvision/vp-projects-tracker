import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import html2pdf from "html2pdf.js";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
        .select("*, tasks(name)")
        .eq("project_id", project.id)
        .eq("date_iso", date)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const total = (entries || []).reduce((s, e) => s + (e.hours || 0), 0);

      const html = `
        <div style="font-family: Inter, system-ui, -apple-system, Segoe UI; padding:24px; max-width:800px">
          <h1 style="margin:0 0 4px 0;">Reporte Diario — ${project.name}</h1>
          <div style="color:#666; margin-bottom:16px;">${format(new Date(date), "EEEE, d 'de' MMMM yyyy", { locale: es })}</div>
          <div style="margin:8px 0 16px 0;"><strong>Total horas:</strong> ${total.toFixed(1)}h</div>
          <hr/>
          <div>
            ${(entries || []).map((e: any) => `
              <div style="margin:16px 0; padding:12px; border:1px solid #eee; border-radius:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div><strong>${e.tasks?.name || "Sin asignar"}</strong></div>
                  <div>${e.hours}h</div>
                </div>
                ${e.notes ? `<pre style="white-space:pre-wrap; margin-top:8px;">${e.notes}</pre>` : `<em style="color:#888;">Sin notas</em>`}
              </div>
            `).join("")}
          </div>
        </div>
      `;
      await html2pdf().set({ margin: 10, filename: `reporte-diario-${project.name}-${date}.pdf` }).from(html).save();
      
      toast({
        title: "Reporte generado",
        description: "El reporte diario se ha descargado correctamente",
      });
    } catch (err) {
      toast({ title: "Error", description: "No se pudo generar el reporte diario.", variant: "destructive" });
    }
  }

  async function generateStatus() {
    try {
      const { data: tasks, error } = await supabase
        .from("tasks")
        .select("name, estimated_hours_min, estimated_hours_max, actual_hours, progress")
        .eq("project_id", project.id)
        .order("display_order");
      if (error) throw error;

      const totals = (tasks || []).reduce((acc: any, t: any) => {
        acc.actual += t.actual_hours || 0;
        acc.estMax += t.estimated_hours_max || 0;
        return acc;
      }, { actual: 0, estMax: 0 });

      const overall = totals.estMax > 0 ? Math.min(100, Math.round((totals.actual / totals.estMax) * 100)) : 0;

      const html = `
        <div style="font-family: Inter, system-ui, -apple-system, Segoe UI; padding:24px; max-width:800px">
          <h1 style="margin:0 0 4px 0;">Reporte de Estado — ${project.name}</h1>
          <div style="color:#666; margin-bottom:16px;">Generado: ${format(new Date(), "PPPp", { locale: es })}</div>
          <div style="margin-bottom:16px;">
            <div><strong>Progreso general:</strong> ${overall}%</div>
            <div><strong>Horas reales:</strong> ${totals.actual.toFixed(1)}h</div>
            <div><strong>Estimado total (max):</strong> ${totals.estMax.toFixed(1)}h</div>
          </div>
          <hr/>
          <h2 style="margin-top:16px;">Detalle por tarea</h2>
          <table style="width:100%; border-collapse:collapse; font-size:14px;">
            <thead>
              <tr>
                <th style="text-align:left; border-bottom:1px solid #eee; padding:8px;">Tarea</th>
                <th style="text-align:right; border-bottom:1px solid #eee; padding:8px;">Est. (max)</th>
                <th style="text-align:right; border-bottom:1px solid #eee; padding:8px;">Horas reales</th>
                <th style="text-align:right; border-bottom:1px solid #eee; padding:8px;">Progreso</th>
              </tr>
            </thead>
            <tbody>
              ${(tasks || []).map((t: any) => `
                <tr>
                  <td style="padding:8px; border-bottom:1px solid #f3f3f3;">${t.name}</td>
                  <td style="padding:8px; text-align:right; border-bottom:1px solid #f3f3f3;">${t.estimated_hours_max ?? "-"}</td>
                  <td style="padding:8px; text-align:right; border-bottom:1px solid #f3f3f3;">${(t.actual_hours ?? 0).toFixed(1)}</td>
                  <td style="padding:8px; text-align:right; border-bottom:1px solid #f3f3f3;">${t.progress ?? 0}%</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
      await html2pdf().set({ margin: 10, filename: `reporte-estado-${project.name}.pdf` }).from(html).save();
      
      toast({
        title: "Reporte generado",
        description: "El reporte de estado se ha descargado correctamente",
      });
    } catch (err) {
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
            <Input type="date" value={date} max={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setDate(e.target.value)} />
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