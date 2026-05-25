# Context docs

Archivos de contexto pensados para cargar selectivamente al trabajar en PocketPal.
Cada archivo explica *por qué* las cosas están como están — el *qué* lo cuenta el código.

| Archivo | Carga cuando… |
|---|---|
| [`architecture.md`](./architecture.md) | Decisiones de stack, capas, patrones de datos, naming. |
| [`database.md`](./database.md) | Tocas el schema, migraciones, RLS, RPCs o tipos de dominio. |
| [`domain-logic.md`](./domain-logic.md) | Balances, recurrentes, snapshots, tipos de movimiento/cuenta. |
| [`forms-and-validation.md`](./forms-and-validation.md) | Añades/cambias un formulario o validación Zod. |
| [`ui-patterns.md`](./ui-patterns.md) | Diseño responsive, Dialog vs Drawer, toasts, tablas. |
| [`known-issues.md`](./known-issues.md) | Bug, regresión, o tocas un área frágil ya conocida. |
| [`testing.md`](./testing.md) | Escribes tests o decides qué verificar manualmente. |
| [`deployment.md`](./deployment.md) | Variables de entorno, despliegue, aplicar migraciones. |
| [`prompting-claude-code.md`](./prompting-claude-code.md) | Construyes un prompt para pasarle a Claude Code (CLI). Plantilla + reglas. |

## Mantenimiento

- Estos docs explican intención y decisiones, no inventario de archivos.
- Si una sección queda desactualizada, prefiere borrarla a mantenerla incorrecta.
- `known-issues.md` es vivo: añadir entrada cuando un bug se repite o un área resulta frágil.
