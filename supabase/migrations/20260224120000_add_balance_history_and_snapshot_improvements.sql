-- Add account balance history table for tracking manual balance adjustments
CREATE TABLE public.account_balance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cuenta_id UUID NOT NULL REFERENCES public.cuentas(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES public.snapshots_patrimonio(id) ON DELETE SET NULL,
  previous_balance DECIMAL(12, 2) NOT NULL,
  new_balance DECIMAL(12, 2) NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on balance history
ALTER TABLE public.account_balance_history ENABLE ROW LEVEL SECURITY;

-- Policy: users can only manage their own balance history
CREATE POLICY "Users manage own balance history" ON public.account_balance_history
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for efficient queries
CREATE INDEX idx_balance_history_cuenta ON public.account_balance_history(cuenta_id);
CREATE INDEX idx_balance_history_user ON public.account_balance_history(user_id);

-- Add tipo (manual/auto) and updated_at to snapshots_patrimonio for Feature 2
ALTER TABLE public.snapshots_patrimonio
  ADD COLUMN tipo TEXT DEFAULT 'manual' CHECK (tipo IN ('manual', 'auto')),
  ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Index for efficient snapshot lookups by month
CREATE INDEX idx_snapshots_user_mes ON public.snapshots_patrimonio(user_id, mes);

-- Add transfer fields to gastos_recurrentes for Feature 3
ALTER TABLE public.gastos_recurrentes
  ADD COLUMN is_transfer BOOLEAN DEFAULT FALSE,
  ADD COLUMN destination_account_id UUID REFERENCES public.cuentas(id) ON DELETE SET NULL;
