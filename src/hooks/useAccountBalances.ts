import { useState, useEffect } from 'react';
import { Cuenta } from '@/types/database';
import { calcularSaldos, fetchMovimientosParaSaldos } from '@/lib/saldos';
import { format } from 'date-fns';

/**
 * Saldo actual de cada cuenta: `{ [cuenta_id]: saldo_inicial + Σ movimientos }`.
 * Misma regla y misma query paginada que el Dashboard (ver `lib/saldos.ts`).
 *
 * The reference to `cuentas` should come from state (not an inline array) to
 * avoid unnecessary re-fetches on every render.
 */
export function useAccountBalances(cuentas: Cuenta[]): {
  balances: Record<string, number>;
  loading: boolean;
} {
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cuentas.length === 0) {
      setBalances({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchMovimientosParaSaldos(cuentas.map(c => c.id))
      .then(movimientos => {
        if (cancelled) return;
        const conSaldo = calcularSaldos(cuentas, movimientos, format(new Date(), 'yyyy-MM'));
        setBalances(Object.fromEntries(conSaldo.map(c => [c.id, c.saldo_actual])));
      })
      .catch(error => {
        if (import.meta.env.DEV) console.error('Error calculando saldos:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [cuentas]); // cuentas comes from state — reference is stable until explicitly set

  return { balances, loading };
}
