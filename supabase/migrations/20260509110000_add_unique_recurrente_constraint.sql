-- Añade restricción UNIQUE para evitar que la race condition en la generación
-- lazy de recurrentes pueda crear duplicados, aunque la guardia en el cliente falle.
--
-- Primero limpiamos cualquier duplicado existente (cualquier mes, cualquier valor
-- de es_recurrente), luego añadimos la constraint.
-- Partición por (user_id, recurrente_template_id, mes_referencia, cuenta_id):
-- las transferencias generan dos movimientos con el mismo template_id pero
-- distinto cuenta_id, por lo que ambos son legítimos y no se tocan.

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
    WHERE recurrente_template_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

ALTER TABLE movimientos
  ADD CONSTRAINT unique_recurrente_template_per_cuenta_per_month
  UNIQUE (user_id, recurrente_template_id, mes_referencia, cuenta_id);
