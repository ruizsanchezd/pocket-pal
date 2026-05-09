-- Limpia movimientos huérfanos: es_recurrente=true pero recurrente_template_id=NULL.
--
-- Causa: cuando se borra un gastos_recurrentes el FK es ON DELETE SET NULL,
-- por lo que el movimiento generado queda con template_id=NULL. Si el template
-- se vuelve a crear, el dedup (que solo mira filas no-NULL) no detecta el huérfano
-- y genera una fila nueva → duplicado visible al usuario.
--
-- Este script elimina los huérfanos de mayo 2026. La corrección permanente en el
-- código de dedup evitará que vuelva a ocurrir.

DELETE FROM movimientos
WHERE es_recurrente = true
  AND recurrente_template_id IS NULL
  AND mes_referencia = '2026-05';
