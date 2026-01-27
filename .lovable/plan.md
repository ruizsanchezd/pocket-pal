
# FinanceFlow - Phase 2: Configuration Pages

## Overview
Implement the three configuration subpages that are linked from the main configuration menu. These pages will allow users to manage their accounts, categories, and recurring expenses.

---

## 1. Accounts Management (`/configuracion/cuentas`)

### Features
- List all accounts grouped by type (Corriente, Inversion, Monedero)
- Create new account with modal form
- Edit existing account
- Deactivate account (soft delete)
- Reorder accounts via drag or buttons
- Set default account
- For monedero type: configure monthly reload amount

### UI Components
- Account list with color indicators
- Modal form for create/edit
- Toggle for active/inactive
- Star icon to mark default account

---

## 2. Categories Management (`/configuracion/categorias`)

### Features
- Tree view of categories (parent → subcategories)
- Create new category/subcategory
- Edit category (name, color, icon)
- Delete category (with validation for no associated movements)
- Filter by type: Ingreso / Gasto / Inversion

### UI Components
- Collapsible tree structure
- Modal form for create/edit
- Color picker for category color
- Type selector (tabs or filter)

---

## 3. Recurring Expenses Management (`/configuracion/recurrentes`)

### Features
- List all recurring expense templates
- Create new template with modal form
- Edit existing template
- Toggle active/inactive
- Delete template

### Form Fields
- Concepto (text)
- Cantidad (number, negative for expense)
- Dia del mes (1-31)
- Cuenta (select)
- Categoria (select)
- Subcategoria (optional select)
- Notas (textarea)

---

## Technical Implementation

### New Files to Create

```text
src/pages/configuracion/
├── Cuentas.tsx
├── Categorias.tsx
└── Recurrentes.tsx

src/components/configuracion/
├── CuentaForm.tsx
├── CategoriaForm.tsx
└── GastoRecurrenteForm.tsx
```

### Routes to Add (App.tsx)
```typescript
<Route path="/configuracion/cuentas" element={<ConfigCuentas />} />
<Route path="/configuracion/categorias" element={<ConfigCategorias />} />
<Route path="/configuracion/recurrentes" element={<ConfigRecurrentes />} />
```

### Shared Patterns
All three pages will follow the same pattern as Movimientos:
- ProtectedRoute wrapper
- MainLayout for navigation
- Card with header and list content
- Dialog for create/edit forms
- Confirmation dialog for delete
- Toast notifications for feedback
- Loading states with Loader2 spinner

---

## Validation Rules

### Accounts
- Name: required, max 100 chars
- Type: required (corriente/inversion/monedero)
- Initial balance: number, default 0
- Cannot delete if has movements (show count)

### Categories
- Name: required, max 50 chars
- Type: required (ingreso/gasto/inversion)
- Cannot delete if has movements (show count)
- Subcategories inherit type from parent

### Recurring Expenses
- Concepto: required, max 200 chars
- Cantidad: required, not 0
- Cuenta: required
- Categoria: required

---

## Estimated Changes
- 3 new page components
- 3 new form components
- 1 route update (App.tsx)
- Reuse existing validations from `src/lib/validations.ts`
