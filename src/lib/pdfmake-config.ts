import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

/**
 * Creates a PDF with proper font configuration
 * This avoids the "object is not extensible" error in Vite
 */
export function createConfiguredPdf(docDefinition: TDocumentDefinitions) {
  return pdfMake.createPdf(docDefinition, null, null, (pdfFonts as any).pdfMake?.vfs || pdfFonts);
}

// Export pdfMake for compatibility
export { pdfMake };
