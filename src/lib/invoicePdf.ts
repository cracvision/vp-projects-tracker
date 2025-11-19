import { TDocumentDefinitions, Content, ContentTable } from 'pdfmake/interfaces';
import pdfMake from './pdfmake-config';
import { invoiceStyles } from './invoice-styles';
import { BRAND_LOGO_URL, fetchAsDataUrl } from './brand';

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
  // Issuer data
  companyName?: string;
  companyAddress?: string;
  companyTaxId?: string;
  companyPhone?: string;
  companyEmail?: string;
  // Payment instructions
  paymentInstructions?: string;
  bankAccount?: string;
}

export async function downloadInvoicePDF(params: InvoicePdfParams) {
  const currency = (n: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "USD",
    }).format(n);

  // Load logo as dataURL
  let logoDataUrl = '';
  try {
    logoDataUrl = await fetchAsDataUrl(BRAND_LOGO_URL);
  } catch (err) {
    console.error("Error loading logo:", err);
  }

  // Build document definition
  const docDefinition: TDocumentDefinitions = {
    content: [
      buildHeader(logoDataUrl, params),
      buildCompanyAndDatesSection(params),
      { text: '', margin: [0, 10] } as Content,
      buildServicesTable(params, currency),
      { text: '', margin: [0, 15] } as Content,
      buildTotalsSection(params, currency),
      ...(params.notes ? [buildNotesSection(params.notes)] : []),
      ...(params.paymentInstructions || params.bankAccount 
        ? [buildPaymentInstructions(params)] 
        : []),
    ],
    styles: invoiceStyles,
    defaultStyle: {
      font: 'Roboto',
    },
    pageMargins: [40, 50, 40, 60] as [number, number, number, number],
    
    // Footer with page numbering
    footer: (currentPage, pageCount) => {
      return {
        text: `Página ${currentPage} de ${pageCount}`,
        alignment: 'center',
        fontSize: 9,
        color: '#64748b',
        margin: [0, 10, 0, 0] as [number, number, number, number],
      };
    },
  };

  // Generate and download
  pdfMake.createPdf(docDefinition).download(`Factura-${params.invoiceNumber}.pdf`);
}

function buildHeader(logoDataUrl: string, params: InvoicePdfParams): Content {
  return {
    columns: [
      // Logo with automatic aspect ratio
      logoDataUrl 
        ? { 
            image: logoDataUrl, 
            fit: [80, 30],
            margin: [0, 0, 0, 0] as [number, number, number, number],
          } 
        : { text: '', width: 80 },
      
      // Title and number aligned right
      {
        stack: [
          { 
            text: 'FACTURA', 
            style: 'invoiceTitle', 
            alignment: 'right',
            margin: [0, 0, 0, 5] as [number, number, number, number],
          },
          { 
            text: `#${params.invoiceNumber}`, 
            style: 'invoiceNumber', 
            alignment: 'right',
          },
        ],
        width: '*',
      },
    ],
    columnGap: 20,
    margin: [0, 0, 0, 20] as [number, number, number, number],
  };
}

function buildCompanyAndDatesSection(params: InvoicePdfParams): Content {
  // Left stack: issuer information
  const leftStack: any[] = [
    { 
      text: 'EMITIDA POR:', 
      style: 'sectionHeader',
      margin: [0, 0, 0, 5] as [number, number, number, number],
    }
  ];

  if (params.companyName) {
    leftStack.push({ 
      text: params.companyName, 
      style: 'companyName',
      margin: [0, 0, 0, 3] as [number, number, number, number],
    });
  }
  
  if (params.companyTaxId) {
    leftStack.push({ 
      text: `RFC/NIF: ${params.companyTaxId}`, 
      style: 'normalText',
      margin: [0, 0, 0, 2] as [number, number, number, number],
    });
  }
  
  if (params.companyAddress) {
    leftStack.push({ 
      text: params.companyAddress, 
      style: 'normalText',
      margin: [0, 0, 0, 2] as [number, number, number, number],
    });
  }
  
  if (params.companyPhone) {
    leftStack.push({ 
      text: `Tel: ${params.companyPhone}`, 
      style: 'normalText',
      margin: [0, 0, 0, 2] as [number, number, number, number],
    });
  }
  
  if (params.companyEmail) {
    leftStack.push({ 
      text: `Email: ${params.companyEmail}`, 
      style: 'normalText',
    });
  }

  // Right stack: dates and project
  const rightStack: any[] = [
    { 
      text: [
        { text: 'FECHA EMISIÓN: ', style: 'sectionHeader' },
        { text: params.invoiceDate, style: 'normalText' },
      ],
      margin: [0, 0, 0, 3] as [number, number, number, number],
    }
  ];

  if (params.dueDate) {
    rightStack.push({
      text: [
        { text: 'FECHA VENCIMIENTO: ', style: 'sectionHeader' },
        { text: params.dueDate, style: 'normalText' },
      ],
      margin: [0, 0, 0, 3] as [number, number, number, number],
    });
  }

  rightStack.push({
    text: [
      { text: 'PROYECTO: ', style: 'sectionHeader' },
      { text: params.projectName, style: 'normalText' },
    ],
  });

  return {
    columns: [
      { stack: leftStack, width: '*' },
      { 
        stack: rightStack, 
        width: '*',
        alignment: 'right',
      },
    ],
    columnGap: 30,
    margin: [0, 0, 0, 15] as [number, number, number, number],
  };
}

function buildServicesTable(
  params: InvoicePdfParams, 
  currency: (n: number) => string
): ContentTable {
  return {
    table: {
      headerRows: 1, // Headers repeat automatically on each page
      widths: ['*', 70, 50, 60, 70],
      body: [
        // Header row
        [
          { text: 'Descripción', style: 'tableHeader' },
          { text: 'Fecha', style: 'tableHeader', alignment: 'center' },
          { text: 'Horas', style: 'tableHeader', alignment: 'right' },
          { text: 'Tarifa', style: 'tableHeader', alignment: 'right' },
          { text: 'Importe', style: 'tableHeader', alignment: 'right' },
        ],
        // Data rows with alternating colors
        ...params.items.map((item, index) => [
          { 
            text: item.description, 
            style: index % 2 === 0 ? 'tableCell' : 'tableCellAlt',
          },
          { 
            text: item.entryDate, 
            style: index % 2 === 0 ? 'tableCell' : 'tableCellAlt',
            alignment: 'center',
          },
          { 
            text: item.hours.toFixed(2), 
            style: index % 2 === 0 ? 'tableCell' : 'tableCellAlt',
            alignment: 'right',
          },
          { 
            text: currency(item.rate), 
            style: index % 2 === 0 ? 'tableCell' : 'tableCellAlt',
            alignment: 'right',
          },
          { 
            text: currency(item.amount), 
            style: index % 2 === 0 ? 'tableCell' : 'tableCellAlt',
            alignment: 'right',
          },
        ]),
      ],
    },
    layout: {
      // Border and color configuration
      hLineWidth: (i, node) => {
        // Top header border (line 0) and bottom header border (line 1): thickness 1
        if (i === 0 || i === 1) return 1;
        // Final table border: thickness 1
        if (i === node.table.body.length) return 1;
        // Internal borders between rows: thickness 0.5
        return 0.5;
      },
      vLineWidth: () => {
        // No vertical borders
        return 0;
      },
      hLineColor: (i) => {
        // Header line: darker color
        if (i === 1) return '#cbd5e1'; // slate-300
        // Other lines: lighter color
        return '#e2e8f0'; // slate-200
      },
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
  } as ContentTable;
}

function buildTotalsSection(
  params: InvoicePdfParams, 
  currency: (n: number) => string
): Content {
  const totalsStack: any[] = [];

  // Subtotal
  totalsStack.push({
    columns: [
      { text: 'Subtotal:', style: 'subtotalLabel', width: 'auto' },
      { 
        text: currency(params.subtotal), 
        style: 'subtotalAmount', 
        alignment: 'right', 
        width: 100,
      },
    ],
    margin: [0, 0, 0, 4] as [number, number, number, number],
  });

  // Discount (if exists)
  if (params.discount && params.discount > 0) {
    totalsStack.push({
      columns: [
        { text: 'Descuento:', style: 'subtotalLabel', width: 'auto' },
        { 
          text: `-${currency(params.discount)}`, 
          style: 'subtotalAmount', 
          alignment: 'right', 
          width: 100,
        },
      ],
      margin: [0, 0, 0, 4] as [number, number, number, number],
    });
  }

  // Tax (if exists)
  if (params.taxRate && params.taxRate > 0 && params.taxAmount) {
    totalsStack.push({
      columns: [
        { text: `IVA (${params.taxRate}%):`, style: 'subtotalLabel', width: 'auto' },
        { 
          text: currency(params.taxAmount), 
          style: 'subtotalAmount', 
          alignment: 'right', 
          width: 100,
        },
      ],
      margin: [0, 0, 0, 4] as [number, number, number, number],
    });
  }

  // Separator line
  totalsStack.push({
    canvas: [
      {
        type: 'line',
        x1: 0,
        y1: 5,
        x2: 200,
        y2: 5,
        lineWidth: 1,
        lineColor: '#cbd5e1',
      },
    ],
    margin: [0, 5, 0, 10] as [number, number, number, number],
  });

  // Total
  totalsStack.push({
    columns: [
      { text: 'TOTAL ADEUDADO:', style: 'totalLabel', width: 'auto' },
      { 
        text: currency(params.total), 
        style: 'totalAmount', 
        alignment: 'right', 
        width: 100,
      },
    ],
  });

  return {
    stack: totalsStack,
    alignment: 'right',
    width: 250,
    margin: [0, 0, 0, 20] as [number, number, number, number],
  };
}

function buildNotesSection(notes: string): Content {
  return {
    stack: [
      { 
        text: 'NOTAS:', 
        style: 'sectionHeader', 
        margin: [0, 10, 0, 5] as [number, number, number, number],
      },
      { text: notes, style: 'normalText' },
    ],
    margin: [0, 0, 0, 15] as [number, number, number, number],
  };
}

function buildPaymentInstructions(params: InvoicePdfParams): Content {
  const stack: any[] = [
    { 
      text: 'INSTRUCCIONES DE PAGO:', 
      style: 'sectionHeader',
      margin: [0, 10, 0, 5] as [number, number, number, number],
    }
  ];

  if (params.bankAccount) {
    stack.push({ 
      text: `Cuenta bancaria: ${params.bankAccount}`, 
      style: 'normalText',
      margin: [0, 0, 0, 3] as [number, number, number, number],
    });
  }

  if (params.paymentInstructions) {
    stack.push({ 
      text: params.paymentInstructions, 
      style: 'normalText',
    });
  }

  return {
    stack,
    margin: [0, 0, 0, 0] as [number, number, number, number],
  };
}
