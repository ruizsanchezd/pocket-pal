# Architecture

## Stack

- **Vite + React 18 + TypeScript** — SPA, build rápido.
- **Supabase** — Postgres + Auth + RLS. Cliente en `src/integrations/supabase/client.ts`.
- **TanStack React Query** — estado servidor (cuentas, categorías). Queries cacheadas por `user_id`.
- **React Hook Form + Zod** — todos los formularios. Schemas centralizados.
- **shadcn-ui + Radix + Tailwind** — primitivos accesibles, tematización por CSS variables.
- **date-fns** con locale `es` — formateo y manipulación de fechas.
- **react-router-dom v6** — rutas, `ProtectedRoute` wrapper para auth.
- **Vitest + Testing Library + jsdom** — tests.
- **Vercel** — hosting; `vercel.json` configura SPA rewrites.

## Capas

```
src/
├── pages/              Componentes página, atados a rutas en App.tsx
├── components/
│   ├── ui/             shadcn primitives (no editar a mano salvo motivo)
│   ├── layout/         MainLayout, ProtectedRoute, ScrollToTop
│   └── [feature]/      Componentes específicos de feature (movimientos, dashboard, configuracion, auth)
├── contexts/           AuthContext (única fuente de verdad de user/session/profile)
├── hooks/              Hooks de dominio (useMovimientos, useAccountBalances, useAutoSnapshot, useStaticData)
├── integrations/       Cliente Supabase + tipos auto-generados
├── lib/                validations.ts (Zod), format.ts, export.ts, utils.ts
└── types/database.ts   Tipos de dominio escritos a mano (NO los auto-generados)
```

## Estado: cuándo usar qué

| Caso | Mecanismo |
|---|---|
| User/session/profile | `useAuth()` (Context) |
| Datos servidor cacheables y compartidos (cuentas, categorías) | React Query via `useCuentas()` / `useCategorias()` |
| Datos servidor de una página (movimientos del mes) | `useState` local en hook de página + `useEffect` |
| Estado UI local (modales, filtros) | `useState` colocado junto a los datos que afecta |

`useMovimientos` mezcla a propósito estado local + cache + UI: la página tiene una vista única
acoplada a operaciones CRUD, y separar daría más fricción que claridad.

## Convenciones de naming

- **Dominio en español**: `cuentas`, `movimientos`, `categorias`, `gastos_recurrentes`,
  `saldo_inicial`, `mes_referencia`. Coincide con el schema de Postgres.
- **Infraestructura en inglés**: hooks (`useAccountBalances`), utilidades genéricas (`formatCurrency`),
  componentes UI.
- **UI en español**: textos visibles al usuario.

## Routing

Todas las rutas autenticadas envueltas en `<ProtectedRoute>`. `/` redirige a `/movimientos`.
Subpáginas de configuración bajo `/configuracion/*` con `MobileSubpageHeader` para volver.

## Logging

Console logs envueltos en `if (import.meta.env.DEV)`. No dejar logs sin guardar en prod.

## Build & alias

- `@/*` → `src/*` (tsconfig + vite.config).
- Dev server en puerto **8080** (no 5173).
- `npm run build:dev` existe para builds en modo development.
