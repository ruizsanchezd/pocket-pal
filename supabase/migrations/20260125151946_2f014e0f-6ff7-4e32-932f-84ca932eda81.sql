-- =============================================
-- FINANCEFLOW DATABASE SCHEMA
-- =============================================

-- 1. Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Create enum for account types
CREATE TYPE public.cuenta_tipo AS ENUM ('corriente', 'inversion', 'monedero');

-- 3. Create enum for category types
CREATE TYPE public.categoria_tipo AS ENUM ('ingreso', 'gasto', 'inversion');

-- =============================================
-- PROFILES TABLE
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  divisa_principal TEXT DEFAULT 'EUR',
  cuenta_default_id UUID,
  preferences JSONB DEFAULT '{}',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- =============================================
-- USER ROLES TABLE (Security)
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- CUENTAS TABLE (Accounts)
-- =============================================
CREATE TABLE public.cuentas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo cuenta_tipo NOT NULL,
  divisa TEXT DEFAULT 'EUR',
  saldo_inicial DECIMAL(12, 2) DEFAULT 0,
  color TEXT DEFAULT '#3B82F6',
  activa BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.cuentas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own accounts" ON public.cuentas
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- CUENTAS_MONEDERO_CONFIG TABLE
-- =============================================
CREATE TABLE public.cuentas_monedero_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cuenta_id UUID NOT NULL REFERENCES public.cuentas(id) ON DELETE CASCADE,
  recarga_mensual DECIMAL(10, 2) NOT NULL,
  dia_recarga INTEGER DEFAULT 1,
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cuenta_id)
);

ALTER TABLE public.cuentas_monedero_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own wallet config" ON public.cuentas_monedero_config
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- CATEGORIAS TABLE (Categories - Hierarchical)
-- =============================================
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  parent_id UUID REFERENCES public.categorias(id) ON DELETE CASCADE,
  tipo categoria_tipo NOT NULL,
  icono TEXT,
  color TEXT DEFAULT '#6B7280',
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own categories" ON public.categorias
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- GASTOS_RECURRENTES TABLE (Recurring Expenses)
-- =============================================
CREATE TABLE public.gastos_recurrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concepto TEXT NOT NULL,
  cantidad DECIMAL(12, 2) NOT NULL,
  dia_del_mes INTEGER,
  cuenta_id UUID NOT NULL REFERENCES public.cuentas(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  subcategoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  notas TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.gastos_recurrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own recurring expenses" ON public.gastos_recurrentes
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- MOVIMIENTOS TABLE (Transactions)
-- =============================================
CREATE TABLE public.movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  concepto TEXT NOT NULL,
  cantidad DECIMAL(12, 2) NOT NULL,
  cuenta_id UUID NOT NULL REFERENCES public.cuentas(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  subcategoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  notas TEXT,
  es_recurrente BOOLEAN DEFAULT FALSE,
  recurrente_template_id UUID REFERENCES public.gastos_recurrentes(id) ON DELETE SET NULL,
  mes_referencia TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transactions" ON public.movimientos
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_movimientos_user_mes ON public.movimientos(user_id, mes_referencia);
CREATE INDEX idx_movimientos_fecha ON public.movimientos(fecha);
CREATE INDEX idx_movimientos_cuenta ON public.movimientos(cuenta_id);
CREATE INDEX idx_movimientos_categoria ON public.movimientos(categoria_id);

-- =============================================
-- SNAPSHOTS_PATRIMONIO TABLE (Monthly Reconciliation)
-- =============================================
CREATE TABLE public.snapshots_patrimonio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes TEXT NOT NULL,
  cuenta_id UUID NOT NULL REFERENCES public.cuentas(id) ON DELETE CASCADE,
  saldo_registrado DECIMAL(12, 2),
  saldo_calculado DECIMAL(12, 2),
  tipo_cambio DECIMAL(10, 6),
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, mes, cuenta_id)
);

ALTER TABLE public.snapshots_patrimonio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own snapshots" ON public.snapshots_patrimonio
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- TRIGGERS
-- =============================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Apply to cuentas
CREATE TRIGGER update_cuentas_updated_at
  BEFORE UPDATE ON public.cuentas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Apply to movimientos
CREATE TRIGGER update_movimientos_updated_at
  BEFORE UPDATE ON public.movimientos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- ADD FOREIGN KEY CONSTRAINT FOR DEFAULT ACCOUNT
-- =============================================
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_cuenta_default
  FOREIGN KEY (cuenta_default_id)
  REFERENCES public.cuentas(id)
  ON DELETE SET NULL;