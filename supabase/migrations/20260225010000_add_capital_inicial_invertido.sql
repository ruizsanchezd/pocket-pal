-- Add capital_inicial_invertido column for investment accounts
ALTER TABLE public.cuentas
  ADD COLUMN capital_inicial_invertido DECIMAL(12, 2) DEFAULT 0;

COMMENT ON COLUMN public.cuentas.capital_inicial_invertido IS 'Initial invested capital for investment accounts. Used to calculate returns = current_balance - (initial_capital + deposits)';
