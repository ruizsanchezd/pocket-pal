import { describe, it, expect } from 'vitest';
import {
  lineasDeHojaCaixaBank,
  lineasDePdfCaixaBank,
  parsearExtractoCaixaBank,
  type TextoPdf,
} from '@/lib/importador/extracto-caixabank';
import {
  claveComercio,
  filasDelViaje,
  huellaLinea,
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
  cat('tomar', 'Tomar algo', 'ocio'),
  cat('salud', 'Salud'), cat('fisio', 'Fisio', 'salud'),
  cat('transporte', 'Transporte'), cat('taxi', 'VTC / Taxi', 'transporte'),
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

  it('se niega si los saldos no cuadran', () => {
    const roto = CSV.replace('4.499,32', '4.400,00');
    expect(() => parsearExtractoCaixaBank(roto)).toThrow(/no cuadran en la línea del 25\/09\/2026/);
  });
});

describe('lineasDeHojaCaixaBank', () => {
  it('lee el Excel del banco: fechas como número de serie e importes como números', () => {
    const lineas = lineasDeHojaCaixaBank([
      ['Movimientos de la cuenta ES00 0000', null, null, null, null, null],
      ['Importes expresados en euros', null, null, null, null, null],
      ['Fecha', 'Fecha valor', 'Movimiento', 'Más datos', 'Importe', 'Saldo'],
      [46293, 46293, 'BIZUM ENVIADO', '', -9.6, 4433.78],
      [46263, 46265, 'NOMINA TRF', '00810144-MENDESALTAREN, S.L.', 2772.39, 4443.38],
    ]);
    expect(lineas).toEqual([
      { fecha: '2026-09-28', fecha_valor: '2026-09-28', concepto: 'BIZUM ENVIADO', mas_datos: null, importe: -9.6, saldo: 4433.78 },
      { fecha: '2026-08-29', fecha_valor: '2026-08-31', concepto: 'NOMINA TRF', mas_datos: '00810144-MENDESALTAREN, S.L.', importe: 2772.39, saldo: 4443.38 },
    ]);
  });
});

describe('lineasDePdfCaixaBank', () => {
  // Posiciones copiadas del PDF que imprime CaixaBankNow desde el navegador.
  const t = (pagina: number, x: number, y: number, ancho: number, texto: string): TextoPdf => ({ pagina, x, y, ancho, texto });
  const cabecera = (pagina: number, y: number) => [
    t(pagina, 19.7, y, 30.6, 'Fecha'), t(pagina, 81.2, y, 47.1, 'Concepto'), t(pagina, 222.6, y, 50.7, 'Más datos'),
    t(pagina, 460, y, 37.3, 'Importe'), t(pagina, 547.6, y, 28.1, 'Saldo'),
  ];
  // Cada texto sale dos veces, como en el PDF real.
  const doble = (xs: TextoPdf[]) => xs.flatMap((x) => [x, { ...x }]);
  const TEXTOS = [
    t(1, 513.4, 800.7, 62.4, '25 Sep 2026'), // fecha de impresión, encima de la cabecera
    ...doble(cabecera(1, 655.2)),
    ...doble([t(1, 19.7, 637.2, 43.6, '25 Sep 2026')]),
    t(1, 81.2, 635.7, 90.4, 'BIZUM RECIBIDO'), t(1, 222.6, 635.7, 34.2, 'BIZUM'),
    ...doble([t(1, 457.3, 635.7, 40, '+ 9,00 €'), t(1, 514.3, 635.7, 61.4, '+ 5.150,16 €')]),
    ...doble([t(1, 19.7, 617.7, 39.4, '1 Sep 2026')]),
    t(1, 81.2, 616.9, 123.4, 'RECIBO UNICO MYBOX'),
    t(1, 222.6, 622.9, 177.4, 'CUOTA AGRUPADA MYBOX 01-09-'), t(1, 222.6, 610.9, 24.5, '2026'),
    t(1, 453.9, 616.9, 43.4, '- 41,03 €'), ...doble([t(1, 514.3, 616.9, 61.4, '+ 5.141,16 €')]),
    ...doble(cabecera(2, 814.2)),
    ...doble([t(2, 19.7, 796.2, 43.2, '31 Ago 2026')]),
    t(2, 81.2, 794.7, 75.1, 'NOMINA (TRF)'), t(2, 222.6, 794.7, 174.4, '00810144-MENDESALTAREN, S.L.'),
    t(2, 436.7, 794.7, 60.6, '+ 2.772,39 €'), ...doble([t(2, 514.3, 794.7, 61.4, '+ 5.182,19 €')]),
  ];

  it('separa columnas por posición, junta renglones partidos y sigue en la página siguiente', () => {
    expect(lineasDePdfCaixaBank(TEXTOS)).toEqual([
      { fecha: '2026-09-25', fecha_valor: null, concepto: 'BIZUM RECIBIDO', mas_datos: 'BIZUM', importe: 9, saldo: 5150.16 },
      { fecha: '2026-09-01', fecha_valor: null, concepto: 'RECIBO UNICO MYBOX', mas_datos: 'CUOTA AGRUPADA MYBOX 01-09-2026', importe: -41.03, saldo: 5141.16 },
      { fecha: '2026-08-31', fecha_valor: null, concepto: 'NOMINA (TRF)', mas_datos: '00810144-MENDESALTAREN, S.L.', importe: 2772.39, saldo: 5182.19 },
    ]);
  });

  it('rechaza un PDF que no es la página de movimientos', () => {
    expect(() => lineasDePdfCaixaBank([t(1, 50, 700, 100, 'Factura')])).toThrow(/CaixaBank/);
  });

  it('la misma línea leída del PDF y del CSV tiene la misma huella', () => {
    const [, , nomina] = lineasDePdfCaixaBank(TEXTOS);
    expect(huellaLinea(nomina)).toBe(huellaLinea({ ...nomina, concepto: 'NOMINA TRF', fecha_valor: '2026-09-01' }));
    expect(claveComercio("MC DONALD'S NUEVO")).toBe(claveComercio('MC DONALDS NUEVO'));
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
    const [una, nunca] = plan([linea('2026-09-20', 'LIDL MAD PASILLO', -12), linea('2026-09-20', 'CARDESA', -60)], conocidos);
    expect(nueva(una).propuesta).toMatchObject({ nivel: 'amarillo', subcategoria_id: 'lidl', concepto: 'Lidl Mad Pasillo' });
    expect(nueva(nunca).propuesta).toMatchObject({ nivel: 'rojo', categoria_id: null, concepto: 'Cardesa' });
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
      linea('2026-09-24', 'CARDESA', -60.2),
    ], [alquiler]);
    expect(nueva(filas[0]).propuesta).toMatchObject({ sigueA: 1, nivel: 'rojo' });
    expect(nueva(filas[0]).propuesta.motivo).toMatch(/Cardesa/);
  });
});

describe('pistas para comercios nunca vistos', () => {
  const propuesta = (concepto: string, conocidos: MovimientoConocido[] = [], mas: string | null = null) =>
    nueva(plan([linea('2026-09-24', concepto, -20, mas)], conocidos)[0]).propuesta;

  it('usa la lista de pistas, en amarillo', () => {
    expect(propuesta('SPORTS GRILL PENA')).toMatchObject({ nivel: 'amarillo', subcategoria_id: 'restaurante' });
    expect(propuesta('SPORTS GRILL PENA').motivo).toMatch(/«GRILL»/);
  });

  it('acepta la última palabra cortada por el banco y palabras pegadas a cifras', () => {
    expect(propuesta('YALEVA RESTAURACI').subcategoria_id).toBe('restaurante');
    expect(propuesta('FISIO4YOU PIRAMID').subcategoria_id).toBe('fisio');
  });

  it('las palabras cortas tienen que ir enteras y gana la pista más concreta', () => {
    expect(propuesta('ESTANCO BARCELO').subcategoria_id).toBe('vicio');
    expect(propuesta('BAR RESTAURANTE P').subcategoria_id).toBe('restaurante');
    expect(propuesta('OLD BAR LUJAM').subcategoria_id).toBe('tomar');
  });

  it('no usa pistas con lo que escribe el usuario en un Bizum o transferencia', () => {
    expect(propuesta('Para sushi', [], 'Nombre Apellido').nivel).toBe('rojo');
  });

  it('antes que la lista, una palabra que el usuario ya usa siempre igual en otros comercios', () => {
    const conocidos = [
      importado('2026-07-01', 'TAXI LIC', -12, 'transporte', 'taxi'),
      importado('2026-08-01', 'LM TAXI ADEJE', -15, 'transporte', 'taxi'),
    ];
    const p = propuesta('RADIO TAXI SUR', conocidos);
    expect(p).toMatchObject({ nivel: 'amarillo', subcategoria_id: 'taxi' });
    expect(p.motivo).toMatch(/Otros comercios con «TAXI»/);
  });

  it('no aprende palabras vacías como "LAS"', () => {
    const conocidos = [
      importado('2026-07-01', 'E.S. LAS ARENAS', -30, 'coche', 'gasolina'),
      importado('2026-08-01', 'LAS ACACIAS', -25, 'coche', 'gasolina'),
    ];
    expect(propuesta('LAS ROZAS VILLAGE', conocidos).nivel).toBe('rojo');
  });

  it('ignora la pista si el usuario no tiene esa categoría', () => {
    const f = nueva(plan([linea('2026-09-24', 'FARMACIA CENTRAL', -8)], [], { categorias: CATEGORIAS.filter((c) => c.id !== 'salud' && c.parent_id !== 'salud') })[0]);
    expect(f.propuesta.nivel).toBe('rojo');
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
