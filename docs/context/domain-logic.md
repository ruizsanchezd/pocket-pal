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

Implementación: `calcularSaldos()` en `src/lib/saldos.ts` es la **única** regla de saldo
(también `gastos_mes` de monederos e `invertido`/`rendimiento` de inversión). La usan el
Dashboard y `useAccountBalances`. Los movimientos se traen con `fetchMovimientosParaSaldos()`:
una query paginada para todas las cuentas, agregada en cliente.

**Si esto crece** (varios miles de movimientos): mover la suma a una RPC en Postgres.

## Tipos de cuenta

| Tipo | Comportamiento UI | Campos extra relevantes |
|---|---|---|
| `corriente` | Cuenta de uso diario. Muestra saldo. | — |
| `inversion` | Muestra `invertido` (capital_inicial_invertido) y `rendimiento` (saldo - invertido). | `capital_inicial_invertido` |
| `monedero` | Presupuesto mensual. Muestra `gastos_mes` además del saldo. Puede tener recarga automática. | Entry en `cuentas_monedero_config` |

Ver `CuentaConSaldo` en `types/database.ts`.

## Recurrentes: generación lazy

Disparada por `useMovimientos` cuando se navega al mes **actual**. La decisión de qué generar
es pura y está testeada: `planificarRecurrentes()` en `src/lib/recurrentes.ts`. Pasos:

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

## Importador de extractos

Página `/movimientos/importar` (`pages/ImportarExtracto.tsx`). De momento solo lee el CSV de
CaixaBank (`lib/importador/extracto-caixabank.ts`). La decisión es pura y está testeada:
`planificarImportacion()` en `lib/importador/planificar.ts`.

**Aprende de `movimientos.lineas_extracto`** (ver [database.md](./database.md)): cada movimiento
que vino del banco dice cómo lo llamó el banco y en qué categoría quedó. No hay tabla de reglas:
recategorizar un movimiento cambia lo que propondrá la siguiente importación. El comercio se
compara con `claveComercio()` (sin números, signos ni acentos).

Cada línea del extracto acaba en uno de cuatro tipos, por este orden:

1. **`anterior`** — su huella (`fecha|importe|saldo|concepto`) ya está guardada, o es más de 7
   días anterior a la última línea importada de esa cuenta. No se decide por posición: el
   Spotify del día 22 puede estar enlazado (lo generó el recurrente) y un Bizum de ese mismo día,
   debajo en el extracto, no.
2. **`apuntada`** — ya existe sin línea del banco (apuntado a mano o generado por un
   recurrente): mismo importe y fecha más cercana hasta 7 días, o el movimiento del recurrente
   aprendido en el mes que toca aunque el importe no coincida (la nómina: se avisa y el usuario
   corrige el importe a mano, como siempre). Solo se le guarda la línea; no se crea nada.
3. **`anulada`** — cargo y devolución del mismo importe en ≤2 días (preautorizaciones de
   gasolinera, cuota de tarjeta retrocedida). Los Bizum nunca se anulan entre sí.
4. **`nueva`** — con propuesta y semáforo:
   - **verde**: el mismo comercio visto ≥2 veces, siempre en la misma categoría. Si el comercio
     cobra cosas distintas (APPLE.COM/BILL), manda el importe.
   - **amarillo**: visto 1 vez, visto con varias categorías, parecido (misma primera palabra o
     mismo `mas_datos`), o concepto genérico ("COMPRA CON TARJETA").
   - **rojo**: nunca visto, o Bizum sin pista.
   - Los movimientos de **Viajes** no enseñan: un viaje es de una vez. Para eso está el botón
     "Estuve de viaje" (`filasDelViaje()`), que pasa un rango de fechas a una subcategoría de
     Viajes salvo recurrentes y Vicio (el tabaco nunca va al viaje).
   - Si siempre lo reescribió igual ("BRUNOA SPORT" → "Gimnasio"), reutiliza ese concepto; si
     siempre fue la misma plantilla de recurrente, el nuevo lleva `recurrente_template_id` (así
     la generación lazy no lo duplica); si siempre se apuntó el día 1 del mes siguiente
     (alquiler, nómina), propone esa fecha.
   - "COMPRA CON TARJETA" toma el comercio de la retención anulada de justo debajo y guarda
     retención y devolución en `lineas_extracto` para aprender el nombre.
   - Un Bizum recibido propone la categoría del gasto no recurrente más reciente de los 3 días
     anteriores que lo cubre; si ese gasto es otra fila nueva, la sigue (`sigueA`) hasta que el
     usuario toque el Bizum.

Al guardar (`guardarImportacion` en `hooks/useImportador.ts`): los nuevos se insertan en una
sola llamada con `created_at` decreciente según la posición en el extracto (el orden intradía
de la lista sale igual que el del banco), y luego se enlazan las `apuntada`. El toast final
tiene "Deshacer" (borra lo creado y quita las líneas enlazadas).
