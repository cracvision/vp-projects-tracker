// src/lib/reports.ts
import { BRAND_LOGO_URL, fetchAsDataUrl } from "@/lib/brand";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ymdToLocalDate } from "@/lib/date";

export async function wrapPdfHtml(opts: {
  title: string;
  subtitle?: string;
  body: string;
}) {
  const logo = await fetchAsDataUrl(BRAND_LOGO_URL);

  // A4 = 210mm ≈ 794px @96dpi. Área útil = 210mm - (2 * 10mm márgenes) = 190mm ≈ 718px
  return `
  <div id="pdf-root" class="pdf-root">
    <style>
      * { box-sizing: border-box; }
      .pdf-root {
        width: 718px;              /* ANCHO INTERNO A4 */
        margin: 0 auto;
        padding: 16px;             /* incluido en width por box-sizing */
        font-family: Inter, system-ui, -apple-system, Segoe UI;
        color:#111;
      }
      h1,h2,h3 { margin: 0 0 8px 0; }
      .muted { color:#666; }
      .hr { height:1px; background:#e5e7eb; margin:16px 0; }
      .card { border:1px solid #eee; border-radius:10px; padding:12px; }
      .header { display:flex; align-items:center; gap:12px; margin-bottom:10px; }
      .logo { height:28px; }

      /* Tablas y listas no deben empujar ancho ni cortarse raro */
      table { width:100%; border-collapse: collapse; table-layout: fixed; }
      th, td {
        padding:10px; border-bottom:1px solid #f1f5f9; font-size:14px; vertical-align: top;
        word-break: break-word; overflow-wrap: anywhere;
      }
      th { text-align:left; font-weight:600; color:#334155; background:#f8fafc; }

      .entry { margin:10px 0; padding:10px; border:1px solid #f1f5f9; border-radius:8px; }
      .pre { white-space: pre-wrap; line-height:1.4; color:#374151; word-break: break-word; overflow-wrap:anywhere; }
      ul, ol { padding-left: 18px; }

      /* Evitar "cortes mordidos" entre páginas */
      .section, table, thead, tbody, tr, td, th, h2, h3, .header, .kpi, ul, ol, li {
        break-inside: avoid; page-break-inside: avoid;
      }

      /* Permitir que las entradas se puedan partir entre páginas */
      .entry {
        break-inside: auto;
        page-break-inside: auto;
      }

      .pre {
        max-height: none;
        break-inside: auto;
        page-break-inside: auto;
      }
      .page-break { page-break-before: always; break-before: page; }
      @media print { .page-break { page-break-before: always; break-before: page; } }
    </style>

    <div class="header">
      <img class="logo" src="${logo}" alt="logo" />
      <h1>${opts.title}</h1>
    </div>
    ${opts.subtitle ? `<div class="muted" style="margin-bottom:12px;">${opts.subtitle}</div>` : ""}

    ${opts.body}
  </div>
  `;
}

export const fmt = (d: string | Date) => {
  const date = typeof d === 'string' ? ymdToLocalDate(d) : d;
  return format(date, "EEEE, d 'de' MMMM yyyy", { locale: es });
};

export const fmtTime = (d: string | Date) =>
  format(new Date(d), "HH:mm", { locale: es });

export const fmtStamp = (d: string | Date) =>
  format(new Date(d), "PPP '·' HH:mm", { locale: es });

/**
 * Genera un PDF de reporte de estado usando jsPDF directamente
 * Más eficiente y sin problemas de paginación
 */
export async function generateStatusPdfDirect(opts: {
  projectName: string;
  tasks: any[];
  entries: any[];
  totalWorked: number;
  unassignedHours: number;
  overallProgress: number;
  timestamp: string;
}) {
  const { projectName, tasks, entries, totalWorked, unassignedHours, overallProgress, timestamp } = opts;

  // Crear documento PDF
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Obtener logo
  const logoDataUrl = await fetchAsDataUrl(BRAND_LOGO_URL);

  // Configuración de fuentes y colores
  const primaryColor = [17, 17, 17] as [number, number, number]; // #111
  const mutedColor = [102, 102, 102] as [number, number, number]; // #666
  const lightGray = [241, 245, 249] as [number, number, number]; // #f1f5f9

  let yPos = 20;

  // === HEADER CON LOGO ===
  try {
    doc.addImage(logoDataUrl, "PNG", 15, yPos, 20, 8);
  } catch (e) {
    console.warn("No se pudo agregar el logo al PDF");
  }

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text(`Reporte de Estado — ${projectName}`, 40, yPos + 6);

  yPos += 15;

  // Fecha de generación
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...mutedColor);
  doc.text(format(new Date(), "PPPp", { locale: es }), 15, yPos);
  yPos += 10;

  // === RESUMEN GENERAL ===
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text(`Horas totales trabajadas: ${totalWorked.toFixed(1)}h`, 15, yPos);
  yPos += 6;

  if (unassignedHours > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...mutedColor);
    doc.text(`Incluye "Sin asignar": ${unassignedHours.toFixed(1)}h`, 15, yPos);
    yPos += 6;
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text(`Progreso general (sobre tareas estimadas): ${overallProgress}%`, 15, yPos);
  yPos += 10;

  // === TABLA DE TAREAS ===
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Detalle por tarea", 15, yPos);
  yPos += 5;

  const taskTableData = tasks.map((t: any) => [
    t.name,
    t.estimated_hours_max ? t.estimated_hours_max.toString() : "-",
    (t.actual_hours ?? 0).toFixed(1),
    `${t.progress ?? 0}%`,
  ]);

  if (unassignedHours > 0) {
    taskTableData.push(["Sin asignar", "-", unassignedHours.toFixed(1), "-"]);
  }

  autoTable(doc, {
    startY: yPos,
    head: [["Tarea", "Est. (max)", "Horas reales", "Progreso"]],
    body: taskTableData,
    theme: "striped",
    headStyles: {
      fillColor: lightGray,
      textColor: primaryColor,
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: primaryColor,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 15, right: 15 },
  });

  // @ts-ignore - autoTable modifica el doc y agrega lastAutoTable
  yPos = doc.lastAutoTable.finalY + 15;

  // === BITÁCORA CRONOLÓGICA ===
  // Nueva página para la bitácora
  doc.addPage();
  yPos = 20;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text("Bitácora completa (orden cronológico)", 15, yPos);
  yPos += 8;

  // Ordenar entradas por date_iso ASC (cronológicamente)
  const sortedEntries = [...entries].sort((a, b) => {
    return new Date(a.date_iso).getTime() - new Date(b.date_iso).getTime();
  });

  // Preparar datos para la tabla de bitácora
  const journalTableData = sortedEntries.map((e: any) => {
    const taskName = e.tasks?.name || "Sin asignar";
    const dateStr = fmt(e.date_iso);
    const hours = `${e.hours}h`;
    const notes = e.notes || "Sin notas";
    
    return [dateStr, taskName, hours, notes];
  });

  if (journalTableData.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...mutedColor);
    doc.text("No hay entradas registradas.", 15, yPos);
  } else {
    autoTable(doc, {
      startY: yPos,
      head: [["Fecha", "Tarea", "Horas", "Notas"]],
      body: journalTableData,
      theme: "plain",
      headStyles: {
        fillColor: lightGray,
        textColor: primaryColor,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: primaryColor,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 30 }, // Fecha
        1: { cellWidth: 40 }, // Tarea
        2: { cellWidth: 15 }, // Horas
        3: { cellWidth: 'auto' }, // Notas (el resto del espacio)
      },
      margin: { left: 15, right: 15 },
      didParseCell: (data) => {
        // Permitir que las notas se expandan en múltiples líneas
        if (data.column.index === 3 && data.section === 'body') {
          data.cell.styles.cellPadding = { top: 3, right: 3, bottom: 3, left: 3 };
        }
      },
    });
  }

  // Guardar PDF
  doc.save(`reporte-estado-${projectName}-${timestamp}.pdf`);
}
