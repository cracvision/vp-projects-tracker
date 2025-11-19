import { TDocumentDefinitions, Content, ContentTable } from 'pdfmake/interfaces';
import pdfMake from './pdfmake-config';
import { BRAND_LOGO_URL, fetchAsDataUrl } from './brand';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ymdToLocalDate } from './date';

// Format helpers
export const fmt = (d: string | Date) => {
  const date = typeof d === 'string' ? ymdToLocalDate(d) : d;
  return format(date, "EEEE, d 'de' MMMM yyyy", { locale: es });
};

export const fmtTime = (d: string | Date) =>
  format(new Date(d), "HH:mm", { locale: es });

export const fmtStamp = (d: string | Date) =>
  format(new Date(d), "PPP '·' HH:mm", { locale: es });

// Report styles
const reportStyles = {
  title: {
    fontSize: 18,
    bold: true,
    color: '#111111',
  },
  subtitle: {
    fontSize: 10,
    color: '#666666',
    margin: [0, 0, 0, 10] as [number, number, number, number],
  },
  sectionTitle: {
    fontSize: 14,
    bold: true,
    color: '#111111',
    margin: [0, 10, 0, 5] as [number, number, number, number],
  },
  kpi: {
    fontSize: 12,
    bold: true,
    color: '#111111',
  },
  normalText: {
    fontSize: 9,
    color: '#111111',
  },
  mutedText: {
    fontSize: 9,
    color: '#666666',
    italics: true,
  },
  tableHeader: {
    fontSize: 10,
    bold: true,
    fillColor: '#f1f5f9',
    color: '#111111',
  },
  tableCell: {
    fontSize: 9,
    color: '#111111',
  },
  tableCellAlt: {
    fontSize: 9,
    color: '#111111',
    fillColor: '#f8fafc',
  },
  entryBox: {
    fontSize: 9,
    color: '#111111',
    margin: [0, 3, 0, 3] as [number, number, number, number],
  },
};

/**
 * Generate Daily Report PDF
 */
export async function generateDailyReportPdf(opts: {
  projectName: string;
  date: string;
  entries: Array<{
    id: string;
    hours: number;
    notes?: string;
    created_at: string;
    tasks?: { name: string } | null;
  }>;
}) {
  const { projectName, date, entries } = opts;

  // Load logo
  let logoDataUrl = '';
  try {
    logoDataUrl = await fetchAsDataUrl(BRAND_LOGO_URL);
  } catch (err) {
    console.error('Error loading logo:', err);
  }

  // Calculate totals
  const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0);

  // Build entries content
  const entriesContent: Content[] = entries.map((entry) => {
    const taskName = entry.tasks?.name || 'Sin asignar';
    const time = fmtTime(entry.created_at);
    const notes = entry.notes || 'Sin notas';

    return {
      stack: [
        {
          columns: [
            {
              text: [
                { text: taskName, bold: true },
                { text: ` • ${time}`, style: 'normalText' },
              ],
              width: '*',
            },
            {
              text: `${entry.hours}h`,
              style: 'normalText',
              alignment: 'right',
              width: 'auto',
            },
          ],
        },
        entry.notes
          ? {
              text: notes,
              style: 'normalText',
              margin: [0, 3, 0, 0] as [number, number, number, number],
              preserveLeadingSpaces: true,
            }
          : {
              text: 'Sin notas',
              style: 'mutedText',
              margin: [0, 3, 0, 0] as [number, number, number, number],
            },
      ],
      margin: [0, 5, 0, 5] as [number, number, number, number],
    } as Content;
  });

  // Build document
  const docDefinition: TDocumentDefinitions = {
    content: [
      // Header with logo
      {
        columns: [
          logoDataUrl
            ? { image: logoDataUrl, fit: [50, 20], margin: [0, 0, 10, 0] as [number, number, number, number] }
            : { text: '', width: 50 },
          {
            text: `Reporte Diario — ${projectName}`,
            style: 'title',
            width: '*',
          },
        ],
        margin: [0, 0, 0, 5] as [number, number, number, number],
      },
      {
        text: format(new Date(), 'PPPp', { locale: es }),
        style: 'subtitle',
      },
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 1,
            lineColor: '#e5e7eb',
          },
        ],
        margin: [0, 0, 0, 10] as [number, number, number, number],
      },
      // Date and total hours
      {
        text: `Entradas del día — ${fmt(date)}`,
        style: 'sectionTitle',
      },
      {
        text: `Total horas: ${totalHours.toFixed(1)}h`,
        style: 'kpi',
        margin: [0, 0, 0, 10] as [number, number, number, number],
      },
      // Entries
      ...entriesContent,
    ],
    styles: reportStyles,
    defaultStyle: {
      font: 'Roboto',
    },
    pageMargins: [40, 40, 40, 60] as [number, number, number, number],
    footer: (currentPage, pageCount) => {
      return {
        text: `Página ${currentPage} de ${pageCount}`,
        alignment: 'center',
        fontSize: 9,
        color: '#666666',
        margin: [0, 10, 0, 0] as [number, number, number, number],
      };
    },
  };

  // Generate and download
  const timestamp = format(new Date(), 'yyyy-MM-dd_HHmm');
  pdfMake.createPdf(docDefinition).download(`reporte-diario-${projectName}-${date}-${timestamp}.pdf`);
}

/**
 * Generate Status Report PDF
 */
export async function generateStatusReportPdf(opts: {
  projectName: string;
  tasks: Array<{
    id: string;
    name: string;
    description?: string;
    estimated_hours_min?: number;
    estimated_hours_max: number;
    actual_hours?: number;
    progress?: number;
  }>;
  entries: Array<{
    task_id?: string;
    date_iso: string;
    hours: number;
    notes?: string;
    created_at: string;
    tasks?: { name: string } | null;
  }>;
  totalWorked: number;
  unassignedHours: number;
  overallProgress: number;
}) {
  const { projectName, tasks, entries, totalWorked, unassignedHours, overallProgress } = opts;

  // Load logo
  let logoDataUrl = '';
  try {
    logoDataUrl = await fetchAsDataUrl(BRAND_LOGO_URL);
  } catch (err) {
    console.error('Error loading logo:', err);
  }

  // Build tasks table
  const taskTableBody: any[][] = [
    [
      { text: 'Tarea', style: 'tableHeader' },
      { text: 'Est. (max)', style: 'tableHeader', alignment: 'right' },
      { text: 'Horas reales', style: 'tableHeader', alignment: 'right' },
      { text: 'Progreso', style: 'tableHeader', alignment: 'right' },
    ],
  ];

  tasks.forEach((task, index) => {
    const isAlt = index % 2 !== 0;
    taskTableBody.push([
      { text: task.name, style: isAlt ? 'tableCellAlt' : 'tableCell' },
      {
        text: task.estimated_hours_max ? task.estimated_hours_max.toString() : '-',
        style: isAlt ? 'tableCellAlt' : 'tableCell',
        alignment: 'right',
      },
      {
        text: (task.actual_hours ?? 0).toFixed(1),
        style: isAlt ? 'tableCellAlt' : 'tableCell',
        alignment: 'right',
      },
      {
        text: `${task.progress ?? 0}%`,
        style: isAlt ? 'tableCellAlt' : 'tableCell',
        alignment: 'right',
      },
    ]);
  });

  if (unassignedHours > 0) {
    const isAlt = tasks.length % 2 !== 0;
    taskTableBody.push([
      { text: 'Sin asignar', style: isAlt ? 'tableCellAlt' : 'tableCell' },
      { text: '-', style: isAlt ? 'tableCellAlt' : 'tableCell', alignment: 'right' },
      { text: unassignedHours.toFixed(1), style: isAlt ? 'tableCellAlt' : 'tableCell', alignment: 'right' },
      { text: '-', style: isAlt ? 'tableCellAlt' : 'tableCell', alignment: 'right' },
    ]);
  }

  // Build journal table (sorted chronologically)
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.date_iso).getTime() - new Date(b.date_iso).getTime()
  );

  const journalTableBody: any[][] = [
    [
      { text: 'Fecha', style: 'tableHeader' },
      { text: 'Tarea', style: 'tableHeader' },
      { text: 'Horas', style: 'tableHeader', alignment: 'right' },
      { text: 'Notas', style: 'tableHeader' },
    ],
  ];

  sortedEntries.forEach((entry, index) => {
    const isAlt = index % 2 !== 0;
    const taskName = entry.tasks?.name || 'Sin asignar';
    const dateStr = fmt(entry.date_iso);
    const notes = entry.notes || 'Sin notas';

    journalTableBody.push([
      { text: dateStr, style: isAlt ? 'tableCellAlt' : 'tableCell', fontSize: 8 },
      { text: taskName, style: isAlt ? 'tableCellAlt' : 'tableCell', fontSize: 8 },
      { text: `${entry.hours}h`, style: isAlt ? 'tableCellAlt' : 'tableCell', fontSize: 8, alignment: 'right' },
      { text: notes, style: isAlt ? 'tableCellAlt' : 'tableCell', fontSize: 8 },
    ]);
  });

  // Build document
  const docDefinition: TDocumentDefinitions = {
    content: [
      // Header with logo
      {
        columns: [
          logoDataUrl
            ? { image: logoDataUrl, fit: [50, 20], margin: [0, 0, 10, 0] as [number, number, number, number] }
            : { text: '', width: 50 },
          {
            text: `Reporte de Estado — ${projectName}`,
            style: 'title',
            width: '*',
          },
        ],
        margin: [0, 0, 0, 5] as [number, number, number, number],
      },
      {
        text: format(new Date(), 'PPPp', { locale: es }),
        style: 'subtitle',
      },
      // Summary
      {
        text: `Horas totales trabajadas: ${totalWorked.toFixed(1)}h`,
        style: 'kpi',
        margin: [0, 5, 0, 3] as [number, number, number, number],
      },
      unassignedHours > 0
        ? {
            text: `Incluye "Sin asignar": ${unassignedHours.toFixed(1)}h`,
            style: 'mutedText',
            margin: [0, 0, 0, 5] as [number, number, number, number],
          }
        : { text: '' },
      {
        text: `Progreso general (sobre tareas estimadas): ${overallProgress}%`,
        style: 'kpi',
        margin: [0, 0, 0, 15] as [number, number, number, number],
      },
      // Tasks table
      {
        text: 'Detalle por tarea',
        style: 'sectionTitle',
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 60, 70, 60],
          body: taskTableBody,
        },
        layout: {
          hLineWidth: (i, node) => {
            if (i === 0 || i === 1 || i === node.table.body.length) return 1;
            return 0.5;
          },
          vLineWidth: () => 0,
          hLineColor: (i) => (i === 1 ? '#e5e7eb' : '#f1f5f9'),
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20] as [number, number, number, number],
      } as ContentTable,
      // Journal section (new page)
      { text: '', pageBreak: 'before' },
      {
        text: 'Bitácora completa (orden cronológico)',
        style: 'sectionTitle',
      },
      journalTableBody.length > 1
        ? ({
            table: {
              headerRows: 1,
              widths: [80, 80, 40, '*'],
              body: journalTableBody,
            },
            layout: {
              hLineWidth: (i, node) => {
                if (i === 0 || i === 1 || i === node.table.body.length) return 1;
                return 0.5;
              },
              vLineWidth: () => 0,
              hLineColor: (i) => (i === 1 ? '#e5e7eb' : '#f1f5f9'),
              paddingLeft: () => 8,
              paddingRight: () => 8,
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
          } as ContentTable)
        : {
            text: 'No hay entradas registradas.',
            style: 'mutedText',
            margin: [0, 5, 0, 0] as [number, number, number, number],
          },
    ],
    styles: reportStyles,
    defaultStyle: {
      font: 'Roboto',
    },
    pageMargins: [40, 40, 40, 60] as [number, number, number, number],
    footer: (currentPage, pageCount) => {
      return {
        text: `Página ${currentPage} de ${pageCount}`,
        alignment: 'center',
        fontSize: 9,
        color: '#666666',
        margin: [0, 10, 0, 0] as [number, number, number, number],
      };
    },
  };

  // Generate and download
  const timestamp = format(new Date(), 'yyyy-MM-dd_HHmm');
  pdfMake.createPdf(docDefinition).download(`reporte-estado-${projectName}-${timestamp}.pdf`);
}
