import { StyleDictionary } from 'pdfmake/interfaces';

export const invoiceStyles: StyleDictionary = {
  // Header styles
  invoiceTitle: {
    fontSize: 26,
    bold: true,
    color: '#1e293b', // slate-800
  },
  invoiceNumber: {
    fontSize: 11,
    color: '#64748b', // slate-500
  },
  
  // Section headers
  sectionHeader: {
    fontSize: 9,
    bold: true,
    color: '#475569', // slate-600
    margin: [0, 0, 0, 3] as [number, number, number, number],
  },
  
  // Company info
  companyName: {
    fontSize: 10,
    bold: true,
    color: '#334155', // slate-700
  },
  normalText: {
    fontSize: 9,
    color: '#334155',
  },
  
  // Table styles
  tableHeader: {
    fontSize: 9,
    bold: true,
    fillColor: '#f1f5f9', // slate-100
    color: '#1e293b', // slate-800
  },
  tableCell: {
    fontSize: 9,
    color: '#334155',
  },
  tableCellAlt: {
    fontSize: 9,
    color: '#334155',
    fillColor: '#f8fafc', // slate-50 - alternating rows
  },
  
  // Totals
  totalLabel: {
    fontSize: 12,
    bold: true,
    color: '#1e293b',
  },
  totalAmount: {
    fontSize: 12,
    bold: true,
    color: '#1e293b',
  },
  subtotalLabel: {
    fontSize: 10,
    color: '#475569',
  },
  subtotalAmount: {
    fontSize: 10,
    color: '#475569',
  },
  
  // Total tachado (cuando hay adjusted_total)
  strikethroughLabel: {
    fontSize: 9,
    color: '#94a3b8', // slate-400 (atenuado)
  },
  strikethroughAmount: {
    fontSize: 9,
    color: '#94a3b8',
    decoration: 'lineThrough',
  },
};
