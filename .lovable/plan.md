
# FinanceFlow - CSV Export Feature

## Overview
Add data export functionality to allow users to download their financial data in CSV format. This includes:
1. Monthly movements export (from the Movimientos page)
2. Full data backup as ZIP (from Configuration page)

---

## 1. Monthly CSV Export (Movimientos Page)

### Location
Add an export button next to the "Nuevo Movimiento" button in the header section.

### Functionality
- Export current month's movements to CSV
- Filename format: `movimientos_YYYY-MM.csv`
- Columns: Fecha, Concepto, Cantidad, Cuenta, Categoria, Subcategoria, Notas, Recurrente
- Auto-download on click

### UI
```text
[← Enero 2026 →]              [Download icon] [+ Nuevo Movimiento]
```

---

## 2. Full Backup Export (Configuration Page)

### Location
Add a new card in the Configuration page grid for "Exportar Datos".

### Functionality
- Generate ZIP file containing multiple CSVs:
  - `movimientos.csv` - All movements
  - `cuentas.csv` - All accounts  
  - `categorias.csv` - All categories
  - `gastos_recurrentes.csv` - All recurring expense templates
- Uses JSZip library for ZIP generation
- Filename: `financeflow_backup_YYYY-MM-DD.zip`

---

## Technical Implementation

### New Utility File
Create `src/lib/export.ts` with helper functions:

```typescript
// CSV generation
function generateCSV(headers: string[], rows: string[][]): string

// Download trigger
function downloadFile(content: string | Blob, filename: string): void

// Movement formatting for CSV
function formatMovimientoForCSV(m: MovimientoConRelaciones): string[]
```

### Dependencies
- **JSZip**: Required for ZIP file generation (will need to be installed)

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/export.ts` | Create | CSV/ZIP generation utilities |
| `src/pages/Movimientos.tsx` | Modify | Add export month button |
| `src/pages/Configuracion.tsx` | Modify | Add export backup card |
| `src/pages/configuracion/ExportData.tsx` | Create | Full backup page with progress |

---

## CSV Format Specifications

### movimientos.csv
```csv
Fecha,Concepto,Cantidad,Cuenta,Categoria,Subcategoria,Notas,Recurrente
2026-01-15,Supermercado,-45.30,Caixa,Alimentacion,,Compra semanal,No
2026-01-01,Nomina,2500.00,Caixa,Nomina,,,No
```

### cuentas.csv
```csv
Nombre,Tipo,Divisa,Saldo Inicial,Color,Activa
Caixa,corriente,EUR,3393.55,#3B82F6,Si
```

### categorias.csv
```csv
Nombre,Tipo,Categoria Padre,Color
Alimentacion,gasto,,#6B7280
Supermercado,gasto,Alimentacion,#6B7280
```

### gastos_recurrentes.csv
```csv
Concepto,Cantidad,Dia del Mes,Cuenta,Categoria,Notas,Activo
Alquiler,-800,1,Caixa,Vivienda,,Si
```

---

## User Flow

### Monthly Export
1. User navigates to Movimientos page
2. Clicks download icon button
3. CSV file downloads automatically
4. Toast notification confirms: "Exportado movimientos de [mes]"

### Full Backup
1. User navigates to Configuracion
2. Clicks "Exportar Datos" card
3. New page shows export options
4. User clicks "Descargar Backup Completo"
5. Loading spinner while fetching all data
6. ZIP file downloads
7. Toast confirms: "Backup descargado correctamente"

---

## Implementation Steps

1. **Install JSZip dependency** via package.json
2. **Create export utilities** in `src/lib/export.ts`
3. **Add monthly export button** to Movimientos.tsx header
4. **Add export card** to Configuracion.tsx grid
5. **Create ExportData page** with full backup functionality
6. **Add route** in App.tsx for `/configuracion/exportar`

---

## Estimated Changes
- 1 new dependency (jszip)
- 1 new utility file
- 1 new page component
- 2 modified pages (Movimientos, Configuracion)
- 1 route addition (App.tsx)
