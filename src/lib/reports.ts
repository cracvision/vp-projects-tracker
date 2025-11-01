// src/lib/reports.ts
import { BRAND_LOGO_URL, fetchAsDataUrl } from "@/lib/brand";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export async function wrapPdfHtml(opts: {
  title: string;
  subtitle?: string;
  body: string;
}) {
  const logo = await fetchAsDataUrl(BRAND_LOGO_URL);

  // A4 @ 96dpi ≈ 794px → fijamos ancho para que html2pdf calcule cortes estables
  return `
  <div id="pdf-root" class="pdf-root">
    <style>
      * { box-sizing: border-box; }
      .pdf-root { width: 794px; margin: 0 auto; font-family: Inter, system-ui, -apple-system, Segoe UI; color:#111; padding:24px; }
      h1,h2,h3 { margin: 0 0 8px 0; }
      .muted { color:#666; }
      .hr { height:1px; background:#e5e7eb; margin:16px 0; }
      .card { border:1px solid #eee; border-radius:10px; padding:12px; }
      table { width:100%; border-collapse: collapse; }
      th, td { padding:10px; border-bottom:1px solid #f1f5f9; font-size:14px; vertical-align: top; }
      th { text-align:left; font-weight:600; color:#334155; background:#f8fafc; }
      .entry { margin:10px 0; padding:10px; border:1px solid #f1f5f9; border-radius:8px; }
      .pre { white-space: pre-wrap; line-height:1.4; color:#374151; }
      .kpi { font-weight:600; }
      .header { display:flex; align-items:center; gap:12px; margin-bottom:10px; }
      .logo { height:28px; }
      ul, ol { padding-left: 18px; }

      /* --- Reglas de paginación para evitar "cortes mordidos" --- */
      .section, .entry, table, thead, tbody, tr, td, th, h2, h3, .header, .kpi, ul, ol, li {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .page-break {
        page-break-before: always;
        break-before: page;
      }
      @media print {
        .page-break {
          page-break-before: always;
          break-before: page;
        }
      }
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

export const fmt = (d: string | Date) =>
  format(new Date(d), "EEEE, d 'de' MMMM yyyy", { locale: es });

export const fmtTime = (d: string | Date) =>
  format(new Date(d), "HH:mm", { locale: es });

export const fmtStamp = (d: string | Date) =>
  format(new Date(d), "PPP '·' HH:mm", { locale: es });
