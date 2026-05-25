# Domain logic

## Signo de `cantidad`

`movimientos.cantidad` es signed:
- **Positivo** → ingreso (suma al saldo).
- **Negativo** → gasto (resta).

El formulario asigna el signo según el tipo de la categoría seleccionada. **Nunca cambiar el signo
en cálculos derivados** — siempre confiar en lo guardado.

Para totales agregados (`useMovimientos.totals`):
- `ingresos` = suma de `cantidad > 0`.
- `gastos` = suma de `|cantidad|` para `cantidad < 0`.

## Saldo de cuenta

No se almacena. Se calcula como:

```
saldo_actual = saldo_inicial + Σ(movimientos.cantidad WHERE cuenta_id = X)
```

Implementación: `src/hooks/useAccountBalances.ts`. Hace **una sola query** trayendo
`cantidad + cuenta_id` para todas las cuentas y agrupa en cliente. Es intencionadamente
una agregación cliente porque evita N queries y la cantidad de movimientos por usuario es modesta.

**Si esto crece**: mover a una vista materializada o RPC.

## Tipos de cuenta

| Tipo | Comportamiento UI | Campos extra relevantes |
|---|---|---|
| `corriente` | Cuenta de uso diario. Muestra saldo. | — |
| `inversion` | Muestra `invertido` (capital_inicial_invertido) y `rendimiento` (saldo - invertido). | `capital_inicial_invertido` |
| `monedero` | Presupuesto mensual. Muestra `gastos_mes` además del saldo. Puede tener recarga automática. | Entry en `cuentas_monedero_config` |

Ver `CuentaConSaldo` en `types/database.ts`.

## Recurrentes: generación lazy

Disparada por `useMovimientos` cuando se navega al mes **actual**. Pasos:

1. Lee `gastos_recurrentes` activos.
2. Re-consulta movimientos del mes para obtener estado fresco (no fía del state, evita races).
3. Para cada template, descarta si:
   - Existe un movimiento con ese `recurrente_template_id` en el mes (set `existingTemplateIds`).
   - **O** existe un huérfano (template_id NULL) con mismo `concepto + cuenta_id` (set
     `existingOrphans`). Esto cubre el caso de template borrado y recreado — sin esto, se
     duplica el movimiento.
   - **O** `dia_del_mes > día actual` (no se ha cumplido aún este mes).
4. Inserta los `pending` con `upsert(onConflict: 'user_id,recurrente_template_id,mes_referencia,cuenta_id', ignoreDuplicates: true)`.
   El UNIQUE constraint del schema es la red de seguridad final.

Si `is_transfer = true`, se generan **2 filas** con el mismo `recurrente_template_id`:
una negativa en `cuenta_id` y una positiva en `destination_account_id`.

**Guardia anti-concurrencia**: `isAutoGeneratingRef` previene que dos invocaciones del effect en
rápida sucesión disparen dos rondas de inserción simultáneas.

## Snapshots de patrimonio

`useAutoSnapshot` corre **una vez por sesión** y genera/refresca snapshots del **mes anterior**
para cada cuenta activa.

Reglas:
- Si la cuenta se creó después del mes objetivo → skip.
- Si ya existe snapshot y `updated_at >= startOfMonth(now)` → skip (ya refrescado este mes).
- Si existe: actualiza `saldo_calculado`. **Nunca toca `saldo_registrado`** (manual override).
- Si no existe: crea con `tipo='auto'`, `saldo_registrado=null`.

Para snapshots manuales, el usuario los crea desde la UI de dashboard. Esos van con
`tipo='manual'` y rellenan `saldo_registrado`.

## Filtros y búsqueda

`useMovimientos` aplica filtros en memoria:
- `filtroCategoria` y `filtroSubcategoria` con sentinela `'__all__'` (no usar string vacía —
  Radix Select interpreta `""` como "sin selección").
- `filtroBusqueda` se normaliza con NFD para ignorar acentos: `'Á' === 'A'`.

## Mes de referencia

`mes_referencia` (`'yyyy-MM'`) es la "carpeta" del movimiento. Al editar la fecha de un
movimiento, también se debe recalcular y guardar `mes_referencia` (lo hace `handleSaveMovimiento`).

Navegación de mes en `useMovimientos.navigateMonth` — recarga movimientos del nuevo mes y dispara
auto-generación de recurrentes si es el mes actual.

## Currency y locale

- Divisa por usuario en `profile.divisa_principal` (default `'EUR'`).
- Formateo en `src/lib/format.ts` usando `Intl.NumberFormat`.
- Fechas con `date-fns` + `locale: es`.
