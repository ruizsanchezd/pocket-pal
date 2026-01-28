import { MovimientoConRelaciones, Cuenta, Categoria, GastoRecurrente } from '@/types/database';

/**
 * Generate a CSV string from headers and rows
 */
export function generateCSV(headers: string[], rows: string[][]): string {
  const escapeField = (field: string | null | undefined): string => {
    const value = field ?? '';
    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const headerLine = headers.map(escapeField).join(',');
  const dataLines = rows.map(row => row.map(escapeField).join(','));
  
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Trigger a file download in the browser
 */
export function downloadFile(content: string | Blob, filename: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format a movement for CSV export
 */
export function formatMovimientoForCSV(m: MovimientoConRelaciones): string[] {
  return [
    m.fecha,
    m.concepto,
    m.cantidad.toString(),
    m.cuenta?.nombre ?? '',
    m.categoria?.nombre ?? '',
    m.subcategoria?.nombre ?? '',
    m.notas ?? '',
    m.es_recurrente ? 'Sí' : 'No'
  ];
}

/**
 * Generate movements CSV content
 */
export function generateMovimientosCSV(movimientos: MovimientoConRelaciones[]): string {
  const headers = ['Fecha', 'Concepto', 'Cantidad', 'Cuenta', 'Categoria', 'Subcategoria', 'Notas', 'Recurrente'];
  const rows = movimientos.map(formatMovimientoForCSV);
  return generateCSV(headers, rows);
}

/**
 * Generate accounts CSV content
 */
export function generateCuentasCSV(cuentas: Cuenta[]): string {
  const headers = ['Nombre', 'Tipo', 'Divisa', 'Saldo Inicial', 'Color', 'Activa'];
  const rows = cuentas.map(c => [
    c.nombre,
    c.tipo,
    c.divisa ?? 'EUR',
    (c.saldo_inicial ?? 0).toString(),
    c.color ?? '',
    c.activa ? 'Sí' : 'No'
  ]);
  return generateCSV(headers, rows);
}

/**
 * Generate categories CSV content
 */
export function generateCategoriasCSV(categorias: Categoria[], allCategorias: Categoria[]): string {
  const headers = ['Nombre', 'Tipo', 'Categoria Padre', 'Color'];
  const rows = categorias.map(c => {
    const parent = c.parent_id ? allCategorias.find(cat => cat.id === c.parent_id) : null;
    return [
      c.nombre,
      c.tipo,
      parent?.nombre ?? '',
      c.color ?? ''
    ];
  });
  return generateCSV(headers, rows);
}

/**
 * Generate recurring expenses CSV content
 */
export function generateRecurrentesCSV(
  recurrentes: GastoRecurrente[], 
  cuentas: Cuenta[], 
  categorias: Categoria[]
): string {
  const headers = ['Concepto', 'Cantidad', 'Dia del Mes', 'Cuenta', 'Categoria', 'Notas', 'Activo'];
  const rows = recurrentes.map(r => {
    const cuenta = cuentas.find(c => c.id === r.cuenta_id);
    const categoria = categorias.find(c => c.id === r.categoria_id);
    return [
      r.concepto,
      r.cantidad.toString(),
      (r.dia_del_mes ?? 1).toString(),
      cuenta?.nombre ?? '',
      categoria?.nombre ?? '',
      r.notas ?? '',
      r.activo ? 'Sí' : 'No'
    ];
  });
  return generateCSV(headers, rows);
}
