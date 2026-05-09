-- Limpia los movimientos recurrentes duplicados de mayo 2026.
-- Causados por una race condition en la generación lazy: si el efecto
-- arrancaba dos veces concurrentemente ambas lecturas veían el mismo estado
-- de BD antes de que la primera inserción hubiera terminado.
--
-- Estrategia: por cada combinación (user, template, mes, cuenta) mantenemos
-- el movimiento más antiguo (ORDER BY created_at ASC, rn = 1) y borramos el resto.
-- Usar cuenta_id en la partición garantiza que las transferencias (que generan
-- dos movimientos por template, uno por cuenta) se dedupen correctamente.

DELETE FROM movimientos
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, recurrente_template_id, mes_referencia, cuenta_id
        ORDER BY created_at ASC
      ) AS rn
    FROM movimientos
    WHERE es_recurrente = true
      AND recurrente_template_id IS NOT NULL
      AND mes_referencia = '2026-05'
  ) ranked
  WHERE rn > 1
);
