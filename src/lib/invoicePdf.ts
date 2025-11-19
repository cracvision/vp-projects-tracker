import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BRAND_LOGO_URL, fetchAsDataUrl } from "./brand";

interface InvoicePdfParams {
  invoiceNumber: number;
  invoiceDate: string;
  dueDate?: string;
  projectName: string;
  items: Array<{
    description: string;
    entryDate: string;
    hours: number;
    rate: number;
    amount: number;
  }>;
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: number;
  total: number;
  notes?: string;
  // Datos del emisor
  companyName?: string;
  companyAddress?: string;
  companyTaxId?: string;
  companyPhone?: string;
  companyEmail?: string;
  // Instrucciones de pago
  paymentInstructions?: string;
  bankAccount?: string;
}

export async function downloadInvoicePDF(params: InvoicePdfParams) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const currency = (n: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "USD",
    }).format(n);

  let y = 15;

  // Logo
  try {
    const logoDataUrl = await fetchAsDataUrl(BRAND_LOGO_URL);
    doc.addImage(logoDataUrl, "PNG", 15, y, 40, 15);
  } catch (err) {
    console.error("Error loading logo:", err);
  }

  // "FACTURA" título
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("FACTURA", 195, y + 8, { align: "right" });

  // Número de factura
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`#${params.invoiceNumber}`, 195, y + 15, { align: "right" });

  y += 25;

  // Información del Emisor (lado izquierdo)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("EMITIDA POR:", 15, y);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  y += 5;
  
  if (params.companyName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(params.companyName, 15, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
  }
  
  if (params.companyTaxId) {
    doc.text(`RFC/NIF: ${params.companyTaxId}`, 15, y);
    y += 4;
  }
  
  if (params.companyAddress) {
    const addressLines = doc.splitTextToSize(params.companyAddress, 80);
    doc.text(addressLines, 15, y);
    y += addressLines.length * 4;
  }
  
  if (params.companyPhone) {
    doc.text(`Tel: ${params.companyPhone}`, 15, y);
    y += 4;
  }
  
  if (params.companyEmail) {
    doc.text(`Email: ${params.companyEmail}`, 15, y);
    y += 4;
  }

  // Fechas e información (lado derecho)
  let rightY = 45;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("FECHA EMISIÓN:", 130, rightY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(params.invoiceDate, 195, rightY, { align: "right" });
  rightY += 6;

  if (params.dueDate) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("FECHA VENCIMIENTO:", 130, rightY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(params.dueDate, 195, rightY, { align: "right" });
    rightY += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("PROYECTO:", 130, rightY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  const projectLines = doc.splitTextToSize(params.projectName, 60);
  doc.text(projectLines, 195, rightY, { align: "right" });

  y = Math.max(y, rightY + projectLines.length * 5) + 10;

  // Tabla de servicios con autoTable
  autoTable(doc, {
    startY: y,
    head: [["Descripción", "Fecha", "Horas", "Tarifa", "Importe"]],
    body: params.items.map((i) => [
      i.description,
      i.entryDate,
      i.hours.toFixed(2),
      currency(i.rate),
      currency(i.amount),
    ]),
    columnStyles: {
      0: { cellWidth: 85 },
      1: { cellWidth: 25, halign: "center" },
      2: { cellWidth: 20, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      textColor: [51, 65, 85],
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [51, 65, 85],
      fontStyle: "bold",
      halign: "left",
      lineWidth: 0.1,
      lineColor: [203, 213, 225],
    },
    alternateRowStyles: {
      fillColor: [252, 252, 253],
    },
    margin: { left: 15, right: 15 },
  });

  // Totales
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const totalsX = 130;
  let totalsY = finalY;

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);

  // Subtotal
  doc.text("Subtotal:", totalsX, totalsY);
  doc.text(currency(params.subtotal), 195, totalsY, { align: "right" });
  totalsY += 6;

  // Descuento
  if (params.discount && params.discount > 0) {
    doc.text("Descuento:", totalsX, totalsY);
    doc.text(`-${currency(params.discount)}`, 195, totalsY, { align: "right" });
    totalsY += 6;
  }

  // Impuestos
  if (params.taxRate && params.taxRate > 0 && params.taxAmount) {
    doc.text(`IVA (${params.taxRate}%):`, totalsX, totalsY);
    doc.text(currency(params.taxAmount), 195, totalsY, { align: "right" });
    totalsY += 6;
  }

  // Línea divisoria
  doc.setDrawColor(203, 213, 225);
  doc.line(totalsX, totalsY, 195, totalsY);
  totalsY += 5;

  // Total
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("TOTAL ADEUDADO:", totalsX, totalsY);
  doc.text(currency(params.total), 195, totalsY, { align: "right" });
  totalsY += 10;

  // Notas
  if (params.notes) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("NOTAS:", 15, totalsY);
    totalsY += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    const notesLines = doc.splitTextToSize(params.notes, 180);
    doc.text(notesLines, 15, totalsY);
    totalsY += notesLines.length * 4 + 5;
  }

  // Instrucciones de pago
  if (params.paymentInstructions || params.bankAccount) {
    // Verificar si necesitamos nueva página
    if (totalsY > 250) {
      doc.addPage();
      totalsY = 20;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("INSTRUCCIONES DE PAGO:", 15, totalsY);
    totalsY += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);

    if (params.bankAccount) {
      doc.text(`Cuenta bancaria: ${params.bankAccount}`, 15, totalsY);
      totalsY += 5;
    }

    if (params.paymentInstructions) {
      const paymentLines = doc.splitTextToSize(params.paymentInstructions, 180);
      doc.text(paymentLines, 15, totalsY);
    }
  }

  // Guardar PDF
  doc.save(`Factura-${params.invoiceNumber}.pdf`);
}
