import html2pdf from "html2pdf.js";

interface InvoicePdfParams {
  invoiceNumber: number;
  invoiceDate: string;
  projectName: string;
  ownerName?: string;
  items: Array<{
    description: string;
    entryDate: string;
    hours: number;
    rate: number;
    amount: number;
  }>;
  total: number;
  notes?: string;
}

export async function downloadInvoicePDF(params: InvoicePdfParams) {
  const logoUrl = "https://static.wixstatic.com/media/86b1c8_5b83096c35e8498db5dc4b56b0108526~mv2.png";
  const currency = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n);

  const rows = params.items
    .map(
      (i) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${i.description}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.entryDate}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${i.hours.toFixed(2)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${currency(i.rate)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${currency(i.amount)}</td>
    </tr>
  `
    )
    .join("");

  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI; padding:24px; max-width:900px">
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <img src="${logoUrl}" style="height:48px; object-fit:contain;" />
        <div>
          <div style="font-size:20px; font-weight:700;">Factura #${params.invoiceNumber}</div>
          <div style="color:#666">Fecha: ${params.invoiceDate}</div>
        </div>
      </div>
      ${params.ownerName ? `<div style="text-align:right;color:#333">Emitida por:<br/><strong>${params.ownerName}</strong></div>` : ""}
    </div>

    <div style="margin:12px 0 20px 0;">
      <div><strong>Proyecto:</strong> ${params.projectName}</div>
    </div>

    <table style="width:100%; border-collapse:collapse; font-size:14px;">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:2px solid #ddd; padding:8px;">Descripción</th>
          <th style="text-align:center; border-bottom:2px solid #ddd; padding:8px;">Fecha</th>
          <th style="text-align:right; border-bottom:2px solid #ddd; padding:8px;">Horas</th>
          <th style="text-align:right; border-bottom:2px solid #ddd; padding:8px;">Tarifa</th>
          <th style="text-align:right; border-bottom:2px solid #ddd; padding:8px;">Importe</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="display:flex; justify-content:flex-end; margin-top:16px;">
      <div style="min-width:260px;">
        <div style="display:flex; justify-content:space-between; padding:6px 0;">
          <div style="color:#666">Total</div>
          <div style="font-weight:700">${currency(params.total)}</div>
        </div>
      </div>
    </div>

    ${
      params.notes
        ? `
    <div style="margin-top:16px; color:#555; font-size:13px;">
      <strong>Notas:</strong><br/>${params.notes}
    </div>`
        : ""
    }
  </div>`;

  await html2pdf()
    .set({
      margin: 10,
      filename: `Factura-${params.invoiceNumber}.pdf`,
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(html)
    .save();
}
