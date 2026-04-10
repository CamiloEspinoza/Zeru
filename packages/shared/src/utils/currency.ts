/**
 * Formats a number as Chilean Pesos (CLP).
 * Accepts strings (e.g., Prisma Decimal serialized as JSON) and numbers.
 * Invalid / NaN inputs render as "$0".
 */
export function formatCLP(amount: number | string | null | undefined): string {
  const n = typeof amount === 'string' ? Number(amount) : (amount ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
}

/**
 * Parses a CLP-formatted string back to a number.
 */
export function parseCLP(formatted: string): number {
  return parseInt(formatted.replace(/[^0-9-]/g, ''), 10) || 0;
}
