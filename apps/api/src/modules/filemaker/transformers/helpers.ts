// ── Shared transformer helpers ──
// Extracted from procedencias.transformer.ts and convenio.transformer.ts.
// All new transformers MUST use these instead of re-declaring locally.

/**
 * Convert any FM field value to a trimmed string.
 * Null/undefined → empty string.
 */
export function str(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
 * Parse a numeric value from FM. Strips non-numeric chars except dot and minus.
 * Returns 0 for unparseable or empty values.
 */
export function parseNum(val: unknown): number {
  const s = str(val);
  if (!s) return 0;
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

/**
 * Safely parse an integer. Returns null for empty/unparseable.
 */
export function safeParseInt(val: unknown): number | null {
  const s = str(val);
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : Math.round(n);
}

/**
 * Parse a date string. Handles ISO (YYYY-MM-DD) and FM US format (MM/DD/YYYY).
 * Returns null for empty/invalid values.
 */
export function parseDate(val: string): Date | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  // Try FM US format: MM/DD/YYYY
  const usParts = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usParts) {
    const [, month, day, year] = usParts;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback to ISO / native parsing
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Combine an FM date string and time string into a single Date.
 * Returns null when date is empty.
 */
export function parseFmDateTime(dateStr: string, timeStr: string): Date | null {
  const d = parseDate(dateStr);
  if (!d) return null;
  if (!timeStr || !timeStr.trim()) return d;
  const timeParts = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeParts) {
    d.setHours(
      Number(timeParts[1]),
      Number(timeParts[2]),
      Number(timeParts[3] || 0),
    );
  }
  return d;
}

/**
 * Check if an FM value means "yes" / "sí".
 */
export function isYes(val: string): boolean {
  return /^s[iíÍ]/i.test(val);
}

/**
 * URL-encode an S3 key path segment-by-segment, preserving forward slashes.
 * Encodes Ñ/ñ and spaces correctly.
 */
export function encodeS3Path(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

const SPANISH_MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

/**
 * Parse a Chilean period string like "Enero 2025" or "1-2025" into a Date (first day of month).
 * Returns null if unparseable.
 */
export function parsePeriod(val: string): Date | null {
  if (!val || !val.trim()) return null;
  const trimmed = val.trim();

  // Try "Enero 2025" format
  const namedMatch = trimmed.match(/^([a-záéíóúñ]+)\s+(\d{4})$/i);
  if (namedMatch) {
    const monthName = namedMatch[1].toLowerCase();
    const year = Number(namedMatch[2]);
    const month = SPANISH_MONTHS[monthName];
    if (month !== undefined && !isNaN(year)) {
      return new Date(year, month, 1);
    }
  }

  // Try "1-2025" or "12-2024" format
  const numericMatch = trimmed.match(/^(\d{1,2})-(\d{4})$/);
  if (numericMatch) {
    const month = Number(numericMatch[1]) - 1;
    const year = Number(numericMatch[2]);
    if (month >= 0 && month <= 11 && !isNaN(year)) {
      return new Date(year, month, 1);
    }
  }

  return null;
}
