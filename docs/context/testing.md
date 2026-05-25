# Testing

## Setup

- **Vitest** con **jsdom** + **Testing Library**.
- Config en `vitest.config.ts`, setup global en `src/test/setup.ts`.
- Comandos: `npm test` (run once), `npm test:watch`.

## Estado actual

Cobertura mínima — hay un `example.test.ts` y poco más. **La mayoría de validación es manual**.
Esto es información, no juicio: no asumir que existe red de seguridad automática al refactorizar.

## Cuándo escribir tests

Por orden de prioridad:

1. **Lógica pura no trivial** — funciones de `lib/` (formateo, parsing, cálculos derivados).
   Estas son baratas de testear y atrapan regresiones reales.
2. **Reglas de dominio con casos límite** — generación de recurrentes (día 31 en febrero,
   templates borrados y recreados, transferencias), cálculo de balances, snapshot logic.
3. **Validaciones Zod** — verificar `refine` cruzados (ej. transfer requiere destino distinto).
4. **Componentes con lógica condicional fuerte** — formularios con campos que aparecen/desaparecen
   según otro campo.

No escribir tests por cubrir métrica. Cada test debe representar un caso de fallo plausible.

## Testear con Supabase

Para tests que tocan el cliente Supabase: mockear `@/integrations/supabase/client` con
`vi.mock()`. Asegurar que el mock devuelve la misma forma `{ data, error }` que la API real,
porque el código encadena `.from().select().eq()...`. Construir un mock chainable mínimo.

## Verificación manual: golden paths

Tras cambios en lógica de dominio, verificar a mano:

- [ ] Crear movimiento (ingreso, gasto, en distintas cuentas).
- [ ] Editar movimiento existente.
- [ ] Duplicar movimiento → comprobar que conserva categoría y subcategoría.
- [ ] Borrar movimiento + deshacer desde toast.
- [ ] Crear gasto recurrente (normal y transferencia).
- [ ] Navegar al mes actual → recurrentes pendientes se generan automáticamente.
- [ ] Cambiar fecha de un movimiento a otro mes → desaparece del listado actual.
- [ ] Cambiar saldo de cuenta y verificar que se refleja.
- [ ] Dashboard refleja totales correctos en móvil y desktop.

Ver [known-issues.md](./known-issues.md) para áreas frágiles que requieren atención extra.

## UI

Para cambios visuales o de UX, **abrir en navegador** (móvil y desktop) — los tests unitarios
no validan UX. `npm run dev` y revisar en `localhost:8080`.
