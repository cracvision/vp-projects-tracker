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

export const fmt = (d: string | Date) =>
  format(new Date(d), "EEEE, d 'de' MMMM yyyy", { locale: es });

export const fmtTime = (d: string | Date) =>
  format(new Date(d), "HH:mm", { locale: es });

export const fmtStamp = (d: string | Date) =>
  format(new Date(d), "PPP '·' HH:mm", { locale: es });
