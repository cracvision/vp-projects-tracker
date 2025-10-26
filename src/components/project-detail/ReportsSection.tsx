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
import { ymdToLocalDate } from "@/lib/date";

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
        .select("id, date_iso, hours, notes, created_at, tasks(name)")
        .eq("project_id", project.id)
        .eq("date_iso", date)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const total = (entries || []).reduce((s, e) => s + (e.hours || 0), 0);

      // Prepara contexto con hora exacta
      const ctx = (entries || []).map(e => ({
        task: e.tasks?.name || "Sin asignar",
        hours: e.hours,
        time: format(new Date(e.created_at), "HH:mm"),
        notes: e.notes || ""
      }));

      const prompt = `
Eres un asistente que redacta resúmenes ejecutivos claros, profesionales y concisos en español.
Genera un "Reporte Diario" de trabajo para el proyecto "${project.name}" del día ${format(ymdToLocalDate(date), "EEEE, d 'de' MMMM yyyy", { locale: es })}.
Usa un tono formal, corrige typos y organiza en secciones:

1) Resumen ejecutivo (3–5 viñetas).
2) Detalle por tarea (viñetas sintetizadas, 1–4 por tarea, usando solo la información dada).

Entrega SOLO HTML válido (sin <html> ni <body>), con subtítulos (<h2>) y listas (<ul>).

Datos (JSON):
${JSON.stringify(ctx, null, 2)}
      `.trim();

      const aiHtml = await generateWithAI(prompt);
      
      const dayLabel = format(ymdToLocalDate(date), "EEEE, d 'de' MMMM yyyy", { locale: es });
      const entriesHtml = (entries || []).map((e: any) => `
        <div style="margin:12px 0; padding:12px; border:1px solid #eee; border-radius:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>${e.tasks?.name || "Sin asignar"}</strong>
              <span style="color:#888; margin-left:8px;">${format(new Date(e.created_at), "HH:mm")}</span>
            </div>
            <div>${e.hours}h</div>
          </div>
          ${e.notes ? `<pre style="white-space:pre-wrap; margin-top:8px; font-family:inherit;">${DOMPurify.sanitize(e.notes)}</pre>` : `<em style="color:#888;">Sin notas</em>`}
        </div>
      `).join("");

      const bodyHtml = `
        <div style="color:#666; margin-bottom:12px;">${dayLabel}</div>
        <div style="margin:8px 0 16px 0;"><strong>Total horas:</strong> ${total.toFixed(1)}h</div>
        ${aiHtml || ""}
        <hr style="margin:20px 0;"/>
        <h2 style="margin:16px 0 8px 0;">Entradas del día</h2>
        <div>${entriesHtml}</div>
      `;

      const html = wrapPdfHtml(`Reporte Diario — ${project.name}`, bodyHtml);

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
      const { data: tasks, error: tErr } = await supabase
        .from("tasks")
        .select("id, name, description, estimated_hours_max, actual_hours, progress")
        .eq("project_id", project.id)
        .order("display_order");
      if (tErr) throw tErr;

      const { data: entries, error: eErr } = await supabase
        .from("daily_entries")
        .select("id, task_id, date_iso, created_at, hours, notes, tasks(name)")
        .eq("project_id", project.id)
        .order("date_iso, created_at", { ascending: true });
      if (eErr) throw eErr;

      // Agrupar entradas por tarea
      const byTask: Record<string, any[]> = {};
      (entries || []).forEach((e) => {
        const k = e.task_id ?? "__unassigned__";
        (byTask[k] ||= []).push(e);
      });

      const totals = (tasks || []).reduce((acc: any, t: any) => {
        acc.actual += t.actual_hours || 0;
        acc.estMax += t.estimated_hours_max || 0;
        return acc;
      }, { actual: 0, estMax: 0 });
      
      const overall = totals.estMax > 0 ? Math.min(100, Math.round((totals.actual / totals.estMax) * 100)) : 0;

      const prompt = `
Eres un Project Manager. Resume el estado del proyecto "${project.name}" con estos datos:
Tareas: ${JSON.stringify((tasks || []).map(t => ({
  name: t.name,
  description: t.description || "",
  estimated_max: t.estimated_hours_max,
  actual_hours: t.actual_hours,
  progress: t.progress
})))}
Entradas: ${JSON.stringify((entries || []).map(e => ({
  task: e.tasks?.name ?? "Sin asignar",
  date: e.date_iso,
  hours: e.hours,
  notes: e.notes?.slice(0, 300)
})) ?? [])}
Redacta 4-6 viñetas claras: progreso, bloqueos si se deducen, prioridades y próximos pasos. Español profesional.
Entrega SOLO HTML válido (sin <html> ni <body>), con subtítulos (<h2>) y listas (<ul>).
      `.trim();

      const executive = await generateWithAI(prompt);

      const taskTable = `
        <h3 style="margin-top:20px;">Detalle por tarea</h3>
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

      const logs = `
        <h3 style="margin-top:24px;">Bitácora por tarea</h3>
        ${(tasks || []).concat([{ id: "__unassigned__", name: "Sin asignar" } as any]).map((t: any) => {
          const list = byTask[t.id] || [];
          if (!list.length) return "";
          return `
            <div style="margin:14px 0; padding:12px; border:1px solid #eee; border-radius:8px;">
              <div style="font-weight:600; margin-bottom:8px;">${t.name}</div>
              ${list.map(e => `
                <div style="margin:8px 0;">
                  <div style="color:#555; font-size:13px;">
                    ${format(ymdToLocalDate(e.date_iso), "PPP", { locale: es })} · ${format(new Date(e.created_at), "HH:mm")} · ${e.hours}h
                  </div>
                  ${e.notes ? `<pre style="white-space:pre-wrap; margin:4px 0 0 0; font-family:inherit;">${DOMPurify.sanitize(e.notes)}</pre>` : `<em style="color:#888;">Sin notas</em>`}
                </div>
              `).join("")}
            </div>
          `;
        }).join("")}
      `;

      const bodyHtml = `
        <div style="color:#666; margin-bottom:16px;">Generado: ${format(new Date(), "PPPp", { locale: es })}</div>
        <div style="margin-bottom:16px;">
          <div><strong>Progreso general:</strong> ${overall}%</div>
          <div><strong>Horas reales:</strong> ${totals.actual.toFixed(1)}h</div>
          <div><strong>Estimado total (max):</strong> ${totals.estMax.toFixed(1)}h</div>
        </div>
        ${executive ? `<div style="padding:12px;border:1px solid #eee;border-radius:8px;margin-bottom:16px;"><strong>Resumen ejecutivo (IA)</strong><br/>${executive}</div>` : ""}
        <hr style="margin:20px 0;"/>
        ${taskTable}
        ${logs}
      `;

      const html = wrapPdfHtml(`Reporte de Estado — ${project.name}`, bodyHtml);

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
