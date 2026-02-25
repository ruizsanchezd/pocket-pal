import { useEffect, useRef } from 'react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to automatically generate monthly snapshots for the previous month
 * Runs once when the app loads and detects a new month
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

        // Check if auto-snapshots already exist for previous month
        const { data: existing } = await supabase
          .from('snapshots_patrimonio')
          .select('id')
          .eq('user_id', userId)
          .eq('mes', previousMonth)
          .eq('tipo', 'auto')
          .limit(1);

        if (existing && existing.length > 0) {
          if (import.meta.env.DEV) {
            console.log('Auto-snapshots already exist for', previousMonth);
          }
          return; // Already generated
        }

        // Fetch all active accounts
        const { data: cuentas } = await supabase
          .from('cuentas')
          .select('*')
          .eq('user_id', userId)
          .eq('activa', true);

        if (!cuentas || cuentas.length === 0) return;

        // For each account, calculate balance at end of previous month
        for (const cuenta of cuentas) {
          // Check if a snapshot already exists for this account/month (manual or auto)
          const { data: existingSnap } = await supabase
            .from('snapshots_patrimonio')
            .select('id, tipo')
            .eq('user_id', userId)
            .eq('mes', previousMonth)
            .eq('cuenta_id', cuenta.id)
            .single();

          // Get all movements before current month
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
            // If there's already a snapshot, only update saldo_calculado (don't touch saldo_registrado)
            await supabase
              .from('snapshots_patrimonio')
              .update({
                saldo_calculado: saldoCalculado,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingSnap.id);
          } else {
            // Create new auto-snapshot
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
          console.log('Auto-snapshots generated for', previousMonth);
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
