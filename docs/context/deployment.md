# Deployment

## Hosting

- **Vercel**, configurado vía `vercel.json` (SPA rewrites a `index.html`).
- Deploy automático desde rama `main`.
- Branch strategy actual: trabajo directo en `main` con commits descriptivos. No hay flujo de PRs
  para uso personal.

## Variables de entorno

En `.env` (no commitead):

```
VITE_SUPABASE_PROJECT_ID=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_URL=...
```

Prefijo `VITE_` obligatorio — sin él, Vite no las expone al cliente. Mismas variables
configuradas en el dashboard de Vercel para producción.

## Supabase

- Proyecto gestionado en supabase.com.
- **Migraciones**: archivos SQL en `supabase/migrations/`. Nombrado:
  `YYYYMMDDHHMMSS_descripcion.sql`.
- Para aplicar en local: `supabase db reset` (recrea desde cero) o `supabase migration up`.
- Para aplicar en prod: subir vía dashboard de Supabase o `supabase db push` con CLI conectado al
  proyecto remoto.
- `supabase/config.toml` configura el entorno local.

**Antes de aplicar una migración en prod**: probar en local con datos representativos. Las
migraciones de dedup (`20260509*`) son ejemplo de migraciones que asumen un estado específico de
los datos.

## Build local

```
npm run build       # build producción
npm run preview     # servir el build local en http://localhost:4173
```

`npm run build:dev` existe pero rara vez se usa — produce un bundle no minificado para debugging.

## OAuth (Google Sign-In)

- Redirect URL configurado en Google Cloud Console y en Supabase Auth Settings.
- En cliente, `getOAuthRedirectUrl()` calcula el URL correcto (preview en Vercel vs prod vs
  localhost).
- Al volver del OAuth callback, `/auth/callback` procesa la sesión y redirige.

## Logs en producción

Cualquier `console.log` o `console.error` debe estar envuelto en `if (import.meta.env.DEV)`.
Los errores reales de usuario se muestran vía toast destructivo, no en consola.
