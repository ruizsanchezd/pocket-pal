# Database

Postgres gestionado por Supabase. Todas las tablas con RLS activado y políticas que filtran por
`user_id = auth.uid()`. **Asunción universal: el cliente nunca debe pasar `user_id` manualmente sin
también garantizar el match — RLS lo bloquearía, pero los queries deben ser explícitos.**

## Entidades principales

### `profiles`
- PK = `auth.users.id` (1-a-1 con el usuario de auth).
- `display_name`, `avatar_url`, `divisa_principal` (default `'EUR'`), `cuenta_default_id`.
- `preferences jsonb`, `onboarding_completed bool`.
- **No hay INSERT desde el cliente**: se crea por trigger en signup. Update vía RPC
  (`fix_profile_rpc_upsert` migration).

### `cuentas`
- `tipo`: `'corriente' | 'inversion' | 'monedero'`. Determina lógica de saldo y UI.
- `saldo_inicial` — el saldo en el momento de creación. **El saldo actual NO se almacena**:
  se calcula como `saldo_inicial + Σ(movimientos.cantidad)` (ver `useAccountBalances`).
- `capital_inicial_invertido` — solo para `inversion`. Permite calcular rendimiento aparte del
  saldo histórico.
- `activa bool` — soft delete. Queries de UI filtran `activa = true`.
- `orden int` — orden manual en listas.

### `categorias`
- `tipo`: `'ingreso' | 'gasto' | 'inversion'`.
- `parent_id` — jerarquía de 2 niveles: padres (parent_id IS NULL) y subcategorías.
- `icono` — string identificador (no path). Lookup en cliente.

### `movimientos`
- `cantidad` — **signo importa**: positiva = ingreso, negativa = gasto.
  Los formularios deciden el signo según el tipo de categoría.
- `mes_referencia text` (formato `'yyyy-MM'`) — denormalizado de `fecha` para particionar
  consultas. Los movimientos se cargan por mes vía este campo, no por rangos de `fecha`.
- `es_recurrente bool` + `recurrente_template_id uuid NULL`:
  - FK a `gastos_recurrentes` con **ON DELETE SET NULL** (no cascade — preserva historial).
  - Si template_id es NULL pero `es_recurrente=true` → es un *huérfano* (template borrado).
- `lineas_extracto jsonb NULL` — array de `LineaExtracto` (líneas del extracto bancario tal cual:
  `fecha`, `fecha_valor`, `concepto`, `mas_datos`, `importe`, `saldo`). **Interno del importador**:
  no se muestra en la UI ni va en el CSV de exportación. Es de donde aprende a categorizar (el
  `concepto` del movimiento lo reescribe el usuario y no sirve para eso) y el `saldo` identifica
  cada línea para no reimportarla. Array porque un movimiento puede juntar varias líneas y una
  línea puede partirse en varios movimientos. Duplicar un movimiento **no** lo copia (la copia no
  viene del banco); deshacer un borrado **sí** lo restaura. Rellenado para todo Caixa desde el
  01/04/2026 cruzando el extracto (migration `20260925180000`).
- **UNIQUE constraint** (migration `20260509110000`):
  `(user_id, recurrente_template_id, mes_referencia, cuenta_id)`. Bloquea duplicados de
  generación lazy. Incluye `cuenta_id` para que las transferencias (2 filas con mismo template)
  no choquen.

### `gastos_recurrentes`
- Plantilla, no instancia. Las instancias viven en `movimientos`.
- `dia_del_mes int (1-31)` — si el mes tiene menos días, se usa `min(día, daysInMonth)`.
- `is_transfer bool` + `destination_account_id` — genera 2 movimientos (salida en origen,
  entrada en destino) con el mismo `recurrente_template_id`.
- `auto_generado_cuenta_id` — para monederos con recarga mensual automática (migration
  `20260502100000_add_auto_generado_monedero_recurrente`).

### `snapshots_patrimonio`
- Snapshot del saldo de una cuenta a final de un mes.
- `saldo_registrado` (manual override) y `saldo_calculado` (recalculado por sistema) coexisten.
- `tipo`: `'manual' | 'auto'`. Auto-snapshots se generan en `useAutoSnapshot` para el mes anterior.
- **Invariante crítica**: `saldo_registrado` jamás se sobreescribe automáticamente. Solo se
  refresca `saldo_calculado`.

### `account_balance_history`
- Audit log opcional cuando se ajusta manualmente el saldo de una cuenta.

### `cuentas_monedero_config`
- Config de recarga mensual para cuentas tipo monedero (`recarga_mensual`, `dia_recarga`).

## Migraciones notables

Lee la cabecera (comentarios SQL) de cada migración para el porqué. Casos importantes:

- **`20260213192931_fix_profile_update_policies`** y **`20260213220000_fix_profile_rpc_upsert`**:
  el update directo de `profiles` chocaba con RLS en ciertos casos → hay un RPC `upsert_profile`.
- **`20260224120000_add_balance_history_and_snapshot_improvements`**: añade history + invariante
  de `saldo_registrado`.
- **`20260225010000_add_capital_inicial_invertido`**: separa "lo invertido" del saldo histórico.
- **`20260502100000_add_auto_generado_monedero_recurrente`**: monederos con recarga mensual auto.
- **`20260509100000` → `20260509120000`**: trío que arregló duplicados de recurrentes
  (ver [known-issues.md](./known-issues.md#duplicados-de-recurrentes)).

## Tipos

- **`src/types/database.ts`** — tipos escritos a mano, alineados con el schema. **Esta es la
  fuente de verdad en cliente.**
- **`src/integrations/supabase/types.ts`** — auto-generado por Supabase. Tipa las queries
  (`supabase.from(...)`), así que **hay que regenerarlo tras cada migración**
  (`supabase gen types typescript --linked > src/integrations/supabase/types.ts`); si no, el
  typecheck del build falla o, peor, deja de proteger columnas nuevas. El código de
  aplicación importa los tipos de dominio desde `@/types/database`.

## Aplicar migraciones

Local: `supabase db reset` o `supabase migration up`. En prod se aplican desde el dashboard de
Supabase. Ver [`deployment.md`](./deployment.md).
