/**
 * Formats a monetary amount using the es-ES locale via Intl.NumberFormat.
 *
 * @param amount   - The numeric value to format.
 * @param currency - ISO 4217 currency code (default: 'EUR').
 * @param showSign - When true, always prepend '+' for positive values (default: false).
 * @param absolute - When true, format the absolute value of amount (default: false).
 */
export function formatCurrency(
  amount: number,
  currency = 'EUR',
  showSign = false,
  absolute = false
): string {
  const value = absolute ? Math.abs(amount) : amount;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: showSign ? 'always' : 'auto',
  }).format(value);
}
