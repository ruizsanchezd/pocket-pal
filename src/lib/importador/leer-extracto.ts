import type { LineaExtracto } from '@/types/database';
import {
  lineasDeHojaCaixaBank,
  lineasDePdfCaixaBank,
  parsearExtractoCaixaBank,
  type TextoPdf,
} from './extracto-caixabank';

export const FORMATOS_EXTRACTO = '.csv,.xls,.xlsx,.pdf,text/csv,application/pdf,application/vnd.ms-excel';

/**
 * Lee un extracto de CaixaBank en cualquiera de sus formas. Las librerías de Excel y PDF son
 * pesadas y solo se descargan cuando hace falta.
 */
export async function leerExtracto(file: File): Promise<LineaExtracto[]> {
  const nombre = file.name.toLowerCase();
  if (nombre.endsWith('.pdf') || file.type === 'application/pdf') {
    return lineasDePdfCaixaBank(await textosDelPdf(file));
  }
  if (nombre.endsWith('.xls') || nombre.endsWith('.xlsx')) {
    const XLSX = await import('xlsx');
    const libro = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    return lineasDeHojaCaixaBank(XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: null }));
  }
  return parsearExtractoCaixaBank(await file.text());
}

async function textosDelPdf(file: File): Promise<TextoPdf[]> {
  const [pdfjs, { default: worker }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const carga = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const textos: TextoPdf[] = [];
  try {
    const doc = await carga.promise;
    for (let pagina = 1; pagina <= doc.numPages; pagina++) {
      const contenido = await (await doc.getPage(pagina)).getTextContent();
      for (const item of contenido.items) {
        if (!('str' in item)) continue;
        textos.push({ pagina, x: item.transform[4], y: item.transform[5], ancho: item.width, texto: item.str });
      }
    }
  } finally {
    await carga.destroy();
  }
  return textos;
}
