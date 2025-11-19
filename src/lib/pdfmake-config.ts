import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

// Configure virtual fonts
(pdfMake as any).vfs = pdfFonts;

export default pdfMake;
