import type { LineaExtracto } from '@/types/database';

/**
 * Lectores del extracto de movimientos de CaixaBankNow, en sus tres formas: el CSV, el Excel
 * que descarga el banco (.xls) y el PDF que sale de imprimir la página de movimientos.
 *
 * Todos devuelven las líneas **en el orden del extracto** (la primera es la más reciente): el
 * orden intradía importa para que el usuario pueda revisar el extracto y PocketPal en paralelo.
 */

type Celda = string | number | null | undefined;

const NO_RECONOZCO =
  'No reconozco este archivo. Sé leer el extracto de movimientos de CaixaBank en CSV, Excel o PDF.';

/**
 * CSV (septiembre 2026): UTF-8, separador `;`, unas líneas de preámbulo ("Tabla 1", el IBAN,
 * "Importes expresados en euros") y luego la cabecera
 * `Fecha;Fecha valor;Movimiento;Más datos;Importe;Saldo`. La cabecera llega con "Más" mal
 * codificado ("MÃ¡s"), así que las columnas se leen por posición, no por nombre.
 * Fechas `dd/MM/yyyy`, importes `-1.000,00`.
 */
export function parsearExtractoCaixaBank(texto: string): LineaExtracto[] {
  return lineasDeTabla(texto.replace(/^\uFEFF/, '').split(/\r?\n/).map(separarCampos));
}

/**
 * Excel (.xls): las mismas columnas que el CSV, pero las fechas llegan como número de serie de
 * Excel y los importes como números. `filas` es la hoja tal cual (una fila por array).
 */
export function lineasDeHojaCaixaBank(filas: Celda[][]): LineaExtracto[] {
  return lineasDeTabla(filas);
}

function lineasDeTabla(filas: Celda[][]): LineaExtracto[] {
  const inicio = filas.findIndex(esCabecera);
  if (inicio === -1) throw new Error(NO_RECONOZCO);

  const lineas: LineaExtracto[] = [];
  for (const [i, campos] of filas.slice(inicio + 1).entries()) {
    if (campos.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;
    const fecha = leerFecha(campos[0]);
    const importe = leerImporte(campos[4]);
    if (!fecha || importe === null) {
      throw new Error(`La línea ${inicio + i + 2} del extracto no tiene fecha o importe válidos.`);
    }
    lineas.push({
      fecha,
      fecha_valor: leerFecha(campos[1]),
      concepto: texto(campos[2]),
      mas_datos: texto(campos[3]) || null,
      importe,
      saldo: leerImporte(campos[5]),
    });
  }
  return comprobarSaldos(lineas);
}

function esCabecera(campos: Celda[]): boolean {
  return texto(campos[0]).toLowerCase() === 'fecha' && texto(campos[4]).toLowerCase() === 'importe';
}

/** Separa por `;` respetando campos entre comillas (con `""` como comilla escapada). */
function separarCampos(fila: string): string[] {
  const campos: string[] = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < fila.length; i++) {
    const c = fila[i];
    if (entreComillas) {
      if (c === '"' && fila[i + 1] === '"') {
        actual += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        actual += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ';') {
      campos.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  campos.push(actual);
  return campos;
}

const texto = (valor: Celda) => (valor === null || valor === undefined ? '' : String(valor).trim());

function leerFecha(valor: Celda): string | null {
  if (typeof valor === 'number') {
    // Número de serie de Excel: días desde el 30/12/1899.
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86_400_000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const m = texto(valor).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function leerImporte(valor: Celda): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const limpio = texto(valor).replace(/\./g, '').replace(',', '.');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

// ─── PDF ────────────────────────────────────────────────────────────────────────────────────

/** Un trozo de texto del PDF con su posición (en puntos, `y` crece hacia arriba). */
export interface TextoPdf {
  pagina: number;
  x: number;
  y: number;
  ancho: number;
  texto: string;
}

const MESES: Record<string, string> = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
};

/** Distancia vertical máxima entre la fecha de una fila y el resto de su texto. */
const ALTO_FILA = 8;

/**
 * PDF: la página de movimientos de CaixaBankNow impresa desde el navegador (septiembre 2026).
 * Cada página repite la cabecera `Fecha | Concepto | Más datos | Importe | Saldo`; debajo, una
 * fila por movimiento: `25 Sep 2026 | BIZUM RECIBIDO | BIZUM | + 9,00 € | + 4.508,32 €`.
 *
 * Las columnas se reconocen por la posición de la cabecera en la página, no por el texto: el
 * concepto y "Más datos" pueden llevar cualquier cosa. Un "Más datos" largo parte en dos
 * renglones ("CUOTA AGRUPADA MYBOX 01-09-" / "2026") y se vuelve a juntar. Solo trae una fecha
 * (la de la operación, la misma que la primera columna del CSV): `fecha_valor` queda vacía.
 */
export function lineasDePdfCaixaBank(textos: TextoPdf[]): LineaExtracto[] {
  // El navegador imprime cada texto dos veces, uno encima de otro.
  const vistos = new Set<string>();
  const unicos = textos.filter((t) => {
    const clave = `${t.pagina}|${t.x.toFixed(1)}|${t.y.toFixed(1)}|${t.texto}`;
    if (!t.texto.trim() || vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });

  const lineas: LineaExtracto[] = [];
  const paginas = [...new Set(unicos.map((t) => t.pagina))].sort((a, b) => a - b);
  for (const pagina of paginas) {
    const dePagina = unicos.filter((t) => t.pagina === pagina);
    const cabecera = columnasDeCabecera(dePagina);
    if (!cabecera) continue;
    const { columnas, y: yCabecera } = cabecera;

    const cuerpo = dePagina.filter((t) => t.y < yCabecera - ALTO_FILA / 2);
    const fechas = cuerpo
      .filter((t) => t.x < columnas.concepto && leerFechaPdf(t.texto))
      .sort((a, b) => b.y - a.y);

    for (const f of fechas) {
      const fila = cuerpo.filter(
        (t) => t !== f && t.x >= columnas.concepto - 2 && Math.abs(t.y - f.y) <= ALTO_FILA
      );
      const importes = fila.filter((t) => leerImportePdf(t.texto) !== null);
      // Los importes van alineados a la derecha: se asignan por dónde acaban.
      const importe = importes.find((t) => Math.abs(t.x + t.ancho - columnas.finImporte) < 3);
      const saldo = importes.find((t) => Math.abs(t.x + t.ancho - columnas.finSaldo) < 3);
      if (!importe) {
        throw new Error(`No encuentro el importe de la línea del ${f.texto} en la página ${pagina} del PDF.`);
      }
      const resto = fila.filter((t) => !importes.includes(t));
      const esConcepto = (t: TextoPdf) => t.x < columnas.masDatos - 2;
      lineas.push({
        fecha: leerFechaPdf(f.texto) as string,
        fecha_valor: null,
        concepto: juntarRenglones(resto.filter(esConcepto)),
        mas_datos: juntarRenglones(resto.filter((t) => !esConcepto(t))) || null,
        importe: leerImportePdf(importe.texto) as number,
        saldo: saldo ? leerImportePdf(saldo.texto) : null,
      });
    }
  }

  if (!lineas.length) throw new Error(NO_RECONOZCO);
  return comprobarSaldos(lineas);
}

interface ColumnasPdf {
  concepto: number;
  masDatos: number;
  finImporte: number;
  finSaldo: number;
}

function columnasDeCabecera(textos: TextoPdf[]): { columnas: ColumnasPdf; y: number } | null {
  const buscar = (nombre: string) => textos.find((t) => t.texto.trim().toLowerCase() === nombre);
  const concepto = buscar('concepto');
  if (!concepto) return null;
  const enSuFila = (nombre: string) =>
    textos.find((t) => t.texto.trim().toLowerCase() === nombre && Math.abs(t.y - concepto.y) < 2);
  const masDatos = enSuFila('más datos');
  const importe = enSuFila('importe');
  const saldo = enSuFila('saldo');
  if (!masDatos || !importe || !saldo) return null;
  return {
    y: concepto.y,
    columnas: {
      concepto: concepto.x,
      masDatos: masDatos.x,
      finImporte: importe.x + importe.ancho,
      finSaldo: saldo.x + saldo.ancho,
    },
  };
}

/** Junta los renglones de una celda de arriba abajo. Tras un guion no hay espacio ("01-09-" + "2026"). */
function juntarRenglones(textos: TextoPdf[]): string {
  return [...textos]
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((t) => t.texto.trim())
    .reduce((acc, t) => (!acc ? t : acc.endsWith('-') ? acc + t : `${acc} ${t}`), '');
}

function leerFechaPdf(valor: string): string | null {
  const m = valor.trim().match(/^(\d{1,2}) ([A-Za-zÁÉÍÓÚáéíóú]{3})[a-z]*\.? (\d{4})$/);
  const mes = m && MESES[m[2].toLowerCase()];
  return m && mes ? `${m[3]}-${mes}-${m[1].padStart(2, '0')}` : null;
}

function leerImportePdf(valor: string): number | null {
  const m = valor.trim().match(/^([+\-−])?\s*([\d.]+,\d{2})\s*€$/);
  if (!m) return null;
  const n = Number(m[2].replace(/\./g, '').replace(',', '.'));
  return m[1] === '-' || m[1] === '−' ? -n : n;
}

// ─── Comprobación ───────────────────────────────────────────────────────────────────────────

/**
 * Cada saldo tiene que ser el de la línea de debajo más su importe. Si no cuadra, el archivo se
 * ha leído mal (o no es un extracto completo) y es mejor no proponer nada que proponer algo raro.
 */
function comprobarSaldos(lineas: LineaExtracto[]): LineaExtracto[] {
  for (let i = 0; i < lineas.length - 1; i++) {
    const { saldo, importe, fecha, concepto } = lineas[i];
    const anterior = lineas[i + 1].saldo;
    if (saldo === null || anterior === null) continue;
    if (Math.round((anterior + importe) * 100) !== Math.round(saldo * 100)) {
      const [a, m, d] = fecha.split('-');
      throw new Error(
        `Las cuentas no cuadran en la línea del ${d}/${m}/${a} (${concepto}): el saldo no es el de ` +
          'la línea anterior más su importe. Puede que el archivo no se haya leído bien.'
      );
    }
  }
  return lineas;
}
