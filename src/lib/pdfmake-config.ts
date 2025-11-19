import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

// Configurar fuentes para pdfMake de forma compatible
const vfs =
  (pdfFonts as any).vfs ??
  (pdfFonts as any).pdfMake?.vfs ??
  pdfFonts;

if (typeof (pdfMake as any).setVfs === 'function') {
  // API moderna de pdfmake: evita tocar directamente pdfMake.vfs
  (pdfMake as any).setVfs(vfs);
} else {
  // Fallback por si la versión no tuviera setVfs
  try {
    (pdfMake as any).vfs = vfs;
  } catch (e) {
    console.warn('No se pudo asignar vfs directamente a pdfMake:', e);
  }
}

/**
 * Creates a PDF with proper font configuration
 * This avoids the "object is not extensible" error in Vite
 */
export function createConfiguredPdf(docDefinition: TDocumentDefinitions) {
  // En este punto pdfMake ya tiene el vfs configurado
  return (pdfMake as any).createPdf(docDefinition);
}

// Export pdfMake for compatibility
export { pdfMake };
