import { z } from 'zod';

// Auth validations
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'El email es obligatorio')
  .email('Email inválido')
  .max(255, 'Email demasiado largo');

export const passwordSchema = z
  .string()
  .min(6, 'La contraseña debe tener al menos 6 caracteres')
  .max(72, 'La contraseña no puede exceder 72 caracteres');

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword']
});

// Movimiento validations
export const movimientoSchema = z.object({
  fecha: z.date({
    required_error: 'La fecha es obligatoria'
  }),
  concepto: z
    .string()
    .trim()
    .min(1, 'El concepto es obligatorio')
    .max(200, 'El concepto no puede exceder 200 caracteres'),
  cantidad: z
    .number({
      required_error: 'La cantidad es obligatoria',
      invalid_type_error: 'Introduce un número válido'
    })
    .refine((val) => val !== 0, 'La cantidad no puede ser 0'),
  cuenta_id: z
    .string()
    .min(1, 'Selecciona una cuenta'),
  categoria_id: z
    .string()
    .min(1, 'Selecciona una categoría'),
  subcategoria_id: z.string().optional(),
  notas: z
    .string()
    .max(500, 'Las notas no pueden exceder 500 caracteres')
    .optional()
});

// Cuenta validations
export const cuentaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  tipo: z.enum(['corriente', 'inversion', 'monedero'], {
    required_error: 'Selecciona un tipo de cuenta'
  }),
  divisa: z.string().default('EUR'),
  saldo_inicial: z
    .number({
      required_error: 'El saldo inicial es obligatorio',
      invalid_type_error: 'Introduce un número válido'
    })
    .default(0),
  saldo_actual: z.number().optional(), // For balance override when editing
  capital_inicial_invertido: z.number().optional(), // For investment accounts
  color: z.string().default('#3B82F6'),
  recarga_mensual: z
    .number()
    .positive('La recarga debe ser positiva')
    .optional()
});

// Categoria validations
export const categoriaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(50, 'El nombre no puede exceder 50 caracteres'),
  tipo: z.enum(['ingreso', 'gasto', 'inversion'], {
    required_error: 'Selecciona un tipo de categoría'
  }),
  parent_id: z.string().optional(),
  icono: z.string().optional(),
  color: z.string().default('#6B7280')
});

// Gasto recurrente validations
export const gastoRecurrenteSchema = z.object({
  concepto: z
    .string()
    .trim()
    .min(1, 'El concepto es obligatorio')
    .max(200, 'El concepto no puede exceder 200 caracteres'),
  cantidad: z
    .number({
      required_error: 'La cantidad es obligatoria',
      invalid_type_error: 'Introduce un número válido'
    })
    .refine((val) => val !== 0, 'La cantidad no puede ser 0'),
  dia_del_mes: z
    .number()
    .int()
    .min(1, 'El día debe ser entre 1 y 31')
    .max(31, 'El día debe ser entre 1 y 31')
    .optional(),
  cuenta_id: z.string().min(1, 'Selecciona una cuenta'),
  categoria_id: z.string().min(1, 'Selecciona una categoría'),
  subcategoria_id: z.string().optional(),
  notas: z.string().max(500, 'Las notas no pueden exceder 500 caracteres').optional(),
  is_transfer: z.boolean().default(false),
  destination_account_id: z.string().nullable().optional()
}).refine((data) => {
  // If is_transfer, destination_account_id is required and must differ from cuenta_id
  if (data.is_transfer) {
    return !!data.destination_account_id && data.destination_account_id !== data.cuenta_id;
  }
  return true;
}, {
  message: 'Selecciona una cuenta destino diferente a la cuenta origen',
  path: ['destination_account_id']
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type MovimientoFormData = z.infer<typeof movimientoSchema>;
export type CuentaFormData = z.infer<typeof cuentaSchema>;
export type CategoriaFormData = z.infer<typeof categoriaSchema>;
export type GastoRecurrenteFormData = z.infer<typeof gastoRecurrenteSchema>;
