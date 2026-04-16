/**
 * Utility for masking sensitive data before logging.
 * Prevents accidental exposure of RUTs, passwords, and certificate data in logs.
 */

/** Keys that should always be fully masked */
const PASSWORD_KEYS = new Set([
  'password',
  'contraseña',
  'secret',
  'token',
  'apiKey',
]);

/** Keys that contain certificate/key material */
const CERTIFICATE_KEYS = new Set([
  'certificate',
  'certificado',
  'privateKey',
  'p12',
  'pfx',
  'encryptedCafXml',
  'cafXml',
]);

/** Keys that contain RUT values */
const RUT_KEYS = new Set(['rut', 'rutEmisor', 'receptorRut', 'cafRut']);

/**
 * Masks a RUT string: "12.345.678-9" -> "12.***.**8-9"
 * Shows first 2 digits and last digit + verification digit.
 */
export function maskRut(rut: string): string {
  const cleaned = rut.replace(/[.\-]/g, '');
  if (cleaned.length < 4) return '***';
  const first2 = cleaned.slice(0, 2);
  const lastDigit = cleaned.slice(-2, -1);
  const dv = cleaned.slice(-1);
  return `${first2}.***.**${lastDigit}-${dv}`;
}

/**
 * Masks a password: always returns "****".
 */
export function maskPassword(): string {
  return '****';
}

/**
 * Masks certificate data: shows only a truncated indicator.
 */
export function maskCertificate(value: string): string {
  if (!value || value.length < 8) return '[certificado]';
  return `[certificado ...${value.slice(-6)}]`;
}

/**
 * Recursively masks sensitive data in a record before logging.
 * Returns a new object with sensitive values masked.
 */
export function maskSensitive(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    if (PASSWORD_KEYS.has(key) || lowerKey.includes('password') || lowerKey.includes('secret')) {
      result[key] = maskPassword();
    } else if (CERTIFICATE_KEYS.has(key) || lowerKey.includes('certificate') || lowerKey.includes('p12')) {
      result[key] = typeof value === 'string' ? maskCertificate(value) : '[certificado]';
    } else if (RUT_KEYS.has(key) || lowerKey.includes('rut')) {
      result[key] = typeof value === 'string' ? maskRut(value) : '***';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = maskSensitive(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}
