import { describe, it, expect } from 'vitest';
import { mesesACubrir } from '@/hooks/useAutoSnapshot';

describe('mesesACubrir', () => {
  const hoy = new Date(2026, 8, 10); // 10 septiembre 2026

  it('empieza en el mes del primer movimiento, no antes', () => {
    // Daniel empezó a usar PocketPal en abril: febrero y marzo no deben rellenarse.
    expect(mesesACubrir('2026-04-01', hoy)).toEqual([
      '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
    ]);
  });

  it('nunca incluye el mes en curso (aún no ha cerrado)', () => {
    expect(mesesACubrir('2026-04-01', hoy)).not.toContain('2026-09');
  });

  it('devuelve vacío si el primer movimiento es de este mismo mes', () => {
    expect(mesesACubrir('2026-09-03', hoy)).toEqual([]);
  });

  it('cubre solo el mes pasado si se empezó el mes pasado', () => {
    expect(mesesACubrir('2026-08-15', hoy)).toEqual(['2026-08']);
  });

  it('cruza el cambio de año', () => {
    expect(mesesACubrir('2025-11-20', new Date(2026, 1, 5))).toEqual([
      '2025-11', '2025-12', '2026-01',
    ]);
  });

  it('no retrocede más de 24 meses aunque haya movimientos muy antiguos', () => {
    const meses = mesesACubrir('2015-01-01', hoy);
    expect(meses).toHaveLength(24);
    expect(meses[0]).toBe('2024-09');
    expect(meses[meses.length - 1]).toBe('2026-08');
  });

  it('no depende del huso horario al leer la fecha', () => {
    // '2026-04-01' como Date se interpreta en UTC; en husos negativos caería en marzo.
    expect(mesesACubrir('2026-04-01', hoy)[0]).toBe('2026-04');
  });
});
