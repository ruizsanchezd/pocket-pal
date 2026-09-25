-- Líneas del extracto bancario de las que sale cada movimiento.
--
-- El importador de extractos aprende a categorizar mirando cómo llama el banco a cada
-- movimiento ya registrado ("BRUNOA SPORT" → Servicios > Gimnasio). Ese texto no se guardaba:
-- `concepto` es lo que escribe el usuario y a menudo lo reescribe. Aquí se conserva tal cual.
--
-- Es un array porque un movimiento puede venir de varias líneas (dos cargos de Cabify que se
-- apuntan juntos) y una línea puede repartirse en varios movimientos (un Bizum que se parte).
-- Cada elemento: { fecha, fecha_valor, concepto, mas_datos, importe, saldo }. El saldo tras la
-- operación identifica la línea de forma única y sirve para no reimportarla.
--
-- No se muestra en la UI ni se exporta: es interno del importador.
-- NULL = movimiento apuntado a mano, generado por un recurrente o de una cuenta sin extracto.

ALTER TABLE public.movimientos
  ADD COLUMN lineas_extracto jsonb
  CHECK (lineas_extracto IS NULL OR jsonb_typeof(lineas_extracto) = 'array');

COMMENT ON COLUMN public.movimientos.lineas_extracto IS
  'Líneas del extracto bancario de origen (interno del importador, no se muestra en la UI).';
