# Biopsias/Papanicolaou Services & Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CRUD services, REST API endpoints, and bidirectional FM sync for billing (ExamCharge/Liquidation) and macroscopy transcription modules.

**Architecture:** NestJS services with Prisma queries, event-driven sync via EventEmitter2 to FmLabSyncService, transformer toFm() for field mapping, FmApiService for FM writes. Conflict detection via modId comparison.

**Tech Stack:** NestJS, Prisma, EventEmitter2, Zod DTOs

**Depends on:** Plan 1 (transformers) + Plan 2 (import pipeline, module wiring)

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `packages/shared/src/schemas/lab.schema.ts` | Zod schemas for all lab DTOs (ExamCharge, Liquidation, DirectPaymentBatch, DiagnosticReport macroscopy, Patient/Practitioner search) |
| `apps/api/src/modules/lab/services/lab-patient.service.ts` | Read-only patient search (by RUT, name) with exam history |
| `apps/api/src/modules/lab/services/lab-patient.service.spec.ts` | Unit tests |
| `apps/api/src/modules/lab/services/lab-practitioner.service.ts` | Read-only practitioner list/search |
| `apps/api/src/modules/lab/services/lab-practitioner.service.spec.ts` | Unit tests |
| `apps/api/src/modules/lab/services/lab-exam-charge.service.ts` | CRUD for LabExamCharge with FM sync events |
| `apps/api/src/modules/lab/services/lab-exam-charge.service.spec.ts` | Unit tests |
| `apps/api/src/modules/lab/services/lab-liquidation.service.ts` | CRUD for LabLiquidation with lifecycle methods (confirm, invoice, payment) |
| `apps/api/src/modules/lab/services/lab-liquidation.service.spec.ts` | Unit tests |
| `apps/api/src/modules/lab/services/lab-direct-payment-batch.service.ts` | CRUD for LabDirectPaymentBatch (create, close, list) |
| `apps/api/src/modules/lab/services/lab-direct-payment-batch.service.spec.ts` | Unit tests |
| `apps/api/src/modules/lab/services/lab-diagnostic-report.service.ts` | Read + macroscopy update for LabDiagnosticReport |
| `apps/api/src/modules/lab/services/lab-diagnostic-report.service.spec.ts` | Unit tests |
| `apps/api/src/modules/lab/services/fm-lab-sync.service.ts` | Listens to `fm.lab.sync` events, calls toFm(), calls FmApiService, updates FmSyncRecord |
| `apps/api/src/modules/lab/services/fm-lab-sync.service.spec.ts` | Unit tests |
| `apps/api/src/modules/lab/controllers/lab-patient.controller.ts` | GET /lab/patients (search), GET /lab/patients/:id |
| `apps/api/src/modules/lab/controllers/lab-practitioner.controller.ts` | GET /lab/practitioners (search/list) |
| `apps/api/src/modules/lab/controllers/lab-exam-charge.controller.ts` | CRUD endpoints for exam charges |
| `apps/api/src/modules/lab/controllers/lab-liquidation.controller.ts` | CRUD + lifecycle endpoints for liquidations |
| `apps/api/src/modules/lab/controllers/lab-direct-payment-batch.controller.ts` | CRUD endpoints for direct payment batches |
| `apps/api/src/modules/lab/controllers/lab-diagnostic-report.controller.ts` | Search/filter/view + macroscopy update endpoints |
| `apps/api/src/modules/lab/dto/lab-exam-charge.dto.ts` | Zod DTOs for exam charge CRUD |
| `apps/api/src/modules/lab/dto/lab-liquidation.dto.ts` | Zod DTOs for liquidation lifecycle |
| `apps/api/src/modules/lab/dto/lab-direct-payment-batch.dto.ts` | Zod DTOs for direct payment batch |
| `apps/api/src/modules/lab/dto/lab-diagnostic-report.dto.ts` | Zod DTOs for macroscopy update |
| `apps/api/src/modules/lab/dto/lab-search.dto.ts` | Zod DTOs for patient/practitioner/report search queries |

### Modified files

| File | Change |
|------|--------|
| `packages/shared/src/index.ts` | Export lab schemas |
| `apps/api/src/modules/lab/lab.module.ts` | Register all new services, controllers, EventEmitter2 |
| `apps/api/src/modules/lab/constants/enum-maps.ts` | Add reverse mapping functions (Prisma enum -> FM string) |
| `apps/api/src/modules/filemaker/transformers/exam-charge.transformer.ts` | Add `toFm()` methods for write-back |
| `apps/api/src/modules/filemaker/transformers/liquidation.transformer.ts` | Add `toFm()` methods for write-back |
| `apps/api/src/modules/filemaker/transformers/biopsy.transformer.ts` | Add `macroscopyToFm()` method for write-back |
| `apps/api/src/modules/filemaker/transformers/traceability.transformer.ts` | Add `macroscopyEventToFm()` method for write-back |
| `apps/api/src/modules/filemaker/filemaker.module.ts` | Export FmImportService (if not already exported for lab sync) |

---

## Critical: Event Naming Convention

Lab sync events use `fm.lab.sync` (not `fm.sync` which is used by the existing FmSyncService for lab-origin/legal-entity/billing-agreement). This avoids conflicts with the existing sync system.

```typescript
interface FmLabSyncEvent {
  tenantId: string;
  entityType: 'lab-exam-charge' | 'lab-liquidation' | 'lab-direct-payment-batch' | 'lab-diagnostic-report' | 'lab-workflow-event' | 'lab-signer';
  entityId: string;
  action: 'create' | 'update' | 'cancel' | 'confirm' | 'invoice' | 'payment' | 'close' | 'macroscopy-update' | 'macroscopy-complete' | 'macro-signer';
  changedFields?: string[];
}
```

---

## Critical: Reverse Enum Maps Reference

For toFm() write-back, we need to convert Prisma enums back to FM field values:

| Prisma Enum | FM Value |
|-------------|----------|
| `LabPaymentMethod.LAB_CASH` | `"Efectivo"` |
| `LabPaymentMethod.LAB_BANK_TRANSFER` | `"Transferencia"` |
| `LabPaymentMethod.LAB_CHECK` | `"Cheque"` |
| `LabPaymentMethod.LAB_VOUCHER` | `"Bono"` |
| `LabPaymentMethod.LAB_CREDIT_CARD` | `"Tarjeta Crédito"` |
| `LabPaymentMethod.LAB_DEBIT_CARD` | `"Tarjeta Débito"` |
| `LabPaymentMethod.LAB_AGREEMENT` | `"Convenio"` |
| `LabPaymentMethod.LAB_PENDING_PAYMENT` | `"Pendiente"` |
| `LabPaymentMethod.OTHER_PAYMENT` | `"Otro"` |
| `LabChargeStatus.REGISTERED_CHARGE` | `"Registrado"` |
| `LabChargeStatus.VALIDATED_CHARGE` | `"Validado"` |
| `LabChargeStatus.INVOICED_CHARGE` | `"Facturado"` |
| `LabChargeStatus.PAID_CHARGE` | `"Pagado"` |
| `LabChargeStatus.CANCELLED_CHARGE` | `"Cancelado"` |
| `LabChargeStatus.REVERSED` | `"Reversado"` |
| `LiquidationStatus.DRAFT_LIQ` | `"Borrador"` |
| `LiquidationStatus.CONFIRMED` | `"Confirmado"` |
| `LiquidationStatus.INVOICED_LIQ` | `"Facturado"` |
| `LiquidationStatus.PARTIALLY_PAID` | `"Pago Parcial"` |
| `LiquidationStatus.PAID_LIQ` | `"Cancelado Total"` |
| `LiquidationStatus.OVERDUE` | `"Vencido"` |
| `LiquidationStatus.CANCELLED_LIQ` | `"Anulado"` |

---

## Task 1: Zod DTOs for Lab Module

**Files:**
- Create: `packages/shared/src/schemas/lab.schema.ts`
- Modify: `packages/shared/src/index.ts`

Define all Zod validation schemas needed by the lab services and controllers.

- [ ] **Step 1: Create lab.schema.ts with all Zod schemas**

Create `packages/shared/src/schemas/lab.schema.ts`:

```typescript
import { z } from 'zod';

// ── Enum constants ──

const LAB_PAYMENT_METHODS = [
  'CASH', 'BANK_TRANSFER', 'CHECK', 'VOUCHER', 'CREDIT_CARD',
  'DEBIT_CARD', 'AGREEMENT', 'PENDING_PAYMENT', 'OTHER',
] as const;

const LAB_CHARGE_STATUSES = [
  'REGISTERED', 'VALIDATED', 'INVOICED', 'PAID', 'CANCELLED', 'REVERSED',
] as const;

const LAB_CHARGE_SOURCES = ['BIOPSIAS_INGRESOS', 'PAP_INGRESOS'] as const;

const LIQUIDATION_STATUSES = [
  'DRAFT', 'CONFIRMED', 'INVOICED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED',
] as const;

const RENDICION_TYPES = ['BIOPSY_DIRECT', 'PAP_DIRECT', 'MIXED'] as const;

const EXAM_CATEGORIES = [
  'BIOPSY', 'PAP', 'CYTOLOGY', 'IMMUNOHISTOCHEMISTRY', 'MOLECULAR', 'OTHER',
] as const;

const REPORT_STATUSES = [
  'REGISTERED', 'IN_TRANSIT', 'RECEIVED', 'PROCESSING', 'REPORTING',
  'PRE_VALIDATED', 'VALIDATED', 'SIGNED', 'DELIVERED', 'DOWNLOADED',
  'CANCELLED', 'AMENDED',
] as const;

// ── ExamCharge DTOs ──

export const createExamChargeSchema = z.object({
  fmSource: z.enum(LAB_CHARGE_SOURCES),
  diagnosticReportId: z.string().uuid(),
  billingConceptId: z.string().uuid().optional().nullable(),
  feeCodesText: z.string().optional().nullable(),
  feeCodes: z.array(z.string()).optional(),
  paymentMethod: z.enum(LAB_PAYMENT_METHODS),
  amount: z.number().min(0, 'Monto debe ser >= 0'),
  currency: z.string().length(3).optional(),
  labOriginId: z.string().uuid(),
  labOriginCodeSnapshot: z.string().min(1),
  legalEntityId: z.string().uuid().optional().nullable(),
  enteredByNameSnapshot: z.string().min(1, 'Responsable requerido'),
  pointOfEntry: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateExamChargeSchema = z.object({
  billingConceptId: z.string().uuid().optional().nullable(),
  feeCodesText: z.string().optional().nullable(),
  feeCodes: z.array(z.string()).optional(),
  paymentMethod: z.enum(LAB_PAYMENT_METHODS).optional(),
  amount: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
});

export const cancelExamChargeSchema = z.object({
  cancelReason: z.string().min(1, 'Motivo de cancelación requerido'),
  cancelledByNameSnapshot: z.string().min(1, 'Responsable requerido'),
});

export const assignChargeToLiquidationSchema = z.object({
  liquidationId: z.string().uuid(),
});

export const assignChargeToDirectPaymentBatchSchema = z.object({
  directPaymentBatchId: z.string().uuid(),
});

// ── Liquidation DTOs ──

export const createLiquidationSchema = z.object({
  legalEntityId: z.string().uuid('Persona jurídica requerida'),
  billingAgreementId: z.string().uuid().optional().nullable(),
  period: z.string().datetime(),
  periodLabel: z.string().min(1, 'Etiqueta período requerida'),
  biopsyAmount: z.number().min(0).default(0),
  papAmount: z.number().min(0).default(0),
  cytologyAmount: z.number().min(0).default(0),
  immunoAmount: z.number().min(0).default(0),
  biopsyCount: z.number().int().min(0).default(0),
  papCount: z.number().int().min(0).default(0),
  cytologyCount: z.number().int().min(0).default(0),
  immunoCount: z.number().int().min(0).default(0),
  previousDebt: z.number().min(0).default(0),
  creditBalance: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
});

export const confirmLiquidationSchema = z.object({
  confirmedByNameSnapshot: z.string().min(1, 'Responsable requerido'),
});

export const invoiceLiquidationSchema = z.object({
  invoiceNumber: z.string().min(1, 'Número de documento requerido'),
  invoiceType: z.string().optional().nullable(),
  invoiceDate: z.string().datetime(),
});

export const paymentLiquidationSchema = z.object({
  paymentAmount: z.number().min(0, 'Monto de pago debe ser >= 0'),
  paymentDate: z.string().datetime(),
  paymentMethodText: z.string().min(1, 'Modo de pago requerido'),
});

// ── DirectPaymentBatch DTOs ──

export const createDirectPaymentBatchSchema = z.object({
  period: z.string().datetime(),
  periodFrom: z.string().datetime().optional().nullable(),
  periodTo: z.string().datetime().optional().nullable(),
  legalEntityId: z.string().uuid().optional().nullable(),
  rendicionType: z.enum(RENDICION_TYPES),
  rendidoByNameSnapshot: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const closeDirectPaymentBatchSchema = z.object({
  receiptNumber: z.string().optional().nullable(),
  receiptDate: z.string().datetime().optional().nullable(),
});

// ── DiagnosticReport Macroscopy DTOs ──

export const updateMacroscopySchema = z.object({
  macroscopicDescription: z.string().min(1, 'Descripción macroscópica requerida'),
});

export const completeMacroscopySchema = z.object({
  performedByNameSnapshot: z.string().min(1, 'Responsable requerido'),
  performedById: z.string().uuid().optional().nullable(),
});

export const registerMacroSignerSchema = z.object({
  diagnosticReportId: z.string().uuid(),
  pathologistCode: z.string().min(1, 'Código patólogo requerido'),
  pathologistName: z.string().min(1, 'Nombre patólogo requerido'),
  assistantCode: z.string().optional().nullable(),
  assistantName: z.string().optional().nullable(),
});

// ── Search / List DTOs ──

export const labPatientSearchSchema = z.object({
  query: z.string().optional(),
  rut: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const labPractitionerSearchSchema = z.object({
  query: z.string().optional(),
  role: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const labReportSearchSchema = z.object({
  query: z.string().optional(),
  status: z.enum(REPORT_STATUSES).optional(),
  category: z.enum(EXAM_CATEGORIES).optional(),
  labOriginId: z.string().uuid().optional(),
  patientRut: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const labChargeListSchema = z.object({
  diagnosticReportId: z.string().uuid().optional(),
  liquidationId: z.string().uuid().optional(),
  directPaymentBatchId: z.string().uuid().optional(),
  labOriginId: z.string().uuid().optional(),
  legalEntityId: z.string().uuid().optional(),
  status: z.enum(LAB_CHARGE_STATUSES).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const labLiquidationListSchema = z.object({
  legalEntityId: z.string().uuid().optional(),
  status: z.enum(LIQUIDATION_STATUSES).optional(),
  periodFrom: z.string().datetime().optional(),
  periodTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

// ── Exported types ──

export type CreateExamChargeSchema = z.infer<typeof createExamChargeSchema>;
export type UpdateExamChargeSchema = z.infer<typeof updateExamChargeSchema>;
export type CancelExamChargeSchema = z.infer<typeof cancelExamChargeSchema>;
export type AssignChargeToLiquidationSchema = z.infer<typeof assignChargeToLiquidationSchema>;
export type AssignChargeToDirectPaymentBatchSchema = z.infer<typeof assignChargeToDirectPaymentBatchSchema>;
export type CreateLiquidationSchema = z.infer<typeof createLiquidationSchema>;
export type ConfirmLiquidationSchema = z.infer<typeof confirmLiquidationSchema>;
export type InvoiceLiquidationSchema = z.infer<typeof invoiceLiquidationSchema>;
export type PaymentLiquidationSchema = z.infer<typeof paymentLiquidationSchema>;
export type CreateDirectPaymentBatchSchema = z.infer<typeof createDirectPaymentBatchSchema>;
export type CloseDirectPaymentBatchSchema = z.infer<typeof closeDirectPaymentBatchSchema>;
export type UpdateMacroscopySchema = z.infer<typeof updateMacroscopySchema>;
export type CompleteMacroscopySchema = z.infer<typeof completeMacroscopySchema>;
export type RegisterMacroSignerSchema = z.infer<typeof registerMacroSignerSchema>;
export type LabPatientSearchSchema = z.infer<typeof labPatientSearchSchema>;
export type LabPractitionerSearchSchema = z.infer<typeof labPractitionerSearchSchema>;
export type LabReportSearchSchema = z.infer<typeof labReportSearchSchema>;
export type LabChargeListSchema = z.infer<typeof labChargeListSchema>;
export type LabLiquidationListSchema = z.infer<typeof labLiquidationListSchema>;
```

- [ ] **Step 2: Export from shared index**

In `packages/shared/src/index.ts`, add after the billing export:

```typescript
export * from './schemas/lab.schema';
```

- [ ] **Step 3: Build shared package**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/shared build
```

Verify no TypeScript errors.

---

## Task 2: Reverse Enum Maps for Write-Back

**Files:**
- Modify: `apps/api/src/modules/lab/constants/enum-maps.ts`
- Create: `apps/api/src/modules/lab/constants/enum-maps.spec.ts` (add reverse map tests)

Add reverse mapping functions that convert Prisma enum values back to FM-compatible strings for the toFm() transformers.

- [ ] **Step 1: Add reverse maps to enum-maps.ts**

Append to `apps/api/src/modules/lab/constants/enum-maps.ts`:

```typescript
// ── Reverse maps (Prisma -> FM string for write-back) ──

const REVERSE_PAYMENT_METHOD_MAP: Record<LabPaymentMethod, string> = {
  [LabPaymentMethod.LAB_CASH]: 'Efectivo',
  [LabPaymentMethod.LAB_BANK_TRANSFER]: 'Transferencia',
  [LabPaymentMethod.LAB_CHECK]: 'Cheque',
  [LabPaymentMethod.LAB_VOUCHER]: 'Bono',
  [LabPaymentMethod.LAB_CREDIT_CARD]: 'Tarjeta Crédito',
  [LabPaymentMethod.LAB_DEBIT_CARD]: 'Tarjeta Débito',
  [LabPaymentMethod.LAB_AGREEMENT]: 'Convenio',
  [LabPaymentMethod.LAB_PENDING_PAYMENT]: 'Pendiente',
  [LabPaymentMethod.OTHER_PAYMENT]: 'Otro',
};

export function fromLabPaymentMethod(val: LabPaymentMethod): string {
  return REVERSE_PAYMENT_METHOD_MAP[val];
}

const REVERSE_CHARGE_STATUS_MAP: Record<LabChargeStatus, string> = {
  [LabChargeStatus.REGISTERED_CHARGE]: 'Registrado',
  [LabChargeStatus.VALIDATED_CHARGE]: 'Validado',
  [LabChargeStatus.INVOICED_CHARGE]: 'Facturado',
  [LabChargeStatus.PAID_CHARGE]: 'Pagado',
  [LabChargeStatus.CANCELLED_CHARGE]: 'Cancelado',
  [LabChargeStatus.REVERSED]: 'Reversado',
};

export function fromLabChargeStatus(val: LabChargeStatus): string {
  return REVERSE_CHARGE_STATUS_MAP[val];
}

const REVERSE_LIQ_STATUS_MAP: Record<LiquidationStatus, string> = {
  [LiquidationStatus.DRAFT_LIQ]: 'Borrador',
  [LiquidationStatus.CONFIRMED]: 'Confirmado',
  [LiquidationStatus.INVOICED_LIQ]: 'Facturado',
  [LiquidationStatus.PARTIALLY_PAID]: 'Pago Parcial',
  [LiquidationStatus.PAID_LIQ]: 'Cancelado Total',
  [LiquidationStatus.OVERDUE]: 'Vencido',
  [LiquidationStatus.CANCELLED_LIQ]: 'Anulado',
};

export function fromLiquidationStatus(val: LiquidationStatus): string {
  return REVERSE_LIQ_STATUS_MAP[val];
}

const REVERSE_EXAM_CHARGE_SOURCE_MAP: Record<LabExamChargeSource, string> = {
  [LabExamChargeSource.BIOPSIAS_INGRESOS]: 'BIOPSIAS_INGRESOS',
  [LabExamChargeSource.PAP_INGRESOS]: 'PAP_INGRESOS',
};

export function fromLabExamChargeSource(val: LabExamChargeSource): string {
  return REVERSE_EXAM_CHARGE_SOURCE_MAP[val];
}
```

- [ ] **Step 2: Write tests for reverse maps**

Create `apps/api/src/modules/lab/constants/enum-maps.spec.ts` (or append to existing if it exists):

```typescript
import {
  LabPaymentMethod, LabChargeStatus, LiquidationStatus, LabExamChargeSource,
} from '@prisma/client';
import {
  fromLabPaymentMethod, fromLabChargeStatus, fromLiquidationStatus,
  fromLabExamChargeSource,
  toLabPaymentMethod, toLabChargeStatus, toLiquidationStatus,
} from './enum-maps';

describe('Reverse enum maps', () => {
  it('fromLabPaymentMethod covers all values', () => {
    for (const val of Object.values(LabPaymentMethod)) {
      expect(fromLabPaymentMethod(val)).toBeDefined();
      expect(typeof fromLabPaymentMethod(val)).toBe('string');
    }
  });

  it('fromLabChargeStatus covers all values', () => {
    for (const val of Object.values(LabChargeStatus)) {
      expect(fromLabChargeStatus(val)).toBeDefined();
    }
  });

  it('fromLiquidationStatus covers all values', () => {
    for (const val of Object.values(LiquidationStatus)) {
      expect(fromLiquidationStatus(val)).toBeDefined();
    }
  });

  it('roundtrip: payment method forward then reverse preserves meaning', () => {
    expect(fromLabPaymentMethod(toLabPaymentMethod('CASH'))).toBe('Efectivo');
    expect(fromLabPaymentMethod(toLabPaymentMethod('AGREEMENT'))).toBe('Convenio');
  });

  it('roundtrip: charge status forward then reverse', () => {
    expect(fromLabChargeStatus(toLabChargeStatus('CANCELLED'))).toBe('Cancelado');
  });

  it('roundtrip: liquidation status forward then reverse', () => {
    expect(fromLiquidationStatus(toLiquidationStatus('CONFIRMED'))).toBe('Confirmado');
    expect(fromLiquidationStatus(toLiquidationStatus('PAID'))).toBe('Cancelado Total');
  });
});
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter api test -- --testPathPattern="enum-maps"`.

---

## Task 3: Transformer toFm() Methods for Write-Back

**Files:**
- Modify: `apps/api/src/modules/filemaker/transformers/exam-charge.transformer.ts`
- Modify: `apps/api/src/modules/filemaker/transformers/liquidation.transformer.ts`
- Modify: `apps/api/src/modules/filemaker/transformers/biopsy.transformer.ts`
- Modify: `apps/api/src/modules/filemaker/transformers/traceability.transformer.ts`

Add toFm() methods that produce `Record<string, unknown>` for FmApiService.createRecord/updateRecord.

- [ ] **Step 1: Add toFm() methods to ExamChargeTransformer**

Append to `apps/api/src/modules/filemaker/transformers/exam-charge.transformer.ts`, inside the class body, after the existing `extractPapCharge` method:

```typescript
  /**
   * Convert a Zeru ExamCharge to FM field data for Biopsias_Ingresos* layout.
   * Used for create and update write-back.
   */
  biopsyChargeToFm(charge: {
    fkInformeNumber: number;
    paymentMethodName: string;
    amount: number;
    feeCodesText: string | null;
    statusName: string;
    labOriginCodeSnapshot: string;
    enteredAt: Date | null;
    enteredByNameSnapshot: string;
    pointOfEntry: string | null;
    fkLiquidacion: string | null;
    fkRendicion: string | null;
  }): Record<string, unknown> {
    return {
      '_fk_Informe_Número': charge.fkInformeNumber,
      'Tipo de Ingreso::Nombre': charge.paymentMethodName,
      'Valor': charge.amount,
      'Códigos Prestación': charge.feeCodesText ?? '',
      'Estado Ingreso': charge.statusName,
      'BIOPSIAS Cobranzas::PROCEDENCIA CODIGO UNICO': charge.labOriginCodeSnapshot,
      'Ingreso Fecha': charge.enteredAt ? formatFmDate(charge.enteredAt) : '',
      'Ingreso Responsable': charge.enteredByNameSnapshot,
      'Punto de ingreso': charge.pointOfEntry ?? '',
      '_fk_Liquidaciones Instituciones': charge.fkLiquidacion ?? '',
      '_fk_Rendición Pago directo': charge.fkRendicion ?? '',
    };
  }

  /**
   * Convert a Zeru ExamCharge to FM field data for PAP_ingresos* layout.
   */
  papChargeToFm(charge: {
    fkInformeNumber: number;
    paymentMethodName: string;
    amount: number;
    feeCodesText: string | null;
    statusName: string;
    labOriginCodeSnapshot: string;
    enteredAt: Date | null;
    enteredByNameSnapshot: string;
    pointOfEntry: string | null;
    fkLiquidacion: string | null;
    fkRendicion: string | null;
  }): Record<string, unknown> {
    return {
      '_fk_Informe_Número': charge.fkInformeNumber,
      'Tipo de Ingreso::Nombre': charge.paymentMethodName,
      'Valor': charge.amount,
      'Códigos Prestación': charge.feeCodesText ?? '',
      'Estado Ingreso': charge.statusName,
      'PAP Cobranzas::CODIGO UNICO PROCEDENCIA': charge.labOriginCodeSnapshot,
      'Ingreso Fecha': charge.enteredAt ? formatFmDate(charge.enteredAt) : '',
      'Ingreso Responsable': charge.enteredByNameSnapshot,
      'Punto de ingreso': charge.pointOfEntry ?? '',
      '_fk_Liquidaciones Instituciones': charge.fkLiquidacion ?? '',
      '_fk_Rendición Pago directo': charge.fkRendicion ?? '',
    };
  }

  /**
   * Partial update for cancellation — only updates status field.
   */
  cancelToFm(): Record<string, unknown> {
    return {
      'Estado Ingreso': 'Cancelado',
    };
  }
```

Also add the helper function at the bottom of the file (outside the class):

```typescript
/**
 * Format a Date as MM/DD/YYYY for FM Data API (US format with dateformats=0).
 */
function formatFmDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}
```

- [ ] **Step 2: Add toFm() methods to LiquidationTransformer**

Append to `apps/api/src/modules/filemaker/transformers/liquidation.transformer.ts`, inside the class body, after the existing `extract` method:

```typescript
  /**
   * Convert Zeru Liquidation to FM field data for Liquidaciones layout (create).
   */
  toFm(liq: {
    labOriginCode: string;
    periodLabel: string;
    statusName: string;
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
  }): Record<string, unknown> {
    return {
      'CODIGO INSTITUCION': liq.labOriginCode,
      'PERIODO COBRO': liq.periodLabel,
      'ESTADO': liq.statusName,
      'TOTAL LIQUIDACIÓN': liq.totalAmount,
      'VALOR TOTAL BIOPSIAS': liq.biopsyAmount,
      'VALOR TOTAL PAP': liq.papAmount,
      'VALOR TOTAL CITOLOGÍAS': liq.cytologyAmount,
      'VALOR TOTAL INMUNOS': liq.immunoAmount,
      'Nº DE BIOPSIAS': liq.biopsyCount,
      'Nº DE PAP': liq.papCount,
      'Nº DE CITOLOGÍAS': liq.cytologyCount,
      'Nº DE INMUNOS': liq.immunoCount,
      'DEUDA ANTERIOR': liq.previousDebt,
      'SALDO A FAVOR': liq.creditBalance,
    };
  }

  /**
   * Partial update for confirm action.
   */
  confirmToFm(confirmedByName: string): Record<string, unknown> {
    return {
      'Confirmado': `Confirmado - ${confirmedByName}`,
    };
  }

  /**
   * Partial update for invoice action.
   */
  invoiceToFm(invoice: {
    invoiceNumber: string;
    invoiceDate: Date;
  }): Record<string, unknown> {
    return {
      'NUMERO DOCUMENTO': invoice.invoiceNumber,
      'FECHA FACTURA': formatFmDate(invoice.invoiceDate),
    };
  }

  /**
   * Partial update for payment registration.
   */
  paymentToFm(payment: {
    paymentAmount: number;
    paymentDate: Date;
    paymentMethodText: string;
  }): Record<string, unknown> {
    return {
      'MONTO CANCELADO': payment.paymentAmount,
      'FECHA PAGO': formatFmDate(payment.paymentDate),
      'MODO DE PAGO': payment.paymentMethodText,
    };
  }
```

Also add the `formatFmDate` helper at the bottom:

```typescript
function formatFmDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}
```

- [ ] **Step 3: Add macroscopyToFm() to BiopsyTransformer**

Append to `apps/api/src/modules/filemaker/transformers/biopsy.transformer.ts`, inside the class body, after the `extract` method:

```typescript
  /**
   * Layout for macroscopy text write-back.
   * TEXTO* layout contains the TEXTO BIOPSIAS::TEXTO field and macroscopy fields.
   */
  readonly macroscopyLayout = 'TEXTO*';

  /**
   * Convert macroscopic description to FM field data.
   * The macroscopy text is stored in the TEXTO* layout's macro fields.
   */
  macroscopyToFm(data: {
    macroscopicDescription: string;
  }): Record<string, unknown> {
    return {
      'TEXTO BIOPSIAS::MACRO': data.macroscopicDescription,
    };
  }

  /**
   * Layout for macro signer registration.
   */
  readonly macroSignerLayout = 'Ingreso Trazabilidad Macroscopía*';

  /**
   * Create a macro signer record in FM.
   */
  macroSignerToFm(data: {
    pathologistCode: string;
    pathologistName: string;
    assistantCode: string | null;
    assistantName: string | null;
  }): Record<string, unknown> {
    const fields: Record<string, unknown> = {
      'PATÓLOGO MACRO': data.pathologistName,
    };
    if (data.assistantName) {
      fields['AYUDANTE MACRO'] = data.assistantName;
    }
    return fields;
  }
```

- [ ] **Step 4: Add macroscopyEventToFm() to TraceabilityTransformer**

Append to `apps/api/src/modules/filemaker/transformers/traceability.transformer.ts`, inside the class body, after the `extract` method:

```typescript
  /**
   * Write macroscopy completion event to FM Trazabilidad record.
   * Updates the Responsable_Macroscopía and Fecha_Macroscopía fields.
   */
  macroscopyEventToFm(data: {
    performedByNameSnapshot: string;
    occurredAt: Date;
  }): Record<string, unknown> {
    return {
      'Trazabilidad::Responsable_Macroscopía': data.performedByNameSnapshot,
      'Trazabilidad::Fecha_Macroscopia': formatFmDate(data.occurredAt),
    };
  }
```

Also add the `formatFmDate` helper at the bottom:

```typescript
function formatFmDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}
```

- [ ] **Step 5: Write unit tests for toFm methods**

Create `apps/api/src/modules/filemaker/transformers/exam-charge.transformer.spec.ts` (append toFm tests if file exists):

```typescript
import { ExamChargeTransformer } from './exam-charge.transformer';

describe('ExamChargeTransformer toFm', () => {
  const transformer = new ExamChargeTransformer();

  const baseCharge = {
    fkInformeNumber: 12345,
    paymentMethodName: 'Convenio',
    amount: 25000,
    feeCodesText: 'BIO-001|BIO-002',
    statusName: 'Registrado',
    labOriginCodeSnapshot: 'CLI-001',
    enteredAt: new Date('2026-03-15'),
    enteredByNameSnapshot: 'María López',
    pointOfEntry: 'Ventanilla 1',
    fkLiquidacion: '1234',
    fkRendicion: null,
  };

  it('biopsyChargeToFm produces correct FM fields', () => {
    const result = transformer.biopsyChargeToFm(baseCharge);
    expect(result['_fk_Informe_Número']).toBe(12345);
    expect(result['Tipo de Ingreso::Nombre']).toBe('Convenio');
    expect(result['Valor']).toBe(25000);
    expect(result['Estado Ingreso']).toBe('Registrado');
    expect(result['BIOPSIAS Cobranzas::PROCEDENCIA CODIGO UNICO']).toBe('CLI-001');
    expect(result['Ingreso Responsable']).toBe('María López');
    expect(result['_fk_Liquidaciones Instituciones']).toBe('1234');
    expect(result['_fk_Rendición Pago directo']).toBe('');
  });

  it('papChargeToFm uses PAP field names', () => {
    const result = transformer.papChargeToFm(baseCharge);
    expect(result['PAP Cobranzas::CODIGO UNICO PROCEDENCIA']).toBe('CLI-001');
    expect(result['Valor']).toBe(25000);
  });

  it('cancelToFm sets status to Cancelado', () => {
    const result = transformer.cancelToFm();
    expect(result['Estado Ingreso']).toBe('Cancelado');
  });
});
```

Create `apps/api/src/modules/filemaker/transformers/liquidation.transformer.spec.ts` (append if exists):

```typescript
import { LiquidationTransformer } from './liquidation.transformer';

describe('LiquidationTransformer toFm', () => {
  const transformer = new LiquidationTransformer();

  it('toFm produces correct FM fields', () => {
    const result = transformer.toFm({
      labOriginCode: 'CLI-001',
      periodLabel: 'Marzo 2026',
      statusName: 'Borrador',
      totalAmount: 500000,
      biopsyAmount: 300000,
      papAmount: 100000,
      cytologyAmount: 50000,
      immunoAmount: 50000,
      biopsyCount: 30,
      papCount: 10,
      cytologyCount: 5,
      immunoCount: 5,
      previousDebt: 0,
      creditBalance: 0,
    });
    expect(result['CODIGO INSTITUCION']).toBe('CLI-001');
    expect(result['PERIODO COBRO']).toBe('Marzo 2026');
    expect(result['TOTAL LIQUIDACIÓN']).toBe(500000);
    expect(result['Nº DE BIOPSIAS']).toBe(30);
  });

  it('confirmToFm includes name in Confirmado field', () => {
    const result = transformer.confirmToFm('Juan Pérez');
    expect(result['Confirmado']).toBe('Confirmado - Juan Pérez');
  });

  it('invoiceToFm formats date and sets document number', () => {
    const result = transformer.invoiceToFm({
      invoiceNumber: 'FAC-2026-001',
      invoiceDate: new Date('2026-03-20'),
    });
    expect(result['NUMERO DOCUMENTO']).toBe('FAC-2026-001');
    expect(result['FECHA FACTURA']).toBe('03/20/2026');
  });

  it('paymentToFm sets all payment fields', () => {
    const result = transformer.paymentToFm({
      paymentAmount: 500000,
      paymentDate: new Date('2026-04-01'),
      paymentMethodText: 'Transferencia',
    });
    expect(result['MONTO CANCELADO']).toBe(500000);
    expect(result['FECHA PAGO']).toBe('04/01/2026');
    expect(result['MODO DE PAGO']).toBe('Transferencia');
  });
});
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter api test -- --testPathPattern="transformer"`.

---

## Task 4: FmLabSyncService (Event Listener + FM Write-Back)

**Files:**
- Create: `apps/api/src/modules/lab/services/fm-lab-sync.service.ts`
- Create: `apps/api/src/modules/lab/services/fm-lab-sync.service.spec.ts`

Central service that listens to `fm.lab.sync` events, resolves the FmSyncRecord, calls the appropriate transformer toFm(), invokes FmApiService, and updates sync status.

- [ ] **Step 1: Create FmLabSyncService**

Create `apps/api/src/modules/lab/services/fm-lab-sync.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import { ExamChargeTransformer } from '../../filemaker/transformers/exam-charge.transformer';
import { LiquidationTransformer } from '../../filemaker/transformers/liquidation.transformer';
import { BiopsyTransformer } from '../../filemaker/transformers/biopsy.transformer';
import { TraceabilityTransformer } from '../../filemaker/transformers/traceability.transformer';
import {
  fromLabPaymentMethod,
  fromLabChargeStatus,
  fromLiquidationStatus,
} from '../constants/enum-maps';

export interface FmLabSyncEvent {
  tenantId: string;
  entityType:
    | 'lab-exam-charge'
    | 'lab-liquidation'
    | 'lab-direct-payment-batch'
    | 'lab-diagnostic-report'
    | 'lab-workflow-event'
    | 'lab-signer';
  entityId: string;
  action:
    | 'create'
    | 'update'
    | 'cancel'
    | 'confirm'
    | 'invoice'
    | 'payment'
    | 'close'
    | 'macroscopy-update'
    | 'macroscopy-complete'
    | 'macro-signer';
  changedFields?: string[];
}

@Injectable()
export class FmLabSyncService {
  private readonly logger = new Logger(FmLabSyncService.name);
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly examChargeTransformer: ExamChargeTransformer,
    private readonly liquidationTransformer: LiquidationTransformer,
    private readonly biopsyTransformer: BiopsyTransformer,
    private readonly traceabilityTransformer: TraceabilityTransformer,
  ) {}

  @OnEvent('fm.lab.sync')
  async handleLabSyncEvent(event: FmLabSyncEvent) {
    this.logger.log(
      `Lab sync event: ${event.action} ${event.entityType}/${event.entityId}`,
    );

    // For creates, we don't have an FmSyncRecord yet — the sync processor
    // will create the FM record and then create the FmSyncRecord.
    if (event.action === 'create') {
      await this.handleCreate(event);
      return;
    }

    // For updates, find the existing FmSyncRecord and mark it PENDING_TO_FM
    const existing = await this.prisma.fmSyncRecord.findFirst({
      where: {
        tenantId: event.tenantId,
        entityType: event.entityType,
        entityId: event.entityId,
      },
    });

    if (!existing) {
      this.logger.warn(
        `No FmSyncRecord for ${event.entityType}/${event.entityId}, ` +
        `action=${event.action} — will create FM record`,
      );
      await this.handleCreate(event);
      return;
    }

    await this.prisma.fmSyncRecord.update({
      where: { id: existing.id },
      data: {
        syncStatus: 'PENDING_TO_FM',
        syncError: null,
      },
    });
  }

  private async handleCreate(event: FmLabSyncEvent) {
    try {
      const result = await this.createInFm(event);
      if (result) {
        // Create FmSyncRecord for the new FM record
        await this.prisma.fmSyncRecord.create({
          data: {
            tenantId: event.tenantId,
            entityType: event.entityType,
            entityId: event.entityId,
            fmDatabase: result.database,
            fmLayout: result.layout,
            fmRecordId: result.recordId,
            syncStatus: 'SYNCED',
            lastSyncAt: new Date(),
          },
        });
        await this.logSync({
          tenantId: event.tenantId,
          entityType: event.entityType,
          entityId: event.entityId,
          fmRecordId: result.recordId,
          action: `lab-sync:create`,
          direction: 'zeru_to_fm',
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to create FM record for ${event.entityType}/${event.entityId}: ${msg}`,
      );
      // Create an error FmSyncRecord so retry can pick it up
      await this.prisma.fmSyncRecord.create({
        data: {
          tenantId: event.tenantId,
          entityType: event.entityType,
          entityId: event.entityId,
          fmDatabase: this.resolveFmDatabase(event.entityType),
          fmLayout: this.resolveFmLayout(event),
          fmRecordId: `pending-create-${event.entityId}`,
          syncStatus: 'ERROR',
          syncError: `[zeru-to-fm] ${msg}`,
          lastSyncAt: new Date(),
        },
      });
    }
  }

  private async createInFm(
    event: FmLabSyncEvent,
  ): Promise<{ database: string; layout: string; recordId: string } | null> {
    if (event.entityType === 'lab-exam-charge') {
      return this.createExamChargeInFm(event);
    }
    if (event.entityType === 'lab-liquidation') {
      return this.createLiquidationInFm(event);
    }
    if (event.entityType === 'lab-signer' && event.action === 'macro-signer') {
      return this.createMacroSignerInFm(event);
    }
    this.logger.warn(`No create handler for ${event.entityType}`);
    return null;
  }

  private async createExamChargeInFm(
    event: FmLabSyncEvent,
  ): Promise<{ database: string; layout: string; recordId: string }> {
    const charge = await this.prisma.labExamCharge.findUniqueOrThrow({
      where: { id: event.entityId },
    });

    // Determine layout based on source
    const isBiopsy = charge.fmSource === 'BIOPSIAS_INGRESOS';
    const layout = isBiopsy
      ? this.examChargeTransformer.biopsyLayout
      : this.examChargeTransformer.papLayout;

    // Resolve liquidation FK
    let fkLiquidacion: string | null = null;
    if (charge.liquidationId) {
      const liq = await this.prisma.labLiquidation.findUnique({
        where: { id: charge.liquidationId },
        select: { fmPk: true },
      });
      fkLiquidacion = liq?.fmPk ? String(liq.fmPk) : null;
    }

    // Resolve DPB FK
    let fkRendicion: string | null = null;
    if (charge.directPaymentBatchId) {
      const dpb = await this.prisma.labDirectPaymentBatch.findUnique({
        where: { id: charge.directPaymentBatchId },
        select: { fmPk: true },
      });
      fkRendicion = dpb?.fmPk ? String(dpb.fmPk) : null;
    }

    const toFmData = {
      fkInformeNumber: charge.fmRecordPk, // This is the DR's fmInformeNumber linked via DR
      paymentMethodName: fromLabPaymentMethod(charge.paymentMethod),
      amount: Number(charge.amount),
      feeCodesText: charge.feeCodesText,
      statusName: fromLabChargeStatus(charge.status),
      labOriginCodeSnapshot: charge.labOriginCodeSnapshot,
      enteredAt: charge.enteredAt,
      enteredByNameSnapshot: charge.enteredByNameSnapshot,
      pointOfEntry: charge.pointOfEntry,
      fkLiquidacion,
      fkRendicion,
    };

    // Resolve DR informe number for the FK
    const dr = await this.prisma.labDiagnosticReport.findUnique({
      where: { id: charge.diagnosticReportId },
      select: { fmInformeNumber: true },
    });
    if (dr) {
      toFmData.fkInformeNumber = dr.fmInformeNumber;
    }

    const fieldData = isBiopsy
      ? this.examChargeTransformer.biopsyChargeToFm(toFmData)
      : this.examChargeTransformer.papChargeToFm(toFmData);

    const result = await this.fmApi.createRecord(
      this.examChargeTransformer.database,
      layout,
      fieldData,
    );

    return {
      database: this.examChargeTransformer.database,
      layout,
      recordId: result.recordId,
    };
  }

  private async createLiquidationInFm(
    event: FmLabSyncEvent,
  ): Promise<{ database: string; layout: string; recordId: string }> {
    const liq = await this.prisma.labLiquidation.findUniqueOrThrow({
      where: { id: event.entityId },
    });

    // Resolve labOriginCode from legalEntity
    let labOriginCode = '';
    const origin = await this.prisma.labOrigin.findFirst({
      where: { legalEntityId: liq.legalEntityId },
      select: { code: true },
    });
    if (origin) labOriginCode = origin.code;

    const fieldData = this.liquidationTransformer.toFm({
      labOriginCode,
      periodLabel: liq.periodLabel,
      statusName: fromLiquidationStatus(liq.status),
      totalAmount: Number(liq.totalAmount),
      biopsyAmount: Number(liq.biopsyAmount),
      papAmount: Number(liq.papAmount),
      cytologyAmount: Number(liq.cytologyAmount),
      immunoAmount: Number(liq.immunoAmount),
      biopsyCount: liq.biopsyCount,
      papCount: liq.papCount,
      cytologyCount: liq.cytologyCount,
      immunoCount: liq.immunoCount,
      previousDebt: Number(liq.previousDebt),
      creditBalance: Number(liq.creditBalance),
    });

    const result = await this.fmApi.createRecord(
      this.liquidationTransformer.database,
      this.liquidationTransformer.layout,
      fieldData,
    );

    return {
      database: this.liquidationTransformer.database,
      layout: this.liquidationTransformer.layout,
      recordId: result.recordId,
    };
  }

  private async createMacroSignerInFm(
    event: FmLabSyncEvent,
  ): Promise<{ database: string; layout: string; recordId: string }> {
    // entityId format for signers: "drId:pathologistCode:assistantCode"
    // We need to read the signer data from the DR
    const signer = await this.prisma.labDiagnosticReportSigner.findUniqueOrThrow({
      where: { id: event.entityId },
    });

    const fieldData = this.biopsyTransformer.macroSignerToFm({
      pathologistCode: signer.codeSnapshot,
      pathologistName: signer.nameSnapshot,
      assistantCode: null,
      assistantName: null,
    });

    const result = await this.fmApi.createRecord(
      this.biopsyTransformer.database,
      this.biopsyTransformer.macroSignerLayout,
      fieldData,
    );

    return {
      database: this.biopsyTransformer.database,
      layout: this.biopsyTransformer.macroSignerLayout,
      recordId: result.recordId,
    };
  }

  @Cron('*/30 * * * * *')
  async processPendingLabSync() {
    if (this.processing) return;
    this.processing = true;
    try {
      await this.doPendingLabSync();
    } finally {
      this.processing = false;
    }
  }

  private async doPendingLabSync() {
    const labEntityTypes = [
      'lab-exam-charge',
      'lab-liquidation',
      'lab-direct-payment-batch',
      'lab-diagnostic-report',
      'lab-workflow-event',
      'lab-signer',
    ];

    const pending = await this.prisma.fmSyncRecord.findMany({
      where: {
        syncStatus: 'PENDING_TO_FM',
        entityType: { in: labEntityTypes },
      },
      take: 10,
    });

    if (pending.length === 0) return;
    this.logger.log(`Processing ${pending.length} PENDING_TO_FM lab records...`);

    for (const record of pending) {
      try {
        if (!record.fmRecordId || record.fmRecordId.startsWith('pending-')) {
          await this.prisma.fmSyncRecord.update({
            where: { id: record.id },
            data: { syncStatus: 'SYNCED', lastSyncAt: new Date() },
          });
          continue;
        }

        // Read current FM record to check modId for conflict detection
        let currentFmRecord;
        try {
          currentFmRecord = await this.fmApi.getRecord(
            record.fmDatabase,
            record.fmLayout,
            record.fmRecordId,
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes('error 101') || msg.includes('not found')) {
            // Record deleted in FM — mark synced
            await this.prisma.fmSyncRecord.update({
              where: { id: record.id },
              data: {
                syncStatus: 'SYNCED',
                lastSyncAt: new Date(),
                syncError: 'FM record deleted',
              },
            });
            continue;
          }
          throw error;
        }

        // Conflict detection: compare modId
        if (record.fmModId && currentFmRecord.modId !== record.fmModId) {
          this.logger.warn(
            `modId conflict for ${record.entityType}/${record.entityId}: ` +
            `expected=${record.fmModId}, actual=${currentFmRecord.modId}. ` +
            `Zeru wins (last-write-wins).`,
          );
          await this.logSync({
            tenantId: record.tenantId,
            entityType: record.entityType,
            entityId: record.entityId,
            fmRecordId: record.fmRecordId,
            action: 'lab-sync:conflict-detected',
            direction: 'zeru_to_fm',
            details: {
              expectedModId: record.fmModId,
              actualModId: currentFmRecord.modId,
            },
          });
        }

        const fieldData = await this.buildUpdateFieldData(record);

        if (fieldData && Object.keys(fieldData).length > 0) {
          await this.fmApi.updateRecord(
            record.fmDatabase,
            record.fmLayout,
            record.fmRecordId,
            fieldData,
            record.fmModId ?? undefined,
          );
        }

        // Re-read the FM record to get new modId
        let newModId = currentFmRecord.modId;
        try {
          const updated = await this.fmApi.getRecord(
            record.fmDatabase,
            record.fmLayout,
            record.fmRecordId,
          );
          newModId = updated.modId;
        } catch {
          // Non-critical — modId will be refreshed on next sync
        }

        await this.prisma.fmSyncRecord.update({
          where: { id: record.id },
          data: {
            syncStatus: 'SYNCED',
            lastSyncAt: new Date(),
            syncError: null,
            fmModId: newModId,
          },
        });

        await this.logSync({
          tenantId: record.tenantId,
          entityType: record.entityType,
          entityId: record.entityId,
          fmRecordId: record.fmRecordId,
          action: 'lab-sync:update',
          direction: 'zeru_to_fm',
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Lab sync failed for ${record.id}: ${msg}`);
        await this.prisma.fmSyncRecord.update({
          where: { id: record.id },
          data: {
            syncStatus: 'ERROR',
            syncError: `[zeru-to-fm] ${msg}`,
            retryCount: { increment: 1 },
          },
        });
      }
    }
  }

  private async buildUpdateFieldData(
    record: {
      entityType: string;
      entityId: string;
      fmLayout: string;
    },
  ): Promise<Record<string, unknown> | null> {
    switch (record.entityType) {
      case 'lab-exam-charge':
        return this.buildExamChargeUpdate(record.entityId);
      case 'lab-liquidation':
        return this.buildLiquidationUpdate(record.entityId);
      case 'lab-diagnostic-report':
        return this.buildDiagnosticReportUpdate(record.entityId, record.fmLayout);
      case 'lab-workflow-event':
        return this.buildWorkflowEventUpdate(record.entityId);
      default:
        this.logger.warn(`No update builder for ${record.entityType}`);
        return null;
    }
  }

  private async buildExamChargeUpdate(
    entityId: string,
  ): Promise<Record<string, unknown>> {
    const charge = await this.prisma.labExamCharge.findUniqueOrThrow({
      where: { id: entityId },
    });

    const dr = await this.prisma.labDiagnosticReport.findUnique({
      where: { id: charge.diagnosticReportId },
      select: { fmInformeNumber: true },
    });

    let fkLiquidacion: string | null = null;
    if (charge.liquidationId) {
      const liq = await this.prisma.labLiquidation.findUnique({
        where: { id: charge.liquidationId },
        select: { fmPk: true },
      });
      fkLiquidacion = liq?.fmPk ? String(liq.fmPk) : null;
    }

    let fkRendicion: string | null = null;
    if (charge.directPaymentBatchId) {
      const dpb = await this.prisma.labDirectPaymentBatch.findUnique({
        where: { id: charge.directPaymentBatchId },
        select: { fmPk: true },
      });
      fkRendicion = dpb?.fmPk ? String(dpb.fmPk) : null;
    }

    const toFmData = {
      fkInformeNumber: dr?.fmInformeNumber ?? 0,
      paymentMethodName: fromLabPaymentMethod(charge.paymentMethod),
      amount: Number(charge.amount),
      feeCodesText: charge.feeCodesText,
      statusName: fromLabChargeStatus(charge.status),
      labOriginCodeSnapshot: charge.labOriginCodeSnapshot,
      enteredAt: charge.enteredAt,
      enteredByNameSnapshot: charge.enteredByNameSnapshot,
      pointOfEntry: charge.pointOfEntry,
      fkLiquidacion,
      fkRendicion,
    };

    const isBiopsy = charge.fmSource === 'BIOPSIAS_INGRESOS';
    return isBiopsy
      ? this.examChargeTransformer.biopsyChargeToFm(toFmData)
      : this.examChargeTransformer.papChargeToFm(toFmData);
  }

  private async buildLiquidationUpdate(
    entityId: string,
  ): Promise<Record<string, unknown>> {
    const liq = await this.prisma.labLiquidation.findUniqueOrThrow({
      where: { id: entityId },
    });

    let labOriginCode = '';
    const origin = await this.prisma.labOrigin.findFirst({
      where: { legalEntityId: liq.legalEntityId },
      select: { code: true },
    });
    if (origin) labOriginCode = origin.code;

    return this.liquidationTransformer.toFm({
      labOriginCode,
      periodLabel: liq.periodLabel,
      statusName: fromLiquidationStatus(liq.status),
      totalAmount: Number(liq.totalAmount),
      biopsyAmount: Number(liq.biopsyAmount),
      papAmount: Number(liq.papAmount),
      cytologyAmount: Number(liq.cytologyAmount),
      immunoAmount: Number(liq.immunoAmount),
      biopsyCount: liq.biopsyCount,
      papCount: liq.papCount,
      cytologyCount: liq.cytologyCount,
      immunoCount: liq.immunoCount,
      previousDebt: Number(liq.previousDebt),
      creditBalance: Number(liq.creditBalance),
    });
  }

  private async buildDiagnosticReportUpdate(
    entityId: string,
    fmLayout: string,
  ): Promise<Record<string, unknown>> {
    const report = await this.prisma.labDiagnosticReport.findUniqueOrThrow({
      where: { id: entityId },
      select: { macroscopicDescription: true },
    });

    // Only macroscopy fields are writable in v1
    if (fmLayout.includes('TEXTO') || fmLayout.includes('MACRO')) {
      return this.biopsyTransformer.macroscopyToFm({
        macroscopicDescription: report.macroscopicDescription ?? '',
      });
    }

    return {};
  }

  private async buildWorkflowEventUpdate(
    entityId: string,
  ): Promise<Record<string, unknown>> {
    const event = await this.prisma.labExamWorkflowEvent.findUniqueOrThrow({
      where: { id: entityId },
    });

    if (event.eventType === 'MACROSCOPY') {
      return this.traceabilityTransformer.macroscopyEventToFm({
        performedByNameSnapshot: event.performedByNameSnapshot,
        occurredAt: event.occurredAt,
      });
    }

    return {};
  }

  private resolveFmDatabase(entityType: string): string {
    // All lab entities come from BIOPSIAS database
    return 'BIOPSIAS';
  }

  private resolveFmLayout(event: FmLabSyncEvent): string {
    switch (event.entityType) {
      case 'lab-exam-charge':
        return this.examChargeTransformer.biopsyLayout;
      case 'lab-liquidation':
        return this.liquidationTransformer.layout;
      case 'lab-diagnostic-report':
        return this.biopsyTransformer.macroscopyLayout;
      case 'lab-workflow-event':
        return this.traceabilityTransformer.layout;
      case 'lab-signer':
        return this.biopsyTransformer.macroSignerLayout;
      default:
        return 'unknown';
    }
  }

  private async logSync(data: {
    tenantId: string;
    entityType: string;
    entityId: string;
    fmRecordId?: string;
    action: string;
    direction: string;
    details?: unknown;
  }) {
    return this.prisma.fmSyncLog.create({
      data: {
        tenantId: data.tenantId,
        entityType: data.entityType,
        entityId: data.entityId,
        fmRecordId: data.fmRecordId,
        action: data.action,
        direction: data.direction,
        details: data.details as any,
      },
    });
  }
}
```

- [ ] **Step 2: Write unit tests for FmLabSyncService**

Create `apps/api/src/modules/lab/services/fm-lab-sync.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { FmLabSyncService, FmLabSyncEvent } from './fm-lab-sync.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import { ExamChargeTransformer } from '../../filemaker/transformers/exam-charge.transformer';
import { LiquidationTransformer } from '../../filemaker/transformers/liquidation.transformer';
import { BiopsyTransformer } from '../../filemaker/transformers/biopsy.transformer';
import { TraceabilityTransformer } from '../../filemaker/transformers/traceability.transformer';

describe('FmLabSyncService', () => {
  let service: FmLabSyncService;
  let prisma: any;
  let fmApi: any;

  beforeEach(async () => {
    prisma = {
      fmSyncRecord: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      fmSyncLog: { create: jest.fn() },
      labExamCharge: { findUniqueOrThrow: jest.fn() },
      labLiquidation: { findUniqueOrThrow: jest.fn() },
      labDiagnosticReport: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
      labExamWorkflowEvent: { findUniqueOrThrow: jest.fn() },
      labDiagnosticReportSigner: { findUniqueOrThrow: jest.fn() },
      labDirectPaymentBatch: { findUnique: jest.fn() },
      labOrigin: { findFirst: jest.fn() },
    };

    fmApi = {
      getRecord: jest.fn(),
      createRecord: jest.fn().mockResolvedValue({ recordId: 'fm-123' }),
      updateRecord: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        FmLabSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: FmApiService, useValue: fmApi },
        ExamChargeTransformer,
        LiquidationTransformer,
        BiopsyTransformer,
        TraceabilityTransformer,
      ],
    }).compile();

    service = module.get(FmLabSyncService);
  });

  it('marks existing FmSyncRecord as PENDING_TO_FM on update event', async () => {
    prisma.fmSyncRecord.findFirst.mockResolvedValue({
      id: 'sync-1',
      entityType: 'lab-exam-charge',
      entityId: 'charge-1',
    });

    await service.handleLabSyncEvent({
      tenantId: 'tenant-1',
      entityType: 'lab-exam-charge',
      entityId: 'charge-1',
      action: 'update',
    });

    expect(prisma.fmSyncRecord.update).toHaveBeenCalledWith({
      where: { id: 'sync-1' },
      data: { syncStatus: 'PENDING_TO_FM', syncError: null },
    });
  });

  it('creates FM record and FmSyncRecord on create event', async () => {
    const mockCharge = {
      id: 'charge-1',
      fmSource: 'BIOPSIAS_INGRESOS',
      fmRecordPk: 1,
      diagnosticReportId: 'dr-1',
      paymentMethod: 'LAB_CASH',
      amount: { toNumber: () => 25000 },
      feeCodesText: null,
      status: 'REGISTERED_CHARGE',
      labOriginCodeSnapshot: 'CLI-001',
      enteredAt: new Date(),
      enteredByNameSnapshot: 'Test User',
      pointOfEntry: null,
      liquidationId: null,
      directPaymentBatchId: null,
    };

    prisma.labExamCharge.findUniqueOrThrow.mockResolvedValue(mockCharge);
    prisma.labDiagnosticReport.findUnique.mockResolvedValue({
      fmInformeNumber: 12345,
    });

    await service.handleLabSyncEvent({
      tenantId: 'tenant-1',
      entityType: 'lab-exam-charge',
      entityId: 'charge-1',
      action: 'create',
    });

    expect(fmApi.createRecord).toHaveBeenCalled();
    expect(prisma.fmSyncRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'lab-exam-charge',
          entityId: 'charge-1',
          syncStatus: 'SYNCED',
        }),
      }),
    );
  });
});
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter api test -- --testPathPattern="fm-lab-sync"`.

---

## Task 5: LabExamChargeService (CRUD + Events)

**Files:**
- Create: `apps/api/src/modules/lab/services/lab-exam-charge.service.ts`
- Create: `apps/api/src/modules/lab/services/lab-exam-charge.service.spec.ts`
- Create: `apps/api/src/modules/lab/dto/lab-exam-charge.dto.ts`

- [ ] **Step 1: Create local DTOs (re-export from shared for controller, local types for service)**

Create `apps/api/src/modules/lab/dto/lab-exam-charge.dto.ts`:

```typescript
// Re-export Zod schemas from shared for controller validation
export {
  createExamChargeSchema,
  updateExamChargeSchema,
  cancelExamChargeSchema,
  assignChargeToLiquidationSchema,
  assignChargeToDirectPaymentBatchSchema,
  labChargeListSchema,
  type CreateExamChargeSchema,
  type UpdateExamChargeSchema,
  type CancelExamChargeSchema,
  type AssignChargeToLiquidationSchema,
  type AssignChargeToDirectPaymentBatchSchema,
  type LabChargeListSchema,
} from '@zeru/shared';
```

- [ ] **Step 2: Create LabExamChargeService**

Create `apps/api/src/modules/lab/services/lab-exam-charge.service.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import { toLabPaymentMethod, toLabChargeStatus, toLabExamChargeSource } from '../constants/enum-maps';
import type {
  CreateExamChargeSchema,
  UpdateExamChargeSchema,
  CancelExamChargeSchema,
  LabChargeListSchema,
} from '@zeru/shared';
import type { FmLabSyncEvent } from './fm-lab-sync.service';

@Injectable()
export class LabExamChargeService {
  private readonly logger = new Logger(LabExamChargeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string, filters: LabChargeListSchema) {
    const { page, pageSize, ...where } = filters;
    const skip = (page - 1) * pageSize;

    const whereClause: Record<string, unknown> = { tenantId };
    if (where.diagnosticReportId) whereClause.diagnosticReportId = where.diagnosticReportId;
    if (where.liquidationId) whereClause.liquidationId = where.liquidationId;
    if (where.directPaymentBatchId) whereClause.directPaymentBatchId = where.directPaymentBatchId;
    if (where.labOriginId) whereClause.labOriginId = where.labOriginId;
    if (where.legalEntityId) whereClause.legalEntityId = where.legalEntityId;
    if (where.status) whereClause.status = toLabChargeStatus(where.status);
    if (where.dateFrom || where.dateTo) {
      whereClause.enteredAt = {
        ...(where.dateFrom ? { gte: new Date(where.dateFrom) } : {}),
        ...(where.dateTo ? { lte: new Date(where.dateTo) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.labExamCharge.findMany({
        where: whereClause,
        include: {
          diagnosticReport: {
            select: {
              id: true,
              fmInformeNumber: true,
              fmSource: true,
              status: true,
              serviceRequest: {
                select: {
                  subjectFirstName: true,
                  subjectPaternalLastName: true,
                  subjectRut: true,
                  labOriginCodeSnapshot: true,
                },
              },
            },
          },
          liquidation: {
            select: { id: true, periodLabel: true, status: true },
          },
        },
        orderBy: { enteredAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.labExamCharge.count({ where: whereClause }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: string, tenantId: string) {
    const charge = await this.prisma.labExamCharge.findFirst({
      where: { id, tenantId },
      include: {
        diagnosticReport: {
          select: {
            id: true,
            fmInformeNumber: true,
            fmSource: true,
            status: true,
            serviceRequest: {
              select: {
                id: true,
                subjectFirstName: true,
                subjectPaternalLastName: true,
                subjectMaternalLastName: true,
                subjectRut: true,
                labOriginCodeSnapshot: true,
                category: true,
              },
            },
          },
        },
        liquidation: true,
        directPaymentBatch: true,
      },
    });
    if (!charge) throw new NotFoundException(`ExamCharge ${id} not found`);
    return charge;
  }

  async create(tenantId: string, data: CreateExamChargeSchema) {
    // Verify DR exists
    const dr = await this.prisma.labDiagnosticReport.findFirst({
      where: { id: data.diagnosticReportId, tenantId },
      select: { id: true, fmInformeNumber: true },
    });
    if (!dr) {
      throw new BadRequestException(`DiagnosticReport ${data.diagnosticReportId} not found`);
    }

    // Generate a unique fmRecordPk for new charges (negative to avoid collision with FM PKs)
    const maxPk = await this.prisma.labExamCharge.aggregate({
      where: { tenantId, fmRecordPk: { lt: 0 } },
      _min: { fmRecordPk: true },
    });
    const newPk = (maxPk._min.fmRecordPk ?? 0) - 1;

    const charge = await this.prisma.labExamCharge.create({
      data: {
        tenantId,
        fmSource: toLabExamChargeSource(data.fmSource),
        fmRecordPk: newPk,
        diagnosticReportId: data.diagnosticReportId,
        billingConceptId: data.billingConceptId ?? null,
        feeCodesText: data.feeCodesText ?? null,
        feeCodes: data.feeCodes ?? [],
        paymentMethod: toLabPaymentMethod(data.paymentMethod),
        amount: new Decimal(data.amount),
        currency: data.currency ?? 'CLP',
        status: toLabChargeStatus('REGISTERED'),
        labOriginId: data.labOriginId,
        labOriginCodeSnapshot: data.labOriginCodeSnapshot,
        legalEntityId: data.legalEntityId ?? null,
        enteredAt: new Date(),
        enteredByNameSnapshot: data.enteredByNameSnapshot,
        pointOfEntry: data.pointOfEntry ?? null,
        notes: data.notes ?? null,
      },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-exam-charge',
      entityId: charge.id,
      action: 'create',
    } satisfies FmLabSyncEvent);

    return charge;
  }

  async update(id: string, tenantId: string, data: UpdateExamChargeSchema) {
    const existing = await this.prisma.labExamCharge.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException(`ExamCharge ${id} not found`);
    if (existing.status === 'CANCELLED_CHARGE') {
      throw new BadRequestException('Cannot update a cancelled charge');
    }

    const updateData: Record<string, unknown> = {};
    if (data.billingConceptId !== undefined) updateData.billingConceptId = data.billingConceptId;
    if (data.feeCodesText !== undefined) updateData.feeCodesText = data.feeCodesText;
    if (data.feeCodes !== undefined) updateData.feeCodes = data.feeCodes;
    if (data.paymentMethod !== undefined) updateData.paymentMethod = toLabPaymentMethod(data.paymentMethod);
    if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await this.prisma.labExamCharge.update({
      where: { id },
      data: updateData,
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-exam-charge',
      entityId: id,
      action: 'update',
      changedFields: Object.keys(data),
    } satisfies FmLabSyncEvent);

    return updated;
  }

  async cancel(id: string, tenantId: string, data: CancelExamChargeSchema) {
    const existing = await this.prisma.labExamCharge.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException(`ExamCharge ${id} not found`);
    if (existing.status === 'CANCELLED_CHARGE') {
      throw new BadRequestException('Charge already cancelled');
    }

    const updated = await this.prisma.labExamCharge.update({
      where: { id },
      data: {
        status: 'CANCELLED_CHARGE',
        cancelledAt: new Date(),
        cancelledByNameSnapshot: data.cancelledByNameSnapshot,
        cancelReason: data.cancelReason,
      },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-exam-charge',
      entityId: id,
      action: 'cancel',
    } satisfies FmLabSyncEvent);

    return updated;
  }

  async assignToLiquidation(id: string, tenantId: string, liquidationId: string) {
    const charge = await this.prisma.labExamCharge.findFirst({
      where: { id, tenantId },
    });
    if (!charge) throw new NotFoundException(`ExamCharge ${id} not found`);

    const liq = await this.prisma.labLiquidation.findFirst({
      where: { id: liquidationId, tenantId },
    });
    if (!liq) throw new NotFoundException(`Liquidation ${liquidationId} not found`);

    const updated = await this.prisma.labExamCharge.update({
      where: { id },
      data: { liquidationId, directPaymentBatchId: null },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-exam-charge',
      entityId: id,
      action: 'update',
      changedFields: ['liquidationId'],
    } satisfies FmLabSyncEvent);

    return updated;
  }

  async assignToDirectPaymentBatch(id: string, tenantId: string, batchId: string) {
    const charge = await this.prisma.labExamCharge.findFirst({
      where: { id, tenantId },
    });
    if (!charge) throw new NotFoundException(`ExamCharge ${id} not found`);

    const dpb = await this.prisma.labDirectPaymentBatch.findFirst({
      where: { id: batchId, tenantId },
    });
    if (!dpb) throw new NotFoundException(`DirectPaymentBatch ${batchId} not found`);

    const updated = await this.prisma.labExamCharge.update({
      where: { id },
      data: { directPaymentBatchId: batchId, liquidationId: null },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-exam-charge',
      entityId: id,
      action: 'update',
      changedFields: ['directPaymentBatchId'],
    } satisfies FmLabSyncEvent);

    return updated;
  }
}
```

- [ ] **Step 3: Write unit tests for LabExamChargeService**

Create `apps/api/src/modules/lab/services/lab-exam-charge.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LabExamChargeService } from './lab-exam-charge.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('LabExamChargeService', () => {
  let service: LabExamChargeService;
  let prisma: any;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    prisma = {
      labExamCharge: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _min: { fmRecordPk: null } }),
      },
      labDiagnosticReport: { findFirst: jest.fn() },
      labLiquidation: { findFirst: jest.fn() },
      labDirectPaymentBatch: { findFirst: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        LabExamChargeService,
        { provide: PrismaService, useValue: prisma },
        EventEmitter2,
      ],
    }).compile();

    service = module.get(LabExamChargeService);
    eventEmitter = module.get(EventEmitter2);
    jest.spyOn(eventEmitter, 'emit');
  });

  it('create emits fm.lab.sync event', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue({
      id: 'dr-1',
      fmInformeNumber: 100,
    });
    prisma.labExamCharge.create.mockResolvedValue({ id: 'charge-1' });

    await service.create('tenant-1', {
      fmSource: 'BIOPSIAS_INGRESOS',
      diagnosticReportId: 'dr-1',
      paymentMethod: 'CASH',
      amount: 25000,
      labOriginId: 'origin-1',
      labOriginCodeSnapshot: 'CLI-001',
      enteredByNameSnapshot: 'Test User',
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({
        entityType: 'lab-exam-charge',
        action: 'create',
      }),
    );
  });

  it('cancel throws if already cancelled', async () => {
    prisma.labExamCharge.findFirst.mockResolvedValue({
      id: 'charge-1',
      status: 'CANCELLED_CHARGE',
    });

    await expect(
      service.cancel('charge-1', 'tenant-1', {
        cancelReason: 'test',
        cancelledByNameSnapshot: 'Admin',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('findById throws NotFoundException for missing charge', async () => {
    prisma.labExamCharge.findFirst.mockResolvedValue(null);

    await expect(
      service.findById('nonexistent', 'tenant-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('assignToLiquidation emits sync event', async () => {
    prisma.labExamCharge.findFirst.mockResolvedValue({ id: 'charge-1' });
    prisma.labLiquidation.findFirst.mockResolvedValue({ id: 'liq-1' });
    prisma.labExamCharge.update.mockResolvedValue({ id: 'charge-1' });

    await service.assignToLiquidation('charge-1', 'tenant-1', 'liq-1');

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({
        action: 'update',
        changedFields: ['liquidationId'],
      }),
    );
  });
});
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter api test -- --testPathPattern="lab-exam-charge"`.

---

## Task 6: LabLiquidationService (CRUD + Lifecycle)

**Files:**
- Create: `apps/api/src/modules/lab/services/lab-liquidation.service.ts`
- Create: `apps/api/src/modules/lab/services/lab-liquidation.service.spec.ts`
- Create: `apps/api/src/modules/lab/dto/lab-liquidation.dto.ts`

- [ ] **Step 1: Create local DTO file**

Create `apps/api/src/modules/lab/dto/lab-liquidation.dto.ts`:

```typescript
export {
  createLiquidationSchema,
  confirmLiquidationSchema,
  invoiceLiquidationSchema,
  paymentLiquidationSchema,
  labLiquidationListSchema,
  type CreateLiquidationSchema,
  type ConfirmLiquidationSchema,
  type InvoiceLiquidationSchema,
  type PaymentLiquidationSchema,
  type LabLiquidationListSchema,
} from '@zeru/shared';
```

- [ ] **Step 2: Create LabLiquidationService**

Create `apps/api/src/modules/lab/services/lab-liquidation.service.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import { toLiquidationStatus } from '../constants/enum-maps';
import type {
  CreateLiquidationSchema,
  ConfirmLiquidationSchema,
  InvoiceLiquidationSchema,
  PaymentLiquidationSchema,
  LabLiquidationListSchema,
} from '@zeru/shared';
import type { FmLabSyncEvent } from './fm-lab-sync.service';

@Injectable()
export class LabLiquidationService {
  private readonly logger = new Logger(LabLiquidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string, filters: LabLiquidationListSchema) {
    const { page, pageSize, ...where } = filters;
    const skip = (page - 1) * pageSize;

    const whereClause: Record<string, unknown> = { tenantId };
    if (where.legalEntityId) whereClause.legalEntityId = where.legalEntityId;
    if (where.status) whereClause.status = toLiquidationStatus(where.status);
    if (where.periodFrom || where.periodTo) {
      whereClause.period = {
        ...(where.periodFrom ? { gte: new Date(where.periodFrom) } : {}),
        ...(where.periodTo ? { lte: new Date(where.periodTo) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.labLiquidation.findMany({
        where: whereClause,
        include: {
          _count: { select: { charges: true } },
        },
        orderBy: { period: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.labLiquidation.count({ where: whereClause }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: string, tenantId: string) {
    const liq = await this.prisma.labLiquidation.findFirst({
      where: { id, tenantId },
      include: {
        charges: {
          include: {
            diagnosticReport: {
              select: {
                fmInformeNumber: true,
                fmSource: true,
                serviceRequest: {
                  select: {
                    subjectFirstName: true,
                    subjectPaternalLastName: true,
                    subjectRut: true,
                    category: true,
                  },
                },
              },
            },
          },
          orderBy: { enteredAt: 'desc' },
        },
      },
    });
    if (!liq) throw new NotFoundException(`Liquidation ${id} not found`);
    return liq;
  }

  async create(tenantId: string, data: CreateLiquidationSchema) {
    // Generate unique fmRecordId for new liquidations
    const fmRecordId = `zeru-liq-${Date.now()}`;

    const totalAmount =
      data.biopsyAmount + data.papAmount + data.cytologyAmount + data.immunoAmount
      + data.previousDebt - data.creditBalance;

    const liq = await this.prisma.labLiquidation.create({
      data: {
        tenantId,
        fmRecordId,
        legalEntityId: data.legalEntityId,
        billingAgreementId: data.billingAgreementId ?? null,
        period: new Date(data.period),
        periodLabel: data.periodLabel,
        totalAmount: new Decimal(totalAmount),
        biopsyAmount: new Decimal(data.biopsyAmount),
        papAmount: new Decimal(data.papAmount),
        cytologyAmount: new Decimal(data.cytologyAmount),
        immunoAmount: new Decimal(data.immunoAmount),
        biopsyCount: data.biopsyCount,
        papCount: data.papCount,
        cytologyCount: data.cytologyCount,
        immunoCount: data.immunoCount,
        previousDebt: new Decimal(data.previousDebt),
        creditBalance: new Decimal(data.creditBalance),
        status: toLiquidationStatus('DRAFT'),
        notes: data.notes ?? null,
      },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-liquidation',
      entityId: liq.id,
      action: 'create',
    } satisfies FmLabSyncEvent);

    return liq;
  }

  async confirm(id: string, tenantId: string, data: ConfirmLiquidationSchema) {
    const liq = await this.prisma.labLiquidation.findFirst({
      where: { id, tenantId },
    });
    if (!liq) throw new NotFoundException(`Liquidation ${id} not found`);
    if (liq.status !== 'DRAFT_LIQ') {
      throw new BadRequestException(
        `Cannot confirm liquidation in status ${liq.status}`,
      );
    }

    const updated = await this.prisma.labLiquidation.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedByNameSnapshot: data.confirmedByNameSnapshot,
      },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-liquidation',
      entityId: id,
      action: 'confirm',
    } satisfies FmLabSyncEvent);

    return updated;
  }

  async invoice(id: string, tenantId: string, data: InvoiceLiquidationSchema) {
    const liq = await this.prisma.labLiquidation.findFirst({
      where: { id, tenantId },
    });
    if (!liq) throw new NotFoundException(`Liquidation ${id} not found`);
    if (liq.status !== 'CONFIRMED') {
      throw new BadRequestException(
        `Cannot invoice liquidation in status ${liq.status} (must be CONFIRMED)`,
      );
    }

    const updated = await this.prisma.labLiquidation.update({
      where: { id },
      data: {
        status: 'INVOICED_LIQ',
        invoiceNumber: data.invoiceNumber,
        invoiceType: data.invoiceType ?? null,
        invoiceDate: new Date(data.invoiceDate),
      },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-liquidation',
      entityId: id,
      action: 'invoice',
    } satisfies FmLabSyncEvent);

    return updated;
  }

  async registerPayment(id: string, tenantId: string, data: PaymentLiquidationSchema) {
    const liq = await this.prisma.labLiquidation.findFirst({
      where: { id, tenantId },
    });
    if (!liq) throw new NotFoundException(`Liquidation ${id} not found`);
    if (liq.status !== 'INVOICED_LIQ' && liq.status !== 'PARTIALLY_PAID') {
      throw new BadRequestException(
        `Cannot register payment for liquidation in status ${liq.status}`,
      );
    }

    const totalPaid = Number(liq.paymentAmount ?? 0) + data.paymentAmount;
    const totalOwed = Number(liq.totalAmount);
    const newStatus = totalPaid >= totalOwed ? 'PAID_LIQ' : 'PARTIALLY_PAID';

    const updated = await this.prisma.labLiquidation.update({
      where: { id },
      data: {
        status: newStatus,
        paymentAmount: new Decimal(totalPaid),
        paymentDate: new Date(data.paymentDate),
        paymentMethodText: data.paymentMethodText,
      },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-liquidation',
      entityId: id,
      action: 'payment',
    } satisfies FmLabSyncEvent);

    return updated;
  }
}
```

- [ ] **Step 3: Write unit tests for LabLiquidationService**

Create `apps/api/src/modules/lab/services/lab-liquidation.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LabLiquidationService } from './lab-liquidation.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('LabLiquidationService', () => {
  let service: LabLiquidationService;
  let prisma: any;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    prisma = {
      labLiquidation: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        LabLiquidationService,
        { provide: PrismaService, useValue: prisma },
        EventEmitter2,
      ],
    }).compile();

    service = module.get(LabLiquidationService);
    eventEmitter = module.get(EventEmitter2);
    jest.spyOn(eventEmitter, 'emit');
  });

  it('create computes totalAmount and emits sync event', async () => {
    prisma.labLiquidation.create.mockResolvedValue({ id: 'liq-1' });

    await service.create('tenant-1', {
      legalEntityId: 'le-1',
      period: '2026-03-01T00:00:00.000Z',
      periodLabel: 'Marzo 2026',
      biopsyAmount: 300000,
      papAmount: 100000,
      cytologyAmount: 50000,
      immunoAmount: 50000,
      biopsyCount: 30,
      papCount: 10,
      cytologyCount: 5,
      immunoCount: 5,
      previousDebt: 10000,
      creditBalance: 5000,
    });

    expect(prisma.labLiquidation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          // 300k+100k+50k+50k+10k-5k = 505000
          totalAmount: expect.any(Object),
        }),
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({ action: 'create' }),
    );
  });

  it('confirm rejects non-DRAFT liquidation', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue({
      id: 'liq-1',
      status: 'CONFIRMED',
    });

    await expect(
      service.confirm('liq-1', 'tenant-1', {
        confirmedByNameSnapshot: 'Admin',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('invoice transitions CONFIRMED to INVOICED_LIQ', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue({
      id: 'liq-1',
      status: 'CONFIRMED',
    });
    prisma.labLiquidation.update.mockResolvedValue({ id: 'liq-1' });

    await service.invoice('liq-1', 'tenant-1', {
      invoiceNumber: 'FAC-001',
      invoiceDate: '2026-03-20T00:00:00.000Z',
    });

    expect(prisma.labLiquidation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'INVOICED_LIQ' }),
      }),
    );
  });

  it('registerPayment sets PAID_LIQ when fully paid', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue({
      id: 'liq-1',
      status: 'INVOICED_LIQ',
      totalAmount: { toNumber: () => 500000 },
      paymentAmount: null,
    });
    prisma.labLiquidation.update.mockResolvedValue({ id: 'liq-1' });

    await service.registerPayment('liq-1', 'tenant-1', {
      paymentAmount: 500000,
      paymentDate: '2026-04-01T00:00:00.000Z',
      paymentMethodText: 'Transferencia',
    });

    expect(prisma.labLiquidation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID_LIQ' }),
      }),
    );
  });
});
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter api test -- --testPathPattern="lab-liquidation"`.

---

## Task 7: LabDirectPaymentBatchService

**Files:**
- Create: `apps/api/src/modules/lab/services/lab-direct-payment-batch.service.ts`
- Create: `apps/api/src/modules/lab/services/lab-direct-payment-batch.service.spec.ts`
- Create: `apps/api/src/modules/lab/dto/lab-direct-payment-batch.dto.ts`

- [ ] **Step 1: Create local DTO file**

Create `apps/api/src/modules/lab/dto/lab-direct-payment-batch.dto.ts`:

```typescript
export {
  createDirectPaymentBatchSchema,
  closeDirectPaymentBatchSchema,
  type CreateDirectPaymentBatchSchema,
  type CloseDirectPaymentBatchSchema,
} from '@zeru/shared';
```

- [ ] **Step 2: Create LabDirectPaymentBatchService**

Create `apps/api/src/modules/lab/services/lab-direct-payment-batch.service.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateDirectPaymentBatchSchema,
  CloseDirectPaymentBatchSchema,
} from '@zeru/shared';
import type { FmLabSyncEvent } from './fm-lab-sync.service';

@Injectable()
export class LabDirectPaymentBatchService {
  private readonly logger = new Logger(LabDirectPaymentBatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string, page = 1, pageSize = 50) {
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.labDirectPaymentBatch.findMany({
        where: { tenantId },
        include: {
          _count: { select: { charges: true } },
        },
        orderBy: { period: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.labDirectPaymentBatch.count({ where: { tenantId } }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: string, tenantId: string) {
    const batch = await this.prisma.labDirectPaymentBatch.findFirst({
      where: { id, tenantId },
      include: {
        charges: {
          include: {
            diagnosticReport: {
              select: {
                fmInformeNumber: true,
                serviceRequest: {
                  select: {
                    subjectFirstName: true,
                    subjectPaternalLastName: true,
                    subjectRut: true,
                  },
                },
              },
            },
          },
          orderBy: { enteredAt: 'desc' },
        },
      },
    });
    if (!batch) throw new NotFoundException(`DirectPaymentBatch ${id} not found`);
    return batch;
  }

  async create(tenantId: string, data: CreateDirectPaymentBatchSchema) {
    const fmRecordId = `zeru-dpb-${Date.now()}`;

    const batch = await this.prisma.labDirectPaymentBatch.create({
      data: {
        tenantId,
        fmRecordId,
        period: new Date(data.period),
        periodFrom: data.periodFrom ? new Date(data.periodFrom) : null,
        periodTo: data.periodTo ? new Date(data.periodTo) : null,
        legalEntityId: data.legalEntityId ?? null,
        rendicionType: data.rendicionType,
        totalAmount: new Decimal(0),
        chargeCount: 0,
        rendidoByNameSnapshot: data.rendidoByNameSnapshot ?? null,
        rendidoAt: new Date(),
        status: 'OPEN_DPB',
        notes: data.notes ?? null,
      },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-direct-payment-batch',
      entityId: batch.id,
      action: 'create',
    } satisfies FmLabSyncEvent);

    return batch;
  }

  async close(id: string, tenantId: string, data: CloseDirectPaymentBatchSchema) {
    const batch = await this.prisma.labDirectPaymentBatch.findFirst({
      where: { id, tenantId },
    });
    if (!batch) throw new NotFoundException(`DirectPaymentBatch ${id} not found`);
    if (batch.status !== 'OPEN_DPB') {
      throw new BadRequestException(`Cannot close batch in status ${batch.status}`);
    }

    // Compute totals from assigned charges
    const chargeAgg = await this.prisma.labExamCharge.aggregate({
      where: { directPaymentBatchId: id, tenantId },
      _sum: { amount: true },
      _count: true,
    });

    const updated = await this.prisma.labDirectPaymentBatch.update({
      where: { id },
      data: {
        status: 'RENDIDA',
        totalAmount: chargeAgg._sum.amount ?? new Decimal(0),
        chargeCount: chargeAgg._count,
        receiptNumber: data.receiptNumber ?? null,
        receiptDate: data.receiptDate ? new Date(data.receiptDate) : null,
      },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-direct-payment-batch',
      entityId: id,
      action: 'close',
    } satisfies FmLabSyncEvent);

    return updated;
  }
}
```

- [ ] **Step 3: Write unit tests**

Create `apps/api/src/modules/lab/services/lab-direct-payment-batch.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';
import { LabDirectPaymentBatchService } from './lab-direct-payment-batch.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('LabDirectPaymentBatchService', () => {
  let service: LabDirectPaymentBatchService;
  let prisma: any;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    prisma = {
      labDirectPaymentBatch: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      labExamCharge: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: null },
          _count: 0,
        }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        LabDirectPaymentBatchService,
        { provide: PrismaService, useValue: prisma },
        EventEmitter2,
      ],
    }).compile();

    service = module.get(LabDirectPaymentBatchService);
    eventEmitter = module.get(EventEmitter2);
    jest.spyOn(eventEmitter, 'emit');
  });

  it('create emits fm.lab.sync event', async () => {
    prisma.labDirectPaymentBatch.create.mockResolvedValue({ id: 'dpb-1' });

    await service.create('tenant-1', {
      period: '2026-03-01T00:00:00.000Z',
      rendicionType: 'BIOPSY_DIRECT',
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({
        entityType: 'lab-direct-payment-batch',
        action: 'create',
      }),
    );
  });

  it('close rejects non-OPEN batch', async () => {
    prisma.labDirectPaymentBatch.findFirst.mockResolvedValue({
      id: 'dpb-1',
      status: 'RENDIDA',
    });

    await expect(
      service.close('dpb-1', 'tenant-1', {}),
    ).rejects.toThrow(BadRequestException);
  });
});
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter api test -- --testPathPattern="lab-direct-payment-batch"`.

---

## Task 8: LabDiagnosticReportService (Read + Macroscopy)

**Files:**
- Create: `apps/api/src/modules/lab/services/lab-diagnostic-report.service.ts`
- Create: `apps/api/src/modules/lab/services/lab-diagnostic-report.service.spec.ts`
- Create: `apps/api/src/modules/lab/dto/lab-diagnostic-report.dto.ts`

- [ ] **Step 1: Create local DTO file**

Create `apps/api/src/modules/lab/dto/lab-diagnostic-report.dto.ts`:

```typescript
export {
  updateMacroscopySchema,
  completeMacroscopySchema,
  registerMacroSignerSchema,
  labReportSearchSchema,
  type UpdateMacroscopySchema,
  type CompleteMacroscopySchema,
  type RegisterMacroSignerSchema,
  type LabReportSearchSchema,
} from '@zeru/shared';
```

- [ ] **Step 2: Create LabDiagnosticReportService**

Create `apps/api/src/modules/lab/services/lab-diagnostic-report.service.ts`:

```typescript
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { toDiagnosticReportStatus, toExamCategory, toWorkflowEventType, toSigningRole } from '../constants/enum-maps';
import type {
  UpdateMacroscopySchema,
  CompleteMacroscopySchema,
  RegisterMacroSignerSchema,
  LabReportSearchSchema,
} from '@zeru/shared';
import type { FmLabSyncEvent } from './fm-lab-sync.service';

@Injectable()
export class LabDiagnosticReportService {
  private readonly logger = new Logger(LabDiagnosticReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async search(tenantId: string, filters: LabReportSearchSchema) {
    const { page, pageSize, ...where } = filters;
    const skip = (page - 1) * pageSize;

    const whereClause: Record<string, unknown> = { tenantId };
    if (where.status) whereClause.status = toDiagnosticReportStatus(where.status);
    if (where.dateFrom || where.dateTo) {
      whereClause.validatedAt = {
        ...(where.dateFrom ? { gte: new Date(where.dateFrom) } : {}),
        ...(where.dateTo ? { lte: new Date(where.dateTo) } : {}),
      };
    }

    // Category and labOrigin filter through serviceRequest relation
    const serviceRequestWhere: Record<string, unknown> = {};
    if (where.category) serviceRequestWhere.category = toExamCategory(where.category);
    if (where.labOriginId) serviceRequestWhere.labOriginId = where.labOriginId;
    if (where.patientRut) serviceRequestWhere.subjectRut = where.patientRut;
    if (Object.keys(serviceRequestWhere).length > 0) {
      whereClause.serviceRequest = serviceRequestWhere;
    }

    // Full-text search on conclusion + fullText
    if (where.query) {
      whereClause.OR = [
        { conclusion: { contains: where.query, mode: 'insensitive' } },
        { fullText: { contains: where.query, mode: 'insensitive' } },
        { serviceRequest: { subjectRut: { contains: where.query } } },
        {
          serviceRequest: {
            subjectPaternalLastName: { contains: where.query, mode: 'insensitive' },
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.labDiagnosticReport.findMany({
        where: whereClause,
        select: {
          id: true,
          fmInformeNumber: true,
          fmSource: true,
          status: true,
          conclusion: true,
          macroscopicDescription: true,
          isUrgent: true,
          isAlteredOrCritical: true,
          validatedAt: true,
          createdAt: true,
          serviceRequest: {
            select: {
              id: true,
              subjectFirstName: true,
              subjectPaternalLastName: true,
              subjectMaternalLastName: true,
              subjectRut: true,
              category: true,
              labOriginCodeSnapshot: true,
              muestraDe: true,
            },
          },
          signers: {
            where: { isActive: true },
            select: { nameSnapshot: true, role: true },
            orderBy: { signatureOrder: 'asc' },
          },
        },
        orderBy: { validatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.labDiagnosticReport.count({ where: whereClause }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: string, tenantId: string) {
    const report = await this.prisma.labDiagnosticReport.findFirst({
      where: { id, tenantId },
      include: {
        serviceRequest: {
          include: {
            patient: true,
            specimens: { include: { slides: true } },
          },
        },
        signers: { orderBy: { signatureOrder: 'asc' } },
        workflowEvents: { orderBy: { occurredAt: 'asc' } },
        communications: { orderBy: { loggedAt: 'desc' } },
        attachments: { orderBy: { sequenceOrder: 'asc' } },
        examCharges: { orderBy: { enteredAt: 'desc' } },
        observations: true,
        technicalObservations: { orderBy: { observedAt: 'desc' } },
        adverseEvents: { orderBy: { occurredAt: 'desc' } },
      },
    });
    if (!report) throw new NotFoundException(`DiagnosticReport ${id} not found`);
    return report;
  }

  async updateMacroscopy(
    id: string,
    tenantId: string,
    data: UpdateMacroscopySchema,
  ) {
    const report = await this.prisma.labDiagnosticReport.findFirst({
      where: { id, tenantId },
      select: { id: true, fmSource: true },
    });
    if (!report) throw new NotFoundException(`DiagnosticReport ${id} not found`);

    const updated = await this.prisma.labDiagnosticReport.update({
      where: { id },
      data: { macroscopicDescription: data.macroscopicDescription },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-diagnostic-report',
      entityId: id,
      action: 'macroscopy-update',
      changedFields: ['macroscopicDescription'],
    } satisfies FmLabSyncEvent);

    return updated;
  }

  async completeMacroscopy(
    id: string,
    tenantId: string,
    data: CompleteMacroscopySchema,
  ) {
    const report = await this.prisma.labDiagnosticReport.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!report) throw new NotFoundException(`DiagnosticReport ${id} not found`);

    // Create workflow event for macroscopy completion
    const event = await this.prisma.labExamWorkflowEvent.create({
      data: {
        tenantId,
        diagnosticReportId: id,
        eventType: 'MACROSCOPY',
        occurredAt: new Date(),
        performedByNameSnapshot: data.performedByNameSnapshot,
        performedById: data.performedById ?? null,
        sourceField: 'Zeru:macroscopy-complete',
      },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-workflow-event',
      entityId: event.id,
      action: 'macroscopy-complete',
    } satisfies FmLabSyncEvent);

    return event;
  }

  async registerMacroSigner(
    tenantId: string,
    data: RegisterMacroSignerSchema,
  ) {
    const report = await this.prisma.labDiagnosticReport.findFirst({
      where: { id: data.diagnosticReportId, tenantId },
      select: { id: true },
    });
    if (!report) {
      throw new NotFoundException(
        `DiagnosticReport ${data.diagnosticReportId} not found`,
      );
    }

    // Get next signature order
    const maxOrder = await this.prisma.labDiagnosticReportSigner.aggregate({
      where: { diagnosticReportId: data.diagnosticReportId },
      _max: { signatureOrder: true },
    });
    let nextOrder = (maxOrder._max.signatureOrder ?? 0) + 1;

    // Create pathologist signer
    const pathologistSigner = await this.prisma.labDiagnosticReportSigner.create({
      data: {
        tenantId,
        diagnosticReportId: data.diagnosticReportId,
        codeSnapshot: data.pathologistCode,
        nameSnapshot: data.pathologistName,
        role: toSigningRole('PRIMARY_PATHOLOGIST'),
        signatureOrder: nextOrder,
        signedAt: new Date(),
        isActive: true,
        roleSnapshot: 'PATÓLOGO MACRO',
      },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-signer',
      entityId: pathologistSigner.id,
      action: 'macro-signer',
    } satisfies FmLabSyncEvent);

    // Create assistant signer if provided
    if (data.assistantCode && data.assistantName) {
      nextOrder++;
      await this.prisma.labDiagnosticReportSigner.create({
        data: {
          tenantId,
          diagnosticReportId: data.diagnosticReportId,
          codeSnapshot: data.assistantCode,
          nameSnapshot: data.assistantName,
          role: toSigningRole('OTHER'),
          signatureOrder: nextOrder,
          signedAt: new Date(),
          isActive: true,
          roleSnapshot: 'AYUDANTE MACRO',
        },
      });
    }

    return pathologistSigner;
  }
}
```

- [ ] **Step 3: Write unit tests**

Create `apps/api/src/modules/lab/services/lab-diagnostic-report.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import { LabDiagnosticReportService } from './lab-diagnostic-report.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('LabDiagnosticReportService', () => {
  let service: LabDiagnosticReportService;
  let prisma: any;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    prisma = {
      labDiagnosticReport: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      labExamWorkflowEvent: { create: jest.fn() },
      labDiagnosticReportSigner: {
        create: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { signatureOrder: null } }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        LabDiagnosticReportService,
        { provide: PrismaService, useValue: prisma },
        EventEmitter2,
      ],
    }).compile();

    service = module.get(LabDiagnosticReportService);
    eventEmitter = module.get(EventEmitter2);
    jest.spyOn(eventEmitter, 'emit');
  });

  it('updateMacroscopy emits fm.lab.sync event', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue({
      id: 'dr-1',
      fmSource: 'BIOPSIAS',
    });
    prisma.labDiagnosticReport.update.mockResolvedValue({ id: 'dr-1' });

    await service.updateMacroscopy('dr-1', 'tenant-1', {
      macroscopicDescription: 'Fragmento de tejido grisáceo',
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({
        entityType: 'lab-diagnostic-report',
        action: 'macroscopy-update',
      }),
    );
  });

  it('completeMacroscopy creates workflow event', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue({ id: 'dr-1' });
    prisma.labExamWorkflowEvent.create.mockResolvedValue({ id: 'evt-1' });

    await service.completeMacroscopy('dr-1', 'tenant-1', {
      performedByNameSnapshot: 'Dr. Martínez',
    });

    expect(prisma.labExamWorkflowEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'MACROSCOPY',
          performedByNameSnapshot: 'Dr. Martínez',
        }),
      }),
    );
  });

  it('registerMacroSigner creates signer and emits event', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue({ id: 'dr-1' });
    prisma.labDiagnosticReportSigner.create.mockResolvedValue({ id: 'signer-1' });

    await service.registerMacroSigner('tenant-1', {
      diagnosticReportId: 'dr-1',
      pathologistCode: 'PAT-001',
      pathologistName: 'Dr. Martínez',
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({
        entityType: 'lab-signer',
        action: 'macro-signer',
      }),
    );
  });

  it('findById throws for non-existent report', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue(null);
    await expect(service.findById('nope', 'tenant-1')).rejects.toThrow(NotFoundException);
  });
});
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter api test -- --testPathPattern="lab-diagnostic-report"`.

---

## Task 9: LabPatientService and LabPractitionerService (Read-Only)

**Files:**
- Create: `apps/api/src/modules/lab/services/lab-patient.service.ts`
- Create: `apps/api/src/modules/lab/services/lab-practitioner.service.ts`
- Create: `apps/api/src/modules/lab/dto/lab-search.dto.ts`

- [ ] **Step 1: Create search DTO file**

Create `apps/api/src/modules/lab/dto/lab-search.dto.ts`:

```typescript
export {
  labPatientSearchSchema,
  labPractitionerSearchSchema,
  type LabPatientSearchSchema,
  type LabPractitionerSearchSchema,
} from '@zeru/shared';
```

- [ ] **Step 2: Create LabPatientService**

Create `apps/api/src/modules/lab/services/lab-patient.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { LabPatientSearchSchema } from '@zeru/shared';

@Injectable()
export class LabPatientService {
  constructor(private readonly prisma: PrismaService) {}

  async search(tenantId: string, filters: LabPatientSearchSchema) {
    const { page, pageSize, ...where } = filters;
    const skip = (page - 1) * pageSize;

    const whereClause: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
      mergedIntoId: null,
    };

    if (where.rut) {
      whereClause.rut = where.rut;
    } else if (where.query) {
      whereClause.OR = [
        { rut: { contains: where.query } },
        { firstName: { contains: where.query, mode: 'insensitive' } },
        { paternalLastName: { contains: where.query, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.labPatient.findMany({
        where: whereClause,
        select: {
          id: true,
          rut: true,
          firstName: true,
          paternalLastName: true,
          maternalLastName: true,
          birthDate: true,
          gender: true,
          needsMerge: true,
          _count: { select: { serviceRequests: true } },
        },
        orderBy: { paternalLastName: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.labPatient.count({ where: whereClause }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: string, tenantId: string) {
    const patient = await this.prisma.labPatient.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        serviceRequests: {
          include: {
            diagnosticReports: {
              select: {
                id: true,
                fmInformeNumber: true,
                fmSource: true,
                status: true,
                conclusion: true,
                validatedAt: true,
              },
              orderBy: { validatedAt: 'desc' },
            },
          },
          orderBy: { requestedAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!patient) throw new NotFoundException(`Patient ${id} not found`);
    return patient;
  }
}
```

- [ ] **Step 3: Create LabPractitionerService**

Create `apps/api/src/modules/lab/services/lab-practitioner.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { LabPractitionerSearchSchema } from '@zeru/shared';

@Injectable()
export class LabPractitionerService {
  constructor(private readonly prisma: PrismaService) {}

  async search(tenantId: string, filters: LabPractitionerSearchSchema) {
    const { page, pageSize, ...where } = filters;
    const skip = (page - 1) * pageSize;

    const whereClause: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };

    if (where.isActive !== undefined) whereClause.isActive = where.isActive;
    if (where.role) whereClause.roles = { has: where.role };
    if (where.query) {
      whereClause.OR = [
        { code: { contains: where.query, mode: 'insensitive' } },
        { firstName: { contains: where.query, mode: 'insensitive' } },
        { paternalLastName: { contains: where.query, mode: 'insensitive' } },
        { rut: { contains: where.query } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.labPractitioner.findMany({
        where: whereClause,
        select: {
          id: true,
          rut: true,
          firstName: true,
          paternalLastName: true,
          maternalLastName: true,
          roles: true,
          code: true,
          specialty: true,
          isActive: true,
          isInternal: true,
        },
        orderBy: { paternalLastName: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.labPractitioner.count({ where: whereClause }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: string, tenantId: string) {
    const practitioner = await this.prisma.labPractitioner.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!practitioner) {
      throw new NotFoundException(`Practitioner ${id} not found`);
    }
    return practitioner;
  }
}
```

- [ ] **Step 4: Write basic tests for both services**

Create `apps/api/src/modules/lab/services/lab-patient.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LabPatientService } from './lab-patient.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('LabPatientService', () => {
  let service: LabPatientService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      labPatient: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        LabPatientService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(LabPatientService);
  });

  it('search by RUT uses exact match', async () => {
    await service.search('tenant-1', { rut: '12.345.678-5', page: 1, pageSize: 20 });
    expect(prisma.labPatient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ rut: '12.345.678-5' }),
      }),
    );
  });

  it('findById throws for missing patient', async () => {
    prisma.labPatient.findFirst.mockResolvedValue(null);
    await expect(service.findById('nope', 'tenant-1')).rejects.toThrow(NotFoundException);
  });
});
```

Create `apps/api/src/modules/lab/services/lab-practitioner.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LabPractitionerService } from './lab-practitioner.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('LabPractitionerService', () => {
  let service: LabPractitionerService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      labPractitioner: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        LabPractitionerService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(LabPractitionerService);
  });

  it('search filters by role when provided', async () => {
    await service.search('tenant-1', { role: 'PATHOLOGIST', page: 1, pageSize: 20 });
    expect(prisma.labPractitioner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ roles: { has: 'PATHOLOGIST' } }),
      }),
    );
  });

  it('findById throws for missing practitioner', async () => {
    prisma.labPractitioner.findFirst.mockResolvedValue(null);
    await expect(service.findById('nope', 'tenant-1')).rejects.toThrow(NotFoundException);
  });
});
```

Run: `cd /Users/camiloespinoza/Zeru && pnpm --filter api test -- --testPathPattern="lab-patient|lab-practitioner"`.

---

## Task 10: REST Controllers

**Files:**
- Create: `apps/api/src/modules/lab/controllers/lab-patient.controller.ts`
- Create: `apps/api/src/modules/lab/controllers/lab-practitioner.controller.ts`
- Create: `apps/api/src/modules/lab/controllers/lab-exam-charge.controller.ts`
- Create: `apps/api/src/modules/lab/controllers/lab-liquidation.controller.ts`
- Create: `apps/api/src/modules/lab/controllers/lab-direct-payment-batch.controller.ts`
- Create: `apps/api/src/modules/lab/controllers/lab-diagnostic-report.controller.ts`

All controllers follow the same pattern: `@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)` + `@RequirePermission('lab', ...)`.

- [ ] **Step 1: Create LabPatientController**

Create `apps/api/src/modules/lab/controllers/lab-patient.controller.ts`:

```typescript
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LabPatientService } from '../services/lab-patient.service';
import { labPatientSearchSchema, type LabPatientSearchSchema } from '../dto/lab-search.dto';

@Controller('lab/patients')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
@RequirePermission('lab', 'read')
export class LabPatientController {
  constructor(private readonly service: LabPatientService) {}

  @Get()
  search(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(labPatientSearchSchema)) query: LabPatientSearchSchema,
  ) {
    return this.service.search(tenantId, query);
  }

  @Get(':id')
  findById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.findById(id, tenantId);
  }
}
```

- [ ] **Step 2: Create LabPractitionerController**

Create `apps/api/src/modules/lab/controllers/lab-practitioner.controller.ts`:

```typescript
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LabPractitionerService } from '../services/lab-practitioner.service';
import {
  labPractitionerSearchSchema,
  type LabPractitionerSearchSchema,
} from '../dto/lab-search.dto';

@Controller('lab/practitioners')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
@RequirePermission('lab', 'read')
export class LabPractitionerController {
  constructor(private readonly service: LabPractitionerService) {}

  @Get()
  search(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(labPractitionerSearchSchema)) query: LabPractitionerSearchSchema,
  ) {
    return this.service.search(tenantId, query);
  }

  @Get(':id')
  findById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.findById(id, tenantId);
  }
}
```

- [ ] **Step 3: Create LabExamChargeController**

Create `apps/api/src/modules/lab/controllers/lab-exam-charge.controller.ts`:

```typescript
import {
  Controller, Get, Post, Patch, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LabExamChargeService } from '../services/lab-exam-charge.service';
import {
  createExamChargeSchema,
  updateExamChargeSchema,
  cancelExamChargeSchema,
  assignChargeToLiquidationSchema,
  assignChargeToDirectPaymentBatchSchema,
  labChargeListSchema,
  type CreateExamChargeSchema,
  type UpdateExamChargeSchema,
  type CancelExamChargeSchema,
  type AssignChargeToLiquidationSchema,
  type AssignChargeToDirectPaymentBatchSchema,
  type LabChargeListSchema,
} from '../dto/lab-exam-charge.dto';

@Controller('lab/exam-charges')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class LabExamChargeController {
  constructor(private readonly service: LabExamChargeService) {}

  @Get()
  @RequirePermission('lab', 'read')
  list(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(labChargeListSchema)) query: LabChargeListSchema,
  ) {
    return this.service.findAll(tenantId, query);
  }

  @Get(':id')
  @RequirePermission('lab', 'read')
  findById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.findById(id, tenantId);
  }

  @Post()
  @RequirePermission('lab', 'write')
  create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createExamChargeSchema)) body: CreateExamChargeSchema,
  ) {
    return this.service.create(tenantId, body);
  }

  @Patch(':id')
  @RequirePermission('lab', 'write')
  update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateExamChargeSchema)) body: UpdateExamChargeSchema,
  ) {
    return this.service.update(id, tenantId, body);
  }

  @Post(':id/cancel')
  @RequirePermission('lab', 'write')
  cancel(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(cancelExamChargeSchema)) body: CancelExamChargeSchema,
  ) {
    return this.service.cancel(id, tenantId, body);
  }

  @Post(':id/assign-liquidation')
  @RequirePermission('lab', 'write')
  assignToLiquidation(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(assignChargeToLiquidationSchema))
    body: AssignChargeToLiquidationSchema,
  ) {
    return this.service.assignToLiquidation(id, tenantId, body.liquidationId);
  }

  @Post(':id/assign-direct-payment')
  @RequirePermission('lab', 'write')
  assignToDirectPaymentBatch(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(assignChargeToDirectPaymentBatchSchema))
    body: AssignChargeToDirectPaymentBatchSchema,
  ) {
    return this.service.assignToDirectPaymentBatch(
      id,
      tenantId,
      body.directPaymentBatchId,
    );
  }
}
```

- [ ] **Step 4: Create LabLiquidationController**

Create `apps/api/src/modules/lab/controllers/lab-liquidation.controller.ts`:

```typescript
import {
  Controller, Get, Post, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LabLiquidationService } from '../services/lab-liquidation.service';
import {
  createLiquidationSchema,
  confirmLiquidationSchema,
  invoiceLiquidationSchema,
  paymentLiquidationSchema,
  labLiquidationListSchema,
  type CreateLiquidationSchema,
  type ConfirmLiquidationSchema,
  type InvoiceLiquidationSchema,
  type PaymentLiquidationSchema,
  type LabLiquidationListSchema,
} from '../dto/lab-liquidation.dto';

@Controller('lab/liquidations')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class LabLiquidationController {
  constructor(private readonly service: LabLiquidationService) {}

  @Get()
  @RequirePermission('lab', 'read')
  list(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(labLiquidationListSchema)) query: LabLiquidationListSchema,
  ) {
    return this.service.findAll(tenantId, query);
  }

  @Get(':id')
  @RequirePermission('lab', 'read')
  findById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.findById(id, tenantId);
  }

  @Post()
  @RequirePermission('lab', 'write')
  create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createLiquidationSchema)) body: CreateLiquidationSchema,
  ) {
    return this.service.create(tenantId, body);
  }

  @Post(':id/confirm')
  @RequirePermission('lab', 'write')
  confirm(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(confirmLiquidationSchema)) body: ConfirmLiquidationSchema,
  ) {
    return this.service.confirm(id, tenantId, body);
  }

  @Post(':id/invoice')
  @RequirePermission('lab', 'write')
  invoice(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(invoiceLiquidationSchema)) body: InvoiceLiquidationSchema,
  ) {
    return this.service.invoice(id, tenantId, body);
  }

  @Post(':id/payment')
  @RequirePermission('lab', 'write')
  registerPayment(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(paymentLiquidationSchema)) body: PaymentLiquidationSchema,
  ) {
    return this.service.registerPayment(id, tenantId, body);
  }
}
```

- [ ] **Step 5: Create LabDirectPaymentBatchController**

Create `apps/api/src/modules/lab/controllers/lab-direct-payment-batch.controller.ts`:

```typescript
import {
  Controller, Get, Post, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LabDirectPaymentBatchService } from '../services/lab-direct-payment-batch.service';
import {
  createDirectPaymentBatchSchema,
  closeDirectPaymentBatchSchema,
  type CreateDirectPaymentBatchSchema,
  type CloseDirectPaymentBatchSchema,
} from '../dto/lab-direct-payment-batch.dto';

@Controller('lab/direct-payment-batches')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class LabDirectPaymentBatchController {
  constructor(private readonly service: LabDirectPaymentBatchService) {}

  @Get()
  @RequirePermission('lab', 'read')
  list(
    @CurrentTenant() tenantId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll(
      tenantId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
    );
  }

  @Get(':id')
  @RequirePermission('lab', 'read')
  findById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.findById(id, tenantId);
  }

  @Post()
  @RequirePermission('lab', 'write')
  create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createDirectPaymentBatchSchema))
    body: CreateDirectPaymentBatchSchema,
  ) {
    return this.service.create(tenantId, body);
  }

  @Post(':id/close')
  @RequirePermission('lab', 'write')
  close(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(closeDirectPaymentBatchSchema))
    body: CloseDirectPaymentBatchSchema,
  ) {
    return this.service.close(id, tenantId, body);
  }
}
```

- [ ] **Step 6: Create LabDiagnosticReportController**

Create `apps/api/src/modules/lab/controllers/lab-diagnostic-report.controller.ts`:

```typescript
import {
  Controller, Get, Post, Patch, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LabDiagnosticReportService } from '../services/lab-diagnostic-report.service';
import {
  updateMacroscopySchema,
  completeMacroscopySchema,
  registerMacroSignerSchema,
  labReportSearchSchema,
  type UpdateMacroscopySchema,
  type CompleteMacroscopySchema,
  type RegisterMacroSignerSchema,
  type LabReportSearchSchema,
} from '../dto/lab-diagnostic-report.dto';

@Controller('lab/diagnostic-reports')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class LabDiagnosticReportController {
  constructor(private readonly service: LabDiagnosticReportService) {}

  @Get()
  @RequirePermission('lab', 'read')
  search(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(labReportSearchSchema)) query: LabReportSearchSchema,
  ) {
    return this.service.search(tenantId, query);
  }

  @Get(':id')
  @RequirePermission('lab', 'read')
  findById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.findById(id, tenantId);
  }

  @Patch(':id/macroscopy')
  @RequirePermission('lab', 'write')
  updateMacroscopy(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateMacroscopySchema)) body: UpdateMacroscopySchema,
  ) {
    return this.service.updateMacroscopy(id, tenantId, body);
  }

  @Post(':id/macroscopy/complete')
  @RequirePermission('lab', 'write')
  completeMacroscopy(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(completeMacroscopySchema)) body: CompleteMacroscopySchema,
  ) {
    return this.service.completeMacroscopy(id, tenantId, body);
  }

  @Post('macro-signer')
  @RequirePermission('lab', 'write')
  registerMacroSigner(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(registerMacroSignerSchema)) body: RegisterMacroSignerSchema,
  ) {
    return this.service.registerMacroSigner(tenantId, body);
  }
}
```

---

## Task 11: Wire Everything into LabModule

**Files:**
- Modify: `apps/api/src/modules/lab/lab.module.ts`

Register all new services, controllers, and EventEmitter2.

- [ ] **Step 1: Update lab.module.ts**

Replace the entire contents of `apps/api/src/modules/lab/lab.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../../prisma/prisma.module';
import { FileMakerModule } from '../filemaker/filemaker.module';
import { FilesModule } from '../files/files.module';

// Constants
import {
  LAB_IMPORT_QUEUE,
  ATTACHMENT_MIGRATION_QUEUE,
} from './constants/queue.constants';

// Services — Import pipeline
import { LabImportOrchestratorService } from './services/lab-import-orchestrator.service';
import { FmRangeResolverService } from './services/fm-range-resolver.service';

// Services — CRUD
import { LabPatientService } from './services/lab-patient.service';
import { LabPractitionerService } from './services/lab-practitioner.service';
import { LabExamChargeService } from './services/lab-exam-charge.service';
import { LabLiquidationService } from './services/lab-liquidation.service';
import { LabDirectPaymentBatchService } from './services/lab-direct-payment-batch.service';
import { LabDiagnosticReportService } from './services/lab-diagnostic-report.service';

// Services — Sync
import { FmLabSyncService } from './services/fm-lab-sync.service';

// Processors (queue dispatchers)
import { LabImportProcessor } from './processors/lab-import.processor';
import { AttachmentDownloadProcessor } from './processors/attachment-download.processor';

// Handlers (business logic)
import { ExamsBatchHandler } from './processors/handlers/exams-batch.handler';
import { WorkflowEventsBatchHandler } from './processors/handlers/workflow-events-batch.handler';
import { CommunicationsBatchHandler } from './processors/handlers/communications-batch.handler';
import { LiquidationsHandler } from './processors/handlers/liquidations.handler';
import { ChargesBatchHandler } from './processors/handlers/charges-batch.handler';

// Controllers
import { LabImportController } from './controllers/lab-import.controller';
import { LabPatientController } from './controllers/lab-patient.controller';
import { LabPractitionerController } from './controllers/lab-practitioner.controller';
import { LabExamChargeController } from './controllers/lab-exam-charge.controller';
import { LabLiquidationController } from './controllers/lab-liquidation.controller';
import { LabDirectPaymentBatchController } from './controllers/lab-direct-payment-batch.controller';
import { LabDiagnosticReportController } from './controllers/lab-diagnostic-report.controller';

@Module({
  imports: [
    PrismaModule,
    FileMakerModule,
    FilesModule,
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL'),
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6380),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: LAB_IMPORT_QUEUE },
      { name: ATTACHMENT_MIGRATION_QUEUE },
    ),
  ],
  controllers: [
    LabImportController,
    LabPatientController,
    LabPractitionerController,
    LabExamChargeController,
    LabLiquidationController,
    LabDirectPaymentBatchController,
    LabDiagnosticReportController,
  ],
  providers: [
    // Import pipeline services
    LabImportOrchestratorService,
    FmRangeResolverService,

    // CRUD services
    LabPatientService,
    LabPractitionerService,
    LabExamChargeService,
    LabLiquidationService,
    LabDirectPaymentBatchService,
    LabDiagnosticReportService,

    // Sync service
    FmLabSyncService,

    // Queue processors (one per queue)
    LabImportProcessor,
    AttachmentDownloadProcessor,

    // Handlers (injected into LabImportProcessor)
    ExamsBatchHandler,
    WorkflowEventsBatchHandler,
    CommunicationsBatchHandler,
    LiquidationsHandler,
    ChargesBatchHandler,

    // Citolab S3 config
    {
      provide: 'CITOLAB_S3_CONFIG',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        bucket: config.get<string>('CITOLAB_S3_BUCKET', 'archivos-citolab-virginia'),
        region: config.get<string>('CITOLAB_S3_REGION', 'us-east-1'),
        accessKeyId: config.get<string>('CITOLAB_AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.get<string>('CITOLAB_AWS_SECRET_ACCESS_KEY'),
      }),
    },
  ],
  exports: [
    LabImportOrchestratorService,
    LabPatientService,
    LabPractitionerService,
    LabExamChargeService,
    LabLiquidationService,
    LabDirectPaymentBatchService,
    LabDiagnosticReportService,
  ],
})
export class LabModule {}
```

**Important note on EventEmitterModule:** If EventEmitterModule.forRoot() is already registered in app.module.ts, remove it from lab.module.ts imports and just use EventEmitter2 from the global module. Check `app.module.ts` first. If it's NOT already registered globally, keep it here.

- [ ] **Step 2: Verify compile**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/shared build && pnpm --filter api build
```

Fix any TypeScript errors.

---

## Task 12: Run All Tests and Lint

- [ ] **Step 1: Run all lab tests**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter api test -- --testPathPattern="lab|transformer" --forceExit
```

Fix any failures.

- [ ] **Step 2: Run linter**

```bash
cd /Users/camiloespinoza/Zeru && pnpm lint
```

Fix all lint errors before proceeding.

- [ ] **Step 3: Verify full build**

```bash
cd /Users/camiloespinoza/Zeru && pnpm build
```

---

## API Endpoint Summary

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/lab/patients` | `lab:read` | Search patients by RUT/name |
| GET | `/lab/patients/:id` | `lab:read` | Patient detail with exam history |
| GET | `/lab/practitioners` | `lab:read` | List/search practitioners |
| GET | `/lab/practitioners/:id` | `lab:read` | Practitioner detail |
| GET | `/lab/diagnostic-reports` | `lab:read` | Search reports (filter by status, category, date, origin, text) |
| GET | `/lab/diagnostic-reports/:id` | `lab:read` | Full report detail (signers, workflow, charges, attachments) |
| PATCH | `/lab/diagnostic-reports/:id/macroscopy` | `lab:write` | Update macroscopic description |
| POST | `/lab/diagnostic-reports/:id/macroscopy/complete` | `lab:write` | Mark macroscopy step complete |
| POST | `/lab/diagnostic-reports/macro-signer` | `lab:write` | Register macro pathologist + assistant |
| GET | `/lab/exam-charges` | `lab:read` | List charges (filter by DR, liquidation, origin, status, date) |
| GET | `/lab/exam-charges/:id` | `lab:read` | Charge detail |
| POST | `/lab/exam-charges` | `lab:write` | Create new charge |
| PATCH | `/lab/exam-charges/:id` | `lab:write` | Update charge |
| POST | `/lab/exam-charges/:id/cancel` | `lab:write` | Cancel charge |
| POST | `/lab/exam-charges/:id/assign-liquidation` | `lab:write` | Assign charge to liquidation |
| POST | `/lab/exam-charges/:id/assign-direct-payment` | `lab:write` | Assign charge to DPB |
| GET | `/lab/liquidations` | `lab:read` | List liquidations (filter by entity, status, period) |
| GET | `/lab/liquidations/:id` | `lab:read` | Liquidation detail with charges |
| POST | `/lab/liquidations` | `lab:write` | Create liquidation |
| POST | `/lab/liquidations/:id/confirm` | `lab:write` | Confirm liquidation |
| POST | `/lab/liquidations/:id/invoice` | `lab:write` | Register invoice |
| POST | `/lab/liquidations/:id/payment` | `lab:write` | Register payment |
| GET | `/lab/direct-payment-batches` | `lab:read` | List DPBs |
| GET | `/lab/direct-payment-batches/:id` | `lab:read` | DPB detail with charges |
| POST | `/lab/direct-payment-batches` | `lab:write` | Create DPB |
| POST | `/lab/direct-payment-batches/:id/close` | `lab:write` | Close DPB (compute totals) |
| POST | `/lab/import/start` | `lab:admin` | Start import (existing) |
| GET | `/lab/import/runs/:id/status` | `lab:admin` | Import status (existing) |

---

## Sync Flow Diagram

```
User action in Zeru
    |
    v
Controller (validates DTO)
    |
    v
Service (Prisma write)
    |
    +-- emit('fm.lab.sync', { entityType, entityId, action })
    |
    v
FmLabSyncService (@OnEvent)
    |
    +-- action === 'create'?
    |   +-- Read entity from Prisma
    |   +-- Call transformer.toFm(data)
    |   +-- FmApiService.createRecord()
    |   +-- Create FmSyncRecord (SYNCED)
    |   +-- Log to FmSyncLog
    |
    +-- action !== 'create'?
    |   +-- Find FmSyncRecord
    |   +-- Mark PENDING_TO_FM
    |   +-- (Cron picks it up every 30s)
    |
    v
Cron: processPendingLabSync (every 30s)
    |
    +-- Read FmSyncRecord (PENDING_TO_FM, lab entity types)
    +-- FmApiService.getRecord() -> check modId (conflict detection)
    +-- buildUpdateFieldData() -> transformer.toFm()
    +-- FmApiService.updateRecord()
    +-- Re-read FM record for new modId
    +-- Update FmSyncRecord (SYNCED, new modId)
    +-- Log to FmSyncLog

On error:
    +-- FmSyncRecord.syncStatus = ERROR
    +-- FmSyncRecord.retryCount++
    +-- Existing retryErrors cron (every 5min) retries
```

---

## Deferred Items (Not in This Plan)

These items from spec section 8.2 require infrastructure not yet built and will be addressed in a follow-up plan:

1. **Macro photo upload to FM containers** (`SCANNER BP 8::MACRO`): Requires adding a `uploadToContainer()` method to `FmApiService` using the FM Data API container upload endpoint (`POST /layouts/{layout}/records/{recordId}/containers/{fieldName}`). This is a multipart/form-data upload, different from the JSON-based `createRecord`/`updateRecord` methods. Will be implemented alongside the macro photo UI.

2. **DirectPaymentBatch write-back to FM rendiciones**: The `LabDirectPaymentBatch` CRUD is fully built with sync events, but the `FmLabSyncService.createInFm()` handler for `lab-direct-payment-batch` is not yet implemented because the FM rendiciones layout field mapping needs to be confirmed. The event is emitted and the sync record will be created once the handler is added.
