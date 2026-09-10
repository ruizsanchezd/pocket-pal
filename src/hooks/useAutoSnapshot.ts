import { useEffect, useRef } from 'react';
import { format, subMonths, startOfMonth, addMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

/** Nunca retrocedemos más de esto, por si el usuario tiene años de histórico. */
const MAX_BACKFILL_MONTHS = 24;

type SnapshotRow = {
  id: string;
  mes: string;
  cuenta_id: string;
  tipo: string | null;
  saldo_calculado: number | null;
  saldo_registrado: number | null;
  updated_at: string;
};

/**
 * Meses cerrados que el backfill debe cubrir: desde el mes del primer movimiento del
 * usuario hasta el mes pasado, ambos incluidos. Nunca antes de que empezara a usar la
 * app — si su primer movimiento es de abril, abril es el suelo — y nunca más de
 * MAX_BACKFILL_MONTHS hacia atrás.
 *
 * Se trabaja con el string 'yyyy-MM-dd' tal cual, sin construir Date a partir de él:
 * `new Date('2026-04-01')` se interpreta como UTC y en husos negativos caería en marzo.
 */
export function mesesACubrir(primerMovimiento: string, hoy: Date): string[] {
  const inicioMesActual = startOfMonth(hoy);
  const ultimoMesCerrado = format(subMonths(inicioMesActual, 1), 'yyyy-MM');
  const suelo = format(subMonths(inicioMesActual, MAX_BACKFILL_MONTHS), 'yyyy-MM');

  let cursor = primerMovimiento.slice(0, 7);
  if (cursor < suelo) cursor = suelo;

  const meses: string[] = [];
  while (cursor <= ultimoMesCerrado) {
    meses.push(cursor);
    const [y, m] = cursor.split('-').map(Number);
    cursor = format(addMonths(new Date(y, m - 1, 1), 1), 'yyyy-MM');
  }
  return meses;
}

/**
 * Genera / refresca los snapshots mensuales de patrimonio.
 *
 * Corre una vez por sesión y cubre **todos los meses cerrados sin snapshot**, no solo el
 * anterior: si el usuario pasa meses sin abrir la app, esos meses se rellenan al volver.
 * También refresca un `saldo_calculado` que se quedó obsoleto porque se importaron
 * movimientos con fecha anterior después de haberlo calculado.
 *
 * Invariantes:
 * - `saldo_registrado` y los snapshots `manual` no se tocan jamás (son overrides del usuario).
 * - Cuentas de inversión: su `saldo_inicial` refleja el valor de mercado de HOY, así que
 *   calcular con él un mes pasado daría una cifra falsa. Para esas se arrastra el último
 *   valor conocido hacia delante.
 */
export function useAutoSnapshot(userId: string | undefined) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (!userId || hasRun.current) return;
    hasRun.current = true;

    const generateAutoSnapshots = async () => {
      try {
        const now = new Date();
        const currentMonthStart = startOfMonth(now);

        const [{ data: cuentas }, { data: movimientos }, { data: snapshots }] = await Promise.all([
          supabase.from('cuentas').select('*').eq('user_id', userId).eq('activa', true),
          supabase
            .from('movimientos')
            .select('cuenta_id, cantidad, fecha, created_at')
            .eq('user_id', userId)
            .lt('fecha', format(currentMonthStart, 'yyyy-MM-dd')),
          supabase
            .from('snapshots_patrimonio')
            .select('id, mes, cuenta_id, tipo, saldo_calculado, saldo_registrado, updated_at')
            .eq('user_id', userId),
        ]);

        if (!cuentas?.length || !movimientos?.length) return;

        const snapsByKey = new Map<string, SnapshotRow>();
        ((snapshots ?? []) as SnapshotRow[]).forEach((s) => snapsByKey.set(`${s.cuenta_id}|${s.mes}`, s));

        const earliestMovement = movimientos.reduce(
          (min, m) => (m.fecha < min ? m.fecha : min),
          movimientos[0].fecha
        );
        const months = mesesACubrir(earliestMovement, now);
        if (months.length === 0) return;

        const payload: Array<{
          user_id: string;
          mes: string;
          cuenta_id: string;
          saldo_calculado: number;
          saldo_registrado: null;
          tipo: string;
        }> = [];

        for (const cuenta of cuentas) {
          const cuentaCreatedMonth = format(startOfMonth(new Date(cuenta.created_at)), 'yyyy-MM');
          const isInversion = cuenta.tipo === 'inversion';
          const movs = movimientos.filter((m) => m.cuenta_id === cuenta.id);

          // Último valor conocido antes de la ventana, para arrastrar en cuentas de inversión.
          let lastKnown: number | null = null;
          const priorSnaps = ((snapshots ?? []) as SnapshotRow[])
            .filter((s) => s.cuenta_id === cuenta.id && s.mes < months[0])
            .sort((a, b) => a.mes.localeCompare(b.mes));
          if (priorSnaps.length) {
            const p = priorSnaps[priorSnaps.length - 1];
            lastKnown = Number(p.saldo_registrado ?? p.saldo_calculado ?? 0);
          }

          for (const mes of months) {
            // La cuenta aún no existía al cierre de ese mes.
            if (cuentaCreatedMonth > mes) continue;

            const cutoff = format(addMonths(startOfMonth(new Date(`${mes}-01T00:00:00`)), 1), 'yyyy-MM-dd');
            const relevantes = movs.filter((m) => m.fecha < cutoff);
            const computed =
              Number(cuenta.saldo_inicial) + relevantes.reduce((sum, m) => sum + Number(m.cantidad), 0);

            const existing = snapsByKey.get(`${cuenta.id}|${mes}`);

            // Override manual del usuario: intocable, pero sirve de referencia para arrastrar.
            if (existing && (existing.tipo === 'manual' || existing.saldo_registrado !== null)) {
              lastKnown = Number(existing.saldo_registrado ?? existing.saldo_calculado ?? lastKnown ?? 0);
              continue;
            }

            // Las de inversión no se pueden recalcular: su saldo_inicial es el valor de hoy.
            const valor = isInversion ? (lastKnown ?? computed) : computed;

            if (existing) {
              // Solo reescribir si hay movimientos anteriores creados DESPUÉS del último cálculo.
              const stale = relevantes.some((m) => m.created_at > existing.updated_at);
              if (!stale) {
                lastKnown = Number(existing.saldo_calculado ?? valor);
                continue;
              }
              if (isInversion) {
                lastKnown = Number(existing.saldo_calculado ?? valor);
                continue;
              }
            }

            const redondeado = Math.round(valor * 100) / 100;

            // Nada que escribir si el recálculo da lo mismo que ya hay guardado.
            if (existing && Number(existing.saldo_calculado) === redondeado) {
              lastKnown = redondeado;
              continue;
            }

            payload.push({
              user_id: userId,
              mes,
              cuenta_id: cuenta.id,
              saldo_calculado: redondeado,
              saldo_registrado: null,
              tipo: 'auto',
            });
            lastKnown = redondeado;
          }
        }

        if (payload.length === 0) return;

        const { error } = await supabase
          .from('snapshots_patrimonio')
          .upsert(payload, { onConflict: 'user_id,mes,cuenta_id' });

        if (error) throw error;

        if (import.meta.env.DEV) {
          console.log(`Auto-snapshots: ${payload.length} filas escritas`, payload.map((p) => `${p.mes}`));
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
