-- Add auto_generado_cuenta_id to gastos_recurrentes
-- Links auto-generated recurring income movements to their source monedero account.
-- ON DELETE SET NULL because cuenta_id (also referencing the same cuenta) handles the
-- cascade delete of the row; this column is only used for identification and sync.
ALTER TABLE public.gastos_recurrentes
ADD COLUMN auto_generado_cuenta_id uuid REFERENCES public.cuentas(id) ON DELETE SET NULL;
