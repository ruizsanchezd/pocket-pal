import { describe, it, expect } from 'vitest';
import { parsearExtractoCaixaBank } from '@/lib/importador/extracto-caixabank';
import {
  claveComercio,
  filasDelViaje,
  planificarImportacion,
  type EntradaPlan,
  type FilaImportacion,
  type MovimientoConocido,
} from '@/lib/importador/planificar';
import type { Categoria, LineaExtracto } from '@/types/database';

const CUENTA = 'caixa';

function cat(id: string, nombre: string, parent_id: string | null = null): Categoria {
  return { id, nombre, parent_id, user_id: 'u', tipo: 'gasto', icono: null, color: '#000', orden: 0, created_at: '' };
}

const CATEGORIAS = [
  cat('super', 'Supermercado'), cat('lidl', 'LIDL', 'super'),
  cat('servicios', 'Servicios'), cat('icloud', 'iCloud', 'servicios'), cat('notability', 'Notability', 'servicios'),
  cat('gimnasio', 'Gimnasio', 'servicios'),
  cat('ocio', 'Ocio'), cat('restaurante', 'Restaurante', 'ocio'), cat('vicio', 'Vicio', 'ocio'),
  cat('coche', 'Coche'), cat('gasolina', 'Gasolina', 'coche'),
  cat('casa', 'Casa'), cat('salario', 'Salario'),
  cat('viajes', 'Viajes'), cat('leon', 'León Agosto', 'viajes'),
];

let saldo = 1000;
function linea(fecha: string, concepto: string, importe: number, mas_datos: string | null = null): LineaExtracto {
  saldo += importe;
  return { fecha, fecha_valor: fecha, concepto, mas_datos, importe, saldo: Math.round(saldo * 100) / 100 };
}

let n = 0;
function mov(fecha: string, concepto: string, cantidad: number, categoria_id: string, subcategoria_id: string | null, lineas: LineaExtracto[] | null, extra: Partial<MovimientoConocido> = {}): MovimientoConocido {
  return {
    id: `m${++n}`, fecha, concepto, cantidad, cuenta_id: CUENTA, categoria_id, subcategoria_id,
    recurrente_template_id: null, lineas_extracto: lineas, ...extra,
  };
}

/** Un movimiento que ya vino del banco: su línea es la misma que el movimiento. */
function importado(fecha: string, banco: string, cantidad: number, categoria_id: string, subcategoria_id: string | null, concepto = banco, extra: Partial<MovimientoConocido> = {}) {
  return mov(fecha, concepto, cantidad, categoria_id, subcategoria_id, [linea(fecha, banco, cantidad)], extra);
}

function plan(lineas: LineaExtracto[], conocidos: MovimientoConocido[], extra: Partial<EntradaPlan> = {}) {
  return planificarImportacion({ lineas, cuentaId: CUENTA, conocidos, categorias: CATEGORIAS, plantillas: new Set(['tpl-salario', 'tpl-gym']), ...extra });
}

function nueva(f: FilaImportacion) {
  if (f.tipo !== 'nueva') throw new Error(`esperaba nueva y es ${f.tipo}`);
  return f;
}

describe('parsearExtractoCaixaBank', () => {
  const CSV = [
    'Tabla 1',
    'Movimientos de la cuenta ES00 0000;;;;;',
    'Importes expresados en euros;;;;;',
    'Fecha;Fecha valor;Movimiento;MÃ¡s datos;Importe;Saldo',
    '25/09/2026;25/09/2026;BIZUM RECIBIDO;BIZUM;9,00;4.508,32',
    '24/09/2026;24/09/2026;"BAR ""EL SOL""";;-1.060,20;4.499,32',
    '',
  ].join('\r\n');

  it('salta el preámbulo, lee importes con miles y respeta el orden del extracto', () => {
    const lineas = parsearExtractoCaixaBank(CSV);
    expect(lineas).toEqual([
      { fecha: '2026-09-25', fecha_valor: '2026-09-25', concepto: 'BIZUM RECIBIDO', mas_datos: 'BIZUM', importe: 9, saldo: 4508.32 },
      { fecha: '2026-09-24', fecha_valor: '2026-09-24', concepto: 'BAR "EL SOL"', mas_datos: null, importe: -1060.2, saldo: 4499.32 },
    ]);
  });

  it('rechaza un archivo que no es el CSV de CaixaBank', () => {
    expect(() => parsearExtractoCaixaBank('fecha,importe\n1,2')).toThrow(/CaixaBank/);
  });
});

describe('claveComercio', () => {
  it('quita referencias con números, signos y acentos', () => {
    expect(claveComercio('Cabify ES 2621i6g')).toBe('CABIFY ES');
    expect(claveComercio('PAG PENSIONES 5485-56-0005484-34')).toBe('PAG PENSIONES');
    expect(claveComercio('AMBIGÚ DEL ESPAÑA')).toBe('AMBIGU DEL ESPANA');
  });
});

describe('planificarImportacion', () => {
  it('da por revisado lo ya importado y lo de más de una semana antes, pero no lo del mismo día', () => {
    const spotify = linea('2026-09-22', 'SpotifyES', -20.99);
    const conocidos = [mov('2026-09-22', 'Spotify', -20.99, 'servicios', null, [spotify])];
    const filas = plan([
      linea('2026-09-22', 'BIZUM RECIBIDO', 31.2, 'BIZUM'), // encima en el extracto, mismo día
      spotify,
      linea('2026-09-20', 'LIDL MAD', -10),
      linea('2026-09-01', 'DEVOLUCION COMPRA', 30), // hace más de una semana: ya se revisó
    ], conocidos);
    expect(filas.map((f) => f.tipo)).toEqual(['nueva', 'anterior', 'nueva', 'anterior']);
  });

  it('enlaza lo apuntado a mano con mismo importe y la fecha más cercana', () => {
    const lejos = mov('2026-09-10', 'Cena (tricount)', -121.25, 'ocio', 'restaurante', null);
    const cerca = mov('2026-09-17', 'Cena Cádiz', -121.25, 'ocio', 'restaurante', null);
    const [f] = plan([linea('2026-09-18', 'BAR RESTAURANTE P', -121.25)], [lejos, cerca]);
    expect(f).toMatchObject({ tipo: 'apuntada', movimiento: { id: cerca.id }, aviso: null });
  });

  it('anula cargo y devolución del mismo importe, pero no un Bizum que devuelve un gasto', () => {
    const filas = plan([
      linea('2026-08-25', 'DEVOLUCION COMPRA', 100),
      linea('2026-08-25', 'MOLGAS ENERGIA -', -100),
      linea('2026-05-10', 'BIZUM RECIBIDO', 18.95, 'BIZUM'),
      linea('2026-05-10', 'WWW.AMAZON', -18.95),
    ], []);
    expect(filas.map((f) => f.tipo)).toEqual(['anulada', 'anulada', 'nueva', 'nueva']);
  });

  it('verde si siempre fue lo mismo, y reutiliza el concepto que siempre escribes', () => {
    const conocidos = [
      importado('2026-07-02', 'BRUNOA SPORT', -39.9, 'servicios', 'gimnasio', 'Gimnasio'),
      importado('2026-08-04', 'BRUNOA SPORT', -39.9, 'servicios', 'gimnasio', 'Gimnasio'),
    ];
    const f = nueva(plan([linea('2026-09-20', 'BRUNOA SPORT', -45)], conocidos)[0]);
    expect(f.propuesta).toMatchObject({ nivel: 'verde', concepto: 'Gimnasio', categoria_id: 'servicios', subcategoria_id: 'gimnasio' });
  });

  it('amarillo si solo lo ha visto una vez, y rojo si nunca', () => {
    const conocidos = [importado('2026-08-04', 'LIDL MAD PASILLO', -30, 'super', 'lidl', 'Compra Lidl')];
    const [una, nunca] = plan([linea('2026-09-20', 'LIDL MAD PASILLO', -12), linea('2026-09-20', 'SPORTS GRILL', -60)], conocidos);
    expect(nueva(una).propuesta).toMatchObject({ nivel: 'amarillo', subcategoria_id: 'lidl', concepto: 'Lidl Mad Pasillo' });
    expect(nueva(nunca).propuesta).toMatchObject({ nivel: 'rojo', categoria_id: null, concepto: 'Sports Grill' });
  });

  it('distingue por importe cuando el mismo comercio cobra cosas distintas', () => {
    const conocidos = [
      importado('2026-07-05', 'APPLE.COM/BILL', -2.99, 'servicios', 'icloud'),
      importado('2026-08-05', 'APPLE.COM/BILL', -2.99, 'servicios', 'icloud'),
      importado('2026-04-21', 'APPLE.COM/BILL', -19.99, 'servicios', 'notability'),
      importado('2026-05-21', 'APPLE.COM/BILL', -19.99, 'servicios', 'notability'),
    ];
    const [conocido, otro] = plan([linea('2026-09-21', 'APPLE.COM/BILL', -19.99), linea('2026-09-21', 'APPLE.COM/BILL', -7.99)], conocidos);
    expect(nueva(conocido).propuesta).toMatchObject({ nivel: 'verde', subcategoria_id: 'notability' });
    expect(nueva(otro).propuesta.nivel).toBe('amarillo');
  });

  it('no aprende de los viajes: la gasolinera sigue siendo gasolina', () => {
    const conocidos = [
      importado('2026-06-06', 'E.S. LAS ARENAS', -14, 'coche', 'gasolina'),
      importado('2026-06-20', 'E.S. LAS ARENAS', -20, 'coche', 'gasolina'),
      importado('2026-08-01', 'E.S. LAS ARENAS', -17, 'viajes', 'leon'),
    ];
    const f = nueva(plan([linea('2026-09-06', 'E.S. LAS ARENAS', -15)], conocidos)[0]);
    expect(f.propuesta).toMatchObject({ nivel: 'verde', subcategoria_id: 'gasolina' });
  });

  it('nómina: la apunta el día 1 del mes siguiente con su plantilla de recurrente', () => {
    const tpl = { recurrente_template_id: 'tpl-salario' };
    const conocidos = [
      mov('2026-08-01', 'Salario', 2805.11, 'salario', null, [linea('2026-07-30', 'NOMINA TRF', 2805.11)], tpl),
      mov('2026-09-01', 'Salario', 2772.39, 'salario', null, [linea('2026-08-29', 'NOMINA TRF', 2772.39)], tpl),
    ];
    const f = nueva(plan([linea('2026-09-29', 'NOMINA TRF', 2790)], conocidos)[0]);
    expect(f.propuesta).toMatchObject({ fecha: '2026-10-01', concepto: 'Salario', recurrente_template_id: 'tpl-salario', nivel: 'verde' });
  });

  it('nómina: si el recurrente de ese mes ya existe con otro importe, lo enlaza y avisa', () => {
    const tpl = { recurrente_template_id: 'tpl-salario' };
    const generado = mov('2026-10-01', 'Salario', 2758.24, 'salario', null, null, tpl);
    const conocidos = [
      mov('2026-08-01', 'Salario', 2805.11, 'salario', null, [linea('2026-07-30', 'NOMINA TRF', 2805.11)], tpl),
      mov('2026-09-01', 'Salario', 2772.39, 'salario', null, [linea('2026-08-29', 'NOMINA TRF', 2772.39)], tpl),
      generado,
    ];
    const [f] = plan([linea('2026-09-29', 'NOMINA TRF', 2790)], conocidos);
    expect(f).toMatchObject({ tipo: 'apuntada', movimiento: { id: generado.id } });
    expect(f.tipo === 'apuntada' && f.aviso).toMatch(/2790,00 €.*2758,24 €/);
  });

  it('"COMPRA CON TARJETA" toma el comercio de la retención anulada de debajo', () => {
    const conocidos = [
      mov('2026-06-01', 'Molgas', -20, 'coche', 'gasolina', [linea('2026-06-01', 'MOLGAS ENERGIA -', -100)]),
      mov('2026-07-01', 'Molgas', -22, 'coche', 'gasolina', [linea('2026-07-01', 'MOLGAS ENERGIA -', -100)]),
    ];
    const lineas = [
      linea('2026-08-25', 'COMPRA CON TARJETA', -21.22),
      linea('2026-08-25', 'DEVOLUCION COMPRA', 100),
      linea('2026-08-25', 'MOLGAS ENERGIA -', -100),
    ];
    const f = nueva(plan(lineas, conocidos)[0]);
    expect(f.propuesta).toMatchObject({ nivel: 'verde', subcategoria_id: 'gasolina', concepto: 'Molgas' });
    expect(f.propuesta.motivo).toMatch(/retención de «MOLGAS ENERGIA -»/);
    expect(f.lineasExtra).toEqual([lineas[2], lineas[1]]);
  });

  it('un Bizum recibido sigue al gasto nuevo de ese día, y no a un recurrente', () => {
    const alquiler = mov('2026-09-24', 'Alquiler', -1000, 'casa', null, null, { recurrente_template_id: 'tpl-alquiler', cuenta_id: 'otra' });
    const filas = plan([
      linea('2026-09-24', 'BIZUM RECIBIDO', 21.2, 'BIZUM'),
      linea('2026-09-24', 'SPORTS GRILL', -60.2),
    ], [alquiler]);
    expect(nueva(filas[0]).propuesta).toMatchObject({ sigueA: 1, nivel: 'rojo' });
    expect(nueva(filas[0]).propuesta.motivo).toMatch(/Sports Grill/);
  });
});

describe('filasDelViaje', () => {
  it('pasa al viaje lo de esas fechas salvo recurrentes y tabaco', () => {
    const f = (pos: number, fecha: string, subcategoria_id: string | null, recurrente_template_id: string | null = null) => ({
      pos, linea: linea(fecha, 'X', -1), categoria_id: 'ocio', subcategoria_id, recurrente_template_id,
    });
    const filas = [
      f(0, '2026-08-03', 'restaurante'),
      f(1, '2026-08-02', 'vicio'),
      f(2, '2026-08-02', 'gimnasio', 'tpl-gym'),
      f(3, '2026-08-01', null),
      f(4, '2026-07-30', 'restaurante'),
    ];
    expect(filasDelViaje(filas, '2026-08-01', '2026-08-03', CATEGORIAS)).toEqual([0, 3]);
  });
});
