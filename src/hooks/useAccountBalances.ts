import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cuenta } from '@/types/database';

/**
 * Given an array of accounts, fetches ALL movements for the user in a single
 * query, groups/sums by cuenta_id in the frontend, and returns a map of
 * { [cuenta_id]: saldo_inicial + sumaMovimientos }.
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

    // Single query: fetch cantidad + cuenta_id for all accounts at once
    const cuentaIds = cuentas.map(c => c.id);

    supabase
      .from('movimientos')
      .select('cantidad, cuenta_id')
      .in('cuenta_id', cuentaIds)
      .then(({ data }) => {
        if (cancelled) return;

        // Sum movements grouped by cuenta_id
        const sumasPorCuenta: Record<string, number> = {};
        data?.forEach(m => {
          sumasPorCuenta[m.cuenta_id] = (sumasPorCuenta[m.cuenta_id] || 0) + Number(m.cantidad);
        });

        // Build balance map: saldo_inicial + sum of movements
        const map: Record<string, number> = {};
        cuentas.forEach(cuenta => {
          const suma = sumasPorCuenta[cuenta.id] || 0;
          map[cuenta.id] = Number(cuenta.saldo_inicial) + suma;
        });

        setBalances(map);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [cuentas]); // cuentas comes from state — reference is stable until explicitly set

  return { balances, loading };
}
