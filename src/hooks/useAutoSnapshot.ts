import { useEffect, useRef } from 'react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

/**
 * Generates / refreshes monthly snapshots for the previous month.
 * Runs once per session. Idempotent: rerunning refreshes saldo_calculado
 * but never touches saldo_registrado (manual overrides are preserved).
 */
export function useAutoSnapshot(userId: string | undefined) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (!userId || hasRun.current) return;
    hasRun.current = true;

    const generateAutoSnapshots = async () => {
      try {
        const now = new Date();
        const previousMonth = format(subMonths(now, 1), 'yyyy-MM');
        const currentMonthStart = format(startOfMonth(now), 'yyyy-MM-dd');

        // Skip if user has no movements before current month — nothing to snapshot
        const { data: anyMovements } = await supabase
          .from('movimientos')
          .select('id')
          .eq('user_id', userId)
          .lt('fecha', currentMonthStart)
          .limit(1);

        if (!anyMovements || anyMovements.length === 0) return;

        const { data: cuentas } = await supabase
          .from('cuentas')
          .select('*')
          .eq('user_id', userId)
          .eq('activa', true);

        if (!cuentas || cuentas.length === 0) return;

        for (const cuenta of cuentas) {
          // Skip accounts not yet created at the previous-month cutoff
          const cuentaCreatedMonth = format(startOfMonth(new Date(cuenta.created_at)), 'yyyy-MM');
          if (cuentaCreatedMonth > previousMonth) continue;

          const { data: existingSnap } = await supabase
            .from('snapshots_patrimonio')
            .select('id, updated_at')
            .eq('user_id', userId)
            .eq('mes', previousMonth)
            .eq('cuenta_id', cuenta.id)
            .maybeSingle();

          // Skip re-computation if this snapshot was already refreshed in the current month
          if (existingSnap?.updated_at && new Date(existingSnap.updated_at) >= startOfMonth(now)) {
            continue;
          }

          const { data: movimientos } = await supabase
            .from('movimientos')
            .select('cantidad')
            .eq('cuenta_id', cuenta.id)
            .lt('fecha', currentMonthStart);

          const sumaMovimientos = movimientos?.reduce(
            (sum, m) => sum + Number(m.cantidad),
            0
          ) || 0;

          const saldoCalculado = Number(cuenta.saldo_inicial) + sumaMovimientos;

          if (existingSnap) {
            // Refresh saldo_calculado; preserve saldo_registrado (manual override)
            await supabase
              .from('snapshots_patrimonio')
              .update({
                saldo_calculado: saldoCalculado,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingSnap.id);
          } else {
            await supabase
              .from('snapshots_patrimonio')
              .insert({
                user_id: userId,
                mes: previousMonth,
                cuenta_id: cuenta.id,
                saldo_registrado: null,
                saldo_calculado: saldoCalculado,
                tipo: 'auto'
              });
          }
        }

        if (import.meta.env.DEV) {
          console.log('Auto-snapshots refreshed for', previousMonth);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error generating auto-snapshots:', error);
        }
      }
    };

    generateAutoSnapshots();
  }, [userId]);
}
