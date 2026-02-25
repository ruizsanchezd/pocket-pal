// PocketPal Database Types

export type CuentaTipo = 'corriente' | 'inversion' | 'monedero';
export type CategoriaTipo = 'ingreso' | 'gasto' | 'inversion';
export type AppRole = 'admin' | 'user';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  divisa_principal: string;
  cuenta_default_id: string | null;
  preferences: Record<string, unknown>;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Cuenta {
  id: string;
  user_id: string;
  nombre: string;
  tipo: CuentaTipo;
  divisa: string;
  saldo_inicial: number;
  capital_inicial_invertido: number;
  color: string;
  activa: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface CuentaMonederoConfig {
  id: string;
  user_id: string;
  cuenta_id: string;
  recarga_mensual: number;
  dia_recarga: number;
  activa: boolean;
  created_at: string;
}

export interface Categoria {
  id: string;
  user_id: string;
  nombre: string;
  parent_id: string | null;
  tipo: CategoriaTipo;
  icono: string | null;
  color: string;
  orden: number;
  created_at: string;
}

export interface CategoriaConHijos extends Categoria {
  children?: CategoriaConHijos[];
}

export interface GastoRecurrente {
  id: string;
  user_id: string;
  concepto: string;
  cantidad: number;
  dia_del_mes: number | null;
  cuenta_id: string;
  categoria_id: string;
  subcategoria_id: string | null;
  notas: string | null;
  activo: boolean;
  is_transfer: boolean;
  destination_account_id: string | null;
  created_at: string;
}

export interface Movimiento {
  id: string;
  user_id: string;
  fecha: string;
  concepto: string;
  cantidad: number;
  cuenta_id: string;
  categoria_id: string;
  subcategoria_id: string | null;
  notas: string | null;
  es_recurrente: boolean;
  recurrente_template_id: string | null;
  mes_referencia: string;
  created_at: string;
  updated_at: string;
}

export interface MovimientoConRelaciones extends Movimiento {
  cuenta?: Cuenta;
  categoria?: Categoria;
  subcategoria?: Categoria | null;
}

export interface SnapshotPatrimonio {
  id: string;
  user_id: string;
  mes: string;
  cuenta_id: string;
  saldo_registrado: number | null;
  saldo_calculado: number | null;
  tipo_cambio: number | null;
  tipo: 'manual' | 'auto';
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountBalanceHistory {
  id: string;
  user_id: string;
  cuenta_id: string;
  snapshot_id: string | null;
  previous_balance: number;
  new_balance: number;
  changed_at: string;
}

// Form types
export interface MovimientoFormData {
  fecha: Date;
  concepto: string;
  cantidad: number;
  cuenta_id: string;
  categoria_id: string;
  subcategoria_id?: string;
  notas?: string;
}

export interface CuentaFormData {
  nombre: string;
  tipo: CuentaTipo;
  divisa: string;
  saldo_inicial: number;
  saldo_actual?: number; // For balance override when editing
  color: string;
  recarga_mensual?: number; // Only for monedero
}

export interface CategoriaFormData {
  nombre: string;
  tipo: CategoriaTipo;
  parent_id?: string;
  icono?: string;
  color: string;
}

// Dashboard types
export interface DashboardMetrics {
  patrimonioTotal: number;
  balanceMes: number;
  variacionMesAnterior: number;
  tasaAhorro: number;
}

export interface CuentaConSaldo extends Cuenta {
  saldo_actual: number;
  gastos_mes?: number; // For monedero type
  invertido?: number; // For inversion type - total deposited
  rendimiento?: number; // For inversion type - returns (saldo_actual - invertido)
}
