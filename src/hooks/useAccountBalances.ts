import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cuenta } from '@/types/database';

/**
 * Given an array of accounts, fetches all movements for each account and returns
 * a map of { [cuenta_id]: saldo_inicial + sumaMovimientos }.
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

    Promise.all(
      cuentas.map(async (cuenta) => {
        const { data } = await supabase
          .from('movimientos')
          .select('cantidad')
          .eq('cuenta_id', cuenta.id);

        const suma = data?.reduce((sum, m) => sum + Number(m.cantidad), 0) ?? 0;
        return { id: cuenta.id, saldo: Number(cuenta.saldo_inicial) + suma };
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, number> = {};
      results.forEach(({ id, saldo }) => { map[id] = saldo; });
      setBalances(map);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [cuentas]); // cuentas comes from state — reference is stable until explicitly set

  return { balances, loading };
}
