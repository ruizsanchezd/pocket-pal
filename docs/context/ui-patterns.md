# UI patterns

## Mobile-first

App diseñada para móvil primero. Usa `useIsMobile()` (de `src/hooks/use-mobile.tsx`) para
decisiones de layout. Breakpoint estándar de Tailwind (`md:`).

## Dialog vs Drawer

- **Desktop** (`md` y arriba): `<Dialog>` centrado.
- **Móvil**: `<Drawer>` de `vaul`, desliza desde abajo.
- Hook `use-drawer-swipe-dismiss` añade gesto de cierre por swipe.

Patrón típico: un componente que renderiza una u otra según `useIsMobile()`, exponiendo la misma
API (open, onOpenChange, children).

## Feedback al usuario

- **`useToast()`** (shadcn) para notificaciones in-app — éxito, error, deshacer.
- **`<ToastAction>`** para acciones secundarias (ej. "Deshacer" tras borrar — ver
  `handleSwipeDelete` en `useMovimientos`).
- **`web-haptics`** vía `useWebHaptics()` — feedback háptico en móvil (`'selection'`, `'success'`).
  Ya está integrado en navegación de mes y operaciones CRUD.

## Tabla de movimientos

- En móvil, filas con `<SwipeableRow>` para borrado por swipe.
- Cabecera de tabla **sin hover effect** (commit `9e8f759`) — solo las filas de datos.
- Filtros por categoría + subcategoría + búsqueda (ver [domain-logic.md](./domain-logic.md#filtros-y-búsqueda)).

## Theming

- Tailwind con CSS variables (HSL) en `src/index.css`. Cambio dark/light vía clase en `<html>`.
- `next-themes` gestiona la persistencia y respeta `prefers-color-scheme`.
- Colores semánticos: `bg-background`, `text-foreground`, `bg-card`, `border`, `text-muted-foreground`, etc.
- Usar `cn(...)` de `@/lib/utils` para combinar clases condicionales.

## Iconos

- **Lucide React** para iconos UI generales.
- Categorías guardan `icono: string` (identificador). Lookup en cliente — hay un mapa centralizado.
- Categorías nuevas creadas por el usuario pueden tener icono `null` (migration
  `20260311100000_clear_categoria_icono` lo limpió en su día).

## Patrones de layout

- `<MainLayout>` envuelve páginas autenticadas — barra inferior de navegación en móvil, sidebar
  en desktop.
- `<MobileSubpageHeader>` en subpáginas (`/configuracion/*`) con botón atrás.
- `<ScrollToTop>` resetea scroll al cambiar de ruta.

## Errores

- `<ErrorBoundary>` raíz para errores no capturados.
- Errores de API → toast destructivo. No mostrar stack traces al usuario.
