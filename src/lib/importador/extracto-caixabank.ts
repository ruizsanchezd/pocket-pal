import type { LineaExtracto } from '@/types/database';

/**
 * Lee el CSV de movimientos que descarga CaixaBankNow.
 *
 * Formato (septiembre 2026): UTF-8, separador `;`, unas líneas de preámbulo ("Tabla 1", el
 * IBAN, "Importes expresados en euros") y luego la cabecera
 * `Fecha;Fecha valor;Movimiento;Más datos;Importe;Saldo`. La cabecera llega con "Más" mal
 * codificado ("MÃ¡s"), así que las columnas se leen por posición, no por nombre.
 * Fechas `dd/MM/yyyy`, importes `-1.000,00`.
 *
 * Devuelve las líneas **en el orden del extracto** (la primera es la más reciente): el orden
 * intradía importa para que el usuario pueda revisar el extracto y PocketPal en paralelo.
 */
export function parsearExtractoCaixaBank(texto: string): LineaExtracto[] {
  const filas = texto.replace(/^\uFEFF/, '').split(/\r?\n/);
  const inicio = filas.findIndex(esCabecera);
  if (inicio === -1) {
    throw new Error(
      'No reconozco este archivo. De momento solo sé leer el CSV de movimientos de CaixaBank.'
    );
  }

  const lineas: LineaExtracto[] = [];
  for (const [i, fila] of filas.slice(inicio + 1).entries()) {
    if (!fila.trim()) continue;
    const campos = separarCampos(fila);
    const fecha = leerFecha(campos[0]);
    const importe = leerImporte(campos[4]);
    if (!fecha || importe === null) {
      throw new Error(`La línea ${inicio + i + 2} del extracto no tiene fecha o importe válidos.`);
    }
    lineas.push({
      fecha,
      fecha_valor: leerFecha(campos[1]),
      concepto: (campos[2] ?? '').trim(),
      mas_datos: (campos[3] ?? '').trim() || null,
      importe,
      saldo: leerImporte(campos[5]),
    });
  }
  return lineas;
}

function esCabecera(fila: string): boolean {
  const campos = separarCampos(fila).map((c) => c.trim().toLowerCase());
  return campos[0] === 'fecha' && campos[4] === 'importe';
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

function leerFecha(valor: string | undefined): string | null {
  const m = valor?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function leerImporte(valor: string | undefined): number | null {
  const limpio = valor?.trim().replace(/\./g, '').replace(',', '.');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}
