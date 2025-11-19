import * as pdfMakeModule from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

/**
 * Creates a PDF with proper font configuration
 * This avoids the "object is not extensible" error in Vite
 */
export function createConfiguredPdf(docDefinition: TDocumentDefinitions) {
  // Access the default export within the namespace
  const pdfMake = (pdfMakeModule as any).default || pdfMakeModule;
  return pdfMake.createPdf(docDefinition, null, null, (pdfFonts as any).pdfMake?.vfs || pdfFonts);
}

// Export pdfMake for compatibility
export { pdfMakeModule as pdfMake };
