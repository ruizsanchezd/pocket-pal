import { supabase } from '@/integrations/supabase/client';
import { fetchAll } from '@/lib/fetch-all';
import type { Cuenta, CuentaConSaldo } from '@/types/database';

export type MovimientoSaldo = {
  cuenta_id: string;
  cantidad: number;
  mes_referencia: string;
};

/** Movimientos mínimos para calcular saldos, de todas las cuentas dadas, sin tope de filas. */
export function fetchMovimientosParaSaldos(cuentaIds: string[]): Promise<MovimientoSaldo[]> {
  if (cuentaIds.length === 0) return Promise.resolve([]);
  return fetchAll<MovimientoSaldo>((from, to) =>
    supabase
      .from('movimientos')
      .select('cuenta_id, cantidad, mes_referencia')
      .in('cuenta_id', cuentaIds)
      .order('id')
      .range(from, to)
  );
}

/**
 * Regla única de saldo (ver docs/context/domain-logic.md):
 *
 * - `saldo_actual` = saldo_inicial + Σ cantidad.
 * - Monedero: `gastos_mes` = Σ |cantidad| de los gastos con `mes_referencia = mesActual`.
 * - Inversión: `invertido` = capital_inicial_invertido + Σ aportaciones (cantidad > 0);
 *   `rendimiento` = saldo_actual − invertido.
 */
export function calcularSaldos<C extends Cuenta>(
  cuentas: C[],
  movimientos: MovimientoSaldo[],
  mesActual: string
): Array<C & CuentaConSaldo> {
  const suma = new Map<string, number>();
  const gastosMes = new Map<string, number>();
  const depositos = new Map<string, number>();

  for (const m of movimientos) {
    const cantidad = Number(m.cantidad);
    suma.set(m.cuenta_id, (suma.get(m.cuenta_id) ?? 0) + cantidad);
    if (cantidad > 0) {
      depositos.set(m.cuenta_id, (depositos.get(m.cuenta_id) ?? 0) + cantidad);
    } else if (cantidad < 0 && m.mes_referencia === mesActual) {
      gastosMes.set(m.cuenta_id, (gastosMes.get(m.cuenta_id) ?? 0) - cantidad);
    }
  }

  return cuentas.map(cuenta => {
    const saldoActual = Number(cuenta.saldo_inicial) + (suma.get(cuenta.id) ?? 0);
    let invertido = 0;
    let rendimiento = 0;
    if (cuenta.tipo === 'inversion') {
      invertido = (Number(cuenta.capital_inicial_invertido) || 0) + (depositos.get(cuenta.id) ?? 0);
      rendimiento = saldoActual - invertido;
    }
    return {
      ...cuenta,
      saldo_actual: saldoActual,
      gastos_mes: cuenta.tipo === 'monedero' ? gastosMes.get(cuenta.id) ?? 0 : 0,
      invertido,
      rendimiento,
    };
  });
}
