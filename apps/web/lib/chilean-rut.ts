/**
 * Chilean RUT helpers — validation (módulo 11) and formatting.
 *
 * RUT format: <body>-<dv>, where body is digits (7 or 8) and dv
 * is a check digit (0-9 or K).
 * Example: 12.345.678-5
 */

/** Strip dots, hyphens, and whitespace; uppercase the DV. */
function cleanRut(rut: string): string {
  return (rut || "").replace(/[^0-9kK]/g, "").toUpperCase();
}

/**
 * Compute the módulo-11 check digit for a RUT body (digits only).
 * Returns "0"-"9" or "K".
 */
function computeDv(body: string): string {
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return "0";
  if (remainder === 10) return "K";
  return String(remainder);
}

/**
 * Validate a Chilean RUT. Accepts any common format ("12.345.678-5",
 * "12345678-5", "12345678K"). Returns true if the check digit matches.
 */
export function validateRut(rut: string): boolean {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return false;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  if (!/^\d+$/.test(body)) return false;
  if (body.length < 7 || body.length > 8) return false;

  return computeDv(body) === dv;
}

/**
 * Format a RUT with thousands separators and hyphen before the DV.
 * Example: "123456785" -> "12.345.678-5".
 * If the input is too short to split, returns the cleaned value.
 */
export function formatRut(rut: string): string {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return cleaned;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  // Add dots every 3 digits from the right
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots}-${dv}`;
}
