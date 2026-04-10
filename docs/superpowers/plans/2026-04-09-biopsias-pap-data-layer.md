# Biopsias/Papanicolaou Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the complete Prisma schema for mod_lab (18 tables, 15+ enums) and all 6 FM transformers with full unit test coverage.

**Architecture:** New `mod_lab` PostgreSQL schema houses all FHIR-aligned entities. Transformers convert FM `FmRecord` objects to typed DTOs without touching the database. Shared helper functions handle FM's dirty data (mixed types, missing values, date formats).

**Tech Stack:** Prisma ORM, NestJS, Jest, TypeScript

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `apps/api/src/modules/filemaker/transformers/helpers.ts` | Shared transformer helpers: `str()`, `parseNum()`, `parseDate()`, `isYes()`, `parseFmDateTime()`, `encodeS3Path()` |
| `apps/api/src/modules/filemaker/transformers/helpers.spec.ts` | Unit tests for shared helpers |
| `apps/api/src/modules/filemaker/transformers/types.ts` | Shared DTO interfaces: `ExtractedExam`, `ExtractedSigner`, `ExtractedAttachmentRef`, `ExtractedExamCharge`, `ExtractedLiquidation`, `ExtractedWorkflowEvent`, `ExtractedCommunication` |
| `apps/api/src/modules/filemaker/transformers/biopsy.transformer.ts` | FM BIOPSIAS/BIOPSIASRESPALDO `Validacion Final*` layout transformer |
| `apps/api/src/modules/filemaker/transformers/biopsy.transformer.spec.ts` | TDD tests for BiopsyTransformer |
| `apps/api/src/modules/filemaker/transformers/pap.transformer.ts` | FM PAPANICOLAOU/PAPANICOLAOUHISTORICO `INGRESO` layout transformer |
| `apps/api/src/modules/filemaker/transformers/pap.transformer.spec.ts` | TDD tests for PapTransformer |
| `apps/api/src/modules/filemaker/transformers/exam-charge.transformer.ts` | FM `Biopsias_Ingresos*` + `PAP_ingresos*` transformer |
| `apps/api/src/modules/filemaker/transformers/exam-charge.transformer.spec.ts` | TDD tests for ExamChargeTransformer |
| `apps/api/src/modules/filemaker/transformers/liquidation.transformer.ts` | FM `Liquidaciones` layout transformer |
| `apps/api/src/modules/filemaker/transformers/liquidation.transformer.spec.ts` | TDD tests for LiquidationTransformer |
| `apps/api/src/modules/filemaker/transformers/traceability.transformer.ts` | FM `TRAZA` layout transformer |
| `apps/api/src/modules/filemaker/transformers/traceability.transformer.spec.ts` | TDD tests for TraceabilityTransformer |
| `apps/api/src/modules/filemaker/transformers/communication.transformer.ts` | FM `COMUNICACIONES` portal + table transformer |
| `apps/api/src/modules/filemaker/transformers/communication.transformer.spec.ts` | TDD tests for CommunicationTransformer |
| `apps/api/src/modules/lab/lab.module.ts` | Basic NestJS module registration |

### Modified files

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `mod_lab` to schemas array, add 15+ enums and 18 models |
| `apps/api/src/modules/filemaker/filemaker.module.ts` | Register 6 new transformers as providers and exports |
| `apps/api/src/app.module.ts` | Import LabModule |
| `apps/api/src/modules/filemaker/transformers/procedencias.transformer.ts` | Remove local `str()`, `safeParseInt()`, `isYes()` — import from helpers.ts |
| `apps/api/src/modules/filemaker/transformers/convenio.transformer.ts` | Remove local `str()`, `parseNum()`, `parseDate()`, `isYes()` — import from helpers.ts |

---

## Task 1: Shared transformer helpers

**Files:**
- Create: `apps/api/src/modules/filemaker/transformers/helpers.ts`
- Create: `apps/api/src/modules/filemaker/transformers/helpers.spec.ts`

Extract duplicated helpers from `procedencias.transformer.ts` and `convenio.transformer.ts` into a shared module, adding new helpers needed by the lab transformers.

- [ ] **Step 1: Write failing tests for shared helpers**

Create `apps/api/src/modules/filemaker/transformers/helpers.spec.ts`:

```typescript
import {
  str,
  parseNum,
  parseDate,
  parseFmDateTime,
  isYes,
  safeParseInt,
  encodeS3Path,
  parsePeriod,
} from './helpers';

describe('Transformer Helpers', () => {
  describe('str()', () => {
    it('returns empty string for null', () => {
      expect(str(null)).toBe('');
    });
    it('returns empty string for undefined', () => {
      expect(str(undefined)).toBe('');
    });
    it('trims whitespace', () => {
      expect(str('  hello  ')).toBe('hello');
    });
    it('converts number to string', () => {
      expect(str(42)).toBe('42');
    });
    it('returns empty string for empty string', () => {
      expect(str('')).toBe('');
    });
  });

  describe('parseNum()', () => {
    it('parses integer string', () => {
      expect(parseNum('42')).toBe(42);
    });
    it('parses decimal string', () => {
      expect(parseNum('1234.56')).toBe(1234.56);
    });
    it('strips non-numeric chars', () => {
      expect(parseNum('$1,234.56')).toBe(1234.56);
    });
    it('returns 0 for empty', () => {
      expect(parseNum('')).toBe(0);
    });
    it('returns 0 for null', () => {
      expect(parseNum(null)).toBe(0);
    });
    it('handles negative numbers', () => {
      expect(parseNum('-500')).toBe(-500);
    });
    it('returns 0 for pure text', () => {
      expect(parseNum('abc')).toBe(0);
    });
  });

  describe('safeParseInt()', () => {
    it('parses integer', () => {
      expect(safeParseInt('42')).toBe(42);
    });
    it('rounds decimal', () => {
      expect(safeParseInt('42.7')).toBe(43);
    });
    it('returns null for empty', () => {
      expect(safeParseInt('')).toBeNull();
    });
    it('returns null for null', () => {
      expect(safeParseInt(null)).toBeNull();
    });
    it('strips non-numeric chars', () => {
      expect(safeParseInt('42 años')).toBe(42);
    });
  });

  describe('parseDate()', () => {
    it('parses ISO date', () => {
      const result = parseDate('2026-03-15');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2026);
    });
    it('parses FM date format MM/DD/YYYY', () => {
      const result = parseDate('03/15/2026');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2026);
      expect(result!.getMonth()).toBe(2); // March = 2
      expect(result!.getDate()).toBe(15);
    });
    it('returns null for empty string', () => {
      expect(parseDate('')).toBeNull();
    });
    it('returns null for invalid date', () => {
      expect(parseDate('not-a-date')).toBeNull();
    });
    it('returns null for null', () => {
      expect(parseDate(null as unknown as string)).toBeNull();
    });
  });

  describe('parseFmDateTime()', () => {
    it('combines date and time strings', () => {
      const result = parseFmDateTime('03/15/2026', '14:30:00');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getHours()).toBe(14);
      expect(result!.getMinutes()).toBe(30);
    });
    it('returns date-only when time is empty', () => {
      const result = parseFmDateTime('03/15/2026', '');
      expect(result).toBeInstanceOf(Date);
    });
    it('returns null when date is empty', () => {
      expect(parseFmDateTime('', '14:30:00')).toBeNull();
    });
  });

  describe('isYes()', () => {
    it('returns true for "Si"', () => {
      expect(isYes('Si')).toBe(true);
    });
    it('returns true for "SI"', () => {
      expect(isYes('SI')).toBe(true);
    });
    it('returns true for "Sí"', () => {
      expect(isYes('Sí')).toBe(true);
    });
    it('returns false for "No"', () => {
      expect(isYes('No')).toBe(false);
    });
    it('returns false for empty', () => {
      expect(isYes('')).toBe(false);
    });
  });

  describe('encodeS3Path()', () => {
    it('URL-encodes Ñ', () => {
      expect(encodeS3Path('PEÑALOLEN')).toBe('PE%C3%91ALOLEN');
    });
    it('URL-encodes ñ', () => {
      expect(encodeS3Path('peñalolen')).toBe('pe%C3%B1alolen');
    });
    it('preserves forward slashes', () => {
      expect(encodeS3Path('Biopsias/test/2026')).toBe('Biopsias/test/2026');
    });
    it('encodes spaces', () => {
      expect(encodeS3Path('my folder/file')).toBe('my%20folder/file');
    });
    it('handles combined special chars', () => {
      const result = encodeS3Path('Biopsias/PEÑALOLEN/2026/03/12345.pdf');
      expect(result).toBe('Biopsias/PE%C3%91ALOLEN/2026/03/12345.pdf');
    });
  });

  describe('parsePeriod()', () => {
    it('parses "Enero 2025"', () => {
      const result = parsePeriod('Enero 2025');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2025);
      expect(result!.getMonth()).toBe(0); // January
    });
    it('parses "1-2025"', () => {
      const result = parsePeriod('1-2025');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2025);
      expect(result!.getMonth()).toBe(0);
    });
    it('parses "Diciembre 2024"', () => {
      const result = parsePeriod('Diciembre 2024');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2024);
      expect(result!.getMonth()).toBe(11);
    });
    it('parses "12-2024"', () => {
      const result = parsePeriod('12-2024');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getMonth()).toBe(11);
    });
    it('returns null for garbage', () => {
      expect(parsePeriod('not a period')).toBeNull();
    });
    it('returns null for empty string', () => {
      expect(parsePeriod('')).toBeNull();
    });
  });
});
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern=helpers.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement shared helpers**

Create `apps/api/src/modules/filemaker/transformers/helpers.ts`:

```typescript
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
    d.setHours(Number(timeParts[1]), Number(timeParts[2]), Number(timeParts[3] || 0));
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
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern=helpers.spec.ts`
Expected: ALL PASS

- [ ] **Step 3: Refactor existing transformers to use shared helpers**

Modify `apps/api/src/modules/filemaker/transformers/procedencias.transformer.ts`:

1. Add import at the top (after the existing imports):
```typescript
import { str, safeParseInt, isYes } from './helpers';
```

2. Remove these local functions at the bottom of the file (lines ~203-268):
- `function str(val: unknown): string`
- `function safeParseInt(val: unknown): number | null`
- `function isYes(val: string): boolean`

Keep: `parseCategory()`, `parseReceptionMode()`, `parseDeliveryMethods()`, `collectEmails()` — these are domain-specific to procedencias.

Modify `apps/api/src/modules/filemaker/transformers/convenio.transformer.ts`:

1. Add import at the top (after the existing imports):
```typescript
import { str, parseNum, parseDate, isYes } from './helpers';
```

2. Remove these local functions at the bottom of the file (lines ~161-180):
- `function str(val: unknown): string`
- `function parseNum(val: unknown): number`
- `function isYes(val: string): boolean`
- `function parseDate(val: string): Date | null`

Keep: `parsePaymentTerms()`, `parseCustomPaymentDays()`, `parseBillingDay()`, `parseAgreementStatus()`, `parseModalities()`, `parseExamTypes()`, `parseOperationalFlags()` — these are domain-specific to convenio.

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test`
Expected: ALL PASS (existing functionality preserved)

---

## Task 2: Shared DTO types

**Files:**
- Create: `apps/api/src/modules/filemaker/transformers/types.ts`

Define all extracted DTO interfaces that the new transformers produce.

- [ ] **Step 1: Create shared types file**

Create `apps/api/src/modules/filemaker/transformers/types.ts`:

```typescript
// ── Shared DTOs for lab module transformers ──
// These are pure data structures extracted from FM records.
// They do NOT touch the database — the import pipeline consumes them.

export type FmSourceType = 'BIOPSIAS' | 'BIOPSIASRESPALDO' | 'PAPANICOLAOU' | 'PAPANICOLAOUHISTORICO';

export type ExamCategoryType = 'BIOPSY' | 'PAP' | 'CYTOLOGY' | 'IMMUNOHISTOCHEMISTRY' | 'MOLECULAR' | 'OTHER';

export type SigningRoleType =
  | 'PRIMARY_PATHOLOGIST'
  | 'CO_PATHOLOGIST'
  | 'SUPERVISING_PATHOLOGIST'
  | 'EXTERNAL_CONSULTANT'
  | 'SCREENING_TECH'
  | 'SUPERVISING_TECH'
  | 'VISTO_BUENO_TECH'
  | 'VALIDATION_CORRECTION'
  | 'QC_REVIEWER'
  | 'OTHER';

export type DiagnosticReportStatusType =
  | 'REGISTERED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'PROCESSING'
  | 'REPORTING'
  | 'PRE_VALIDATED'
  | 'VALIDATED'
  | 'SIGNED'
  | 'DELIVERED'
  | 'DOWNLOADED'
  | 'CANCELLED'
  | 'AMENDED';

export type AttachmentCategoryType =
  | 'REPORT_PDF'
  | 'CRITICAL_NOTIFICATION_PDF'
  | 'MACRO_PHOTO'
  | 'MICRO_PHOTO'
  | 'ENCAPSULATION_PHOTO'
  | 'MACRO_DICTATION'
  | 'DIAGNOSIS_MODIFICATION'
  | 'SCANNER_CARTON'
  | 'REQUEST_DOCUMENT'
  | 'MOLECULAR_CONTAINER'
  | 'ADVERSE_EVENT_PHOTO'
  | 'OTHER';

export type WorkflowEventTypeValue =
  | 'ORIGIN_INTAKE'
  | 'ORIGIN_HANDOFF_TO_COURIER'
  | 'TRANSPORT'
  | 'RECEIVED_AT_LAB'
  | 'MACROSCOPY'
  | 'EMBEDDING'
  | 'CUTTING_STAINING'
  | 'HISTOLOGY_REPORTING'
  | 'VALIDATION'
  | 'APPROVAL'
  | 'DELIVERY'
  | 'INTAKE'
  | 'PROCESSING'
  | 'DIAGNOSIS_TRANSCRIPTION'
  | 'PRE_VALIDATION'
  | 'SECRETARY_VALIDATION'
  | 'PATHOLOGIST_APPROVAL_WEB'
  | 'WEB_VALIDATION'
  | 'PDF_GENERATED'
  | 'WEB_DELIVERY'
  | 'WEB_TRANSPORT'
  | 'WEB_RECEPTION'
  | 'WEB_EXAM_CYTOLOGY'
  | 'WEB_DOWNLOAD'
  | 'WEB_ACKNOWLEDGMENT'
  | 'CLIENT_NOTIFIED'
  | 'CASE_CORRECTION'
  | 'AMENDMENT'
  | 'CRITICAL_NOTIFICATION'
  | 'OTHER';

export type CommunicationCategoryType =
  | 'SAMPLE_QUALITY_ISSUE'
  | 'ADDITIONAL_INFO_REQUEST'
  | 'INTERNAL_QC'
  | 'CRITICAL_RESULT'
  | 'CLIENT_INQUIRY'
  | 'CORRECTION_REQUEST'
  | 'OTHER';

export type ChargeStatusType = 'REGISTERED' | 'VALIDATED' | 'INVOICED' | 'PAID' | 'CANCELLED' | 'REVERSED';

export type PaymentMethodType =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'CHECK'
  | 'VOUCHER'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'AGREEMENT'
  | 'PENDING_PAYMENT'
  | 'OTHER';

export type ExamChargeSourceType = 'BIOPSIAS_INGRESOS' | 'PAP_INGRESOS';

export type LiquidationStatusType =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'INVOICED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

// ── Extracted DTOs ──

export interface ExtractedSigner {
  codeSnapshot: string;
  nameSnapshot: string;
  role: SigningRoleType;
  signatureOrder: number;
  signedAt: Date | null;
  isActive: boolean;
  supersededBy: string | null;
  correctionReason: string | null;
}

export interface ExtractedAttachmentRef {
  category: AttachmentCategoryType;
  label: string | null;
  sequenceOrder: number | null;
  s3Key: string;
  contentType: string;
  fmSourceField: string;
  fmContainerUrlOriginal: string | null;
  citolabS3KeyOriginal: string | null;
}

/**
 * Unified DTO for both biopsies and PAPs.
 * Both BiopsyTransformer and PapTransformer produce this interface.
 */
export interface ExtractedExam {
  fmInformeNumber: number;
  fmSource: FmSourceType;
  fmRecordId: string;

  // Patient snapshot
  subjectFirstName: string;
  subjectPaternalLastName: string;
  subjectMaternalLastName: string | null;
  subjectRut: string | null;
  subjectAge: number | null;
  subjectGender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN' | null;

  // ServiceRequest
  category: ExamCategoryType;
  subcategory: string | null;
  isUrgent: boolean;
  requestingPhysicianName: string | null;
  labOriginCode: string;
  anatomicalSite: string | null;
  clinicalHistory: string | null;
  sampleCollectedAt: Date | null;
  receivedAt: Date | null;
  requestedAt: Date | null;

  // DiagnosticReport
  status: DiagnosticReportStatusType;
  conclusion: string | null;
  fullText: string | null;
  microscopicDescription: string | null;
  macroscopicDescription: string | null;
  isAlteredOrCritical: boolean;
  validatedAt: Date | null;
  issuedAt: Date | null;

  // Signers
  signers: ExtractedSigner[];

  // Attachment references (not the binary — just metadata + keys)
  attachmentRefs: ExtractedAttachmentRef[];
}

export interface ExtractedExamCharge {
  fmRecordPk: number;
  fmSource: ExamChargeSourceType;
  fkInformeNumber: number;
  paymentMethod: PaymentMethodType;
  paymentMethodRaw: string;
  amount: number;
  feeCodesText: string | null;
  feeCodes: string[];
  status: ChargeStatusType;
  statusRaw: string;
  labOriginCodeSnapshot: string;
  enteredAt: Date | null;
  enteredByNameSnapshot: string;
  pointOfEntry: string | null;
  fkLiquidacion: string | null;
  fkRendicion: string | null;
}

export interface ExtractedLiquidation {
  fmPk: number;
  labOriginCode: string;
  period: Date | null;
  periodLabel: string;
  status: LiquidationStatusType;
  statusRaw: string;
  totalAmount: number;
  biopsyAmount: number;
  papAmount: number;
  cytologyAmount: number;
  immunoAmount: number;
  biopsyCount: number;
  papCount: number;
  cytologyCount: number;
  immunoCount: number;
  previousDebt: number;
  creditBalance: number;
  confirmedAt: Date | null;
  confirmedByNameSnapshot: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  paymentAmount: number | null;
  paymentDate: Date | null;
  paymentMethodText: string | null;
  notes: string | null;
}

export interface ExtractedWorkflowEvent {
  eventType: WorkflowEventTypeValue;
  sequenceOrder: number;
  occurredAt: Date;
  performedByNameSnapshot: string;
  sourceField: string;
}

export interface ExtractedCommunication {
  fkInformeNumber: number;
  reason: string | null;
  content: string;
  response: string | null;
  loggedAt: Date | null;
  loggedByNameSnapshot: string;
  category: CommunicationCategoryType | null;
}
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api exec tsc --noEmit --pretty`
Expected: No type errors

---

## Task 3: Prisma schema — mod_lab enums and models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

This adds the `mod_lab` PostgreSQL schema with all 18 models and 15+ enums.

- [ ] **Step 1: Add `mod_lab` to the schemas array**

In the `datasource db` block, change:

```prisma
  schemas  = ["public", "citolab_fm"]
```

to:

```prisma
  schemas  = ["public", "citolab_fm", "mod_lab"]
```

- [ ] **Step 2: Add all mod_lab enums**

Add the following block at the end of the file (after all existing models), before any closing comments:

```prisma
// ─── mod_lab Enums ──────────────────────────────────────

enum FmSource {
  BIOPSIAS
  BIOPSIASRESPALDO
  PAPANICOLAOU
  PAPANICOLAOUHISTORICO

  @@schema("mod_lab")
}

enum ExamCategory {
  BIOPSY
  PAP
  CYTOLOGY
  IMMUNOHISTOCHEMISTRY
  MOLECULAR
  OTHER

  @@schema("mod_lab")
}

enum Priority {
  ROUTINE
  URGENT
  ASAP

  @@schema("mod_lab")
}

enum Gender {
  MALE
  FEMALE
  OTHER_GENDER
  UNKNOWN

  @@schema("mod_lab")
}

enum PractitionerRole {
  PATHOLOGIST
  MEDICAL_TECH
  CYTOTECHNOLOGIST
  REQUESTING_PHYSICIAN
  RECEPTION
  LAB_TECHNICIAN
  SECRETARY
  COURIER
  OTHER_ROLE

  @@schema("mod_lab")
}

enum SigningRole {
  PRIMARY_PATHOLOGIST
  CO_PATHOLOGIST
  SUPERVISING_PATHOLOGIST
  EXTERNAL_CONSULTANT
  SCREENING_TECH
  SUPERVISING_TECH
  VISTO_BUENO_TECH
  VALIDATION_CORRECTION
  QC_REVIEWER
  OTHER_SIGNING

  @@schema("mod_lab")
}

enum SpecimenStatus {
  RECEIVED
  PROCESSING
  EMBEDDED
  CUT
  STAINED
  ARCHIVED
  DISCARDED

  @@schema("mod_lab")
}

enum DiagnosticReportStatus {
  REGISTERED
  IN_TRANSIT
  RECEIVED_STATUS
  PROCESSING_STATUS
  REPORTING
  PRE_VALIDATED
  VALIDATED
  SIGNED
  DELIVERED
  DOWNLOADED
  CANCELLED
  AMENDED

  @@schema("mod_lab")
}

enum WorkflowEventType {
  ORIGIN_INTAKE
  ORIGIN_HANDOFF_TO_COURIER
  TRANSPORT
  RECEIVED_AT_LAB
  MACROSCOPY
  EMBEDDING
  CUTTING_STAINING
  HISTOLOGY_REPORTING
  VALIDATION
  APPROVAL
  DELIVERY
  INTAKE
  PROCESSING_EVENT
  DIAGNOSIS_TRANSCRIPTION
  PRE_VALIDATION
  SECRETARY_VALIDATION
  PATHOLOGIST_APPROVAL_WEB
  WEB_VALIDATION
  PDF_GENERATED
  WEB_DELIVERY
  WEB_TRANSPORT
  WEB_RECEPTION
  WEB_EXAM_CYTOLOGY
  WEB_DOWNLOAD
  WEB_ACKNOWLEDGMENT
  CLIENT_NOTIFIED
  CASE_CORRECTION
  AMENDMENT
  CRITICAL_NOTIFICATION
  OTHER_EVENT

  @@schema("mod_lab")
}

enum ObservationCategory {
  DIAGNOSIS
  DIFFERENTIAL
  FINDING
  MARKER
  RECOMMENDATION

  @@schema("mod_lab")
}

enum CommunicationCategory {
  SAMPLE_QUALITY_ISSUE
  ADDITIONAL_INFO_REQUEST
  INTERNAL_QC
  CRITICAL_RESULT
  CLIENT_INQUIRY
  CORRECTION_REQUEST
  OTHER_COMM

  @@schema("mod_lab")
}

enum AttachmentCategory {
  REPORT_PDF
  CRITICAL_NOTIFICATION_PDF
  MACRO_PHOTO
  MICRO_PHOTO
  ENCAPSULATION_PHOTO
  MACRO_DICTATION
  DIAGNOSIS_MODIFICATION
  SCANNER_CARTON
  REQUEST_DOCUMENT
  MOLECULAR_CONTAINER
  ADVERSE_EVENT_PHOTO
  OTHER_ATTACHMENT

  @@schema("mod_lab")
}

enum AttachmentMigrationStatus {
  PENDING
  DOWNLOADING
  UPLOADED
  FAILED
  SKIPPED

  @@schema("mod_lab")
}

enum LabExamChargeSource {
  BIOPSIAS_INGRESOS
  PAP_INGRESOS

  @@schema("mod_lab")
}

enum LabPaymentMethod {
  CASH
  BANK_TRANSFER
  CHECK
  VOUCHER
  CREDIT_CARD
  DEBIT_CARD
  AGREEMENT
  PENDING_PAYMENT
  OTHER_PAYMENT

  @@schema("mod_lab")
}

enum LabChargeStatus {
  REGISTERED
  VALIDATED_CHARGE
  INVOICED
  PAID
  CANCELLED_CHARGE
  REVERSED

  @@schema("mod_lab")
}

enum LiquidationStatus {
  DRAFT
  CONFIRMED
  INVOICED_LIQ
  PARTIALLY_PAID
  PAID_LIQ
  OVERDUE
  CANCELLED_LIQ

  @@schema("mod_lab")
}

enum RendicionType {
  BIOPSY_DIRECT
  PAP_DIRECT
  MIXED

  @@schema("mod_lab")
}

enum DirectPaymentStatus {
  OPEN
  RENDIDA
  RECONCILED
  CANCELLED_DPB

  @@schema("mod_lab")
}

enum AdverseSeverity {
  MINOR
  MODERATE
  MAJOR
  CRITICAL_SEV

  @@schema("mod_lab")
}

enum AdverseStatus {
  OPEN_ADV
  INVESTIGATING
  RESOLVED
  CLOSED

  @@schema("mod_lab")
}
```

**IMPORTANT NOTE on enum naming:** Prisma requires globally unique enum values across the entire schema. Some values like `OTHER`, `CANCELLED`, `PAID`, etc. may clash with existing enums or between mod_lab enums. The suffixed names (e.g., `OTHER_ROLE`, `OTHER_SIGNING`, `OTHER_PAYMENT`, `OTHER_COMM`, `OTHER_ATTACHMENT`, `OTHER_EVENT`) avoid this. If the Prisma generation step fails due to collisions, add `@@map("ORIGINAL_VALUE")` on the offending values. You MUST run `pnpm --filter @zeru/api exec prisma format` after every schema edit, and `pnpm --filter @zeru/api exec prisma generate` to detect issues early.

**Alternative approach if Prisma allows it:** Prisma 5+ allows duplicate enum values across different enums as long as each enum is independently referenced. Test with `prisma generate` first — if the plain names work (e.g., `OTHER` in both `PractitionerRole` and `SigningRole`), use the simpler names from the spec. Only add suffixes if generation fails.

- [ ] **Step 3: Verify enum uniqueness**

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api exec prisma format && pnpm --filter @zeru/api exec prisma generate`

If there are enum value collisions, apply `@@map()` annotations to disambiguate. For example:
```prisma
enum PractitionerRole {
  // ...
  OTHER @map("PRACTITIONER_OTHER")
  @@schema("mod_lab")
}
```

If plain names from the spec work without collisions, revert to plain names (remove suffixes).

- [ ] **Step 4: Add Patient model**

```prisma
// ─── mod_lab Models ─────────────────────────────────────

model LabPatient {
  id                String   @id @default(uuid())
  tenantId          String
  rut               String?
  firstName         String
  paternalLastName  String
  maternalLastName  String?
  birthDate         DateTime?
  gender            Gender?
  email             String?
  phone             String?
  address           String?
  commune           String?
  city              String?
  needsMerge        Boolean  @default(false)
  mergedIntoId      String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime?

  serviceRequests   LabServiceRequest[]

  @@unique([tenantId, rut])
  @@index([tenantId, paternalLastName, firstName])
  @@index([tenantId, needsMerge])
  @@map("lab_patients")
  @@schema("mod_lab")
}
```

- [ ] **Step 5: Add Practitioner model**

```prisma
model LabPractitioner {
  id                String             @id @default(uuid())
  tenantId          String
  rut               String?
  firstName         String
  paternalLastName  String
  maternalLastName  String?
  roles             PractitionerRole[]
  isInternal        Boolean            @default(false)
  code              String?
  licenseNumber     String?
  specialty         String?
  email             String?
  phone             String?
  institutionId     String?
  isActive          Boolean            @default(true)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  deletedAt         DateTime?

  @@unique([tenantId, rut])
  @@unique([tenantId, code])
  @@index([tenantId, paternalLastName, firstName])
  @@map("lab_practitioners")
  @@schema("mod_lab")
}
```

- [ ] **Step 6: Add ServiceRequest model**

```prisma
model LabServiceRequest {
  id                        String        @id @default(uuid())
  tenantId                  String
  fmInformeNumber           Int
  fmSource                  FmSource
  subjectFirstName          String
  subjectPaternalLastName   String
  subjectMaternalLastName   String?
  subjectRut                String?
  subjectAge                Int?
  subjectId                 String?
  patient                   LabPatient?   @relation(fields: [subjectId], references: [id])
  category                  ExamCategory
  subcategory               String?
  priority                  Priority      @default(ROUTINE)
  requestingPhysicianName   String?
  requestingPhysicianId     String?
  labOriginId               String
  labOriginCodeSnapshot     String
  sampleCollectedAt         DateTime?
  receivedAt                DateTime?
  requestedAt               DateTime?
  clinicalHistory           String?       @db.Text
  muestraDe                 String?
  createdAt                 DateTime      @default(now())
  updatedAt                 DateTime      @updatedAt
  deletedAt                 DateTime?

  specimens                 LabSpecimen[]
  diagnosticReports         LabDiagnosticReport[]

  @@unique([tenantId, fmSource, fmInformeNumber])
  @@index([tenantId, labOriginId])
  @@index([tenantId, subjectId])
  @@index([tenantId, category, receivedAt])
  @@index([tenantId, subjectRut])
  @@map("lab_service_requests")
  @@schema("mod_lab")
}
```

- [ ] **Step 7: Add Specimen and Slide models**

```prisma
model LabSpecimen {
  id                String          @id @default(uuid())
  tenantId          String
  serviceRequestId  String
  serviceRequest    LabServiceRequest @relation(fields: [serviceRequestId], references: [id])
  containerLabel    String?
  sequenceNumber    Int
  anatomicalSite    String?
  muestraDeText     String?
  collectedAt       DateTime?
  receivedAt        DateTime?
  status            SpecimenStatus  @default(RECEIVED)
  tacoCode          String?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  deletedAt         DateTime?

  slides            LabSlide[]

  @@index([tenantId, serviceRequestId])
  @@map("lab_specimens")
  @@schema("mod_lab")
}

model LabSlide {
  id          String   @id @default(uuid())
  tenantId    String
  specimenId  String
  specimen    LabSpecimen @relation(fields: [specimenId], references: [id])
  placaCode   String?
  stain       String?
  level       Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([tenantId, specimenId])
  @@map("lab_slides")
  @@schema("mod_lab")
}
```

- [ ] **Step 8: Add DiagnosticReport model**

```prisma
model LabDiagnosticReport {
  id                        String                    @id @default(uuid())
  tenantId                  String
  serviceRequestId          String
  serviceRequest            LabServiceRequest         @relation(fields: [serviceRequestId], references: [id])
  fmInformeNumber           Int
  fmSource                  FmSource
  status                    DiagnosticReportStatus
  currentStageOwnerId       String?
  primarySignerId           String?
  primarySignerCodeSnapshot String?
  conclusion                String?                   @db.Text
  fullText                  String?                   @db.Text
  microscopicDescription    String?                   @db.Text
  macroscopicDescription    String?                   @db.Text
  clinicalComments          String?                   @db.Text
  isUrgent                  Boolean                   @default(false)
  isAlteredOrCritical       Boolean                   @default(false)
  criticalNotified          Boolean                   @default(false)
  validatedAt               DateTime?
  issuedAt                  DateTime?
  deliveredAt               DateTime?
  createdAt                 DateTime                  @default(now())
  updatedAt                 DateTime                  @updatedAt
  deletedAt                 DateTime?

  signers                   LabDiagnosticReportSigner[]
  observations              LabObservation[]
  workflowEvents            LabExamWorkflowEvent[]
  communications            LabCommunication[]
  adverseEvents             LabAdverseEvent[]
  technicalObservations     LabTechnicalObservation[]
  attachments               LabDiagnosticReportAttachment[]
  examCharges               LabExamCharge[]

  @@unique([tenantId, fmSource, fmInformeNumber])
  @@index([tenantId, status])
  @@index([tenantId, validatedAt])
  @@index([tenantId, primarySignerId])
  @@index([tenantId, isUrgent, isAlteredOrCritical])
  @@map("lab_diagnostic_reports")
  @@schema("mod_lab")
}
```

- [ ] **Step 9: Add DiagnosticReportSigner model**

```prisma
model LabDiagnosticReportSigner {
  id                    String                @id @default(uuid())
  tenantId              String
  diagnosticReportId    String
  diagnosticReport      LabDiagnosticReport   @relation(fields: [diagnosticReportId], references: [id])
  practitionerId        String?
  codeSnapshot          String
  nameSnapshot          String
  roleSnapshot          String?
  role                  SigningRole
  signatureOrder        Int
  signedAt              DateTime
  isActive              Boolean               @default(true)
  supersededBy          String?
  correctionReason      String?
  notes                 String?
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt

  @@index([tenantId, diagnosticReportId])
  @@index([tenantId, practitionerId])
  @@index([tenantId, role])
  @@map("lab_diagnostic_report_signers")
  @@schema("mod_lab")
}
```

- [ ] **Step 10: Add Observation model**

```prisma
model LabObservation {
  id                    String              @id @default(uuid())
  tenantId              String
  diagnosticReportId    String
  diagnosticReport      LabDiagnosticReport @relation(fields: [diagnosticReportId], references: [id])
  code                  String
  codeSystem            String
  display               String
  category              ObservationCategory
  severity              String?
  interpretation        String?
  specimenId            String?
  notes                 String?
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt
  deletedAt             DateTime?

  @@index([tenantId, diagnosticReportId])
  @@index([tenantId, code])
  @@map("lab_observations")
  @@schema("mod_lab")
}
```

- [ ] **Step 11: Add ExamWorkflowEvent model**

```prisma
model LabExamWorkflowEvent {
  id                        String              @id @default(uuid())
  tenantId                  String
  diagnosticReportId        String
  diagnosticReport          LabDiagnosticReport @relation(fields: [diagnosticReportId], references: [id])
  eventType                 WorkflowEventType
  sequenceOrder             Int?
  occurredAt                DateTime
  performedById             String?
  performedByNameSnapshot   String
  location                  String?
  notes                     String?
  sourceField               String
  createdAt                 DateTime            @default(now())

  @@index([tenantId, diagnosticReportId, occurredAt])
  @@index([tenantId, eventType, occurredAt])
  @@map("lab_exam_workflow_events")
  @@schema("mod_lab")
}
```

- [ ] **Step 12: Add Communication model**

```prisma
model LabCommunication {
  id                      String                 @id @default(uuid())
  tenantId                String
  diagnosticReportId      String
  diagnosticReport        LabDiagnosticReport    @relation(fields: [diagnosticReportId], references: [id])
  subjectPatientId        String?
  reason                  String?
  content                 String                 @db.Text
  response                String?                @db.Text
  loggedAt                DateTime
  loggedById              String?
  loggedByNameSnapshot    String
  respondedAt             DateTime?
  respondedById           String?
  respondedByNameSnapshot String?
  category                CommunicationCategory?
  createdAt               DateTime               @default(now())
  updatedAt               DateTime               @updatedAt
  deletedAt               DateTime?

  @@index([tenantId, diagnosticReportId, loggedAt])
  @@index([tenantId, category])
  @@map("lab_communications")
  @@schema("mod_lab")
}
```

- [ ] **Step 13: Add AdverseEvent and TechnicalObservation models**

```prisma
model LabAdverseEvent {
  id                      String          @id @default(uuid())
  tenantId                String
  diagnosticReportId      String?
  diagnosticReport        LabDiagnosticReport? @relation(fields: [diagnosticReportId], references: [id])
  eventType               String
  severity                AdverseSeverity
  description             String          @db.Text
  occurredAt              DateTime
  detectedAt              DateTime?
  reportedAt              DateTime?
  reportedByNameSnapshot  String
  reportedById            String?
  correctiveAction        String?         @db.Text
  resolvedAt              DateTime?
  resolvedById            String?
  status                  AdverseStatus   @default(OPEN_ADV)
  createdAt               DateTime        @default(now())
  updatedAt               DateTime        @updatedAt
  deletedAt               DateTime?

  @@index([tenantId, diagnosticReportId])
  @@index([tenantId, severity, status])
  @@map("lab_adverse_events")
  @@schema("mod_lab")
}

model LabTechnicalObservation {
  id                      String              @id @default(uuid())
  tenantId                String
  diagnosticReportId      String
  diagnosticReport        LabDiagnosticReport @relation(fields: [diagnosticReportId], references: [id])
  workflowStage           WorkflowEventType?
  description             String              @db.Text
  observedAt              DateTime
  observedByNameSnapshot  String
  observedById            String?
  createdAt               DateTime            @default(now())

  @@index([tenantId, diagnosticReportId])
  @@map("lab_technical_observations")
  @@schema("mod_lab")
}
```

- [ ] **Step 14: Add DiagnosticReportAttachment model**

```prisma
model LabDiagnosticReportAttachment {
  id                        String                      @id @default(uuid())
  tenantId                  String
  diagnosticReportId        String
  diagnosticReport          LabDiagnosticReport         @relation(fields: [diagnosticReportId], references: [id])
  category                  AttachmentCategory
  label                     String?
  sequenceOrder             Int?
  s3Bucket                  String
  s3Key                     String
  contentType               String
  sizeBytes                 Int?
  checksum                  String?
  fmSourceField             String
  fmContainerUrlOriginal    String?
  citolabS3KeyOriginal      String?
  migrationStatus           AttachmentMigrationStatus   @default(PENDING)
  migrationError            String?
  migrationAttempts         Int                         @default(0)
  migratedAt                DateTime?
  adverseEventId            String?
  createdAt                 DateTime                    @default(now())
  updatedAt                 DateTime                    @updatedAt

  @@index([tenantId, diagnosticReportId])
  @@index([migrationStatus])
  @@map("lab_diagnostic_report_attachments")
  @@schema("mod_lab")
}
```

- [ ] **Step 15: Add ExamCharge model**

```prisma
model LabExamCharge {
  id                      String             @id @default(uuid())
  tenantId                String
  fmSource                LabExamChargeSource
  fmRecordPk              Int
  diagnosticReportId      String
  diagnosticReport        LabDiagnosticReport @relation(fields: [diagnosticReportId], references: [id])
  billingConceptId        String?
  feeCodesText            String?
  feeCodes                String[]
  paymentMethod           LabPaymentMethod
  amount                  Decimal            @db.Decimal(14, 4)
  currency                String             @default("CLP")
  status                  LabChargeStatus
  labOriginId             String
  labOriginCodeSnapshot   String
  legalEntityId           String?
  liquidationId           String?
  liquidation             LabLiquidation?    @relation(fields: [liquidationId], references: [id])
  directPaymentBatchId    String?
  directPaymentBatch      LabDirectPaymentBatch? @relation(fields: [directPaymentBatchId], references: [id])
  enteredAt               DateTime
  enteredByNameSnapshot   String
  enteredById             String?
  pointOfEntry            String?
  validatedAt             DateTime?
  validatedByNameSnapshot String?
  validatedById           String?
  cancelledAt             DateTime?
  cancelledByNameSnapshot String?
  cancelReason            String?
  notes                   String?
  createdAt               DateTime           @default(now())
  updatedAt               DateTime           @updatedAt
  deletedAt               DateTime?

  @@unique([tenantId, fmSource, fmRecordPk])
  @@index([tenantId, diagnosticReportId])
  @@index([tenantId, liquidationId])
  @@index([tenantId, directPaymentBatchId])
  @@index([tenantId, status])
  @@index([tenantId, labOriginId, enteredAt])
  @@index([tenantId, legalEntityId, enteredAt])
  @@map("lab_exam_charges")
  @@schema("mod_lab")
}
```

- [ ] **Step 16: Add Liquidation model**

```prisma
model LabLiquidation {
  id                      String            @id @default(uuid())
  tenantId                String
  fmRecordId              String
  fmPk                    Int?
  legalEntityId           String
  billingAgreementId      String?
  period                  DateTime
  periodLabel             String
  totalAmount             Decimal           @db.Decimal(14, 2)
  biopsyAmount            Decimal           @db.Decimal(14, 2)
  papAmount               Decimal           @db.Decimal(14, 2)
  cytologyAmount          Decimal           @db.Decimal(14, 2)
  immunoAmount            Decimal           @db.Decimal(14, 2)
  biopsyCount             Int
  papCount                Int
  cytologyCount           Int
  immunoCount             Int
  previousDebt            Decimal           @db.Decimal(14, 2) @default(0)
  creditBalance           Decimal           @db.Decimal(14, 2) @default(0)
  status                  LiquidationStatus
  confirmedAt             DateTime?
  confirmedByNameSnapshot String?
  invoiceNumber           String?
  invoiceType             String?
  invoiceDate             DateTime?
  paymentAmount           Decimal?          @db.Decimal(14, 2)
  paymentDate             DateTime?
  paymentMethodText       String?
  liquidationPdfKey       String?
  invoicePdfKey           String?
  notes                   String?
  createdAt               DateTime          @default(now())
  updatedAt               DateTime          @updatedAt
  deletedAt               DateTime?

  charges                 LabExamCharge[]

  @@unique([tenantId, fmRecordId])
  @@index([tenantId, legalEntityId, period])
  @@index([tenantId, status])
  @@index([tenantId, period])
  @@map("lab_liquidations")
  @@schema("mod_lab")
}
```

- [ ] **Step 17: Add DirectPaymentBatch model**

```prisma
model LabDirectPaymentBatch {
  id                      String              @id @default(uuid())
  tenantId                String
  fmRecordId              String?
  fmPk                    Int?
  period                  DateTime
  periodFrom              DateTime?
  periodTo                DateTime?
  legalEntityId           String?
  rendicionType           RendicionType
  totalAmount             Decimal             @db.Decimal(14, 2)
  chargeCount             Int
  rendidoByNameSnapshot   String?
  rendidoById             String?
  rendidoAt               DateTime?
  status                  DirectPaymentStatus
  receiptNumber           String?
  receiptDate             DateTime?
  receiptPdfKey           String?
  notes                   String?
  createdAt               DateTime            @default(now())
  updatedAt               DateTime            @updatedAt
  deletedAt               DateTime?

  charges                 LabExamCharge[]

  @@unique([tenantId, fmRecordId])
  @@index([tenantId, period, rendicionType])
  @@index([tenantId, legalEntityId])
  @@map("lab_direct_payment_batches")
  @@schema("mod_lab")
}
```

- [ ] **Step 18: Add LabImportRun and LabImportBatch tracking models**

```prisma
model LabImportRun {
  id          String    @id @default(uuid())
  tenantId    String
  sources     FmSource[]
  dateFrom    DateTime?
  dateTo      DateTime?
  batchSize   Int       @default(100)
  status      String    @default("PENDING")
  phase       String?
  totalBatches Int      @default(0)
  completedBatches Int  @default(0)
  failedBatches Int     @default(0)
  totalRecords Int      @default(0)
  processedRecords Int  @default(0)
  errorRecords Int      @default(0)
  startedAt   DateTime?
  completedAt DateTime?
  error       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  batches     LabImportBatch[]

  @@index([tenantId, status])
  @@map("lab_import_runs")
  @@schema("mod_lab")
}

model LabImportBatch {
  id          String    @id @default(uuid())
  runId       String
  run         LabImportRun @relation(fields: [runId], references: [id])
  phase       String
  fmSource    FmSource
  batchIndex  Int
  offset      Int
  limit       Int
  status      String    @default("PENDING")
  recordCount Int       @default(0)
  processedCount Int    @default(0)
  errorCount  Int       @default(0)
  errors      Json?
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([runId, status])
  @@map("lab_import_batches")
  @@schema("mod_lab")
}
```

- [ ] **Step 19: Format and generate Prisma client**

Run:
```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api exec prisma format
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api exec prisma generate
```

Fix any errors. Common issues:
- Enum value collisions: add `@@map()` or rename with suffix
- Missing relation fields: add inverse relations
- `@db.Decimal` precision issues: check exact (14,4) or (14,2) syntax

Expected: `prisma generate` succeeds without errors.

- [ ] **Step 20: Create migration**

Run:
```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api exec prisma migrate dev --name add_mod_lab_schema --create-only
```

Review the generated SQL migration file. Verify:
1. `CREATE SCHEMA IF NOT EXISTS "mod_lab"` is present
2. All 18 tables are created under `mod_lab`
3. All enum types reference `mod_lab`
4. All indexes are present

Do NOT apply the migration yet (--create-only). It will be applied when the database is available.

---

## Task 4: BiopsyTransformer

**Files:**
- Create: `apps/api/src/modules/filemaker/transformers/biopsy.transformer.spec.ts`
- Create: `apps/api/src/modules/filemaker/transformers/biopsy.transformer.ts`

**Depends on:** Task 1 (helpers), Task 2 (types)

- [ ] **Step 1: Write failing tests for BiopsyTransformer**

Create `apps/api/src/modules/filemaker/transformers/biopsy.transformer.spec.ts`:

```typescript
import { BiopsyTransformer } from './biopsy.transformer';
import type { FmRecord } from '@zeru/shared';

function makeBiopsyRecord(overrides: Record<string, unknown> = {}, portalOverrides: Record<string, Record<string, unknown>[]> = {}): FmRecord {
  return {
    recordId: '1001',
    modId: '5',
    fieldData: {
      'INFORME Nº': 12345,
      'NOMBRE': 'Juan Carlos',
      'A.PATERNO': 'González',
      'A.MATERNO': 'López',
      'RUT': '12.345.678-9',
      'EDAD': 45,
      'TIPO DE EXAMEN': 'BIOPSIA',
      'SUBTIPO EXAMEN': 'BIOPSIA DIFERIDA',
      'URGENTES': '',
      'Alterado o Crítico': '',
      'SOLICITADA POR': 'Dr. Pérez',
      'PROCEDENCIA CODIGO UNICO': 'PROC-001',
      'MUESTRA DE': 'Piel región dorsal',
      'ANTECEDENTES': 'Lesión sospechosa de 2cm',
      'DIAGNOSTICO': 'Carcinoma basocelular nodular',
      'TEXTO BIOPSIAS::TEXTO': 'Se recibe fragmento...',
      'FECHA VALIDACIÓN': '03/15/2026',
      'PATOLOGO': 'Dr. Martínez (PAT-001)',
      'Revisado por patólogo supervisor': '',
      'caso corregido por PAT SUP': '',
      'caso corregido por validacion': '',
      'Activar Subir Examen': 'Si',
      'Estado Web': 'Publicado',
      'INFORMES PDF::PDF INFORME': 'https://fm.citolab.cl/Streaming_SSL/MainDB?-db=BIOPSIAS&-lay=...',
      'FECHA': '03/10/2026',
      ...overrides,
    },
    portalData: {
      'SCANNER BP 8': [],
      ...portalOverrides,
    },
  };
}

describe('BiopsyTransformer', () => {
  let transformer: BiopsyTransformer;

  beforeEach(() => {
    transformer = new BiopsyTransformer();
  });

  describe('extract()', () => {
    it('extracts basic exam data', () => {
      const record = makeBiopsyRecord();
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.fmInformeNumber).toBe(12345);
      expect(result.fmSource).toBe('BIOPSIAS');
      expect(result.fmRecordId).toBe('1001');
      expect(result.subjectFirstName).toBe('Juan Carlos');
      expect(result.subjectPaternalLastName).toBe('González');
      expect(result.subjectMaternalLastName).toBe('López');
      expect(result.subjectAge).toBe(45);
      expect(result.category).toBe('BIOPSY');
      expect(result.subcategory).toBe('BIOPSIA DIFERIDA');
      expect(result.requestingPhysicianName).toBe('Dr. Pérez');
      expect(result.labOriginCode).toBe('PROC-001');
      expect(result.anatomicalSite).toBe('Piel región dorsal');
      expect(result.clinicalHistory).toBe('Lesión sospechosa de 2cm');
      expect(result.conclusion).toBe('Carcinoma basocelular nodular');
      expect(result.fullText).toBe('Se recibe fragmento...');
    });

    it('normalizes RUT', () => {
      const record = makeBiopsyRecord({ 'RUT': '12.345.678-9' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.subjectRut).toBe('123456789');
    });

    it('returns null RUT for empty', () => {
      const record = makeBiopsyRecord({ 'RUT': '' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.subjectRut).toBeNull();
    });

    it('returns null RUT for short values', () => {
      const record = makeBiopsyRecord({ 'RUT': '1' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.subjectRut).toBeNull();
    });

    it('parses BIOPSY category', () => {
      const record = makeBiopsyRecord({ 'TIPO DE EXAMEN': 'BIOPSIA' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.category).toBe('BIOPSY');
    });

    it('parses IMMUNOHISTOCHEMISTRY category', () => {
      const record = makeBiopsyRecord({ 'TIPO DE EXAMEN': 'INMUNOHISTOQUIMICA' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.category).toBe('IMMUNOHISTOCHEMISTRY');
    });

    it('parses CYTOLOGY category', () => {
      const record = makeBiopsyRecord({ 'TIPO DE EXAMEN': 'CITOLOGIA' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.category).toBe('CYTOLOGY');
    });

    it('parses MOLECULAR category', () => {
      const record = makeBiopsyRecord({ 'TIPO DE EXAMEN': 'MOLECULAR' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.category).toBe('MOLECULAR');
    });

    it('defaults unknown category to OTHER', () => {
      const record = makeBiopsyRecord({ 'TIPO DE EXAMEN': 'DESCONOCIDO' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.category).toBe('OTHER');
    });

    it('detects urgent exam', () => {
      const record = makeBiopsyRecord({ 'URGENTES': 'URGENTE' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.isUrgent).toBe(true);
    });

    it('non-urgent by default', () => {
      const record = makeBiopsyRecord({ 'URGENTES': '' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.isUrgent).toBe(false);
    });

    it('detects altered or critical', () => {
      const record = makeBiopsyRecord({ 'Alterado o Crítico': 'CRITICO' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.isAlteredOrCritical).toBe(true);
    });

    it('not altered when empty', () => {
      const record = makeBiopsyRecord({ 'Alterado o Crítico': '' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.isAlteredOrCritical).toBe(false);
    });

    it('parses validatedAt date', () => {
      const record = makeBiopsyRecord({ 'FECHA VALIDACIÓN': '03/15/2026' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.validatedAt).toBeInstanceOf(Date);
      expect(result.validatedAt!.getFullYear()).toBe(2026);
      expect(result.validatedAt!.getMonth()).toBe(2);
    });

    it('uses FECHA APROBACION for BIOPSIASRESPALDO', () => {
      const record = makeBiopsyRecord({
        'FECHA VALIDACIÓN': '',
        'FECHA APROBACION': '01/10/2024',
      });
      const result = transformer.extract(record, 'BIOPSIASRESPALDO');
      expect(result.validatedAt).toBeInstanceOf(Date);
      expect(result.validatedAt!.getFullYear()).toBe(2024);
    });

    it('uses fmSource parameter correctly', () => {
      const record = makeBiopsyRecord();
      const result = transformer.extract(record, 'BIOPSIASRESPALDO');
      expect(result.fmSource).toBe('BIOPSIASRESPALDO');
    });

    it('infers VALIDATED status when web published', () => {
      const record = makeBiopsyRecord({
        'Activar Subir Examen': 'Si',
        'Estado Web': 'Publicado',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.status).toBe('DELIVERED');
    });

    it('infers VALIDATED status when only validated', () => {
      const record = makeBiopsyRecord({
        'Activar Subir Examen': '',
        'Estado Web': '',
        'FECHA VALIDACIÓN': '03/15/2026',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.status).toBe('VALIDATED');
    });

    it('infers REGISTERED status when no validation date', () => {
      const record = makeBiopsyRecord({
        'Activar Subir Examen': '',
        'Estado Web': '',
        'FECHA VALIDACIÓN': '',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.status).toBe('REGISTERED');
    });
  });

  describe('signers extraction', () => {
    it('extracts primary pathologist', () => {
      const record = makeBiopsyRecord({ 'PATOLOGO': 'Dr. Martínez (PAT-001)' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.signers.length).toBeGreaterThanOrEqual(1);
      const primary = result.signers.find(s => s.role === 'PRIMARY_PATHOLOGIST');
      expect(primary).toBeDefined();
      expect(primary!.nameSnapshot).toBe('Dr. Martínez (PAT-001)');
      expect(primary!.signatureOrder).toBe(1);
    });

    it('extracts supervising pathologist', () => {
      const record = makeBiopsyRecord({
        'PATOLOGO': 'Dr. Martínez',
        'Revisado por patólogo supervisor': 'Dr. García (PAT-002)',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      const supervisor = result.signers.find(s => s.role === 'SUPERVISING_PATHOLOGIST');
      expect(supervisor).toBeDefined();
      expect(supervisor!.nameSnapshot).toBe('Dr. García (PAT-002)');
    });

    it('supersedes supervisor when PAT SUP corrects', () => {
      const record = makeBiopsyRecord({
        'PATOLOGO': 'Dr. Martínez',
        'Revisado por patólogo supervisor': 'Dr. García',
        'caso corregido por PAT SUP': 'Dr. López',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      const supervisors = result.signers.filter(s => s.role === 'SUPERVISING_PATHOLOGIST');
      expect(supervisors.length).toBe(2);
      const original = supervisors.find(s => s.nameSnapshot === 'Dr. García');
      expect(original!.isActive).toBe(false);
      const correction = supervisors.find(s => s.nameSnapshot === 'Dr. López');
      expect(correction!.isActive).toBe(true);
    });

    it('extracts validation correction signer', () => {
      const record = makeBiopsyRecord({
        'PATOLOGO': 'Dr. Martínez',
        'caso corregido por validacion': 'Dr. Soto',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      const correction = result.signers.find(s => s.role === 'VALIDATION_CORRECTION');
      expect(correction).toBeDefined();
      expect(correction!.nameSnapshot).toBe('Dr. Soto');
    });

    it('skips empty signer fields', () => {
      const record = makeBiopsyRecord({
        'PATOLOGO': 'Dr. Martínez',
        'Revisado por patólogo supervisor': '',
        'caso corregido por PAT SUP': '',
        'caso corregido por validacion': '',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.signers.length).toBe(1);
    });

    it('handles case with no signers', () => {
      const record = makeBiopsyRecord({
        'PATOLOGO': '',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.signers.length).toBe(0);
    });
  });

  describe('attachment refs', () => {
    it('extracts PDF attachment ref', () => {
      const record = makeBiopsyRecord({
        'INFORMES PDF::PDF INFORME': 'https://fm.citolab.cl/Streaming_SSL/...',
        'PROCEDENCIA CODIGO UNICO': 'PROC-001',
        'FECHA VALIDACIÓN': '03/15/2026',
        'INFORME Nº': 12345,
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      const pdf = result.attachmentRefs.find(a => a.category === 'REPORT_PDF');
      expect(pdf).toBeDefined();
      expect(pdf!.s3Key).toContain('Biopsias/PROC-001/2026/03/12345.pdf');
      expect(pdf!.contentType).toBe('application/pdf');
      expect(pdf!.fmSourceField).toBe('INFORMES PDF::PDF INFORME');
    });

    it('encodes Ñ in S3 key', () => {
      const record = makeBiopsyRecord({
        'INFORMES PDF::PDF INFORME': 'https://fm.citolab.cl/...',
        'PROCEDENCIA CODIGO UNICO': 'PEÑALOLEN',
        'FECHA VALIDACIÓN': '03/15/2026',
        'INFORME Nº': 99999,
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      const pdf = result.attachmentRefs.find(a => a.category === 'REPORT_PDF');
      expect(pdf!.s3Key).toContain('PE%C3%91ALOLEN');
    });

    it('extracts scanner photos from portal', () => {
      const record = makeBiopsyRecord(
        {},
        {
          'SCANNER BP 8': [
            { 'SCANNER BP 8::FOTO 1': 'https://fm.citolab.cl/photo1.jpg' },
            { 'SCANNER BP 8::FOTO 2': 'https://fm.citolab.cl/photo2.jpg' },
          ],
        },
      );
      const result = transformer.extract(record, 'BIOPSIAS');
      const photos = result.attachmentRefs.filter(a => a.category === 'MICRO_PHOTO');
      expect(photos.length).toBe(2);
    });

    it('extracts macro photos from portal', () => {
      const record = makeBiopsyRecord(
        {},
        {
          'SCANNER BP 8': [
            { 'SCANNER BP 8::MACRO': 'https://fm.citolab.cl/macro1.jpg' },
          ],
        },
      );
      const result = transformer.extract(record, 'BIOPSIAS');
      const macros = result.attachmentRefs.filter(a => a.category === 'MACRO_PHOTO');
      expect(macros.length).toBe(1);
    });

    it('skips empty container URLs', () => {
      const record = makeBiopsyRecord({
        'INFORMES PDF::PDF INFORME': '',
      });
      const result = transformer.extract(record, 'BIOPSIAS');
      const pdfs = result.attachmentRefs.filter(a => a.category === 'REPORT_PDF');
      expect(pdfs.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles numeric INFORME Nº as string', () => {
      const record = makeBiopsyRecord({ 'INFORME Nº': '12345' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.fmInformeNumber).toBe(12345);
    });

    it('handles missing maternal last name', () => {
      const record = makeBiopsyRecord({ 'A.MATERNO': '' });
      const result = transformer.extract(record, 'BIOPSIAS');
      expect(result.subjectMaternalLastName).toBeNull();
    });

    it('handles all-empty record gracefully', () => {
      const emptyRecord: FmRecord = {
        recordId: '999',
        modId: '1',
        fieldData: {},
        portalData: {},
      };
      const result = transformer.extract(emptyRecord, 'BIOPSIAS');
      expect(result.fmInformeNumber).toBe(0);
      expect(result.subjectFirstName).toBe('');
      expect(result.signers).toEqual([]);
      expect(result.attachmentRefs).toEqual([]);
    });
  });
});
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern=biopsy.transformer.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement BiopsyTransformer**

Create `apps/api/src/modules/filemaker/transformers/biopsy.transformer.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { normalizeRut } from '@zeru/shared';
import type { FmRecord } from '@zeru/shared';
import { str, parseNum, parseDate, encodeS3Path } from './helpers';
import type {
  ExtractedExam,
  ExtractedSigner,
  ExtractedAttachmentRef,
  FmSourceType,
  ExamCategoryType,
  DiagnosticReportStatusType,
} from './types';

@Injectable()
export class BiopsyTransformer {
  readonly database = 'BIOPSIAS';
  readonly layout = 'Validación Final*';

  /**
   * Extract a unified ExamDTO from a BIOPSIAS or BIOPSIASRESPALDO record.
   */
  extract(record: FmRecord, fmSource: FmSourceType): ExtractedExam {
    const d = record.fieldData;

    const informeNumber = parseNum(d['INFORME Nº']);
    const rawRut = str(d['RUT']);
    const rut = rawRut ? normalizeRut(rawRut) : null;
    const labOriginCode = str(d['PROCEDENCIA CODIGO UNICO']);

    // Use FECHA APROBACION for BIOPSIASRESPALDO, FECHA VALIDACIÓN for BIOPSIAS
    const validationDateField =
      fmSource === 'BIOPSIASRESPALDO' && !str(d['FECHA VALIDACIÓN'])
        ? str(d['FECHA APROBACION'])
        : str(d['FECHA VALIDACIÓN']);
    const validatedAt = parseDate(validationDateField);
    const requestedAt = parseDate(str(d['FECHA']));

    return {
      fmInformeNumber: informeNumber,
      fmSource,
      fmRecordId: record.recordId,

      // Patient snapshot
      subjectFirstName: str(d['NOMBRE']),
      subjectPaternalLastName: str(d['A.PATERNO']),
      subjectMaternalLastName: str(d['A.MATERNO']) || null,
      subjectRut: rut && rut.length >= 3 ? rut : null,
      subjectAge: parseNum(d['EDAD']) || null,
      subjectGender: null, // Not available in biopsies

      // ServiceRequest
      category: parseExamCategory(str(d['TIPO DE EXAMEN'])),
      subcategory: str(d['SUBTIPO EXAMEN']) || null,
      isUrgent: str(d['URGENTES']).toUpperCase().includes('URGENTE'),
      requestingPhysicianName: str(d['SOLICITADA POR']) || null,
      labOriginCode: labOriginCode || record.recordId,
      anatomicalSite: str(d['MUESTRA DE']) || null,
      clinicalHistory: str(d['ANTECEDENTES']) || null,
      sampleCollectedAt: null, // Not typically in biopsies
      receivedAt: null,
      requestedAt,

      // DiagnosticReport
      status: inferStatus(d, validatedAt),
      conclusion: str(d['DIAGNOSTICO']) || null,
      fullText: str(d['TEXTO BIOPSIAS::TEXTO']) || null,
      microscopicDescription: null,
      macroscopicDescription: null,
      isAlteredOrCritical: !!str(d['Alterado o Crítico']),
      validatedAt,
      issuedAt: validatedAt,

      // Signers
      signers: extractSigners(d, validatedAt),

      // Attachment refs
      attachmentRefs: extractAttachmentRefs(record, labOriginCode, validatedAt, informeNumber),
    };
  }
}

// ── Pure helper functions ──

function parseExamCategory(val: string): ExamCategoryType {
  const upper = val
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (upper.includes('BIOPSIA')) return 'BIOPSY';
  if (upper.includes('INMUNOHISTOQUIMICA') || upper.includes('IHQ') || upper.includes('INMUNO'))
    return 'IMMUNOHISTOCHEMISTRY';
  if (upper.includes('CITOLOGIA') || upper.includes('THIN PREP')) return 'CYTOLOGY';
  if (upper.includes('MOLECULAR')) return 'MOLECULAR';
  if (upper.includes('PAP')) return 'PAP';
  return 'OTHER';
}

function inferStatus(
  d: Record<string, unknown>,
  validatedAt: Date | null,
): DiagnosticReportStatusType {
  const activarSubir = str(d['Activar Subir Examen']);
  const estadoWeb = str(d['Estado Web']).toLowerCase();

  if (estadoWeb.includes('publicado') || estadoWeb.includes('descargado')) return 'DELIVERED';
  if (activarSubir && /^s[iíÍ]/i.test(activarSubir)) return 'SIGNED';
  if (validatedAt) return 'VALIDATED';
  return 'REGISTERED';
}

function extractSigners(d: Record<string, unknown>, validatedAt: Date | null): ExtractedSigner[] {
  const signers: ExtractedSigner[] = [];
  const signedAt = validatedAt ?? new Date();
  let order = 0;

  // Primary pathologist
  const patologo = str(d['PATOLOGO']);
  if (patologo) {
    order++;
    signers.push({
      codeSnapshot: extractCode(patologo),
      nameSnapshot: patologo,
      role: 'PRIMARY_PATHOLOGIST',
      signatureOrder: order,
      signedAt,
      isActive: true,
      supersededBy: null,
      correctionReason: null,
    });
  }

  // Supervising pathologist
  const supervisor = str(d['Revisado por patólogo supervisor']);
  const patSupCorrection = str(d['caso corregido por PAT SUP']);

  if (supervisor) {
    order++;
    signers.push({
      codeSnapshot: extractCode(supervisor),
      nameSnapshot: supervisor,
      role: 'SUPERVISING_PATHOLOGIST',
      signatureOrder: order,
      signedAt,
      isActive: !patSupCorrection, // Superseded if PAT SUP correction exists
      supersededBy: patSupCorrection || null,
      correctionReason: patSupCorrection ? 'Corregido por patólogo supervisor' : null,
    });
  }

  // PAT SUP correction (new supervising pathologist)
  if (patSupCorrection) {
    order++;
    signers.push({
      codeSnapshot: extractCode(patSupCorrection),
      nameSnapshot: patSupCorrection,
      role: 'SUPERVISING_PATHOLOGIST',
      signatureOrder: order,
      signedAt,
      isActive: true,
      supersededBy: null,
      correctionReason: null,
    });
  }

  // Validation correction
  const validationCorrection = str(d['caso corregido por validacion']);
  if (validationCorrection) {
    order++;
    signers.push({
      codeSnapshot: extractCode(validationCorrection),
      nameSnapshot: validationCorrection,
      role: 'VALIDATION_CORRECTION',
      signatureOrder: order,
      signedAt,
      isActive: true,
      supersededBy: null,
      correctionReason: null,
    });
  }

  return signers;
}

/**
 * Extract a practitioner code from strings like "Dr. Martínez (PAT-001)".
 * Falls back to full string if no parenthesized code found.
 */
function extractCode(name: string): string {
  const match = name.match(/\(([^)]+)\)/);
  return match ? match[1] : name;
}

function extractAttachmentRefs(
  record: FmRecord,
  labOriginCode: string,
  validatedAt: Date | null,
  informeNumber: number,
): ExtractedAttachmentRef[] {
  const refs: ExtractedAttachmentRef[] = [];
  const d = record.fieldData;

  // Build S3 key components
  const year = validatedAt ? String(validatedAt.getFullYear()) : 'unknown';
  const month = validatedAt ? String(validatedAt.getMonth() + 1).padStart(2, '0') : 'unknown';
  const encodedOrigin = encodeS3Path(labOriginCode);

  // PDF report
  const pdfUrl = str(d['INFORMES PDF::PDF INFORME']);
  if (pdfUrl) {
    refs.push({
      category: 'REPORT_PDF',
      label: `Informe ${informeNumber}`,
      sequenceOrder: 0,
      s3Key: `Biopsias/${encodedOrigin}/${year}/${month}/${informeNumber}.pdf`,
      contentType: 'application/pdf',
      fmSourceField: 'INFORMES PDF::PDF INFORME',
      fmContainerUrlOriginal: pdfUrl,
      citolabS3KeyOriginal: `Biopsias/${labOriginCode}/${year}/${month}/${informeNumber}.pdf`,
    });
  }

  // Scanner/micro photos from portal SCANNER BP 8
  const scannerPortal = record.portalData?.['SCANNER BP 8'];
  if (scannerPortal && Array.isArray(scannerPortal)) {
    let photoIndex = 0;
    for (const row of scannerPortal) {
      // Check FOTO 1 through FOTO 22
      for (let i = 1; i <= 22; i++) {
        const fotoUrl = str(row[`SCANNER BP 8::FOTO ${i}`]);
        if (fotoUrl) {
          photoIndex++;
          refs.push({
            category: 'MICRO_PHOTO',
            label: `Foto ${photoIndex}`,
            sequenceOrder: photoIndex,
            s3Key: `Biopsias/${encodedOrigin}/${year}/${month}/${informeNumber}_foto_${photoIndex}.jpg`,
            contentType: 'image/jpeg',
            fmSourceField: `SCANNER BP 8::FOTO ${i}`,
            fmContainerUrlOriginal: fotoUrl,
            citolabS3KeyOriginal: null,
          });
        }
      }

      // Check MACRO
      const macroUrl = str(row['SCANNER BP 8::MACRO']);
      if (macroUrl) {
        photoIndex++;
        refs.push({
          category: 'MACRO_PHOTO',
          label: `Macro ${photoIndex}`,
          sequenceOrder: photoIndex,
          s3Key: `Biopsias/${encodedOrigin}/${year}/${month}/${informeNumber}_macro_${photoIndex}.jpg`,
          contentType: 'image/jpeg',
          fmSourceField: 'SCANNER BP 8::MACRO',
          fmContainerUrlOriginal: macroUrl,
          citolabS3KeyOriginal: null,
        });
      }
    }
  }

  return refs;
}
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern=biopsy.transformer.spec.ts`
Expected: ALL PASS

- [ ] **Step 3: Fix any failing tests and iterate**

Review test output. Common issues:
- Date parsing differences (timezone offset)
- String matching on signer names
- S3 key encoding differences

Fix implementation or test assertions as needed, then re-run.

---

## Task 5: PapTransformer

**Files:**
- Create: `apps/api/src/modules/filemaker/transformers/pap.transformer.spec.ts`
- Create: `apps/api/src/modules/filemaker/transformers/pap.transformer.ts`

**Depends on:** Task 1 (helpers), Task 2 (types)

- [ ] **Step 1: Write failing tests for PapTransformer**

Create `apps/api/src/modules/filemaker/transformers/pap.transformer.spec.ts`:

```typescript
import { PapTransformer } from './pap.transformer';
import type { FmRecord } from '@zeru/shared';

function makePapRecord(overrides: Record<string, unknown> = {}): FmRecord {
  return {
    recordId: '2001',
    modId: '3',
    fieldData: {
      'INFORME Nº': 54321,
      'NOMBRES': 'María Isabel',
      'A.PATERNO': 'Fernández',
      'A.MATERNO': 'Muñoz',
      'RUT': '9.876.543-2',
      'EDAD': 38,
      'EXAMEN': 'PAPANICOLAOU',
      'SOLICITADO POR': 'Dra. Rivera',
      'PROCEDENCIA': 'Consultorio Central',
      'CODIGO UNICO PROCEDENCIA': 'PROC-050',
      'MUESTRA DE': 'Cuello uterino',
      'PAP TEXTO::TEXTO': 'Frotis cervicovaginal...',
      'FECHA': '03/20/2026',
      'FECHA TOMA MUESTRA': '03/18/2026',
      'LECTOR SCREANING': 'Tec. Sánchez',
      'SUPERVISORA PAP': 'Tec. Rojas',
      'VISTO BUENO': 'Tec. Paredes',
      'APROBACION PATOLOGO WEB': 'Dr. Álvarez',
      'Estado WEB': 'Publicado',
      'Scanner Cartón': '',
      ...overrides,
    },
    portalData: {},
  };
}

describe('PapTransformer', () => {
  let transformer: PapTransformer;

  beforeEach(() => {
    transformer = new PapTransformer();
  });

  describe('extract()', () => {
    it('extracts basic exam data', () => {
      const record = makePapRecord();
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.fmInformeNumber).toBe(54321);
      expect(result.fmSource).toBe('PAPANICOLAOU');
      expect(result.fmRecordId).toBe('2001');
      expect(result.subjectFirstName).toBe('María Isabel');
      expect(result.subjectPaternalLastName).toBe('Fernández');
      expect(result.subjectMaternalLastName).toBe('Muñoz');
      expect(result.subjectAge).toBe(38);
      expect(result.category).toBe('PAP');
      expect(result.requestingPhysicianName).toBe('Dra. Rivera');
      expect(result.labOriginCode).toBe('PROC-050');
      expect(result.anatomicalSite).toBe('Cuello uterino');
      expect(result.fullText).toBe('Frotis cervicovaginal...');
    });

    it('uses NOMBRES field (not NOMBRE)', () => {
      const record = makePapRecord({ 'NOMBRES': 'Ana María' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.subjectFirstName).toBe('Ana María');
    });

    it('uses SOLICITADO POR (not SOLICITADA POR)', () => {
      const record = makePapRecord({ 'SOLICITADO POR': 'Dr. Test' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.requestingPhysicianName).toBe('Dr. Test');
    });

    it('uses CODIGO UNICO PROCEDENCIA', () => {
      const record = makePapRecord({ 'CODIGO UNICO PROCEDENCIA': 'CUSTOM-001' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.labOriginCode).toBe('CUSTOM-001');
    });

    it('falls back to PROCEDENCIA when CODIGO UNICO is empty', () => {
      const record = makePapRecord({
        'CODIGO UNICO PROCEDENCIA': '',
        'PROCEDENCIA': 'Fallback',
      });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.labOriginCode).toBe('Fallback');
    });

    it('normalizes RUT', () => {
      const record = makePapRecord({ 'RUT': '9.876.543-2' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.subjectRut).toBe('98765432');
    });

    it('parses PAP category', () => {
      const record = makePapRecord({ 'EXAMEN': 'PAPANICOLAOU' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.category).toBe('PAP');
    });

    it('parses sampleCollectedAt', () => {
      const record = makePapRecord({ 'FECHA TOMA MUESTRA': '03/18/2026' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.sampleCollectedAt).toBeInstanceOf(Date);
      expect(result.sampleCollectedAt!.getDate()).toBe(18);
    });

    it('parses requestedAt from FECHA', () => {
      const record = makePapRecord({ 'FECHA': '03/20/2026' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.requestedAt).toBeInstanceOf(Date);
    });

    it('uses PAPANICOLAOUHISTORICO source', () => {
      const record = makePapRecord();
      const result = transformer.extract(record, 'PAPANICOLAOUHISTORICO');
      expect(result.fmSource).toBe('PAPANICOLAOUHISTORICO');
    });

    it('defaults category to PAP for unknown EXAMEN', () => {
      const record = makePapRecord({ 'EXAMEN': '' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.category).toBe('PAP');
    });

    it('infers DELIVERED status for published', () => {
      const record = makePapRecord({ 'Estado WEB': 'Publicado' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.status).toBe('DELIVERED');
    });

    it('infers VALIDATED status with date', () => {
      const record = makePapRecord({
        'Estado WEB': '',
        'FECHA': '03/20/2026',
      });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.status).toBe('VALIDATED');
    });
  });

  describe('signers extraction', () => {
    it('extracts screening tech', () => {
      const record = makePapRecord({ 'LECTOR SCREANING': 'Tec. Sánchez' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const screener = result.signers.find(s => s.role === 'SCREENING_TECH');
      expect(screener).toBeDefined();
      expect(screener!.nameSnapshot).toBe('Tec. Sánchez');
      expect(screener!.signatureOrder).toBe(1);
    });

    it('extracts supervising tech', () => {
      const record = makePapRecord({ 'SUPERVISORA PAP': 'Tec. Rojas' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const supervisor = result.signers.find(s => s.role === 'SUPERVISING_TECH');
      expect(supervisor).toBeDefined();
      expect(supervisor!.nameSnapshot).toBe('Tec. Rojas');
    });

    it('extracts visto bueno tech', () => {
      const record = makePapRecord({ 'VISTO BUENO': 'Tec. Paredes' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const vb = result.signers.find(s => s.role === 'VISTO_BUENO_TECH');
      expect(vb).toBeDefined();
    });

    it('extracts primary pathologist from web approval', () => {
      const record = makePapRecord({ 'APROBACION PATOLOGO WEB': 'Dr. Álvarez' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const pathologist = result.signers.find(s => s.role === 'PRIMARY_PATHOLOGIST');
      expect(pathologist).toBeDefined();
      expect(pathologist!.nameSnapshot).toBe('Dr. Álvarez');
    });

    it('builds correct signer order', () => {
      const record = makePapRecord({
        'LECTOR SCREANING': 'Tec1',
        'SUPERVISORA PAP': 'Tec2',
        'VISTO BUENO': 'Tec3',
        'APROBACION PATOLOGO WEB': 'Dr4',
      });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.signers.length).toBe(4);
      expect(result.signers[0].signatureOrder).toBe(1);
      expect(result.signers[1].signatureOrder).toBe(2);
      expect(result.signers[2].signatureOrder).toBe(3);
      expect(result.signers[3].signatureOrder).toBe(4);
    });

    it('skips empty signer fields', () => {
      const record = makePapRecord({
        'LECTOR SCREANING': '',
        'SUPERVISORA PAP': '',
        'VISTO BUENO': '',
        'APROBACION PATOLOGO WEB': '',
      });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.signers.length).toBe(0);
    });
  });

  describe('attachment refs', () => {
    it('generates correct S3 key for PAP PDF', () => {
      const record = makePapRecord({
        'CODIGO UNICO PROCEDENCIA': 'PROC-050',
        'FECHA': '03/20/2026',
        'INFORME Nº': 54321,
      });
      // PAP PDFs come from Citolab S3, not from FM containers
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const pdf = result.attachmentRefs.find(a => a.category === 'REPORT_PDF');
      expect(pdf).toBeDefined();
      expect(pdf!.s3Key).toContain('Papanicolaous/PROC-050/2026/03/54321.pdf');
    });

    it('extracts scanner carton attachment', () => {
      const record = makePapRecord({ 'Scanner Cartón': 'https://fm.citolab.cl/scanner.jpg' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const scanner = result.attachmentRefs.find(a => a.category === 'SCANNER_CARTON');
      expect(scanner).toBeDefined();
      expect(scanner!.fmSourceField).toBe('Scanner Cartón');
    });

    it('skips empty scanner carton', () => {
      const record = makePapRecord({ 'Scanner Cartón': '' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const scanner = result.attachmentRefs.filter(a => a.category === 'SCANNER_CARTON');
      expect(scanner.length).toBe(0);
    });

    it('encodes Ñ in S3 key', () => {
      const record = makePapRecord({
        'CODIGO UNICO PROCEDENCIA': 'PEÑALOLEN',
        'FECHA': '06/15/2025',
        'INFORME Nº': 11111,
      });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      const pdf = result.attachmentRefs.find(a => a.category === 'REPORT_PDF');
      expect(pdf!.s3Key).toContain('PE%C3%91ALOLEN');
    });
  });

  describe('edge cases', () => {
    it('handles all-empty record gracefully', () => {
      const emptyRecord: FmRecord = {
        recordId: '999',
        modId: '1',
        fieldData: {},
        portalData: {},
      };
      const result = transformer.extract(emptyRecord, 'PAPANICOLAOU');
      expect(result.fmInformeNumber).toBe(0);
      expect(result.subjectFirstName).toBe('');
      expect(result.signers).toEqual([]);
    });

    it('handles missing maternal last name', () => {
      const record = makePapRecord({ 'A.MATERNO': '' });
      const result = transformer.extract(record, 'PAPANICOLAOU');
      expect(result.subjectMaternalLastName).toBeNull();
    });
  });
});
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern=pap.transformer.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement PapTransformer**

Create `apps/api/src/modules/filemaker/transformers/pap.transformer.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { normalizeRut } from '@zeru/shared';
import type { FmRecord } from '@zeru/shared';
import { str, parseNum, parseDate, encodeS3Path } from './helpers';
import type {
  ExtractedExam,
  ExtractedSigner,
  ExtractedAttachmentRef,
  FmSourceType,
  ExamCategoryType,
  DiagnosticReportStatusType,
} from './types';

@Injectable()
export class PapTransformer {
  readonly database = 'PAPANICOLAOU';
  readonly layout = 'INGRESO';

  /**
   * Extract a unified ExamDTO from a PAPANICOLAOU or PAPANICOLAOUHISTORICO record.
   */
  extract(record: FmRecord, fmSource: FmSourceType): ExtractedExam {
    const d = record.fieldData;

    const informeNumber = parseNum(d['INFORME Nº']);
    const rawRut = str(d['RUT']);
    const rut = rawRut ? normalizeRut(rawRut) : null;
    const labOriginCode = str(d['CODIGO UNICO PROCEDENCIA']) || str(d['PROCEDENCIA']);
    const fecha = str(d['FECHA']);
    const validatedAt = parseDate(fecha);
    const sampleCollectedAt = parseDate(str(d['FECHA TOMA MUESTRA']));

    return {
      fmInformeNumber: informeNumber,
      fmSource,
      fmRecordId: record.recordId,

      // Patient snapshot
      subjectFirstName: str(d['NOMBRES']),
      subjectPaternalLastName: str(d['A.PATERNO']),
      subjectMaternalLastName: str(d['A.MATERNO']) || null,
      subjectRut: rut && rut.length >= 3 ? rut : null,
      subjectAge: parseNum(d['EDAD']) || null,
      subjectGender: null,

      // ServiceRequest
      category: parsePapCategory(str(d['EXAMEN'])),
      subcategory: null, // PAPs don't have subcategory
      isUrgent: false, // PAPs are never urgent
      requestingPhysicianName: str(d['SOLICITADO POR']) || null,
      labOriginCode: labOriginCode || record.recordId,
      anatomicalSite: str(d['MUESTRA DE']) || null,
      clinicalHistory: null, // PAPs don't have antecedentes field
      sampleCollectedAt,
      receivedAt: null,
      requestedAt: validatedAt,

      // DiagnosticReport
      status: inferPapStatus(d, validatedAt),
      conclusion: null, // PAP conclusion is in the fullText
      fullText: str(d['PAP TEXTO::TEXTO']) || null,
      microscopicDescription: null,
      macroscopicDescription: null,
      isAlteredOrCritical: false,
      validatedAt,
      issuedAt: validatedAt,

      // Signers
      signers: extractPapSigners(d, validatedAt),

      // Attachment refs
      attachmentRefs: extractPapAttachmentRefs(d, labOriginCode, validatedAt, informeNumber),
    };
  }
}

// ── Pure helper functions ──

function parsePapCategory(val: string): ExamCategoryType {
  const upper = val
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (upper.includes('PAP') || upper.includes('PAPANICOLAOU')) return 'PAP';
  if (upper.includes('CITOLOGIA') || upper.includes('THIN PREP')) return 'CYTOLOGY';
  // Default for the PAP table
  return 'PAP';
}

function inferPapStatus(
  d: Record<string, unknown>,
  validatedAt: Date | null,
): DiagnosticReportStatusType {
  const estadoWeb = str(d['Estado WEB']).toLowerCase();

  if (estadoWeb.includes('publicado') || estadoWeb.includes('descargado')) return 'DELIVERED';
  if (str(d['APROBACION PATOLOGO WEB'])) return 'SIGNED';
  if (validatedAt) return 'VALIDATED';
  return 'REGISTERED';
}

function extractPapSigners(d: Record<string, unknown>, validatedAt: Date | null): ExtractedSigner[] {
  const signers: ExtractedSigner[] = [];
  const signedAt = validatedAt ?? new Date();
  let order = 0;

  // 1. Screening tech (LECTOR SCREANING)
  const screener = str(d['LECTOR SCREANING']);
  if (screener) {
    order++;
    signers.push({
      codeSnapshot: screener,
      nameSnapshot: screener,
      role: 'SCREENING_TECH',
      signatureOrder: order,
      signedAt,
      isActive: true,
      supersededBy: null,
      correctionReason: null,
    });
  }

  // 2. Supervising tech (SUPERVISORA PAP)
  const supervisor = str(d['SUPERVISORA PAP']);
  if (supervisor) {
    order++;
    signers.push({
      codeSnapshot: supervisor,
      nameSnapshot: supervisor,
      role: 'SUPERVISING_TECH',
      signatureOrder: order,
      signedAt,
      isActive: true,
      supersededBy: null,
      correctionReason: null,
    });
  }

  // 3. Visto bueno tech (VISTO BUENO)
  const vistoBueno = str(d['VISTO BUENO']);
  if (vistoBueno) {
    order++;
    signers.push({
      codeSnapshot: vistoBueno,
      nameSnapshot: vistoBueno,
      role: 'VISTO_BUENO_TECH',
      signatureOrder: order,
      signedAt,
      isActive: true,
      supersededBy: null,
      correctionReason: null,
    });
  }

  // 4. Primary pathologist (APROBACION PATOLOGO WEB)
  const pathologist = str(d['APROBACION PATOLOGO WEB']);
  if (pathologist) {
    order++;
    signers.push({
      codeSnapshot: pathologist,
      nameSnapshot: pathologist,
      role: 'PRIMARY_PATHOLOGIST',
      signatureOrder: order,
      signedAt,
      isActive: true,
      supersededBy: null,
      correctionReason: null,
    });
  }

  return signers;
}

function extractPapAttachmentRefs(
  d: Record<string, unknown>,
  labOriginCode: string,
  validatedAt: Date | null,
  informeNumber: number,
): ExtractedAttachmentRef[] {
  const refs: ExtractedAttachmentRef[] = [];

  // Build S3 key components
  const year = validatedAt ? String(validatedAt.getFullYear()) : 'unknown';
  const month = validatedAt ? String(validatedAt.getMonth() + 1).padStart(2, '0') : 'unknown';
  const encodedOrigin = encodeS3Path(labOriginCode);

  // PAP PDFs come from Citolab S3 — always create a ref for matching
  if (informeNumber > 0 && labOriginCode) {
    refs.push({
      category: 'REPORT_PDF',
      label: `Informe PAP ${informeNumber}`,
      sequenceOrder: 0,
      s3Key: `Papanicolaous/${encodedOrigin}/${year}/${month}/${informeNumber}.pdf`,
      contentType: 'application/pdf',
      fmSourceField: 'PDF_FROM_S3_CITOLAB',
      fmContainerUrlOriginal: null,
      citolabS3KeyOriginal: `Papanicolaous/${labOriginCode}/${year}/${month}/${informeNumber}.pdf`,
    });
  }

  // Scanner Cartón
  const scannerCarton = str(d['Scanner Cartón']);
  if (scannerCarton) {
    refs.push({
      category: 'SCANNER_CARTON',
      label: `Scanner Cartón ${informeNumber}`,
      sequenceOrder: 1,
      s3Key: `Papanicolaous/${encodedOrigin}/${year}/${month}/${informeNumber}_scanner.jpg`,
      contentType: 'image/jpeg',
      fmSourceField: 'Scanner Cartón',
      fmContainerUrlOriginal: scannerCarton,
      citolabS3KeyOriginal: null,
    });
  }

  return refs;
}
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern=pap.transformer.spec.ts`
Expected: ALL PASS

- [ ] **Step 3: Fix any failing tests and iterate**

---

## Task 6: ExamChargeTransformer

**Files:**
- Create: `apps/api/src/modules/filemaker/transformers/exam-charge.transformer.spec.ts`
- Create: `apps/api/src/modules/filemaker/transformers/exam-charge.transformer.ts`

**Depends on:** Task 1 (helpers), Task 2 (types)

- [ ] **Step 1: Write failing tests for ExamChargeTransformer**

Create `apps/api/src/modules/filemaker/transformers/exam-charge.transformer.spec.ts`:

```typescript
import { ExamChargeTransformer } from './exam-charge.transformer';
import type { FmRecord } from '@zeru/shared';

function makeBiopsyChargeRecord(overrides: Record<string, unknown> = {}): FmRecord {
  return {
    recordId: '3001',
    modId: '2',
    fieldData: {
      '__pk_Biopsia_Ingreso': 50001,
      '_fk_Informe_Número': 12345,
      '_fk_Tipo de Ingreso': 'TI-001',
      'Tipo de Ingreso::Nombre': 'Convenio',
      'Valor': 25000,
      'Estado Ingreso': 'VALIDADO (María)',
      'Códigos Prestación': '0301039|0301041',
      '_fk_Liquidaciones Instituciones': 'LIQ-001',
      '_fk_Rendición Pago directo': '',
      'Ingreso Fecha': '03/15/2026',
      'Ingreso Responsable': 'María Campos',
      'Punto de ingreso': 'Recepción Central',
      'BIOPSIAS Cobranzas::PROCEDENCIA CODIGO UNICO': 'PROC-001',
      ...overrides,
    },
    portalData: {},
  };
}

function makePapChargeRecord(overrides: Record<string, unknown> = {}): FmRecord {
  return {
    recordId: '4001',
    modId: '1',
    fieldData: {
      '__pk_PAP_Ingreso': 60001,
      '_fk_Informe_Número': 54321,
      '_fk_Tipo de Ingreso': 'TI-002',
      'Tipo de Ingreso::Nombre': 'Efectivo',
      'Valor': 15000,
      'Estado Ingreso': 'VALIDADO (Pedro)',
      'Códigos Prestación': '0301050',
      '_fk_Liquidaciones Instituciones': '',
      '_fk_Rendición Pago directo': 'REN-001',
      'Ingreso Fecha': '03/18/2026',
      'Ingreso Responsable': 'Pedro Gómez',
      'Punto de ingreso': 'Sucursal Norte',
      'PAP Cobranzas::CODIGO UNICO PROCEDENCIA': 'PROC-050',
      ...overrides,
    },
    portalData: {},
  };
}

describe('ExamChargeTransformer', () => {
  let transformer: ExamChargeTransformer;

  beforeEach(() => {
    transformer = new ExamChargeTransformer();
  });

  describe('extractBiopsyCharge()', () => {
    it('extracts basic charge data', () => {
      const record = makeBiopsyChargeRecord();
      const result = transformer.extractBiopsyCharge(record);
      expect(result.fmRecordPk).toBe(50001);
      expect(result.fmSource).toBe('BIOPSIAS_INGRESOS');
      expect(result.fkInformeNumber).toBe(12345);
      expect(result.amount).toBe(25000);
      expect(result.enteredByNameSnapshot).toBe('María Campos');
      expect(result.pointOfEntry).toBe('Recepción Central');
      expect(result.labOriginCodeSnapshot).toBe('PROC-001');
    });

    it('parses payment method from Tipo de Ingreso', () => {
      const record = makeBiopsyChargeRecord({ 'Tipo de Ingreso::Nombre': 'Convenio' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.paymentMethod).toBe('AGREEMENT');
    });

    it('parses Efectivo payment method', () => {
      const record = makeBiopsyChargeRecord({ 'Tipo de Ingreso::Nombre': 'Efectivo' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.paymentMethod).toBe('CASH');
    });

    it('parses Bono payment method', () => {
      const record = makeBiopsyChargeRecord({ 'Tipo de Ingreso::Nombre': 'Bono' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.paymentMethod).toBe('VOUCHER');
    });

    it('parses Cheque payment method', () => {
      const record = makeBiopsyChargeRecord({ 'Tipo de Ingreso::Nombre': 'Cheque' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.paymentMethod).toBe('CHECK');
    });

    it('parses Transferencia payment method', () => {
      const record = makeBiopsyChargeRecord({ 'Tipo de Ingreso::Nombre': 'Transferencia' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.paymentMethod).toBe('BANK_TRANSFER');
    });

    it('defaults unknown payment to OTHER', () => {
      const record = makeBiopsyChargeRecord({ 'Tipo de Ingreso::Nombre': 'SomethingNew' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.paymentMethod).toBe('OTHER');
    });

    it('parses VALIDATED status', () => {
      const record = makeBiopsyChargeRecord({ 'Estado Ingreso': 'VALIDADO (María)' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.status).toBe('VALIDATED');
    });

    it('parses CANCELLED status', () => {
      const record = makeBiopsyChargeRecord({ 'Estado Ingreso': 'Cancelado' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.status).toBe('CANCELLED');
    });

    it('defaults to REGISTERED for unknown status', () => {
      const record = makeBiopsyChargeRecord({ 'Estado Ingreso': '' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.status).toBe('REGISTERED');
    });

    it('parses fee codes from pipe-separated string', () => {
      const record = makeBiopsyChargeRecord({ 'Códigos Prestación': '0301039|0301041' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.feeCodesText).toBe('0301039|0301041');
      expect(result.feeCodes).toEqual(['0301039', '0301041']);
    });

    it('handles single fee code', () => {
      const record = makeBiopsyChargeRecord({ 'Códigos Prestación': '0301039' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.feeCodes).toEqual(['0301039']);
    });

    it('handles empty fee codes', () => {
      const record = makeBiopsyChargeRecord({ 'Códigos Prestación': '' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.feeCodesText).toBeNull();
      expect(result.feeCodes).toEqual([]);
    });

    it('extracts liquidation FK', () => {
      const record = makeBiopsyChargeRecord({ '_fk_Liquidaciones Instituciones': 'LIQ-001' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.fkLiquidacion).toBe('LIQ-001');
    });

    it('extracts rendicion FK', () => {
      const record = makeBiopsyChargeRecord({ '_fk_Rendición Pago directo': 'REN-001' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.fkRendicion).toBe('REN-001');
    });

    it('parses entry date', () => {
      const record = makeBiopsyChargeRecord({ 'Ingreso Fecha': '03/15/2026' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.enteredAt).toBeInstanceOf(Date);
      expect(result.enteredAt!.getMonth()).toBe(2);
    });
  });

  describe('extractPapCharge()', () => {
    it('extracts basic PAP charge data', () => {
      const record = makePapChargeRecord();
      const result = transformer.extractPapCharge(record);
      expect(result.fmRecordPk).toBe(60001);
      expect(result.fmSource).toBe('PAP_INGRESOS');
      expect(result.fkInformeNumber).toBe(54321);
      expect(result.amount).toBe(15000);
      expect(result.labOriginCodeSnapshot).toBe('PROC-050');
    });

    it('uses PAP PK field', () => {
      const record = makePapChargeRecord({ '__pk_PAP_Ingreso': 77777 });
      const result = transformer.extractPapCharge(record);
      expect(result.fmRecordPk).toBe(77777);
    });

    it('uses PAP procedencia field', () => {
      const record = makePapChargeRecord({ 'PAP Cobranzas::CODIGO UNICO PROCEDENCIA': 'PAP-999' });
      const result = transformer.extractPapCharge(record);
      expect(result.labOriginCodeSnapshot).toBe('PAP-999');
    });
  });

  describe('edge cases', () => {
    it('handles zero amount', () => {
      const record = makeBiopsyChargeRecord({ 'Valor': 0 });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.amount).toBe(0);
    });

    it('handles string amount with currency format', () => {
      const record = makeBiopsyChargeRecord({ 'Valor': '$25.000' });
      const result = transformer.extractBiopsyCharge(record);
      expect(result.amount).toBe(25000);
    });
  });
});
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern=exam-charge.transformer.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement ExamChargeTransformer**

Create `apps/api/src/modules/filemaker/transformers/exam-charge.transformer.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { FmRecord } from '@zeru/shared';
import { str, parseNum, parseDate } from './helpers';
import type {
  ExtractedExamCharge,
  PaymentMethodType,
  ChargeStatusType,
  ExamChargeSourceType,
} from './types';

@Injectable()
export class ExamChargeTransformer {
  readonly database = 'BIOPSIAS';
  readonly biopsyLayout = 'Biopsias_Ingresos*';
  readonly papLayout = 'PAP_ingresos*';

  extractBiopsyCharge(record: FmRecord): ExtractedExamCharge {
    const d = record.fieldData;
    return this.extractCharge(d, 'BIOPSIAS_INGRESOS', {
      pkField: '__pk_Biopsia_Ingreso',
      procedenciaField: 'BIOPSIAS Cobranzas::PROCEDENCIA CODIGO UNICO',
    });
  }

  extractPapCharge(record: FmRecord): ExtractedExamCharge {
    const d = record.fieldData;
    return this.extractCharge(d, 'PAP_INGRESOS', {
      pkField: '__pk_PAP_Ingreso',
      procedenciaField: 'PAP Cobranzas::CODIGO UNICO PROCEDENCIA',
    });
  }

  private extractCharge(
    d: Record<string, unknown>,
    source: ExamChargeSourceType,
    fields: { pkField: string; procedenciaField: string },
  ): ExtractedExamCharge {
    const statusRaw = str(d['Estado Ingreso']);
    const feeCodesRaw = str(d['Códigos Prestación']);
    const paymentMethodRaw = str(d['Tipo de Ingreso::Nombre']);

    return {
      fmRecordPk: parseNum(d[fields.pkField]),
      fmSource: source,
      fkInformeNumber: parseNum(d['_fk_Informe_Número']),
      paymentMethod: parsePaymentMethod(paymentMethodRaw),
      paymentMethodRaw,
      amount: parseNum(d['Valor']),
      feeCodesText: feeCodesRaw || null,
      feeCodes: parseFeeCodes(feeCodesRaw),
      status: parseChargeStatus(statusRaw),
      statusRaw,
      labOriginCodeSnapshot: str(d[fields.procedenciaField]),
      enteredAt: parseDate(str(d['Ingreso Fecha'])),
      enteredByNameSnapshot: str(d['Ingreso Responsable']),
      pointOfEntry: str(d['Punto de ingreso']) || null,
      fkLiquidacion: str(d['_fk_Liquidaciones Instituciones']) || null,
      fkRendicion: str(d['_fk_Rendición Pago directo']) || null,
    };
  }
}

// ── Pure helpers ──

function parsePaymentMethod(val: string): PaymentMethodType {
  const lower = val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (lower.includes('convenio') || lower.includes('liquidacion')) return 'AGREEMENT';
  if (lower.includes('efectivo')) return 'CASH';
  if (lower.includes('bono') || lower.includes('fonasa') || lower.includes('isapre')) return 'VOUCHER';
  if (lower.includes('cheque')) return 'CHECK';
  if (lower.includes('transferencia')) return 'BANK_TRANSFER';
  if (lower.includes('credito') || lower.includes('tarjeta credito')) return 'CREDIT_CARD';
  if (lower.includes('debito') || lower.includes('tarjeta debito') || lower.includes('redcompra')) return 'DEBIT_CARD';
  if (lower.includes('pendiente') || lower.includes('por cobrar')) return 'PENDING_PAYMENT';
  if (!val) return 'OTHER';
  return 'OTHER';
}

function parseChargeStatus(val: string): ChargeStatusType {
  const lower = val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (lower.startsWith('validado')) return 'VALIDATED';
  if (lower.includes('cancelado') || lower.includes('anulado')) return 'CANCELLED';
  if (lower.includes('facturado')) return 'INVOICED';
  if (lower.includes('pagado')) return 'PAID';
  if (lower.includes('reversado') || lower.includes('revertido')) return 'REVERSED';
  return 'REGISTERED';
}

function parseFeeCodes(val: string): string[] {
  if (!val) return [];
  return val
    .split(/[|,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern=exam-charge.transformer.spec.ts`
Expected: ALL PASS

- [ ] **Step 3: Fix any failing tests and iterate**

---

## Task 7: LiquidationTransformer

**Files:**
- Create: `apps/api/src/modules/filemaker/transformers/liquidation.transformer.spec.ts`
- Create: `apps/api/src/modules/filemaker/transformers/liquidation.transformer.ts`

**Depends on:** Task 1 (helpers), Task 2 (types)

- [ ] **Step 1: Write failing tests for LiquidationTransformer**

Create `apps/api/src/modules/filemaker/transformers/liquidation.transformer.spec.ts`:

```typescript
import { LiquidationTransformer } from './liquidation.transformer';
import type { FmRecord } from '@zeru/shared';

function makeLiquidationRecord(overrides: Record<string, unknown> = {}): FmRecord {
  return {
    recordId: '5001',
    modId: '4',
    fieldData: {
      '__pk_liquidaciones_instituciones': 7001,
      'CODIGO INSTITUCION': 'PROC-001',
      'PERIODO COBRO': 'Enero 2025',
      'ESTADO': 'Confirmado',
      'TOTAL LIQUIDACIÓN': 1500000,
      'TOTAL FINAL': 1500000,
      'VALOR TOTAL BIOPSIAS': 800000,
      'VALOR TOTAL PAP': 400000,
      'VALOR TOTAL CITOLOGÍAS': 200000,
      'VALOR TOTAL INMUNOS': 100000,
      'Nº DE BIOPSIAS': 32,
      'Nº DE PAP': 80,
      'Nº DE CITOLOGÍAS': 15,
      'Nº DE INMUNOS': 5,
      'DEUDA ANTERIOR': 250000,
      'SALDO A FAVOR': 0,
      'Confirmado': 'Confirmado',
      'NUMERO DOCUMENTO': 'F-12345',
      'FECHA FACTURA': '01/31/2025',
      'MONTO CANCELADO': 1500000,
      'FECHA PAGO': '02/15/2025',
      'MODO DE PAGO': 'Transferencia',
      ...overrides,
    },
    portalData: {},
  };
}

describe('LiquidationTransformer', () => {
  let transformer: LiquidationTransformer;

  beforeEach(() => {
    transformer = new LiquidationTransformer();
  });

  describe('extract()', () => {
    it('extracts basic liquidation data', () => {
      const record = makeLiquidationRecord();
      const result = transformer.extract(record);
      expect(result.fmPk).toBe(7001);
      expect(result.labOriginCode).toBe('PROC-001');
      expect(result.totalAmount).toBe(1500000);
      expect(result.invoiceNumber).toBe('F-12345');
      expect(result.paymentMethodText).toBe('Transferencia');
    });

    it('parses period "Enero 2025"', () => {
      const record = makeLiquidationRecord({ 'PERIODO COBRO': 'Enero 2025' });
      const result = transformer.extract(record);
      expect(result.period).toBeInstanceOf(Date);
      expect(result.period!.getFullYear()).toBe(2025);
      expect(result.period!.getMonth()).toBe(0);
      expect(result.periodLabel).toBe('Enero 2025');
    });

    it('parses period "1-2025"', () => {
      const record = makeLiquidationRecord({ 'PERIODO COBRO': '1-2025' });
      const result = transformer.extract(record);
      expect(result.period).toBeInstanceOf(Date);
      expect(result.period!.getMonth()).toBe(0);
      expect(result.periodLabel).toBe('1-2025');
    });

    it('extracts breakdown amounts', () => {
      const record = makeLiquidationRecord();
      const result = transformer.extract(record);
      expect(result.biopsyAmount).toBe(800000);
      expect(result.papAmount).toBe(400000);
      expect(result.cytologyAmount).toBe(200000);
      expect(result.immunoAmount).toBe(100000);
    });

    it('extracts counts', () => {
      const record = makeLiquidationRecord();
      const result = transformer.extract(record);
      expect(result.biopsyCount).toBe(32);
      expect(result.papCount).toBe(80);
      expect(result.cytologyCount).toBe(15);
      expect(result.immunoCount).toBe(5);
    });

    it('extracts previous debt and credit balance', () => {
      const record = makeLiquidationRecord({
        'DEUDA ANTERIOR': 250000,
        'SALDO A FAVOR': 50000,
      });
      const result = transformer.extract(record);
      expect(result.previousDebt).toBe(250000);
      expect(result.creditBalance).toBe(50000);
    });

    it('parses credit balance defensively (text mixed in)', () => {
      const record = makeLiquidationRecord({ 'SALDO A FAVOR': 'No tiene saldo' });
      const result = transformer.extract(record);
      expect(result.creditBalance).toBe(0);
    });

    it('parses CONFIRMED status', () => {
      const record = makeLiquidationRecord({ 'ESTADO': 'Confirmado' });
      const result = transformer.extract(record);
      expect(result.status).toBe('CONFIRMED');
    });

    it('parses PAID status', () => {
      const record = makeLiquidationRecord({ 'ESTADO': 'Pagado' });
      const result = transformer.extract(record);
      expect(result.status).toBe('PAID');
    });

    it('parses INVOICED status', () => {
      const record = makeLiquidationRecord({ 'ESTADO': 'Facturado' });
      const result = transformer.extract(record);
      expect(result.status).toBe('INVOICED');
    });

    it('parses OVERDUE status', () => {
      const record = makeLiquidationRecord({ 'ESTADO': 'Vencido' });
      const result = transformer.extract(record);
      expect(result.status).toBe('OVERDUE');
    });

    it('parses CANCELLED status', () => {
      const record = makeLiquidationRecord({ 'ESTADO': 'Cancelado' });
      const result = transformer.extract(record);
      expect(result.status).toBe('CANCELLED');
    });

    it('defaults to DRAFT for unknown status', () => {
      const record = makeLiquidationRecord({ 'ESTADO': '' });
      const result = transformer.extract(record);
      expect(result.status).toBe('DRAFT');
    });

    it('parses confirmedAt when Confirmado field says "Confirmado"', () => {
      const record = makeLiquidationRecord({ 'Confirmado': 'Confirmado' });
      const result = transformer.extract(record);
      // confirmedAt should be a truthy indicator; we use the string presence
      expect(result.confirmedAt).toBeDefined();
    });

    it('returns null confirmedAt when not confirmed', () => {
      const record = makeLiquidationRecord({ 'Confirmado': '' });
      const result = transformer.extract(record);
      expect(result.confirmedAt).toBeNull();
    });

    it('parses invoice date', () => {
      const record = makeLiquidationRecord({ 'FECHA FACTURA': '01/31/2025' });
      const result = transformer.extract(record);
      expect(result.invoiceDate).toBeInstanceOf(Date);
    });

    it('parses payment date', () => {
      const record = makeLiquidationRecord({ 'FECHA PAGO': '02/15/2025' });
      const result = transformer.extract(record);
      expect(result.paymentDate).toBeInstanceOf(Date);
    });

    it('parses payment amount', () => {
      const record = makeLiquidationRecord({ 'MONTO CANCELADO': 1500000 });
      const result = transformer.extract(record);
      expect(result.paymentAmount).toBe(1500000);
    });

    it('returns null payment amount when empty', () => {
      const record = makeLiquidationRecord({ 'MONTO CANCELADO': '' });
      const result = transformer.extract(record);
      expect(result.paymentAmount).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('uses TOTAL FINAL when TOTAL LIQUIDACIÓN is empty', () => {
      const record = makeLiquidationRecord({
        'TOTAL LIQUIDACIÓN': '',
        'TOTAL FINAL': 2000000,
      });
      const result = transformer.extract(record);
      expect(result.totalAmount).toBe(2000000);
    });

    it('handles all-empty record', () => {
      const emptyRecord: FmRecord = {
        recordId: '999',
        modId: '1',
        fieldData: {},
        portalData: {},
      };
      const result = transformer.extract(emptyRecord);
      expect(result.fmPk).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(result.biopsyCount).toBe(0);
    });
  });
});
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern=liquidation.transformer.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement LiquidationTransformer**

Create `apps/api/src/modules/filemaker/transformers/liquidation.transformer.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { FmRecord } from '@zeru/shared';
import { str, parseNum, parseDate, parsePeriod } from './helpers';
import type { ExtractedLiquidation, LiquidationStatusType } from './types';

@Injectable()
export class LiquidationTransformer {
  readonly database = 'BIOPSIAS';
  readonly layout = 'Liquidaciones';

  extract(record: FmRecord): ExtractedLiquidation {
    const d = record.fieldData;
    const periodRaw = str(d['PERIODO COBRO']);
    const statusRaw = str(d['ESTADO']);
    const totalLiq = parseNum(d['TOTAL LIQUIDACIÓN']);
    const totalFinal = parseNum(d['TOTAL FINAL']);
    const montoCanc = str(d['MONTO CANCELADO']);
    const confirmadoField = str(d['Confirmado']);

    return {
      fmPk: parseNum(d['__pk_liquidaciones_instituciones']),
      labOriginCode: str(d['CODIGO INSTITUCION']),
      period: parsePeriod(periodRaw),
      periodLabel: periodRaw,
      status: parseLiquidationStatus(statusRaw),
      statusRaw,
      totalAmount: totalLiq || totalFinal,
      biopsyAmount: parseNum(d['VALOR TOTAL BIOPSIAS']),
      papAmount: parseNum(d['VALOR TOTAL PAP']),
      cytologyAmount: parseNum(d['VALOR TOTAL CITOLOGÍAS']),
      immunoAmount: parseNum(d['VALOR TOTAL INMUNOS']),
      biopsyCount: parseNum(d['Nº DE BIOPSIAS']),
      papCount: parseNum(d['Nº DE PAP']),
      cytologyCount: parseNum(d['Nº DE CITOLOGÍAS']),
      immunoCount: parseNum(d['Nº DE INMUNOS']),
      previousDebt: parseNum(d['DEUDA ANTERIOR']),
      creditBalance: parseNum(d['SALDO A FAVOR']),
      confirmedAt: confirmadoField.toLowerCase().includes('confirmado') ? new Date() : null,
      confirmedByNameSnapshot: confirmadoField.toLowerCase().includes('confirmado')
        ? confirmadoField
        : null,
      invoiceNumber: str(d['NUMERO DOCUMENTO']) || null,
      invoiceDate: parseDate(str(d['FECHA FACTURA'])),
      paymentAmount: montoCanc ? parseNum(d['MONTO CANCELADO']) || null : null,
      paymentDate: parseDate(str(d['FECHA PAGO'])),
      paymentMethodText: str(d['MODO DE PAGO']) || null,
      notes: null,
    };
  }
}

// ── Pure helpers ──

function parseLiquidationStatus(val: string): LiquidationStatusType {
  const lower = val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (lower.includes('confirmado')) return 'CONFIRMED';
  if (lower.includes('facturado')) return 'INVOICED';
  if (lower.includes('pagado') || lower.includes('cancelado total'))
    return 'PAID';
  if (lower.includes('parcial')) return 'PARTIALLY_PAID';
  if (lower.includes('vencido') || lower.includes('moroso')) return 'OVERDUE';
  if (lower.includes('cancelado') || lower.includes('anulado')) return 'CANCELLED';
  return 'DRAFT';
}
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern=liquidation.transformer.spec.ts`
Expected: ALL PASS

- [ ] **Step 3: Fix any failing tests and iterate**

---

## Task 8: TraceabilityTransformer

**Files:**
- Create: `apps/api/src/modules/filemaker/transformers/traceability.transformer.spec.ts`
- Create: `apps/api/src/modules/filemaker/transformers/traceability.transformer.ts`

**Depends on:** Task 1 (helpers), Task 2 (types)

- [ ] **Step 1: Write failing tests for TraceabilityTransformer**

Create `apps/api/src/modules/filemaker/transformers/traceability.transformer.spec.ts`:

```typescript
import { TraceabilityTransformer } from './traceability.transformer';
import type { FmRecord } from '@zeru/shared';

function makeTraceRecord(overrides: Record<string, unknown> = {}): FmRecord {
  return {
    recordId: '6001',
    modId: '2',
    fieldData: {
      'INFORME Nº': 12345,
      'Trazabilidad::Responsable_Ingreso examen': 'Ana Torres',
      'Trazabilidad::Fecha_Ingreso examen': '03/10/2026',
      'Trazabilidad::Responsable_Entrega a Estafeta en origen': 'Carlos Ruiz',
      'Trazabilidad::Fecha_Entrega a Estafeta en origen': '03/10/2026',
      'Trazabilidad::Responsable_Transporte': 'Pedro López',
      'Trazabilidad::Fecha_Transporte': '03/11/2026',
      'Trazabilidad::Responsable_Recibe en Citolab': 'María Campos',
      'Trazabilidad::Fecha_Recibe en Citolab': '03/11/2026',
      'Trazabilidad::Responsable_Macroscopía': 'Dr. Martínez',
      'Trazabilidad::Fecha_Macroscopía': '03/12/2026',
      'Trazabilidad::Responsable_Inclusión': 'Tec. Soto',
      'Trazabilidad::Fecha_Inclusión': '03/12/2026',
      'Trazabilidad::Responsable_Corte tinción montaje y registro de placas': 'Tec. Vega',
      'Trazabilidad::Fecha_Corte tinción montaje y registro de placas': '03/13/2026',
      'Trazabilidad::Responsable_Patólogo informante histología': 'Dr. García',
      'Trazabilidad::Fecha_Patólogo informante histología': '03/13/2026',
      'Trazabilidad::Responsable_Validación': 'Sec. Mora',
      'Trazabilidad::Fecha_Validación': '03/14/2026',
      'Trazabilidad::Responsable_Aprueba resultado': 'Dr. González',
      'Trazabilidad::Fecha_Aprueba resultado': '03/14/2026',
      'Trazabilidad::Responsable_Entrega resultado': 'Ana Torres',
      'Trazabilidad::Fecha_Entrega resultado': '03/15/2026',
      ...overrides,
    },
    portalData: {},
  };
}

describe('TraceabilityTransformer', () => {
  let transformer: TraceabilityTransformer;

  beforeEach(() => {
    transformer = new TraceabilityTransformer();
  });

  describe('extract()', () => {
    it('extracts all 11 workflow steps', () => {
      const record = makeTraceRecord();
      const result = transformer.extract(record);
      expect(result.fmInformeNumber).toBe(12345);
      expect(result.events.length).toBe(11);
    });

    it('assigns correct event types in order', () => {
      const record = makeTraceRecord();
      const result = transformer.extract(record);
      const types = result.events.map(e => e.eventType);
      expect(types).toEqual([
        'ORIGIN_INTAKE',
        'ORIGIN_HANDOFF_TO_COURIER',
        'TRANSPORT',
        'RECEIVED_AT_LAB',
        'MACROSCOPY',
        'EMBEDDING',
        'CUTTING_STAINING',
        'HISTOLOGY_REPORTING',
        'VALIDATION',
        'APPROVAL',
        'DELIVERY',
      ]);
    });

    it('assigns sequential order numbers', () => {
      const record = makeTraceRecord();
      const result = transformer.extract(record);
      const orders = result.events.map(e => e.sequenceOrder);
      expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    it('extracts performer name and date', () => {
      const record = makeTraceRecord();
      const result = transformer.extract(record);
      const intake = result.events[0];
      expect(intake.performedByNameSnapshot).toBe('Ana Torres');
      expect(intake.occurredAt).toBeInstanceOf(Date);
      expect(intake.occurredAt.getMonth()).toBe(2); // March
    });

    it('skips steps where both name and date are empty', () => {
      const record = makeTraceRecord({
        'Trazabilidad::Responsable_Transporte': '',
        'Trazabilidad::Fecha_Transporte': '',
        'Trazabilidad::Responsable_Inclusión': '',
        'Trazabilidad::Fecha_Inclusión': '',
      });
      const result = transformer.extract(record);
      expect(result.events.length).toBe(9); // 11 - 2 skipped
    });

    it('includes step when only name is present (uses epoch date)', () => {
      const record = makeTraceRecord({
        'Trazabilidad::Fecha_Transporte': '',
        'Trazabilidad::Responsable_Transporte': 'Pedro',
      });
      const result = transformer.extract(record);
      const transport = result.events.find(e => e.eventType === 'TRANSPORT');
      expect(transport).toBeDefined();
      expect(transport!.performedByNameSnapshot).toBe('Pedro');
    });

    it('includes step when only date is present (uses "Desconocido" name)', () => {
      const record = makeTraceRecord({
        'Trazabilidad::Responsable_Transporte': '',
        'Trazabilidad::Fecha_Transporte': '03/11/2026',
      });
      const result = transformer.extract(record);
      const transport = result.events.find(e => e.eventType === 'TRANSPORT');
      expect(transport).toBeDefined();
      expect(transport!.performedByNameSnapshot).toBe('Desconocido');
    });

    it('populates sourceField with FM field name', () => {
      const record = makeTraceRecord();
      const result = transformer.extract(record);
      expect(result.events[0].sourceField).toBe('Trazabilidad::Responsable_Ingreso examen');
    });
  });

  describe('edge cases', () => {
    it('handles empty record', () => {
      const emptyRecord: FmRecord = {
        recordId: '999',
        modId: '1',
        fieldData: {},
        portalData: {},
      };
      const result = transformer.extract(emptyRecord);
      expect(result.fmInformeNumber).toBe(0);
      expect(result.events).toEqual([]);
    });

    it('handles record with only some steps', () => {
      const record = makeTraceRecord({
        'Trazabilidad::Responsable_Ingreso examen': 'Ana',
        'Trazabilidad::Fecha_Ingreso examen': '03/10/2026',
        // All other steps are empty by removing them
        'Trazabilidad::Responsable_Entrega a Estafeta en origen': '',
        'Trazabilidad::Fecha_Entrega a Estafeta en origen': '',
        'Trazabilidad::Responsable_Transporte': '',
        'Trazabilidad::Fecha_Transporte': '',
        'Trazabilidad::Responsable_Recibe en Citolab': '',
        'Trazabilidad::Fecha_Recibe en Citolab': '',
        'Trazabilidad::Responsable_Macroscopía': '',
        'Trazabilidad::Fecha_Macroscopía': '',
        'Trazabilidad::Responsable_Inclusión': '',
        'Trazabilidad::Fecha_Inclusión': '',
        'Trazabilidad::Responsable_Corte tinción montaje y registro de placas': '',
        'Trazabilidad::Fecha_Corte tinción montaje y registro de placas': '',
        'Trazabilidad::Responsable_Patólogo informante histología': '',
        'Trazabilidad::Fecha_Patólogo informante histología': '',
        'Trazabilidad::Responsable_Validación': '',
        'Trazabilidad::Fecha_Validación': '',
        'Trazabilidad::Responsable_Aprueba resultado': '',
        'Trazabilidad::Fecha_Aprueba resultado': '',
        'Trazabilidad::Responsable_Entrega resultado': '',
        'Trazabilidad::Fecha_Entrega resultado': '',
      });
      const result = transformer.extract(record);
      expect(result.events.length).toBe(1);
      expect(result.events[0].eventType).toBe('ORIGIN_INTAKE');
    });
  });
});
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern=traceability.transformer.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement TraceabilityTransformer**

Create `apps/api/src/modules/filemaker/transformers/traceability.transformer.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { FmRecord } from '@zeru/shared';
import { str, parseNum, parseDate } from './helpers';
import type { ExtractedWorkflowEvent, WorkflowEventTypeValue } from './types';

interface TraceabilityResult {
  fmInformeNumber: number;
  fmRecordId: string;
  events: ExtractedWorkflowEvent[];
}

/**
 * Step definitions mapping FM traceability field names to WorkflowEventType.
 * Order matters — it defines sequenceOrder.
 */
const TRACEABILITY_STEPS: { label: string; eventType: WorkflowEventTypeValue }[] = [
  { label: 'Ingreso examen', eventType: 'ORIGIN_INTAKE' },
  { label: 'Entrega a Estafeta en origen', eventType: 'ORIGIN_HANDOFF_TO_COURIER' },
  { label: 'Transporte', eventType: 'TRANSPORT' },
  { label: 'Recibe en Citolab', eventType: 'RECEIVED_AT_LAB' },
  { label: 'Macroscopía', eventType: 'MACROSCOPY' },
  { label: 'Inclusión', eventType: 'EMBEDDING' },
  { label: 'Corte tinción montaje y registro de placas', eventType: 'CUTTING_STAINING' },
  { label: 'Patólogo informante histología', eventType: 'HISTOLOGY_REPORTING' },
  { label: 'Validación', eventType: 'VALIDATION' },
  { label: 'Aprueba resultado', eventType: 'APPROVAL' },
  { label: 'Entrega resultado', eventType: 'DELIVERY' },
];

@Injectable()
export class TraceabilityTransformer {
  readonly database = 'BIOPSIAS';
  readonly layout = 'TRAZA';

  extract(record: FmRecord): TraceabilityResult {
    const d = record.fieldData;
    const events: ExtractedWorkflowEvent[] = [];
    let order = 0;

    for (const step of TRACEABILITY_STEPS) {
      const responsableField = `Trazabilidad::Responsable_${step.label}`;
      const fechaField = `Trazabilidad::Fecha_${step.label}`;
      const responsable = str(d[responsableField]);
      const fechaStr = str(d[fechaField]);

      // Skip if both are empty
      if (!responsable && !fechaStr) continue;

      const occurredAt = parseDate(fechaStr) ?? new Date(0);

      order++;
      events.push({
        eventType: step.eventType,
        sequenceOrder: order,
        occurredAt,
        performedByNameSnapshot: responsable || 'Desconocido',
        sourceField: responsableField,
      });
    }

    return {
      fmInformeNumber: parseNum(d['INFORME Nº']),
      fmRecordId: record.recordId,
      events,
    };
  }
}
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern=traceability.transformer.spec.ts`
Expected: ALL PASS

- [ ] **Step 3: Fix any failing tests and iterate**

---

## Task 9: CommunicationTransformer

**Files:**
- Create: `apps/api/src/modules/filemaker/transformers/communication.transformer.spec.ts`
- Create: `apps/api/src/modules/filemaker/transformers/communication.transformer.ts`

**Depends on:** Task 1 (helpers), Task 2 (types)

- [ ] **Step 1: Write failing tests for CommunicationTransformer**

Create `apps/api/src/modules/filemaker/transformers/communication.transformer.spec.ts`:

```typescript
import { CommunicationTransformer } from './communication.transformer';
import type { FmRecord } from '@zeru/shared';

function makeBiopsyCommunicationRecord(
  portalRows: Record<string, unknown>[] = [],
): FmRecord {
  return {
    recordId: '7001',
    modId: '1',
    fieldData: {
      'INFORME Nº': 12345,
    },
    portalData: {
      COMUNICACIONES: portalRows,
    },
  };
}

function makePapCommunicationRecord(overrides: Record<string, unknown> = {}): FmRecord {
  return {
    recordId: '8001',
    modId: '1',
    fieldData: {
      'fk_InformeNumero': 54321,
      'Motivo': 'Muestra insuficiente',
      'Comentario': 'La muestra no es apta para procesamiento',
      'IngresoFecha': '03/15/2026',
      'IngresoHora': '14:30:00',
      'IngresoResponsable': 'Tec. Sánchez',
      'Respuesta': 'Se solicitó nueva muestra',
      ...overrides,
    },
    portalData: {},
  };
}

describe('CommunicationTransformer', () => {
  let transformer: CommunicationTransformer;

  beforeEach(() => {
    transformer = new CommunicationTransformer();
  });

  describe('extractFromBiopsyPortal()', () => {
    it('extracts communications from portal rows', () => {
      const record = makeBiopsyCommunicationRecord([
        {
          'COMUNICACIONES::MOTIVO': 'Muestra dañada',
          'COMUNICACIONES::COMENTARIO': 'Se recibió en mal estado',
          'COMUNICACIONES::Ingreso Fecha': '03/15/2026',
          'COMUNICACIONES::Ingreso Hora': '10:00:00',
          'COMUNICACIONES::Ingreso Responsable': 'María',
          'COMUNICACIONES::Respuesta': 'Se reenvía muestra',
        },
      ]);
      const result = transformer.extractFromBiopsyPortal(record);
      expect(result.length).toBe(1);
      expect(result[0].fkInformeNumber).toBe(12345);
      expect(result[0].reason).toBe('Muestra dañada');
      expect(result[0].content).toBe('Se recibió en mal estado');
      expect(result[0].loggedByNameSnapshot).toBe('María');
      expect(result[0].response).toBe('Se reenvía muestra');
    });

    it('extracts multiple portal rows', () => {
      const record = makeBiopsyCommunicationRecord([
        {
          'COMUNICACIONES::MOTIVO': 'Motivo 1',
          'COMUNICACIONES::COMENTARIO': 'Comentario 1',
          'COMUNICACIONES::Ingreso Fecha': '03/15/2026',
          'COMUNICACIONES::Ingreso Hora': '',
          'COMUNICACIONES::Ingreso Responsable': 'A',
          'COMUNICACIONES::Respuesta': '',
        },
        {
          'COMUNICACIONES::MOTIVO': 'Motivo 2',
          'COMUNICACIONES::COMENTARIO': 'Comentario 2',
          'COMUNICACIONES::Ingreso Fecha': '03/16/2026',
          'COMUNICACIONES::Ingreso Hora': '',
          'COMUNICACIONES::Ingreso Responsable': 'B',
          'COMUNICACIONES::Respuesta': 'Resp 2',
        },
      ]);
      const result = transformer.extractFromBiopsyPortal(record);
      expect(result.length).toBe(2);
    });

    it('handles empty portal', () => {
      const record = makeBiopsyCommunicationRecord([]);
      const result = transformer.extractFromBiopsyPortal(record);
      expect(result).toEqual([]);
    });

    it('handles missing portal', () => {
      const record: FmRecord = {
        recordId: '7001',
        modId: '1',
        fieldData: { 'INFORME Nº': 12345 },
        portalData: {},
      };
      const result = transformer.extractFromBiopsyPortal(record);
      expect(result).toEqual([]);
    });

    it('parses loggedAt from date + time', () => {
      const record = makeBiopsyCommunicationRecord([
        {
          'COMUNICACIONES::MOTIVO': 'Test',
          'COMUNICACIONES::COMENTARIO': 'Content',
          'COMUNICACIONES::Ingreso Fecha': '03/15/2026',
          'COMUNICACIONES::Ingreso Hora': '14:30:00',
          'COMUNICACIONES::Ingreso Responsable': 'User',
          'COMUNICACIONES::Respuesta': '',
        },
      ]);
      const result = transformer.extractFromBiopsyPortal(record);
      expect(result[0].loggedAt).toBeInstanceOf(Date);
      expect(result[0].loggedAt!.getHours()).toBe(14);
    });

    it('returns null response when empty', () => {
      const record = makeBiopsyCommunicationRecord([
        {
          'COMUNICACIONES::MOTIVO': 'Test',
          'COMUNICACIONES::COMENTARIO': 'Content',
          'COMUNICACIONES::Ingreso Fecha': '03/15/2026',
          'COMUNICACIONES::Ingreso Hora': '',
          'COMUNICACIONES::Ingreso Responsable': 'User',
          'COMUNICACIONES::Respuesta': '',
        },
      ]);
      const result = transformer.extractFromBiopsyPortal(record);
      expect(result[0].response).toBeNull();
    });

    it('skips rows where comentario is empty', () => {
      const record = makeBiopsyCommunicationRecord([
        {
          'COMUNICACIONES::MOTIVO': 'Motivo',
          'COMUNICACIONES::COMENTARIO': '',
          'COMUNICACIONES::Ingreso Fecha': '03/15/2026',
          'COMUNICACIONES::Ingreso Hora': '',
          'COMUNICACIONES::Ingreso Responsable': 'User',
          'COMUNICACIONES::Respuesta': '',
        },
      ]);
      const result = transformer.extractFromBiopsyPortal(record);
      expect(result.length).toBe(0);
    });
  });

  describe('extractFromPapRecord()', () => {
    it('extracts communication from standalone PAP record', () => {
      const record = makePapCommunicationRecord();
      const result = transformer.extractFromPapRecord(record);
      expect(result).not.toBeNull();
      expect(result!.fkInformeNumber).toBe(54321);
      expect(result!.reason).toBe('Muestra insuficiente');
      expect(result!.content).toBe('La muestra no es apta para procesamiento');
      expect(result!.loggedByNameSnapshot).toBe('Tec. Sánchez');
      expect(result!.response).toBe('Se solicitó nueva muestra');
    });

    it('parses loggedAt from date + time', () => {
      const record = makePapCommunicationRecord({
        'IngresoFecha': '03/15/2026',
        'IngresoHora': '14:30:00',
      });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.loggedAt).toBeInstanceOf(Date);
      expect(result!.loggedAt!.getHours()).toBe(14);
    });

    it('returns null when Comentario is empty', () => {
      const record = makePapCommunicationRecord({ 'Comentario': '' });
      const result = transformer.extractFromPapRecord(record);
      expect(result).toBeNull();
    });

    it('returns null response when empty', () => {
      const record = makePapCommunicationRecord({ 'Respuesta': '' });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.response).toBeNull();
    });
  });

  describe('category inference', () => {
    it('infers SAMPLE_QUALITY_ISSUE from motivo', () => {
      const record = makePapCommunicationRecord({ 'Motivo': 'Muestra insuficiente' });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.category).toBe('SAMPLE_QUALITY_ISSUE');
    });

    it('infers ADDITIONAL_INFO_REQUEST', () => {
      const record = makePapCommunicationRecord({ 'Motivo': 'Solicitud de antecedentes' });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.category).toBe('ADDITIONAL_INFO_REQUEST');
    });

    it('infers CRITICAL_RESULT', () => {
      const record = makePapCommunicationRecord({ 'Motivo': 'Resultado crítico' });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.category).toBe('CRITICAL_RESULT');
    });

    it('infers CORRECTION_REQUEST', () => {
      const record = makePapCommunicationRecord({ 'Motivo': 'Corrección de informe' });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.category).toBe('CORRECTION_REQUEST');
    });

    it('defaults to OTHER for unknown motivo', () => {
      const record = makePapCommunicationRecord({ 'Motivo': 'Otro motivo' });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.category).toBe('OTHER');
    });

    it('returns null category when motivo is empty', () => {
      const record = makePapCommunicationRecord({ 'Motivo': '' });
      const result = transformer.extractFromPapRecord(record);
      expect(result!.category).toBeNull();
    });
  });
});
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern=communication.transformer.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement CommunicationTransformer**

Create `apps/api/src/modules/filemaker/transformers/communication.transformer.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { FmRecord } from '@zeru/shared';
import { str, parseNum, parseFmDateTime } from './helpers';
import type { ExtractedCommunication, CommunicationCategoryType } from './types';

@Injectable()
export class CommunicationTransformer {
  readonly biopsyDatabase = 'BIOPSIAS';
  readonly biopsyLayout = 'Validación Final*';
  readonly papDatabase = 'PAPANICOLAOU';
  readonly papLayout = 'COMUNICACIONES';

  /**
   * Extract communications from the COMUNICACIONES portal on a biopsy record.
   */
  extractFromBiopsyPortal(record: FmRecord): ExtractedCommunication[] {
    const portalData = record.portalData?.['COMUNICACIONES'];
    if (!portalData || !Array.isArray(portalData)) return [];

    const informeNumber = parseNum(record.fieldData['INFORME Nº']);

    return portalData
      .map((row: Record<string, unknown>) => {
        const content = str(row['COMUNICACIONES::COMENTARIO']);
        if (!content) return null;

        const motivo = str(row['COMUNICACIONES::MOTIVO']);
        const responseText = str(row['COMUNICACIONES::Respuesta']);

        return {
          fkInformeNumber: informeNumber,
          reason: motivo || null,
          content,
          response: responseText || null,
          loggedAt: parseFmDateTime(
            str(row['COMUNICACIONES::Ingreso Fecha']),
            str(row['COMUNICACIONES::Ingreso Hora']),
          ),
          loggedByNameSnapshot: str(row['COMUNICACIONES::Ingreso Responsable']) || 'Desconocido',
          category: inferCategory(motivo),
        };
      })
      .filter((c): c is ExtractedCommunication => c !== null);
  }

  /**
   * Extract a single communication from a standalone PAP COMUNICACIONES record.
   */
  extractFromPapRecord(record: FmRecord): ExtractedCommunication | null {
    const d = record.fieldData;
    const content = str(d['Comentario']);
    if (!content) return null;

    const motivo = str(d['Motivo']);
    const responseText = str(d['Respuesta']);

    return {
      fkInformeNumber: parseNum(d['fk_InformeNumero']),
      reason: motivo || null,
      content,
      response: responseText || null,
      loggedAt: parseFmDateTime(str(d['IngresoFecha']), str(d['IngresoHora'])),
      loggedByNameSnapshot: str(d['IngresoResponsable']) || 'Desconocido',
      category: inferCategory(motivo),
    };
  }
}

// ── Pure helpers ──

function inferCategory(motivo: string): CommunicationCategoryType | null {
  if (!motivo) return null;

  const lower = motivo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (lower.includes('muestra') && (lower.includes('insuficiente') || lower.includes('danada') || lower.includes('calidad')))
    return 'SAMPLE_QUALITY_ISSUE';
  if (lower.includes('solicitud') || lower.includes('antecedentes') || lower.includes('informacion adicional'))
    return 'ADDITIONAL_INFO_REQUEST';
  if (lower.includes('critico') || lower.includes('alterado') || lower.includes('urgente'))
    return 'CRITICAL_RESULT';
  if (lower.includes('correccion') || lower.includes('enmienda') || lower.includes('modificacion'))
    return 'CORRECTION_REQUEST';
  if (lower.includes('calidad') && lower.includes('interno'))
    return 'INTERNAL_QC';
  if (lower.includes('consulta') || lower.includes('cliente') || lower.includes('procedencia'))
    return 'CLIENT_INQUIRY';

  return 'OTHER';
}
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern=communication.transformer.spec.ts`
Expected: ALL PASS

- [ ] **Step 3: Fix any failing tests and iterate**

---

## Task 10: Module registration

**Files:**
- Create: `apps/api/src/modules/lab/lab.module.ts`
- Modify: `apps/api/src/modules/filemaker/filemaker.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Depends on:** Tasks 4-9 (all transformers)

- [ ] **Step 1: Create basic lab.module.ts**

Create `apps/api/src/modules/lab/lab.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class LabModule {}
```

- [ ] **Step 2: Register new transformers in FileMakerModule**

Modify `apps/api/src/modules/filemaker/filemaker.module.ts`:

Add imports:
```typescript
import { BiopsyTransformer } from './transformers/biopsy.transformer';
import { PapTransformer } from './transformers/pap.transformer';
import { ExamChargeTransformer } from './transformers/exam-charge.transformer';
import { LiquidationTransformer } from './transformers/liquidation.transformer';
import { TraceabilityTransformer } from './transformers/traceability.transformer';
import { CommunicationTransformer } from './transformers/communication.transformer';
```

Add to providers array:
```typescript
BiopsyTransformer, PapTransformer, ExamChargeTransformer, LiquidationTransformer, TraceabilityTransformer, CommunicationTransformer
```

Add to exports array:
```typescript
BiopsyTransformer, PapTransformer, ExamChargeTransformer, LiquidationTransformer, TraceabilityTransformer, CommunicationTransformer
```

- [ ] **Step 3: Register LabModule in app.module.ts**

Find the `imports` array in `apps/api/src/app.module.ts` and add:
```typescript
import { LabModule } from './modules/lab/lab.module';
```

Add `LabModule` to the imports array.

- [ ] **Step 4: Verify compilation**

Run:
```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api exec tsc --noEmit --pretty
```

Expected: No compilation errors.

---

## Task 11: Run full test suite and lint

**Depends on:** All previous tasks

- [ ] **Step 1: Run all transformer tests**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern='transformers/.*.spec.ts'
```

Expected: ALL PASS (helpers + 6 transformers)

- [ ] **Step 2: Run full API test suite**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test
```

Expected: ALL PASS (no regressions from helper refactor)

- [ ] **Step 3: Run lint**

```bash
cd /Users/camiloespinoza/Zeru && pnpm lint
```

Fix any lint errors. Common issues:
- Unused imports after helper refactor
- Missing trailing commas
- Line length

- [ ] **Step 4: Final verification**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api exec prisma generate && pnpm --filter @zeru/api exec tsc --noEmit
```

Expected: Both commands succeed.

---

## Dependency Graph

```
Task 1 (helpers)  ──┐
                    ├── Task 4 (BiopsyTransformer)
Task 2 (types)   ──┤── Task 5 (PapTransformer)
                    ├── Task 6 (ExamChargeTransformer)
                    ├── Task 7 (LiquidationTransformer)
                    ├── Task 8 (TraceabilityTransformer)
                    └── Task 9 (CommunicationTransformer)

Task 3 (Prisma schema) ── independent (can run in parallel with Tasks 4-9)

Tasks 4-9 ──── Task 10 (module registration)

All tasks ──── Task 11 (full test suite + lint)
```

Tasks 4, 5, 6, 7, 8, 9 are **independent** and can be executed in parallel by multiple agents.
Task 3 is also **independent** and can run in parallel with everything except Task 11.

---

## Summary of deliverables

| # | Deliverable | Files | Tests |
|---|-------------|-------|-------|
| 1 | Shared helpers | `helpers.ts` | `helpers.spec.ts` (25+ tests) |
| 2 | Shared DTO types | `types.ts` | Type-checked via `tsc --noEmit` |
| 3 | Prisma schema (mod_lab) | `schema.prisma` + migration | `prisma generate` + `prisma format` |
| 4 | BiopsyTransformer | `biopsy.transformer.ts` | `biopsy.transformer.spec.ts` (25+ tests) |
| 5 | PapTransformer | `pap.transformer.ts` | `pap.transformer.spec.ts` (20+ tests) |
| 6 | ExamChargeTransformer | `exam-charge.transformer.ts` | `exam-charge.transformer.spec.ts` (20+ tests) |
| 7 | LiquidationTransformer | `liquidation.transformer.ts` | `liquidation.transformer.spec.ts` (20+ tests) |
| 8 | TraceabilityTransformer | `traceability.transformer.ts` | `traceability.transformer.spec.ts` (10+ tests) |
| 9 | CommunicationTransformer | `communication.transformer.ts` | `communication.transformer.spec.ts` (15+ tests) |
| 10 | Module registration | `lab.module.ts`, `filemaker.module.ts`, `app.module.ts` | Compilation check |
| 11 | Verification | — | Full test suite + lint |

**Total new files:** 15 (7 implementation + 7 test + 1 module)
**Total modified files:** 4 (schema, filemaker module, app module, 2 existing transformers)
**Total estimated tests:** 135+
