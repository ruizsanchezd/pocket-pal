# CLAUDE.md

This file provides guidance for Claude Code when working with this repository.

## Project Overview

**FinanceFlow** - A personal finance management app built with React 18 + TypeScript + Vite + Tailwind CSS + shadcn-ui + Supabase.

Features: Transaction tracking, account management, expense categorization, dashboards/analytics, recurring expenses, CSV export.

## Commands

```bash
npm run dev          # Start dev server (port 8080)
npm run build        # Production build
npm run lint         # Run ESLint
npm test             # Run Vitest tests once
npm test:watch       # Run Vitest in watch mode
```

## Architecture

### Directory Structure

- `src/pages/` - Full page components (Auth, Dashboard, Movimientos, Configuracion)
- `src/components/ui/` - shadcn-ui primitive components
- `src/components/layout/` - MainLayout, ProtectedRoute
- `src/components/[feature]/` - Feature-specific components
- `src/contexts/` - React Context providers (AuthContext)
- `src/hooks/` - Custom React hooks
- `src/integrations/supabase/` - Supabase client and auto-generated types
- `src/lib/` - Utilities (validations.ts with Zod schemas, export.ts, utils.ts)
- `src/types/` - TypeScript interfaces for domain models
- `supabase/migrations/` - Database migrations

### Key Patterns

**Authentication:** React Context (`AuthContext.tsx`) with Supabase auth. Use `useAuth()` hook. Protected pages wrapped with `<ProtectedRoute>`.

**Data Fetching:** TanStack React Query for server state. Supabase client from `@/integrations/supabase/client`.

**Forms:** React Hook Form + Zod. All schemas in `src/lib/validations.ts`.

**Styling:** Tailwind CSS with CSS variables for theming. Use `cn()` from `@/lib/utils` for conditional classes.

**Import Alias:** `@/*` maps to `src/*`.

### Database Entities

- `Profile` - User profile (display_name, currency, onboarding status)
- `Cuenta` - Accounts (types: corriente, inversion, monedero)
- `Categoria` - Categories (types: ingreso, gasto, inversion)
- `Movimiento` - Transactions
- `GastoRecurrente` - Recurring expenses/income
- `SnapshotPatrimonio` - Monthly net worth snapshots

### UI Components

All from shadcn-ui using Radix UI primitives. Icons from Lucide React.

## Conventions

- Spanish language for UI text and variable names related to domain (cuentas, movimientos, categorias)
- Environment-aware logging: wrap console logs with `import.meta.env.DEV` check
- Toast notifications via `useToast()` hook for user feedback
- Date handling with `date-fns` and Spanish locale (`es`)

## Adding Features

1. **New page:** Create in `src/pages/`, add route in `App.tsx`, wrap with `<ProtectedRoute>` if auth required
2. **New component:** Place in `src/components/[feature]/`, use UI components from `@/components/ui`
3. **Database queries:** Use Supabase client, add TypeScript types in `src/types/database.ts`
4. **Form validation:** Add Zod schema in `src/lib/validations.ts`, use with React Hook Form
