import { addDays, addMonths, differenceInCalendarDays, format, parseISO, startOfMonth } from 'date-fns';
import type { Json } from '@/integrations/supabase/types';
import type { Categoria, LineaExtracto } from '@/types/database';
import { PALABRAS_VACIAS, PISTAS } from './pistas';

/**
 * Qué hacer con cada línea de un extracto bancario. Lógica pura: la pantalla
 * (`pages/ImportarExtracto.tsx`) solo la pinta y guarda lo que el usuario confirma.
 *
 * El importador aprende de `movimientos.lineas_extracto`: cada movimiento que ya vino del banco
 * dice cómo lo llamó el banco y en qué categoría lo dejó el usuario. No hay reglas aparte que
 * mantener: si el usuario recategoriza un movimiento, la siguiente importación ya lo sabe.
 *
 * Por orden, cada línea es:
 * 1. `anterior` — ya importada, o de antes de la última importación: ya se revisó.
 * 2. `apuntada` — ya existe en PocketPal (apuntada a mano o generada por un recurrente):
 *    solo se le guarda la línea del banco, no se crea nada.
 * 3. `anulada` — un cargo y su devolución (preautorizaciones de gasolinera, cuotas
 *    retrocedidas): se cancelan entre sí y no se importan.
 * 4. `nueva` — se creará, con una propuesta de concepto, fecha y categoría y un semáforo.
 */

export type Nivel = 'verde' | 'amarillo' | 'rojo';

export interface Propuesta {
  concepto: string;
  fecha: string; // yyyy-MM-dd
  categoria_id: string | null;
  subcategoria_id: string | null;
  recurrente_template_id: string | null;
  nivel: Nivel;
  motivo: string;
  /**
   * Bizum que liquida otra línea nueva de este extracto: copia su categoría cuando el
   * usuario se la ponga (mientras no toque este a mano).
   */
  sigueA?: number;
}

/** Lo que el importador necesita de cada movimiento ya registrado (de cualquier cuenta). */
export interface MovimientoConocido {
  id: string;
  fecha: string;
  concepto: string;
  cantidad: number;
  cuenta_id: string;
  categoria_id: string;
  subcategoria_id: string | null;
  recurrente_template_id: string | null;
  lineas_extracto: LineaExtracto[] | null;
}

interface FilaBase {
  /** Posición en el extracto (0 = primera línea, la más reciente). */
  pos: number;
  linea: LineaExtracto;
}

export type FilaImportacion =
  | (FilaBase & { tipo: 'anterior' })
  | (FilaBase & { tipo: 'apuntada'; movimiento: MovimientoConocido; aviso: string | null })
  | (FilaBase & { tipo: 'anulada'; con: number })
  | (FilaBase & {
      tipo: 'nueva';
      propuesta: Propuesta;
      /**
       * Otras líneas que se guardan con el movimiento: la retención de la que sale el comercio
       * y su devolución. Así se aprende el nombre y no reaparecen al reimportar.
       */
      lineasExtra: LineaExtracto[];
    });

export interface EntradaPlan {
  lineas: LineaExtracto[];
  cuentaId: string;
  conocidos: MovimientoConocido[];
  categorias: Categoria[];
  /** Ids de `gastos_recurrentes` que existen (activos o no): el FK no admite otros. */
  plantillas: Set<string>;
}

/** Lo que no se importó y es más antiguo que esto respecto a la última importación, se da por revisado. */
const DIAS_REVISION = 7;
/** Días de margen entre la fecha del banco y la que el usuario apuntó a mano. */
const TOLERANCIAS_DIAS = [0, 1, 3, 7];
/** Un cargo y su devolución llegan como mucho con estos días de diferencia. */
const DIAS_ANULACION = 2;
/** Un Bizum recibido suele liquidar un gasto de estos días anteriores. */
const DIAS_BIZUM = 3;
/** Categorías que no se pasan a un viaje aunque caigan dentro (el tabaco va siempre a Vicio). */
const NUNCA_EN_VIAJE = ['VICIO'];
/** Conceptos que no dicen de qué comercio es: nunca pasan de amarillo. */
const CONCEPTOS_GENERICOS = new Set(['COMPRA CON TARJETA']);
/** Primeras palabras que no identifican al comercio. */
const PALABRAS_GENERICAS = new Set([
  'COMPRA', 'PAGO', 'RECIBO', 'TRANSFER', 'TRANSFERENCIA', 'BIZUM', 'DEVOLUCION', 'CUOTA', 'PARA',
]);

// ─── Utilidades ──────────────────────────────────────────────────────────────

/**
 * Nombre del comercio sin lo que cambia de una vez a otra: mayúsculas, sin acentos ni
 * signos, y sin palabras con números (referencias, nº de licencia, fechas).
 * "Cabify ES 2621i6g" → "CABIFY ES"; "PAG PENSIONES 5485-56-…" → "PAG PENSIONES".
 */
export function claveComercio(texto: string): string {
  return normalizar(texto)
    .split(' ')
    .filter((p) => p && !/\d/.test(p))
    .join(' ');
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function esBizumGenerico(linea: LineaExtracto): boolean {
  const clave = claveComercio(linea.concepto);
  return clave === 'BIZUM RECIBIDO' || clave === 'BIZUM ENVIADO';
}

function esBizum(linea: LineaExtracto): boolean {
  return esBizumGenerico(linea) || linea.mas_datos?.trim().toUpperCase() === 'BIZUM';
}

/** Identifica una línea del extracto: el saldo tras la operación la hace única. */
export function huellaLinea(l: LineaExtracto): string {
  return [l.fecha, centimos(l.importe), l.saldo === null ? '' : centimos(l.saldo), l.concepto.trim()].join('|');
}

const centimos = (n: number) => Math.round(n * 100);
const mismoImporte = (a: number, b: number) => centimos(a) === centimos(b);
const dias = (a: string, b: string) => Math.abs(differenceInCalendarDays(parseISO(a), parseISO(b)));
const mes = (fecha: string) => fecha.slice(0, 7);
const euros = (n: number) =>
  `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** "LIDL MAD PASILLO" → "Lidl Mad Pasillo". Lo que ya trae minúsculas se deja como está. */
function conceptoLegible(linea: LineaExtracto): string {
  const base = linea.concepto.trim();
  const legible = base === base.toUpperCase()
    ? base.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, sep, letra) => sep + letra.toUpperCase())
    : base;
  // Bizum o transferencia con concepto propio ("Para sushi" + destinatario).
  if (/^para\s/i.test(base) && linea.mas_datos) {
    return `${legible} – ${linea.mas_datos.split(' ')[0]}`;
  }
  return legible;
}

/** Valida el JSON de `movimientos.lineas_extracto` (llega sin tipar de la base de datos). */
export function leerLineasExtracto(valor: Json | null | undefined): LineaExtracto[] | null {
  if (!Array.isArray(valor)) return null;
  const lineas: LineaExtracto[] = [];
  for (const l of valor) {
    if (!l || typeof l !== 'object' || Array.isArray(l)) continue;
    if (typeof l.fecha !== 'string' || typeof l.concepto !== 'string' || typeof l.importe !== 'number') continue;
    lineas.push({
      fecha: l.fecha,
      fecha_valor: typeof l.fecha_valor === 'string' ? l.fecha_valor : null,
      concepto: l.concepto,
      mas_datos: typeof l.mas_datos === 'string' ? l.mas_datos : null,
      importe: l.importe,
      saldo: typeof l.saldo === 'number' ? l.saldo : null,
    });
  }
  return lineas.length ? lineas : null;
}

/** Id de la categoría padre "Viajes", si existe. Sus subcategorías son viajes concretos. */
export function idCategoriaViajes(categorias: Categoria[]): string | null {
  return categorias.find((c) => !c.parent_id && normalizar(c.nombre) === 'VIAJES')?.id ?? null;
}

// ─── Aprendizaje ─────────────────────────────────────────────────────────────

interface Ejemplo {
  mov: MovimientoConocido;
  linea: LineaExtracto;
}

interface Historial {
  porClave: Map<string, Ejemplo[]>;
  porMasDatos: Map<string, Ejemplo[]>;
  porPrimeraPalabra: Map<string, Ejemplo[]>;
  porPalabra: Map<string, Ejemplo[]>;
}

function primeraPalabra(clave: string): string | null {
  const p = clave.split(' ')[0];
  return p && p.length >= 4 && !PALABRAS_GENERICAS.has(p) ? p : null;
}

function claveMasDatos(linea: LineaExtracto): string | null {
  const c = linea.mas_datos ? claveComercio(linea.mas_datos) : '';
  return c.length >= 3 && c !== 'BIZUM' ? c : null;
}

function construirHistorial(conocidos: MovimientoConocido[], categorias: Categoria[]): Historial {
  const ids = new Set(categorias.map((c) => c.id));
  const h: Historial = { porClave: new Map(), porMasDatos: new Map(), porPrimeraPalabra: new Map(), porPalabra: new Map() };
  const meter = (mapa: Map<string, Ejemplo[]>, clave: string | null, e: Ejemplo) => {
    if (!clave) return;
    mapa.set(clave, [...(mapa.get(clave) ?? []), e]);
  };
  for (const mov of conocidos) {
    // Si la categoría se borró, el ejemplo ya no enseña nada.
    if (!mov.lineas_extracto || !ids.has(mov.categoria_id)) continue;
    const limpio = mov.subcategoria_id && !ids.has(mov.subcategoria_id) ? { ...mov, subcategoria_id: null } : mov;
    for (const linea of mov.lineas_extracto) {
      // La devolución de una retención (o el +7 de una gasolina de −20 +7) no describe el gasto.
      if (esBizumGenerico(linea) || Math.sign(linea.importe) !== Math.sign(mov.cantidad)) continue;
      const clave = claveComercio(linea.concepto);
      const e = { mov: limpio, linea };
      meter(h.porClave, clave, e);
      meter(h.porMasDatos, claveMasDatos(linea), e);
      meter(h.porPrimeraPalabra, primeraPalabra(clave), e);
      for (const p of new Set(clave.split(' '))) meter(h.porPalabra, p, e);
    }
  }
  return h;
}

const categoriaDe = (e: Ejemplo) => `${e.mov.categoria_id}|${e.mov.subcategoria_id ?? ''}`;

function nombreCategoria(e: Ejemplo, categorias: Categoria[]): string {
  const nombre = (id: string | null) => categorias.find((c) => c.id === id)?.nombre;
  const sub = nombre(e.mov.subcategoria_id);
  return sub ? `${nombre(e.mov.categoria_id)} › ${sub}` : nombre(e.mov.categoria_id) ?? '?';
}

function veces(n: number): string {
  return n === 1 ? '1 vez' : `${n} veces`;
}

/** Propuesta a partir de lo aprendido, sin mirar el contexto de otras líneas. */
function proponer(linea: LineaExtracto, h: Historial, entrada: EntradaPlan, viajesId: string | null): Propuesta {
  const vacia: Propuesta = {
    concepto: conceptoLegible(linea),
    fecha: linea.fecha,
    categoria_id: null,
    subcategoria_id: null,
    recurrente_template_id: null,
    nivel: 'rojo',
    motivo: 'No lo has visto nunca: elige la categoría.',
  };

  if (esBizumGenerico(linea)) {
    return {
      ...vacia,
      concepto: linea.importe > 0 ? 'Bizum recibido' : 'Bizum enviado',
      motivo: linea.importe > 0
        ? 'El banco no dice quién te lo manda.'
        : 'El banco no dice a quién ni para qué.',
    };
  }

  const clave = claveComercio(linea.concepto);
  let ejemplos = h.porClave.get(clave) ?? [];
  let parecido: string | null = null;
  if (!ejemplos.length) {
    const porMas = claveMasDatos(linea);
    const palabra = primeraPalabra(clave);
    ejemplos = (porMas && h.porMasDatos.get(porMas)) || (palabra && h.porPrimeraPalabra.get(palabra)) || [];
    parecido = ejemplos[0]?.linea.concepto ?? null;
  }
  if (!ejemplos.length) return porPalabras(linea.concepto, h, entrada, viajesId, vacia);

  // Un viaje es de una vez: que "El Soportal" fuera al viaje a León no dice nada de la próxima.
  const normales = ejemplos.filter((e) => e.mov.categoria_id !== viajesId);
  if (!normales.length) {
    return porPalabras(linea.concepto, h, entrada, viajesId, {
      ...vacia,
      motivo: `Solo lo has visto en un viaje (${nombreCategoria(ejemplos[0], entrada.categorias)}).`,
    });
  }

  // Mismo comercio y mismo importe manda: APPLE.COM/BILL 2,99 es iCloud y 19,99 Notability.
  const mismoImp = normales.filter((e) => mismoImporte(e.linea.importe, linea.importe));
  const base = mismoImp.length && new Set(mismoImp.map(categoriaDe)).size === 1 ? mismoImp : normales;

  const cuenta = new Map<string, Ejemplo[]>();
  for (const e of base) cuenta.set(categoriaDe(e), [...(cuenta.get(categoriaDe(e)) ?? []), e]);
  const grupos = [...cuenta.values()].sort(
    (a, b) => b.length - a.length || masReciente(b).localeCompare(masReciente(a))
  );
  const elegido = grupos[0];
  const ref = elegido.reduce((a, b) => (a.mov.fecha >= b.mov.fecha ? a : b));

  let nivel: Nivel;
  let motivo: string;
  if (parecido) {
    nivel = 'amarillo';
    motivo = `Parecido a «${parecido}», que fue ${nombreCategoria(ref, entrada.categorias)}.`;
  } else if (grupos.length > 1) {
    nivel = 'amarillo';
    motivo = 'Otras veces: ' + grupos
      .map((g) => `${nombreCategoria(g[0], entrada.categorias)} (${g.length})`)
      .join(', ') + '.';
  } else if (elegido.length === 1) {
    nivel = 'amarillo';
    motivo = `Solo lo has visto 1 vez (${ref.mov.concepto}).`;
  } else if (CONCEPTOS_GENERICOS.has(clave)) {
    nivel = 'amarillo';
    motivo = `El banco no dice el comercio; otras veces fue ${nombreCategoria(ref, entrada.categorias)}.`;
  } else {
    nivel = 'verde';
    motivo = `Siempre ${nombreCategoria(ref, entrada.categorias)} (${veces(elegido.length)}).`;
  }

  // Si siempre lo reescribes igual ("BRUNOA SPORT" → "Gimnasio"), se reutiliza ese concepto.
  const [ultimo, penultimo] = [...elegido].sort((a, b) => b.mov.fecha.localeCompare(a.mov.fecha));
  const concepto = !parecido && penultimo && ultimo.mov.concepto === penultimo.mov.concepto
    ? ultimo.mov.concepto
    : conceptoLegible(linea);

  // Recurrente: si siempre fue la misma plantilla, el movimiento nuevo también.
  const plantilla = elegido[0].mov.recurrente_template_id;
  const recurrente_template_id = !parecido && grupos.length === 1 && plantilla && entrada.plantillas.has(plantilla) &&
    elegido.every((e) => e.mov.recurrente_template_id === plantilla) ? plantilla : null;

  // Alquiler y nómina se apuntan el día 1 del mes siguiente al cargo: se aprende de cómo
  // se apuntaron las otras veces.
  const alMesSiguiente = !parecido && elegido.length >= 2 && elegido.every(
    (e) => e.mov.fecha === format(startOfMonth(addMonths(parseISO(e.linea.fecha), 1)), 'yyyy-MM-dd')
  );
  const fecha = alMesSiguiente
    ? format(startOfMonth(addMonths(parseISO(linea.fecha), 1)), 'yyyy-MM-dd')
    : linea.fecha;
  if (alMesSiguiente) motivo += ' Lo apuntas el día 1 del mes siguiente.';

  return {
    concepto,
    fecha,
    categoria_id: ref.mov.categoria_id,
    subcategoria_id: ref.mov.subcategoria_id,
    recurrente_template_id,
    nivel,
    motivo,
  };
}

function conRetencion(p: Propuesta, retencion: LineaExtracto): Propuesta {
  return {
    ...p,
    motivo: `Cargo final de la retención de «${retencion.concepto}» (${euros(retencion.importe)}). ${p.motivo}`,
  };
}

/**
 * Para un comercio sin historial propio: primero una palabra que el usuario ya usa siempre
 * igual en otros comercios ("TAXI" en TAXI LIC y TAXI LEON → Taxi), y si no, una pista de la
 * lista fija (`pistas.ts`). Siempre amarillo: es una suposición.
 */
function porPalabras(texto: string, h: Historial, entrada: EntradaPlan, viajesId: string | null, sinPista: Propuesta): Propuesta {
  const clave = claveComercio(texto);
  // "Para sushi" + destinatario: el concepto lo escribió el usuario en su Bizum o
  // transferencia, no es un comercio (eran regalos de boda, no un japonés).
  if (clave.startsWith('PARA ')) return sinPista;
  const palabras = clave.split(' ');

  for (const p of palabras) {
    if (p.length < 3 || PALABRAS_VACIAS.has(p)) continue;
    const ejemplos = (h.porPalabra.get(p) ?? []).filter(
      (e) => e.mov.categoria_id !== viajesId && claveComercio(e.linea.concepto) !== clave
    );
    const comercios = [...new Set(ejemplos.map((e) => claveComercio(e.linea.concepto)))];
    if (comercios.length < 2 || new Set(ejemplos.map(categoriaDe)).size !== 1) continue;
    const ref = ejemplos.reduce((a, b) => (a.mov.fecha >= b.mov.fecha ? a : b));
    return {
      ...sinPista,
      categoria_id: ref.mov.categoria_id,
      subcategoria_id: ref.mov.subcategoria_id,
      nivel: 'amarillo',
      motivo: `Otros comercios con «${p}» (${comercios.slice(0, 2).join(', ')}) fueron ${nombreCategoria(ref, entrada.categorias)}.`,
    };
  }

  const buscar = (nombre: string, padre: string | null) =>
    entrada.categorias.find((c) => c.parent_id === padre && normalizar(c.nombre) === normalizar(nombre));
  // Para las pistas, las cifras separan palabras en vez de descartarlas: "FISIO4YOU" → FISIO.
  const palabrasPista = normalizar(texto).split(/[^A-Z]+/).filter(Boolean);
  for (const pista of PISTAS) {
    const palabra = pista.palabras.find((patron) => encajaPatron(palabrasPista, patron));
    if (!palabra) continue;
    const padre = buscar(pista.categoria, null);
    if (!padre) continue;
    const sub = pista.subcategoria ? buscar(pista.subcategoria, padre.id) : undefined;
    const nombre = sub ? `${padre.nombre} › ${sub.nombre}` : padre.nombre;
    const texto = palabra.replace('*', '');
    return {
      ...sinPista,
      categoria_id: padre.id,
      subcategoria_id: sub?.id ?? null,
      nivel: 'amarillo',
      motivo: padre.id === viajesId
        ? `«${texto}» suena a viaje: usa «Estuve de viaje» para elegir cuál.`
        : `Pista: «${texto}» suele ser ${nombre}.`,
    };
  }

  return sinPista;
}

/** `BAR` palabra entera, `RESTAUR*` prefijo, `UBER EATS` palabras seguidas (ver `pistas.ts`). */
export function encajaPatron(palabras: string[], patron: string): boolean {
  const partes = patron.split(' ');
  for (let i = 0; i + partes.length <= palabras.length; i++) {
    if (partes.every((parte, j) => encajaPalabra(palabras[i + j], parte, i + j === palabras.length - 1))) return true;
  }
  return false;
}

function encajaPalabra(palabra: string, parte: string, esUltima: boolean): boolean {
  const prefijo = parte.endsWith('*');
  const raiz = prefijo ? parte.slice(0, -1) : parte;
  if (prefijo ? palabra.startsWith(raiz) : palabra === raiz) return true;
  // El banco corta el concepto: la última palabra puede venir a medias ("RESTAURACI").
  return esUltima && palabra.length >= 4 && raiz.startsWith(palabra);
}

const masReciente = (g: Ejemplo[]) => g.reduce((m, e) => (e.mov.fecha > m ? e.mov.fecha : m), '');

// ─── Plan ────────────────────────────────────────────────────────────────────

export function planificarImportacion(entrada: EntradaPlan): FilaImportacion[] {
  const { lineas, cuentaId, conocidos, categorias } = entrada;
  const filas: (FilaImportacion | null)[] = lineas.map(() => null);

  // 1. Lo ya importado, y lo que es más de una semana anterior a la última importación
  //    (cargos que se anularon, líneas que el usuario descartó: ya se revisaron). Por
  //    posición no vale: el Spotify del día 22 puede estar enlazado y un Bizum de ese
  //    mismo día, debajo en el extracto, no.
  const conocidas = new Set(conocidos.flatMap((m) => (m.lineas_extracto ?? []).map(huellaLinea)));
  const ultimaImportada = conocidos
    .filter((m) => m.cuenta_id === cuentaId)
    .flatMap((m) => (m.lineas_extracto ?? []).map((l) => l.fecha))
    .reduce<string | null>((max, f) => (!max || f > max ? f : max), null);
  const limite = ultimaImportada
    ? format(addDays(parseISO(ultimaImportada), -DIAS_REVISION), 'yyyy-MM-dd')
    : null;
  lineas.forEach((linea, pos) => {
    if (conocidas.has(huellaLinea(linea)) || (limite && linea.fecha < limite)) {
      filas[pos] = { tipo: 'anterior', pos, linea };
    }
  });
  const pendientes = () => lineas.map((linea, pos) => ({ linea, pos })).filter(({ pos }) => !filas[pos]);

  // 2. Lo que ya está apuntado a mano o por un recurrente: mismo importe, fecha más cercana.
  const libres = conocidos.filter((m) => m.cuenta_id === cuentaId && !m.lineas_extracto);
  const usados = new Set<string>();
  for (const tol of TOLERANCIAS_DIAS) {
    for (const { linea, pos } of pendientes()) {
      const candidatos = libres.filter(
        (m) => !usados.has(m.id) && mismoImporte(m.cantidad, linea.importe) && dias(m.fecha, linea.fecha) <= tol
      );
      if (!candidatos.length) continue;
      const m = candidatos.reduce((a, b) => (dias(a.fecha, linea.fecha) <= dias(b.fecha, linea.fecha) ? a : b));
      usados.add(m.id);
      filas[pos] = { tipo: 'apuntada', pos, linea, movimiento: m, aviso: null };
    }
  }

  // 3. Cargo y devolución del mismo importe en pocos días: se anulan. Los Bizum no, porque un
  //    Bizum que devuelve un gasto entero es un movimiento real (el gasto compartido).
  for (const { linea, pos } of pendientes()) {
    if (linea.importe <= 0 || esBizum(linea) || filas[pos]) continue;
    const pareja = pendientes().find(
      (o) => !filas[o.pos] && o.linea.importe < 0 && !esBizum(o.linea) &&
        mismoImporte(-o.linea.importe, linea.importe) && dias(o.linea.fecha, linea.fecha) <= DIAS_ANULACION
    );
    if (!pareja) continue;
    filas[pos] = { tipo: 'anulada', pos, linea, con: pareja.pos };
    filas[pareja.pos] = { tipo: 'anulada', pos: pareja.pos, linea: pareja.linea, con: pos };
  }

  // 4. Lo nuevo: propuesta aprendida del historial.
  const historial = construirHistorial(conocidos, categorias);
  const viajesId = idCategoriaViajes(categorias);
  const retencionesUsadas = new Set<number>();
  for (const { linea, pos } of pendientes()) {
    // En gasolineras el banco retiene con el nombre de la estación ("MOLGAS ENERGIA −100"),
    // lo devuelve, y el cargo real llega como "COMPRA CON TARJETA" justo encima. El
    // comercio se toma de la retención anulada más cercana por debajo.
    const retencion = CONCEPTOS_GENERICOS.has(claveComercio(linea.concepto))
      ? filas.find((f): f is FilaBase & { tipo: 'anulada'; con: number } =>
          f?.tipo === 'anulada' && f.pos > pos && f.linea.importe < 0 &&
          !retencionesUsadas.has(f.pos) && dias(f.linea.fecha, linea.fecha) <= DIAS_ANULACION)
      : undefined;
    if (retencion) retencionesUsadas.add(retencion.pos);
    const propuesta = retencion
      ? conRetencion(proponer({ ...linea, concepto: retencion.linea.concepto }, historial, entrada, viajesId), retencion.linea)
      : proponer(linea, historial, entrada, viajesId);
    const tpl = propuesta.recurrente_template_id;
    if (tpl) {
      // El recurrente de ese mes ya existe (p. ej. el Salario del día 1 con el importe
      // estimado): se enlaza aunque el importe no coincida, y se avisa.
      const delMes = conocidos.filter(
        (m) => m.cuenta_id === cuentaId && m.recurrente_template_id === tpl && mes(m.fecha) === mes(propuesta.fecha)
      );
      const libre = delMes.find((m) => !m.lineas_extracto && !usados.has(m.id));
      if (libre) {
        usados.add(libre.id);
        filas[pos] = {
          tipo: 'apuntada', pos, linea, movimiento: libre,
          aviso: mismoImporte(libre.cantidad, linea.importe)
            ? null
            : `El banco dice ${euros(linea.importe)} y en PocketPal tienes ${euros(libre.cantidad)}.`,
        };
        continue;
      }
      if (delMes.length) {
        // Ya hay uno ese mes y viene de otra línea: crear otro con la plantilla chocaría con
        // el UNIQUE de recurrentes. Se propone como movimiento normal y se avisa.
        propuesta.recurrente_template_id = null;
        propuesta.nivel = 'amarillo';
        propuesta.motivo = `Ya tienes «${delMes[0].concepto}» este mes. ¿Es otro cargo?`;
      }
    }
    const lineasExtra = retencion ? [retencion.linea, lineas[retencion.con]] : [];
    filas[pos] = { tipo: 'nueva', pos, linea, propuesta, lineasExtra };
  }

  // 5. Bizum recibido: suele ser tu parte de un gasto compartido de los días anteriores. Los
  //    recurrentes (alquiler, suscripciones) no se comparten.
  const gastos = [
    ...conocidos
      .filter((m) => m.cantidad < 0 && !m.recurrente_template_id && !normalizar(m.concepto).startsWith('BIZUM') &&
        !(m.lineas_extracto ?? []).some(esBizum))
      .map((m) => ({ pos: null as number | null, fecha: m.fecha, importe: m.cantidad, concepto: m.concepto, categoria_id: m.categoria_id as string | null, subcategoria_id: m.subcategoria_id })),
    ...filas.flatMap((f) =>
      f?.tipo === 'nueva' && f.linea.importe < 0 && !esBizum(f.linea) && !f.propuesta.recurrente_template_id
        ? [{ pos: f.pos as number | null, fecha: f.linea.fecha, importe: f.linea.importe, concepto: f.propuesta.concepto, categoria_id: f.propuesta.categoria_id, subcategoria_id: f.propuesta.subcategoria_id }]
        : []
    ),
  ];
  for (const f of filas) {
    if (f?.tipo !== 'nueva' || !esBizumGenerico(f.linea) || f.linea.importe <= 0) continue;
    const fecha = parseISO(f.linea.fecha);
    const candidato = gastos
      .filter((g) => {
        const d = differenceInCalendarDays(fecha, parseISO(g.fecha));
        return d >= 0 && d <= DIAS_BIZUM && -g.importe > f.linea.importe;
      })
      // El más reciente y, a igualdad, el más pequeño que aún cubre el Bizum.
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.importe - a.importe)[0];
    if (!candidato) continue;
    f.propuesta = {
      ...f.propuesta,
      categoria_id: candidato.categoria_id,
      subcategoria_id: candidato.subcategoria_id,
      nivel: candidato.categoria_id ? 'amarillo' : 'rojo',
      motivo: `¿Te devuelven parte de «${candidato.concepto}» (${euros(candidato.importe)})?` +
        (candidato.categoria_id ? '' : ' Cuando le pongas categoría, este Bizum la copia.'),
      ...(candidato.pos !== null ? { sigueA: candidato.pos } : {}),
    };
  }

  return filas as FilaImportacion[];
}

// ─── Viajes ──────────────────────────────────────────────────────────────────

/**
 * Posiciones de las filas nuevas que "estos días estuve de viaje" debe pasar al viaje:
 * las que caen entre `desde` y `hasta` (fecha del banco), salvo recurrentes y lo que va a
 * una categoría de `NUNCA_EN_VIAJE`.
 */
export function filasDelViaje(
  filas: { pos: number; linea: LineaExtracto; categoria_id: string | null; subcategoria_id: string | null; recurrente_template_id: string | null }[],
  desde: string,
  hasta: string,
  categorias: Categoria[]
): number[] {
  const excluida = (id: string | null) => {
    const c = categorias.find((x) => x.id === id);
    return !!c && NUNCA_EN_VIAJE.includes(normalizar(c.nombre));
  };
  return filas
    .filter((f) => f.linea.fecha >= desde && f.linea.fecha <= hasta)
    .filter((f) => !f.recurrente_template_id && !excluida(f.categoria_id) && !excluida(f.subcategoria_id))
    .map((f) => f.pos);
}
