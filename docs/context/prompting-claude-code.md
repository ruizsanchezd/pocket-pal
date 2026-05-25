# Prompting Claude Code

Guía para construir prompts que Claude Code (CLI, con acceso al repo) pueda ejecutar a la
primera. Pensada para el flujo: *Daniel pelotea idea con Claude.ai → Claude.ai redacta el prompt → Daniel lo pega en Claude Code*.

El objetivo no es ser exhaustivo, es ser **preciso**. Un prompt corto y específico bate a uno largo y vago.

---

## Qué información debe llevar siempre un prompt

Un buen prompt para Claude Code incluye estas 5 cosas, en este orden:

1. **Contexto** (1-2 frases): qué problema resolvemos y por qué ahora.
2. **Cambio concreto**: archivo(s) y comportamiento esperado.
3. **Restricciones / invariantes**: referencias a `docs/context/` que apliquen.
4. **Criterio de hecho**: cómo Daniel verá que está bien.
5. **Verificación manual**: golden path a probar tras el cambio.

Si falta alguna, Claude Code va a tener que adivinar — y ahí entran las regresiones.

---

## Reglas para cada sección

### Contexto
- Una o dos frases. El *por qué*, no el *qué*.
- Bien: "Los recurrentes de transferencia muestran un signo confuso en el dashboard porque ambas filas se cuentan como gasto."
- Mal: "Hay un bug en transferencias."

### Cambio concreto
- **Nombrar archivos**. No "el form de movimientos" sino `src/components/movimientos/MovimientoForm.tsx`.
- Si hay varios archivos plausibles, listarlos todos o decir "investiga primero dónde vive X".
- Comportamiento descrito como antes → después, no como implementación. Claude Code decide el cómo; tú decides el qué.

### Restricciones
Linkear los docs relevantes. Algunos invariantes recurrentes para PocketPal:

- **Signo de cantidad**: positivo = ingreso, negativo = gasto. Nunca cambiar signo en cálculos derivados. (`domain-logic.md`)
- **`saldo_registrado` jamás se sobreescribe automáticamente** en snapshots. (`domain-logic.md`)
- **`mes_referencia`** se deriva de `fecha`, no se elige aparte. (`domain-logic.md`)
- **Sentinela `'__all__'`** en filtros Select, nunca `""`. (`forms-and-validation.md`)
- **Logs envueltos en `import.meta.env.DEV`**. (`architecture.md`)
- **Tipos desde `@/types/database`**, no desde `integrations/supabase/types`. (`database.md`)
- **UNIQUE constraint de recurrentes** = no asumir que se puede insertar libremente. (`database.md`)
- **Textos UI en español**, hooks/utils en inglés. (`architecture.md`)

Si el cambio toca un área marcada en `known-issues.md`, citarlo explícitamente.

### Criterio de hecho
- Observable, no interno.
- Bien: "Al borrar el template de un gasto recurrente, los movimientos generados permanecen con `template_id=NULL` y no se duplican al volver a crear el template."
- Mal: "Que el dedup funcione bien."

### Verificación manual
- Golden paths concretos a probar. Si está en la lista de `testing.md` o `known-issues.md`, referenciarlo.
- Si el cambio es UI, decir explícitamente "verificar en móvil y desktop".

---

## Anti-patrones a evitar

- **Pedir refactors junto a bug fixes**: separar. Un commit = una intención.
- **"Mejora X" sin definir qué significa mejor**: dimensión + criterio (rendimiento medido cómo, UX en qué flujo).
- **Asumir nombres de archivos sin verificar**: si no estás seguro de dónde vive algo, pídele a Claude Code que lo localice antes de cambiar.
- **Prompts que chocan con invariantes documentadas** sin justificar el por qué. Si el cambio rompe un invariante a propósito, decirlo explícito ("este cambio rompe la regla X porque...").
- **Múltiples cambios independientes en un prompt**: separar en prompts distintos. Es más rápido iterar 3 cambios pequeños que debuggear uno grande.
- **Pedir explicaciones largas en código**: este proyecto prefiere código sin comentarios salvo donde el *por qué* no sea obvio.

---

## Plantilla copiable

```
Contexto:
[1-2 frases — qué problema y por qué]

Cambio:
- Archivo(s): [path/al/archivo.tsx]
- Comportamiento esperado: [antes → después]

Restricciones:
- Ver docs/context/[archivo].md sección [X]
- Mantener invariante: [si aplica]

Hecho cuando:
- [criterio observable 1]
- [criterio observable 2]

Verificar a mano:
- [golden path 1]
- [golden path 2]
```

---

## Ejemplo bueno

```
Contexto:
Al duplicar un movimiento desde la tabla, se conserva todo menos la fecha,
que vuelve a hoy. El usuario espera mantener la misma fecha porque suele
duplicar gastos del mes pasado para registrar uno equivalente este mes.

Cambio:
- Archivo: src/hooks/useMovimientos.tsx (handleDuplicateMovimiento)
- Comportamiento: copiar también movimiento.fecha y movimiento.mes_referencia
  (en vez de calcular nuevos)

Restricciones:
- mes_referencia debe seguir derivándose de fecha (no inconsistentes entre sí)
- Ver docs/context/known-issues.md → "Pérdida de campos al editar duplicado"
  (verificar que esta corrección no regresa ese bug)

Hecho cuando:
- Duplicar un movimiento de marzo crea otro movimiento en marzo con misma
  fecha y mes_referencia
- La edición posterior del duplicado conserva categoría y subcategoría

Verificar a mano:
- Duplicar un movimiento del mes actual y del mes anterior
- Editar el duplicado y guardar — categoría debe persistir
```

---

## Ejemplo malo (y por qué)

```
"Cuando duplico movimientos no me funciona bien la fecha, arréglalo"
```

Falta: archivo, comportamiento esperado, criterio de éxito, qué significa "no funciona bien".
Claude Code va a tener que pedir aclaraciones o asumir — y ahí es donde fallan los prompts.

---

## Cuando un prompt no clave a la primera

- Cuéntale a Claude.ai qué información faltó o qué malinterpretó Claude Code.
- Si fue una invariante no documentada que rompió, **añadirla a `known-issues.md` o al doc que toque**. Cada fallo es una oportunidad de cerrar el gap.
