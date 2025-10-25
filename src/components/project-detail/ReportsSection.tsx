import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import html2pdf from "html2pdf.js";
import DOMPurify from "dompurify";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { generateWithAI } from "@/lib/ai";
import { BRAND_LOGO_URL } from "@/lib/brand";

interface ReportsSectionProps {
  project: {
    id: string;
    name: string;
  };
}

function wrapPdfHtml(title: string, bodyHtml: string) {
  const safeBody = DOMPurify.sanitize(bodyHtml, { USE_PROFILES: { html: true } });
  return `
    <div style="font-family: Inter, system-ui, -apple-system, Segoe UI; padding:24px; max-width:900px; color:#111;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
        <img src="${BRAND_LOGO_URL}" alt="logo" style="height:36px; width:auto;" />
        <h1 style="margin:0; font-size:22px;">${title}</h1>
      </div>
      ${safeBody}
    </div>
  `;
}

const ReportsSection = ({ project }: ReportsSectionProps) => {
  const { toast } = useToast();
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  async function generateDaily() {
    try {
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("id, date_iso, hours, notes, tasks(name)")
        .eq("project_id", project.id)
        .eq("date_iso", date)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const total = (entries || []).reduce((s, e) => s + (e.hours || 0), 0);

      // Prepara contexto compacto para el prompt
      const ctx = (entries || []).map(e => ({
        task: e.tasks?.name || "Sin asignar",
        hours: e.hours,
        notes: e.notes || ""
      }));

      const prompt = `
Eres un analista de proyectos. Con el siguiente contexto, genera un REPORTE DIARIO en HTML claro y profesional.
- Mantén el idioma en español.
- Incluye secciones: "Resumen del día", "Actividades por tarea", "Riesgos/Impedimentos" (si existen), "Próximos pasos".
- Menciona el total de horas del día y distribuciones por tarea.
- Si una nota está vacía, indica "Sin notas".
- Entrega SOLO HTML válido (sin <html> ni <body>), con subtítulos (<h2>) y listas (<ul>).

Proyecto: ${project.name}
Fecha: ${format(new Date(date), "EEEE, d 'de' MMMM yyyy", { locale: es })}
Total horas del día: ${total.toFixed(1)}h

Entradas (JSON):
${JSON.stringify(ctx, null, 2)}
      `.trim();

      const aiHtml = await generateWithAI(prompt);
      const html = wrapPdfHtml(`Reporte Diario — ${project.name} — ${format(new Date(date), "PPP", { locale: es })}`, aiHtml || `
        <p><strong>Total horas:</strong> ${total.toFixed(1)}h</p>
        <ul>${ctx.map(c => `<li><strong>${c.task}</strong> — ${c.hours}h<br/>${c.notes ? DOMPurify.sanitize(c.notes) : "<em>Sin notas</em>"}</li>`).join("")}</ul>
      `);

      await html2pdf().set({
        margin: 10,
        filename: `reporte-diario-${project.name}-${date}.pdf`
      }).from(html).save();
      
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
      const { data: tasks, error } = await supabase
        .from("tasks")
        .select("name, description, estimated_hours_min, estimated_hours_max, actual_hours, progress")
        .eq("project_id", project.id)
        .order("display_order");
      if (error) throw error;

      const totals = (tasks || []).reduce((acc: any, t: any) => {
        acc.actual += t.actual_hours || 0;
        acc.estMax += t.estimated_hours_max || 0;
        return acc;
      }, { actual: 0, estMax: 0 });

      const overall = totals.estMax > 0 ? Math.min(100, Math.round((totals.actual / totals.estMax) * 100)) : 0;

      const ctx = (tasks || []).map(t => ({
        name: t.name,
        description: t.description || "",
        estMin: t.estimated_hours_min,
        estMax: t.estimated_hours_max,
        actual: t.actual_hours || 0,
        progress: t.progress || 0
      }));

      const prompt = `
Eres un project manager. Genera un REPORTE DE ESTADO en HTML (sin <html>/<body>) para ejecutivos.
- Idioma: español, tono profesional.
- Incluye: "Resumen ejecutivo", "Métricas generales", "Progreso por tarea" (puedes usar una lista o tabla simple), "Riesgos y mitigaciones", "Próximos pasos".
- Usa números redondeados y porcentajes claros.
- NO inventes datos. Usa solo el contexto provisto.

Proyecto: ${project.name}
Fecha: ${format(new Date(), "PPPp", { locale: es })}
Métricas:
- Horas reales: ${totals.actual.toFixed(1)}h
- Estimado total (max): ${totals.estMax.toFixed(1)}h
- Progreso general: ${overall}%

Tareas (JSON):
${JSON.stringify(ctx, null, 2)}
      `.trim();

      const aiHtml = await generateWithAI(prompt);

      // tabla determinística como backup
      const fallbackTable = `
        <h2>Detalle por tarea</h2>
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
      `;

      const html = wrapPdfHtml(`Reporte de Estado — ${project.name}`, aiHtml || `
        <h2>Resumen ejecutivo</h2>
        <p>Horas reales: ${totals.actual.toFixed(1)}h. Estimado (max): ${totals.estMax.toFixed(1)}h. Progreso general: ${overall}%.</p>
        ${fallbackTable}
      `);

      await html2pdf().set({
        margin: 10,
        filename: `reporte-estado-${project.name}.pdf`
      }).from(html).save();
      
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
