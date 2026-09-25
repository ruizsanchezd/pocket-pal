import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { calcularSaldos, type MovimientoSaldo } from '@/lib/saldos';
import type { Cuenta } from '@/types/database';

function cuenta(overrides: Partial<Cuenta>): Cuenta {
  return {
    id: 'c',
    user_id: 'u',
    nombre: 'Cuenta',
    tipo: 'corriente',
    saldo_inicial: 0,
    capital_inicial_invertido: 0,
    divisa: 'EUR',
    color: null,
    activa: true,
    orden: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Cuenta;
}

const mov = (cuenta_id: string, cantidad: number, mes_referencia = '2026-09'): MovimientoSaldo => ({
  cuenta_id,
  cantidad,
  mes_referencia,
});

describe('calcularSaldos', () => {
  it('saldo = saldo_inicial + suma de movimientos con su signo', () => {
    const [c] = calcularSaldos(
      [cuenta({ id: 'caixa', saldo_inicial: 1000 })],
      [mov('caixa', -200), mov('caixa', 2500), mov('caixa', -12.5)],
      '2026-09'
    );
    expect(c.saldo_actual).toBeCloseTo(3287.5);
  });

  it('no mezcla movimientos de otras cuentas', () => {
    const res = calcularSaldos(
      [cuenta({ id: 'a', saldo_inicial: 10 }), cuenta({ id: 'b', saldo_inicial: 20 })],
      [mov('a', 5), mov('b', -3)],
      '2026-09'
    );
    expect(res.map(c => c.saldo_actual)).toEqual([15, 17]);
  });

  it('una cuenta sin movimientos queda con su saldo_inicial (aunque venga como string de Postgres)', () => {
    const [c] = calcularSaldos([cuenta({ id: 'x', saldo_inicial: '42.10' as unknown as number })], [], '2026-09');
    expect(c.saldo_actual).toBeCloseTo(42.1);
  });

  it('monedero: gastos_mes suma solo los gastos del mes actual, en positivo', () => {
    const [c] = calcularSaldos(
      [cuenta({ id: 'betterfly', tipo: 'monedero' })],
      [mov('betterfly', 220), mov('betterfly', -30), mov('betterfly', -12.5), mov('betterfly', -99, '2026-08')],
      '2026-09'
    );
    expect(c.gastos_mes).toBeCloseTo(42.5);
    expect(c.saldo_actual).toBeCloseTo(78.5);
  });

  it('solo los monederos tienen gastos_mes', () => {
    const [c] = calcularSaldos([cuenta({ id: 'caixa' })], [mov('caixa', -30)], '2026-09');
    expect(c.gastos_mes).toBe(0);
  });

  it('inversión: invertido = capital inicial + aportaciones; rendimiento = saldo − invertido', () => {
    const [c] = calcularSaldos(
      [cuenta({ id: 'indexa', tipo: 'inversion', saldo_inicial: 25000, capital_inicial_invertido: 20000 })],
      [mov('indexa', 300), mov('indexa', 300), mov('indexa', -100)],
      '2026-09'
    );
    expect(c.saldo_actual).toBe(25500);
    expect(c.invertido).toBe(20600);
    expect(c.rendimiento).toBe(4900);
  });

  it('las cuentas que no son de inversión no tienen invertido ni rendimiento', () => {
    const [c] = calcularSaldos([cuenta({ id: 'caixa' })], [mov('caixa', 300)], '2026-09');
    expect(c.invertido).toBe(0);
    expect(c.rendimiento).toBe(0);
  });
});
