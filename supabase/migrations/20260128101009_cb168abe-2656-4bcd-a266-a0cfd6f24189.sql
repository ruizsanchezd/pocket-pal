-- Add database-level CHECK constraints for server-side input validation
-- This ensures data integrity even if client-side validation is bypassed

-- Movimientos table constraints
ALTER TABLE public.movimientos 
ADD CONSTRAINT check_movimientos_concepto_length 
CHECK (length(concepto) BETWEEN 1 AND 200);

ALTER TABLE public.movimientos 
ADD CONSTRAINT check_movimientos_cantidad_non_zero 
CHECK (cantidad <> 0);

ALTER TABLE public.movimientos 
ADD CONSTRAINT check_movimientos_notas_length 
CHECK (notas IS NULL OR length(notas) <= 500);

-- Cuentas table constraints
ALTER TABLE public.cuentas 
ADD CONSTRAINT check_cuentas_nombre_length 
CHECK (length(nombre) BETWEEN 1 AND 100);

-- Categorias table constraints
ALTER TABLE public.categorias 
ADD CONSTRAINT check_categorias_nombre_length 
CHECK (length(nombre) BETWEEN 1 AND 50);

-- Gastos recurrentes table constraints
ALTER TABLE public.gastos_recurrentes 
ADD CONSTRAINT check_gastos_concepto_length 
CHECK (length(concepto) BETWEEN 1 AND 200);

ALTER TABLE public.gastos_recurrentes 
ADD CONSTRAINT check_gastos_cantidad_non_zero 
CHECK (cantidad <> 0);

ALTER TABLE public.gastos_recurrentes 
ADD CONSTRAINT check_gastos_dia_del_mes_range 
CHECK (dia_del_mes IS NULL OR (dia_del_mes BETWEEN 1 AND 31));

ALTER TABLE public.gastos_recurrentes 
ADD CONSTRAINT check_gastos_notas_length 
CHECK (notas IS NULL OR length(notas) <= 500);

-- Cuentas monedero config constraints
ALTER TABLE public.cuentas_monedero_config 
ADD CONSTRAINT check_monedero_dia_recarga_range 
CHECK (dia_recarga IS NULL OR (dia_recarga BETWEEN 1 AND 31));

ALTER TABLE public.cuentas_monedero_config 
ADD CONSTRAINT check_monedero_recarga_positive 
CHECK (recarga_mensual > 0);