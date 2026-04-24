// ── Shared transformer helpers ──
// Extracted from procedencias.transformer.ts and convenio.transformer.ts.
// All new transformers MUST use these instead of re-declaring locally.

export function mapGender(raw: string | null | undefined): 'MALE' | 'FEMALE' | 'OTHER' | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v === 'M' || v === 'MASCULINO' || v === 'MALE' || v === 'HOMBRE') return 'MALE';
  if (v === 'F' || v === 'FEMENINO' || v === 'FEMALE' || v === 'MUJER') return 'FEMALE';
  return 'OTHER';
}

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
 *
 * IMPORTANTE: Date(year, month, day) y setHours() interpretan los valores en
 * la zona horaria local del proceso. Para Citolab (timestamps de FM en hora
 * chilena) el contenedor del API debe correr con `TZ=America/Santiago` para
 * evitar desfases (ver docker-compose.yml). En tests CI se usa UTC y los
 * valores quedan offset.
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalize an email value coming from FileMaker.
 * Returns trimmed lowercase email if valid, or null otherwise.
 * Discards garbage like "no tiene", "—", "sin correo".
 */
export function normalizeEmail(val: unknown): string | null {
  const s = str(val).toLowerCase();
  if (!s) return null;
  return EMAIL_RE.test(s) ? s : null;
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
/**
 * Split a FileMaker full-name string into first / paternal / maternal parts.
 *
 * Rules:
 * - Strips a leading title (`Dr.`, `Dra.`, `Dr`, `Dra`, case-insensitive, with
 *   or without trailing period/space).
 * - Last two tokens → paternalLastName + maternalLastName.
 * - Everything before them → firstName.
 * - Only two tokens → firstName + paternalLastName (no maternal).
 * - Only one token → firstName = token, paternalLastName = '-' (schema NOT NULL).
 * - Empty input → firstName = '-', paternalLastName = '-'.
 *
 * The paternalLastName fallback is '-' because the `LabPractitioner` model
 * requires a non-null String. Callers can choose to map '-' to something
 * more descriptive later.
 */
export function splitFullName(raw: string | null | undefined): {
  firstName: string;
  paternalLastName: string;
  maternalLastName: string | null;
} {
  const trimmed = str(raw);
  if (!trimmed) {
    return { firstName: '-', paternalLastName: '-', maternalLastName: null };
  }

  // Strip leading Dr./Dra. title (case-insensitive).
  const withoutTitle = trimmed.replace(/^\s*dra?\.?\s+/i, '').trim();
  if (!withoutTitle) {
    return { firstName: '-', paternalLastName: '-', maternalLastName: null };
  }

  const tokens = withoutTitle.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    return { firstName: tokens[0], paternalLastName: '-', maternalLastName: null };
  }
  if (tokens.length === 2) {
    return { firstName: tokens[0], paternalLastName: tokens[1], maternalLastName: null };
  }
  // 3+ tokens: last two are lastnames, rest is first name(s)
  const maternalLastName = tokens[tokens.length - 1];
  const paternalLastName = tokens[tokens.length - 2];
  const firstName = tokens.slice(0, tokens.length - 2).join(' ');
  return { firstName, paternalLastName, maternalLastName };
}

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
