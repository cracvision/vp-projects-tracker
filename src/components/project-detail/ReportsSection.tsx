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
import { ymdToLocalDate } from "@/lib/date";
import { wrapPdfHtml, fmt, fmtTime, fmtStamp } from "@/lib/reports";

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

      const total = (entries || []).reduce((s, e) => s + (e.hours || 0), 0);

      const body = `
        <h2>Entradas del día — ${fmt(date)}</h2>
        <div class="hr"></div>
        <div class="kpi">Total horas: ${total.toFixed(1)}h</div>
        <div style="margin-top:12px;">
          ${(entries || []).map((e: any) => `
            <div class="entry">
              <div style="display:flex; justify-content:space-between; gap:8px;">
                <div><strong>${e.tasks?.name || "Sin asignar"}</strong> • ${fmtTime(e.created_at)}</div>
                <div>${e.hours}h</div>
              </div>
              ${e.notes ? `<div class="pre" style="margin-top:6px;">${DOMPurify.sanitize(e.notes)}</div>` : `<em class="muted">Sin notas</em>`}
            </div>
          `).join("")}
        </div>
      `;

      const html = await wrapPdfHtml({
        title: `Reporte Diario — ${project.name}`,
        subtitle: format(new Date(), "PPPp", { locale: es }),
        body,
      });

      await html2pdf()
        .set({
          margin: 10,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "pt", format: "a4", orientation: "portrait" },
        })
        .from(html)
        .save(`reporte-diario-${project.name}-${date}.pdf`);

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

      // 2) Traer TODAS las entradas (para totales reales)
      const { data: entries, error: eErr } = await supabase
        .from("daily_entries")
        .select("task_id, date_iso, hours, notes, created_at, tasks(name)")
        .eq("project_id", project.id)
        .order("date_iso", { ascending: true })
        .order("created_at", { ascending: true });
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

      // 5) Agrupar entradas por tarea (incluye "Sin asignar")
      const byTask: Record<string, any[]> = {};
      (entries || []).forEach((e) => {
        const key = e.task_id || "unassigned";
        if (!byTask[key]) byTask[key] = [];
        byTask[key].push(e);
      });
      const unassignedHours = (byTask["unassigned"] || []).reduce((s, e) => s + (e.hours || 0), 0);

      // 6) Sección resumen + tabla
      const summaryHtml = `
        <div class="kpi">Horas totales trabajadas: ${totalWorked.toFixed(1)}h</div>
        ${unassignedHours > 0 ? `<div class="muted">Incluye "Sin asignar": ${unassignedHours.toFixed(1)}h</div>` : ""}
        <div class="kpi" style="margin-top:6px;">Progreso general (sobre tareas estimadas): ${overall}%</div>
        <div class="hr"></div>
        <h2>Detalle por tarea</h2>
        <table>
          <thead>
            <tr>
              <th>Tarea</th>
              <th>Est. (max)</th>
              <th>Horas reales</th>
              <th>Progreso</th>
            </tr>
          </thead>
          <tbody>
            ${(tasks || [])
              .map(
                (t: any) => `
              <tr>
                <td>${t.name}</td>
                <td>${t.estimated_hours_max ?? "-"}</td>
                <td>${(t.actual_hours ?? 0).toFixed(1)}</td>
                <td>${t.progress ?? 0}%</td>
              </tr>`
              )
              .join("")}
            ${
              unassignedHours > 0
                ? `
              <tr>
                <td>Sin asignar</td>
                <td>-</td>
                <td>${unassignedHours.toFixed(1)}</td>
                <td>-</td>
              </tr>`
                : ""
            }
          </tbody>
        </table>
      `;

      // 7) Bitácora completa por tarea (con salto de página limpio)
      const tasksWithUnassigned = [
        ...(tasks || []),
        { id: "unassigned", name: "Sin asignar", description: null, estimated_hours_max: null, actual_hours: null, progress: null },
      ];

      const journalHtml = `
        <div class="hr"></div>
        <div class="page-break"></div>
        <h2>Bitácora por tarea</h2>
        <div class="section" style="margin-top:8px;">
          ${tasksWithUnassigned
            .map((t: any) => {
              const list = byTask[t.id] || [];
              if (list.length === 0)
                return `
                  <div style="margin:12px 0;">
                    <h3>${t.name}</h3>
                    <div class="muted">Sin entradas registradas.</div>
                  </div>
                `;
              return `
                <div style="margin:12px 0;">
                  <h3>${t.name}</h3>
                  ${t.description ? `<div class="muted" style="margin-bottom:6px;">${DOMPurify.sanitize(t.description)}</div>` : ""}
                  ${list
                    .map(
                      (e: any) => `
                      <div class="entry">
                        <div style="display:flex; justify-content:space-between; gap:8px;">
                          <div>${fmtStamp(e.created_at)}</div>
                          <div><strong>${e.hours}h</strong></div>
                        </div>
                        ${e.notes ? `<div class="pre" style="margin-top:6px;">${DOMPurify.sanitize(e.notes)}</div>` : `<em class="muted">Sin notas</em>`}
                      </div>
                    `
                    )
                    .join("")}
                </div>
              `;
            })
            .join("")}
        </div>
      `;

      const html = await wrapPdfHtml({
        title: `Reporte de Estado — ${project.name}`,
        subtitle: format(new Date(), "PPPp", { locale: es }),
        body: summaryHtml + journalHtml,
      });

      await html2pdf()
        .set({
          margin: 10,
          pagebreak: {
            mode: ['css', 'legacy'],
            avoid: ['.entry', 'table', 'tr', 'td', 'th', 'h2', 'h3', 'ul', 'ol', 'li']
          },
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: 730 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        } as any)
        .from(html)
        .save(`reporte-estado-${project.name}.pdf`);

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
