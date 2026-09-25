import { format, getDaysInMonth, parse } from 'date-fns';

export type PlantillaRecurrente = {
  id: string;
  concepto: string;
  cantidad: number;
  dia_del_mes: number | null;
  cuenta_id: string;
  categoria_id: string;
  subcategoria_id: string | null;
  notas: string | null;
  is_transfer: boolean | null;
  destination_account_id: string | null;
};

/** Lo mínimo de los movimientos recurrentes ya existentes en el mes para deduplicar. */
export type RecurrenteExistente = {
  recurrente_template_id: string | null;
  concepto: string;
  cuenta_id: string;
};

export type MovimientoRecurrenteInsert = {
  user_id: string;
  fecha: string;
  concepto: string;
  cantidad: number;
  cuenta_id: string;
  categoria_id: string;
  subcategoria_id: string | null;
  notas: string | null;
  es_recurrente: true;
  recurrente_template_id: string;
  mes_referencia: string;
};

/**
 * Movimientos que hay que generar en `mes` ('yyyy-MM') a fecha de `hoy`.
 * Ver docs/context/domain-logic.md § Recurrentes y known-issues.md § Duplicados.
 *
 * Una plantilla se descarta si:
 * - ya hay un movimiento con su `recurrente_template_id` en el mes;
 * - hay un huérfano (template_id NULL) con el mismo `concepto + cuenta_id` — la plantilla
 *   se borró y se recreó, y el movimiento de este mes ya existe con el id viejo;
 * - su día (`min(dia_del_mes, días del mes)`) aún no ha llegado.
 *
 * Una transferencia genera dos filas con el mismo template_id: salida (negativa) en la
 * cuenta origen y entrada (positiva) en la destino.
 */
export function planificarRecurrentes(
  plantillas: PlantillaRecurrente[],
  existentes: RecurrenteExistente[],
  mes: string,
  hoy: Date,
  userId: string
): MovimientoRecurrenteInsert[] {
  const date = parse(mes, 'yyyy-MM', new Date());
  const daysInMonth = getDaysInMonth(date);
  const currentDay = hoy.getDate();

  const existingTemplateIds = new Set(
    existentes.map(m => m.recurrente_template_id).filter(id => !!id)
  );
  const existingOrphans = new Set(
    existentes.filter(m => !m.recurrente_template_id).map(m => `${m.concepto}::${m.cuenta_id}`)
  );

  const pending = plantillas.filter(t => {
    if (existingTemplateIds.has(t.id)) return false;
    if (existingOrphans.has(`${t.concepto}::${t.cuenta_id}`)) return false;
    const actualDay = Math.min(t.dia_del_mes ?? 1, daysInMonth);
    return actualDay <= currentDay;
  });

  const movimientos: MovimientoRecurrenteInsert[] = [];

  for (const t of pending) {
    const actualDay = Math.min(t.dia_del_mes ?? 1, daysInMonth);
    const fecha = format(new Date(date.getFullYear(), date.getMonth(), actualDay), 'yyyy-MM-dd');

    movimientos.push({
      user_id: userId,
      fecha,
      concepto: t.concepto,
      cantidad: t.is_transfer ? -Math.abs(t.cantidad) : t.cantidad,
      cuenta_id: t.cuenta_id,
      categoria_id: t.categoria_id,
      subcategoria_id: t.subcategoria_id,
      notas: t.notas,
      es_recurrente: true,
      recurrente_template_id: t.id,
      mes_referencia: mes,
    });

    if (t.is_transfer && t.destination_account_id) {
      movimientos.push({
        user_id: userId,
        fecha,
        concepto: t.concepto,
        cantidad: Math.abs(t.cantidad),
        cuenta_id: t.destination_account_id,
        categoria_id: t.categoria_id,
        subcategoria_id: t.subcategoria_id,
        notas: t.notas ? `${t.notas} (transferencia)` : 'Transferencia entre cuentas',
        es_recurrente: true,
        recurrente_template_id: t.id,
        mes_referencia: mes,
      });
    }
  }

  return movimientos;
}
