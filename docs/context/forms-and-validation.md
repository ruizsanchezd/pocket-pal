# Forms and validation

## Patrón estándar

1. Schema Zod en `src/lib/validations.ts`.
2. `useForm({ resolver: zodResolver(schema) })` en el componente.
3. Componentes shadcn `<Form>`, `<FormField>`, `<FormItem>`, `<FormControl>`, `<FormMessage>`.
4. Submit → handler en el hook de página (no en el componente de form).

El componente de form solo conoce el shape de los datos; quien decide qué hacer con ellos es la
página/hook (separa presentación de efectos).

## Schemas existentes (en `validations.ts`)

| Schema | Notas |
|---|---|
| `loginSchema` / `signUpSchema` | Email + password (6-72 chars). signUp con `refine` para `confirmPassword`. |
| `movimientoSchema` | `cantidad ≠ 0` enforced. `subcategoria_id` opcional. |
| `cuentaSchema` | `saldo_actual` opcional para override en edición. `recarga_mensual` solo para monedero (no enforced aquí, lo hace el form). |
| `categoriaSchema` | Jerarquía vía `parent_id` opcional. |
| `gastoRecurrenteSchema` | `refine` cruzado: si `is_transfer`, `destination_account_id` requerido y distinto a `cuenta_id`. |

## Trampas conocidas

### Input de cantidad numérica
Bug histórico (commits `2c46498`, `b45ed18`): un input numérico no permitía borrar el último
dígito porque convertía `""` → `0` en el `onChange`. **Regla**: si la cantidad puede estar
vacía mientras el usuario edita, manejar el valor como string en estado intermedio o aceptar
`undefined`/NaN y dejar que Zod valide en submit. No forzar `0` en el change.

### Editar duplicados
Bug histórico (commit `3cdfdd4`): al editar un movimiento duplicado, se perdía la categoría/subcategoría.
**Regla**: al pre-llenar el form de edición, mapear todos los campos incluyendo `subcategoria_id`
incluso si es `null`. No omitir campos opcionales en `defaultValues`.

### Sentinelas en Select
Radix `<Select>` no acepta `value=""`. Usar `'__all__'` para "sin filtro" (ver
`useMovimientos.filtroCategoria`).

### Fechas
`movimientoSchema.fecha` es `z.date()` (Date object), no string. La conversión a `yyyy-MM-dd`
se hace en el submit handler con `format()`. Para `mes_referencia` se usa `format(fecha, 'yyyy-MM')`
— calcularlo desde la fecha del form, **no** dejar al usuario elegirlo.

## Convenciones UX

- Mensajes de error en español, breves y específicos.
- `toast({ variant: 'destructive', title: 'Error', description: ... })` para fallos de API.
- `toast({ title: '...' })` neutro para éxito.
- Tras crear/editar, cerrar modal + reset state (`setEditingX(null)`, `setOpen(false)`).
