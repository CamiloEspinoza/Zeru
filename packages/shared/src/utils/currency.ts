/**
 * Formats a number as Chilean Pesos (CLP).
 */
export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Parses a CLP-formatted string back to a number.
 */
export function parseCLP(formatted: string): number {
  return parseInt(formatted.replace(/[^0-9-]/g, ''), 10) || 0;
}
