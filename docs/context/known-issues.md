# Known issues & fragile areas

Lista viva de bugs históricos y áreas donde es fácil meter regresiones. Añadir aquí cuando un
bug se repite o un área resulta sorprendente. **No describe la solución** (eso está en el commit);
describe la causa raíz y dónde mirar.

---

## Duplicados de recurrentes

**Síntoma**: Movimientos recurrentes aparecen 2+ veces en el mes.

**Causas posibles**:
1. **Race condition en generación lazy**: si el `useEffect` que dispara la generación corre dos
   veces casi simultáneamente, ambas lecturas ven el mismo estado de BD y ambas insertan.
   *Mitigación actual*: `isAutoGeneratingRef` (guardia en cliente) + UNIQUE constraint en BD
   `(user_id, recurrente_template_id, mes_referencia, cuenta_id)` + `upsert` con `ignoreDuplicates`.
2. **Template borrado y recreado**: el FK es ON DELETE SET NULL → el movimiento queda huérfano
   (`template_id=NULL`). Si solo deduplicas por `template_id`, el nuevo template inserta una fila
   duplicada. *Mitigación*: el dedup también compara `concepto+cuenta_id` para huérfanos
   (`existingOrphans` set en `useMovimientos`).
3. **Transferencias**: legítimamente generan 2 filas con el mismo template_id (origen + destino).
   La partición incluye `cuenta_id` para que no choquen entre sí.

**Dónde mirar**: `src/hooks/useMovimientos.tsx` (bloque de auto-generation), migraciones
`20260509*`.

---

## Input numérico que no borra el último dígito

**Síntoma**: en formularios con cantidad, no se puede dejar el campo vacío al borrar.

**Causa**: el `onChange` convertía `""` → `0`, así que el siguiente borrado ya partía de `0`.

**Regla**: aceptar string/undefined como valor intermedio y dejar que Zod valide en submit.
Ver [forms-and-validation.md](./forms-and-validation.md#input-de-cantidad-numérica). Histórico:
commits `2c46498`, `b45ed18`. Aplica a movimientos, cuentas, recurrentes — verificar los 3 si se
toca el patrón.

---

## Pérdida de campos al editar movimiento duplicado

**Síntoma**: editar un movimiento creado por duplicación pierde categoría/subcategoría.

**Causa**: `defaultValues` del form omitía campos `null`. Commit `3cdfdd4`.

**Regla**: mapear todos los campos en `defaultValues`, incluso si son `null`/opcionales.

---

## Saldo recalculado vs registrado en snapshots

**Síntoma**: un snapshot manual del usuario "desaparece" tras refresh.

**Causa potencial**: código que sobreescribe `saldo_registrado` en vez de solo
`saldo_calculado`.

**Regla**: `useAutoSnapshot` y cualquier refresco automático **solo** debe tocar `saldo_calculado`
y `updated_at`. `saldo_registrado` solo se toca en operaciones explícitas del usuario.

---

## Profile update con RLS

**Síntoma**: error al actualizar el profile desde el cliente.

**Causa histórica**: las políticas de RLS del UPDATE directo eran demasiado estrictas en ciertos
flujos (ej. onboarding).

**Solución actual**: hay una RPC `upsert_profile` (migrations `20260213*`). Usar la RPC en vez de
`.from('profiles').update(...)` cuando el flujo incluya onboarding o creación.

---

## Sentinela `'__all__'` en filtros

Radix Select no acepta `value=""`. Si un filtro pierde su opción "todos", es probable que
alguien usó string vacía. Usar `'__all__'` consistentemente.

---

## Áreas a verificar a mano cuando se toca algo del dominio

- Generación de recurrentes el día 1 y el día 31 de un mes corto (febrero).
- Transferencias entre cuentas — verificar que generan 2 filas con signos correctos.
- Cambiar la fecha de un movimiento a otro mes → debe moverse de `mes_referencia` y desaparecer
  del listado del mes actual.
- Crear cuenta nueva y comprobar que aparece en formularios de movimientos sin recargar.
- Borrar template recurrente con movimientos generados → comprobar que los movimientos
  permanecen (huérfanos, `template_id=NULL`).
