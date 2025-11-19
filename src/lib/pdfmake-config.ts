import * as pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import { TDocumentDefinitions } from 'pdfmake/interfaces';

// Configurar VFS de fuentes incorporadas usando la API correcta
(pdfMake as any).addVirtualFileSystem(pdfFonts);

/**
 * Creates a PDF with proper font configuration
 * Uses addVirtualFileSystem instead of setVfs/direct assignment
 * to avoid "object is not extensible" errors in Vite
 */
export function createConfiguredPdf(docDefinition: TDocumentDefinitions) {
  return (pdfMake as any).createPdf(docDefinition);
}

// Export pdfMake for compatibility
export { pdfMake };
