# Biopsias/Papanicolaou Import Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the BullMQ-based import pipeline that reads 4.2M exam records from FileMaker, transforms them via the Plan 1 transformers, and persists them to the mod_lab schema with full progress tracking.

**Architecture:** BullMQ queues with Redis orchestrate phased import: practitioners → exams → workflow/comms → liquidations → charges → attachments. Each phase runs in batches of 100 with idempotent upserts. Attachment migration runs on a separate rate-limited queue.

**Tech Stack:** BullMQ, Redis, NestJS, Prisma, AWS S3 SDK

**Depends on:** Plan 1 (Data Layer) — all transformers and Prisma models must exist

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `apps/api/src/modules/lab/constants/queue.constants.ts` | Queue names, job names, concurrency, rate limits, retry config |
| `apps/api/src/modules/lab/constants/enum-maps.ts` | Mapping functions from transformer string literal unions to Prisma enum values |
| `apps/api/src/modules/lab/constants/enum-maps.spec.ts` | Tests for enum mapping functions |
| `apps/api/src/modules/lab/services/lab-import-orchestrator.service.ts` | Creates LabImportRun, partitions FM data into batches, enqueues phased jobs |
| `apps/api/src/modules/lab/services/lab-import-orchestrator.service.spec.ts` | Tests for orchestrator |
| `apps/api/src/modules/lab/services/fm-range-resolver.service.ts` | Queries FM to count records and resolve informe number ranges per source/date |
| `apps/api/src/modules/lab/services/fm-range-resolver.service.spec.ts` | Tests for range resolver |
| `apps/api/src/modules/lab/processors/lab-import.processor.ts` | Main import queue processor — dispatches by job.name to handler methods for exams, workflow, comms, liquidations, charges |
| `apps/api/src/modules/lab/processors/lab-import.processor.spec.ts` | Integration tests with mocked FM for all Phase 1-4 job types |
| `apps/api/src/modules/lab/processors/handlers/exams-batch.handler.ts` | Core handler: Patient + ServiceRequest + Specimen + DR + Signers + AttachmentRefs |
| `apps/api/src/modules/lab/processors/handlers/exams-batch.handler.spec.ts` | Unit tests for exam handler |
| `apps/api/src/modules/lab/processors/handlers/workflow-events-batch.handler.ts` | Processes TraceabilityTransformer output → LabExamWorkflowEvent |
| `apps/api/src/modules/lab/processors/handlers/workflow-events-batch.handler.spec.ts` | Tests |
| `apps/api/src/modules/lab/processors/handlers/communications-batch.handler.ts` | Processes CommunicationTransformer output → LabCommunication |
| `apps/api/src/modules/lab/processors/handlers/communications-batch.handler.spec.ts` | Tests |
| `apps/api/src/modules/lab/processors/handlers/liquidations.handler.ts` | Imports LabLiquidation + LabDirectPaymentBatch records |
| `apps/api/src/modules/lab/processors/handlers/liquidations.handler.spec.ts` | Tests |
| `apps/api/src/modules/lab/processors/handlers/charges-batch.handler.ts` | Imports LabExamCharge, links to DR + Liquidation/DPB |
| `apps/api/src/modules/lab/processors/handlers/charges-batch.handler.spec.ts` | Tests |
| `apps/api/src/modules/lab/processors/attachment-download.processor.ts` | Separate queue processor: downloads from FM containers + copies from S3 Citolab → S3 Zeru |
| `apps/api/src/modules/lab/processors/attachment-download.processor.spec.ts` | Tests |
| `apps/api/src/modules/lab/controllers/lab-import.controller.ts` | POST /lab/import/start + GET /lab/import/runs/:id/status |
| `apps/api/src/modules/lab/dto/start-import.dto.ts` | Validated DTO for import start endpoint |

### Modified files

| File | Change |
|------|--------|
| `apps/api/src/modules/lab/lab.module.ts` | Register BullMQ queues, all processors, orchestrator, controller |
| `apps/api/src/modules/filemaker/filemaker.module.ts` | Export FmImportService if not already exported (no change needed — already exports transformers) |

---

## Critical: Prisma Enum Mapping Reference

The transformer `types.ts` uses simple string literal unions, but Prisma enums use suffixed values to avoid global collisions. Every processor MUST use the mapping functions from `enum-maps.ts`. Complete mapping:

| Transformer Type | Prisma Enum | Value Mapping |
|-----------------|-------------|---------------|
| `ExamCategoryType` | `ExamCategory` | `OTHER` → `OTHER_EXAM`, rest identical |
| `DiagnosticReportStatusType` | `DiagnosticReportStatus` | `RECEIVED` → `RECEIVED_STATUS`, `PROCESSING` → `PROCESSING_STATUS`, `VALIDATED` → `VALIDATED_REPORT`, `CANCELLED` → `CANCELLED_REPORT`, rest identical |
| `SigningRoleType` | `SigningRole` | `OTHER` → `OTHER_SIGNING`, rest identical |
| `WorkflowEventTypeValue` | `WorkflowEventType` | `PROCESSING` → `PROCESSING_EVENT`, `OTHER` → `OTHER_EVENT`, rest identical |
| `CommunicationCategoryType` | `CommunicationCategory` | `OTHER` → `OTHER_COMM`, rest identical |
| `AttachmentCategoryType` | `AttachmentCategory` | `OTHER` → `OTHER_ATTACHMENT`, rest identical |
| `PaymentMethodType` | `LabPaymentMethod` | `CASH` → `LAB_CASH`, `BANK_TRANSFER` → `LAB_BANK_TRANSFER`, `CHECK` → `LAB_CHECK`, `VOUCHER` → `LAB_VOUCHER`, `CREDIT_CARD` → `LAB_CREDIT_CARD`, `DEBIT_CARD` → `LAB_DEBIT_CARD`, `AGREEMENT` → `LAB_AGREEMENT`, `PENDING_PAYMENT` → `LAB_PENDING_PAYMENT`, `OTHER` → `OTHER_PAYMENT` |
| `ChargeStatusType` | `LabChargeStatus` | `REGISTERED` → `REGISTERED_CHARGE`, `VALIDATED` → `VALIDATED_CHARGE`, `INVOICED` → `INVOICED_CHARGE`, `PAID` → `PAID_CHARGE`, `CANCELLED` → `CANCELLED_CHARGE`, `REVERSED` → `REVERSED` |
| `LiquidationStatusType` | `LiquidationStatus` | `DRAFT` → `DRAFT_LIQ`, `INVOICED` → `INVOICED_LIQ`, `PAID` → `PAID_LIQ`, `CANCELLED` → `CANCELLED_LIQ`, `CONFIRMED` → `CONFIRMED`, `PARTIALLY_PAID` → `PARTIALLY_PAID`, `OVERDUE` → `OVERDUE` |
| `FmSourceType` | `FmSource` | All identical: `BIOPSIAS`, `BIOPSIASRESPALDO`, `PAPANICOLAOU`, `PAPANICOLAOUHISTORICO` |
| `'MALE'/'FEMALE'/'OTHER'/'UNKNOWN'` | `Gender` | `OTHER` → `OTHER_GENDER`, rest identical |

Also note: Prisma model names have `Lab` prefix (e.g., `LabPatient`, `LabDiagnosticReport`, `LabExamCharge`). The ExamCharge source enum is `LabExamChargeSource` (not `ExamChargeSource`). Specimen status uses `RECEIVED_SPECIMEN`, `PROCESSING_SPECIMEN` instead of `RECEIVED`, `PROCESSING`.

---

## Task 1: Queue constants and enum mapping utilities

**Files:**
- Create: `apps/api/src/modules/lab/constants/queue.constants.ts`
- Create: `apps/api/src/modules/lab/constants/enum-maps.ts`
- Create: `apps/api/src/modules/lab/constants/enum-maps.spec.ts`

- [ ] **Step 1: Create queue constants**

Create `apps/api/src/modules/lab/constants/queue.constants.ts`:

```typescript
// ── BullMQ queue configuration for lab import pipeline ──

export const LAB_IMPORT_QUEUE = 'lab-import';
export const ATTACHMENT_MIGRATION_QUEUE = 'attachment-migration';

// ── Job names ──

export const JOB_NAMES = {
  EXAMS_BATCH: 'exams-batch',
  WORKFLOW_EVENTS_BATCH: 'workflow-events-batch',
  COMMUNICATIONS_BATCH: 'communications-batch',
  LIQUIDATIONS: 'liquidations',
  CHARGES_BATCH: 'charges-batch',
  ATTACHMENT_DOWNLOAD: 'attachment-download',
  PHASE_COMPLETE: 'phase-complete',
} as const;

// ── Phase identifiers (execution order) ──

export const PHASES = {
  EXAMS: 'phase-1-exams',
  WORKFLOW_COMMS: 'phase-2-workflow-comms',
  LIQUIDATIONS: 'phase-3-liquidations',
  CHARGES: 'phase-4-charges',
  ATTACHMENTS: 'phase-5-attachments',
} as const;

// ── Configuration ──

export const IMPORT_QUEUE_CONFIG = {
  concurrency: 3,
  defaultBatchSize: 100,
  retryAttempts: 5,
  retryBackoff: {
    type: 'exponential' as const,
    delay: 5000,   // 5s initial → 10s → 20s → 40s → 80s
  },
};

export const ATTACHMENT_QUEUE_CONFIG = {
  concurrency: 10,
  retryAttempts: 10,
  retryBackoff: {
    type: 'exponential' as const,
    delay: 3000,
  },
  rateLimiter: {
    max: 50,       // 50 jobs
    duration: 1000, // per 1 second
  },
};

// ── FM source processing order ──
// BIOPSIAS first (primary), BIOPSIASRESPALDO second (delta only)
// PAPANICOLAOU first (primary), PAPANICOLAOUHISTORICO second (delta only)
export const SOURCE_ORDER: readonly string[] = [
  'BIOPSIAS',
  'BIOPSIASRESPALDO',
  'PAPANICOLAOU',
  'PAPANICOLAOUHISTORICO',
];
```

- [ ] **Step 2: Create enum mapping functions with tests (TDD)**

Create `apps/api/src/modules/lab/constants/enum-maps.spec.ts`:

```typescript
import {
  toExamCategory,
  toDiagnosticReportStatus,
  toSigningRole,
  toWorkflowEventType,
  toCommunicationCategory,
  toAttachmentCategory,
  toLabPaymentMethod,
  toLabChargeStatus,
  toLiquidationStatus,
  toFmSource,
  toGender,
  toLabExamChargeSource,
} from './enum-maps';
import {
  ExamCategory,
  DiagnosticReportStatus,
  SigningRole,
  WorkflowEventType,
  CommunicationCategory,
  AttachmentCategory,
  LabPaymentMethod,
  LabChargeStatus,
  LiquidationStatus,
  FmSource,
  Gender,
  LabExamChargeSource,
} from '@prisma/client';

describe('Enum Maps', () => {
  describe('toExamCategory', () => {
    it('maps BIOPSY directly', () => {
      expect(toExamCategory('BIOPSY')).toBe(ExamCategory.BIOPSY);
    });
    it('maps PAP directly', () => {
      expect(toExamCategory('PAP')).toBe(ExamCategory.PAP);
    });
    it('maps OTHER to OTHER_EXAM', () => {
      expect(toExamCategory('OTHER')).toBe(ExamCategory.OTHER_EXAM);
    });
    it('maps IMMUNOHISTOCHEMISTRY directly', () => {
      expect(toExamCategory('IMMUNOHISTOCHEMISTRY')).toBe(ExamCategory.IMMUNOHISTOCHEMISTRY);
    });
    it('maps CYTOLOGY directly', () => {
      expect(toExamCategory('CYTOLOGY')).toBe(ExamCategory.CYTOLOGY);
    });
    it('maps MOLECULAR directly', () => {
      expect(toExamCategory('MOLECULAR')).toBe(ExamCategory.MOLECULAR);
    });
  });

  describe('toDiagnosticReportStatus', () => {
    it('maps REGISTERED directly', () => {
      expect(toDiagnosticReportStatus('REGISTERED')).toBe(DiagnosticReportStatus.REGISTERED);
    });
    it('maps RECEIVED to RECEIVED_STATUS', () => {
      expect(toDiagnosticReportStatus('RECEIVED')).toBe(DiagnosticReportStatus.RECEIVED_STATUS);
    });
    it('maps PROCESSING to PROCESSING_STATUS', () => {
      expect(toDiagnosticReportStatus('PROCESSING')).toBe(DiagnosticReportStatus.PROCESSING_STATUS);
    });
    it('maps VALIDATED to VALIDATED_REPORT', () => {
      expect(toDiagnosticReportStatus('VALIDATED')).toBe(DiagnosticReportStatus.VALIDATED_REPORT);
    });
    it('maps CANCELLED to CANCELLED_REPORT', () => {
      expect(toDiagnosticReportStatus('CANCELLED')).toBe(DiagnosticReportStatus.CANCELLED_REPORT);
    });
    it('maps SIGNED directly', () => {
      expect(toDiagnosticReportStatus('SIGNED')).toBe(DiagnosticReportStatus.SIGNED);
    });
    it('maps DELIVERED directly', () => {
      expect(toDiagnosticReportStatus('DELIVERED')).toBe(DiagnosticReportStatus.DELIVERED);
    });
  });

  describe('toSigningRole', () => {
    it('maps PRIMARY_PATHOLOGIST directly', () => {
      expect(toSigningRole('PRIMARY_PATHOLOGIST')).toBe(SigningRole.PRIMARY_PATHOLOGIST);
    });
    it('maps OTHER to OTHER_SIGNING', () => {
      expect(toSigningRole('OTHER')).toBe(SigningRole.OTHER_SIGNING);
    });
    it('maps SCREENING_TECH directly', () => {
      expect(toSigningRole('SCREENING_TECH')).toBe(SigningRole.SCREENING_TECH);
    });
  });

  describe('toWorkflowEventType', () => {
    it('maps PROCESSING to PROCESSING_EVENT', () => {
      expect(toWorkflowEventType('PROCESSING')).toBe(WorkflowEventType.PROCESSING_EVENT);
    });
    it('maps OTHER to OTHER_EVENT', () => {
      expect(toWorkflowEventType('OTHER')).toBe(WorkflowEventType.OTHER_EVENT);
    });
    it('maps MACROSCOPY directly', () => {
      expect(toWorkflowEventType('MACROSCOPY')).toBe(WorkflowEventType.MACROSCOPY);
    });
  });

  describe('toCommunicationCategory', () => {
    it('maps OTHER to OTHER_COMM', () => {
      expect(toCommunicationCategory('OTHER')).toBe(CommunicationCategory.OTHER_COMM);
    });
    it('maps CRITICAL_RESULT directly', () => {
      expect(toCommunicationCategory('CRITICAL_RESULT')).toBe(CommunicationCategory.CRITICAL_RESULT);
    });
  });

  describe('toAttachmentCategory', () => {
    it('maps OTHER to OTHER_ATTACHMENT', () => {
      expect(toAttachmentCategory('OTHER')).toBe(AttachmentCategory.OTHER_ATTACHMENT);
    });
    it('maps REPORT_PDF directly', () => {
      expect(toAttachmentCategory('REPORT_PDF')).toBe(AttachmentCategory.REPORT_PDF);
    });
  });

  describe('toLabPaymentMethod', () => {
    it('maps CASH to LAB_CASH', () => {
      expect(toLabPaymentMethod('CASH')).toBe(LabPaymentMethod.LAB_CASH);
    });
    it('maps BANK_TRANSFER to LAB_BANK_TRANSFER', () => {
      expect(toLabPaymentMethod('BANK_TRANSFER')).toBe(LabPaymentMethod.LAB_BANK_TRANSFER);
    });
    it('maps CHECK to LAB_CHECK', () => {
      expect(toLabPaymentMethod('CHECK')).toBe(LabPaymentMethod.LAB_CHECK);
    });
    it('maps VOUCHER to LAB_VOUCHER', () => {
      expect(toLabPaymentMethod('VOUCHER')).toBe(LabPaymentMethod.LAB_VOUCHER);
    });
    it('maps CREDIT_CARD to LAB_CREDIT_CARD', () => {
      expect(toLabPaymentMethod('CREDIT_CARD')).toBe(LabPaymentMethod.LAB_CREDIT_CARD);
    });
    it('maps DEBIT_CARD to LAB_DEBIT_CARD', () => {
      expect(toLabPaymentMethod('DEBIT_CARD')).toBe(LabPaymentMethod.LAB_DEBIT_CARD);
    });
    it('maps AGREEMENT to LAB_AGREEMENT', () => {
      expect(toLabPaymentMethod('AGREEMENT')).toBe(LabPaymentMethod.LAB_AGREEMENT);
    });
    it('maps PENDING_PAYMENT to LAB_PENDING_PAYMENT', () => {
      expect(toLabPaymentMethod('PENDING_PAYMENT')).toBe(LabPaymentMethod.LAB_PENDING_PAYMENT);
    });
    it('maps OTHER to OTHER_PAYMENT', () => {
      expect(toLabPaymentMethod('OTHER')).toBe(LabPaymentMethod.OTHER_PAYMENT);
    });
  });

  describe('toLabChargeStatus', () => {
    it('maps REGISTERED to REGISTERED_CHARGE', () => {
      expect(toLabChargeStatus('REGISTERED')).toBe(LabChargeStatus.REGISTERED_CHARGE);
    });
    it('maps VALIDATED to VALIDATED_CHARGE', () => {
      expect(toLabChargeStatus('VALIDATED')).toBe(LabChargeStatus.VALIDATED_CHARGE);
    });
    it('maps INVOICED to INVOICED_CHARGE', () => {
      expect(toLabChargeStatus('INVOICED')).toBe(LabChargeStatus.INVOICED_CHARGE);
    });
    it('maps PAID to PAID_CHARGE', () => {
      expect(toLabChargeStatus('PAID')).toBe(LabChargeStatus.PAID_CHARGE);
    });
    it('maps CANCELLED to CANCELLED_CHARGE', () => {
      expect(toLabChargeStatus('CANCELLED')).toBe(LabChargeStatus.CANCELLED_CHARGE);
    });
    it('maps REVERSED directly', () => {
      expect(toLabChargeStatus('REVERSED')).toBe(LabChargeStatus.REVERSED);
    });
  });

  describe('toLiquidationStatus', () => {
    it('maps DRAFT to DRAFT_LIQ', () => {
      expect(toLiquidationStatus('DRAFT')).toBe(LiquidationStatus.DRAFT_LIQ);
    });
    it('maps INVOICED to INVOICED_LIQ', () => {
      expect(toLiquidationStatus('INVOICED')).toBe(LiquidationStatus.INVOICED_LIQ);
    });
    it('maps PAID to PAID_LIQ', () => {
      expect(toLiquidationStatus('PAID')).toBe(LiquidationStatus.PAID_LIQ);
    });
    it('maps CANCELLED to CANCELLED_LIQ', () => {
      expect(toLiquidationStatus('CANCELLED')).toBe(LiquidationStatus.CANCELLED_LIQ);
    });
    it('maps CONFIRMED directly', () => {
      expect(toLiquidationStatus('CONFIRMED')).toBe(LiquidationStatus.CONFIRMED);
    });
    it('maps PARTIALLY_PAID directly', () => {
      expect(toLiquidationStatus('PARTIALLY_PAID')).toBe(LiquidationStatus.PARTIALLY_PAID);
    });
    it('maps OVERDUE directly', () => {
      expect(toLiquidationStatus('OVERDUE')).toBe(LiquidationStatus.OVERDUE);
    });
  });

  describe('toFmSource', () => {
    it('maps BIOPSIAS', () => {
      expect(toFmSource('BIOPSIAS')).toBe(FmSource.BIOPSIAS);
    });
    it('maps PAPANICOLAOUHISTORICO', () => {
      expect(toFmSource('PAPANICOLAOUHISTORICO')).toBe(FmSource.PAPANICOLAOUHISTORICO);
    });
  });

  describe('toGender', () => {
    it('maps OTHER to OTHER_GENDER', () => {
      expect(toGender('OTHER')).toBe(Gender.OTHER_GENDER);
    });
    it('maps MALE directly', () => {
      expect(toGender('MALE')).toBe(Gender.MALE);
    });
    it('returns null for null input', () => {
      expect(toGender(null)).toBeNull();
    });
  });

  describe('toLabExamChargeSource', () => {
    it('maps BIOPSIAS_INGRESOS', () => {
      expect(toLabExamChargeSource('BIOPSIAS_INGRESOS')).toBe(LabExamChargeSource.BIOPSIAS_INGRESOS);
    });
    it('maps PAP_INGRESOS', () => {
      expect(toLabExamChargeSource('PAP_INGRESOS')).toBe(LabExamChargeSource.PAP_INGRESOS);
    });
  });
});
```

- [ ] **Step 3: Implement enum mapping functions**

Create `apps/api/src/modules/lab/constants/enum-maps.ts`:

```typescript
import {
  ExamCategory,
  DiagnosticReportStatus,
  SigningRole,
  WorkflowEventType,
  CommunicationCategory,
  AttachmentCategory,
  LabPaymentMethod,
  LabChargeStatus,
  LiquidationStatus,
  FmSource,
  Gender,
  LabExamChargeSource,
} from '@prisma/client';
import type {
  ExamCategoryType,
  DiagnosticReportStatusType,
  SigningRoleType,
  WorkflowEventTypeValue,
  CommunicationCategoryType,
  AttachmentCategoryType,
  PaymentMethodType,
  ChargeStatusType,
  LiquidationStatusType,
  FmSourceType,
  ExamChargeSourceType,
} from '../../filemaker/transformers/types';

// ── ExamCategory ──

const EXAM_CATEGORY_MAP: Record<ExamCategoryType, ExamCategory> = {
  BIOPSY: ExamCategory.BIOPSY,
  PAP: ExamCategory.PAP,
  CYTOLOGY: ExamCategory.CYTOLOGY,
  IMMUNOHISTOCHEMISTRY: ExamCategory.IMMUNOHISTOCHEMISTRY,
  MOLECULAR: ExamCategory.MOLECULAR,
  OTHER: ExamCategory.OTHER_EXAM,
};

export function toExamCategory(val: ExamCategoryType): ExamCategory {
  return EXAM_CATEGORY_MAP[val];
}

// ── DiagnosticReportStatus ──

const DR_STATUS_MAP: Record<DiagnosticReportStatusType, DiagnosticReportStatus> = {
  REGISTERED: DiagnosticReportStatus.REGISTERED,
  IN_TRANSIT: DiagnosticReportStatus.IN_TRANSIT,
  RECEIVED: DiagnosticReportStatus.RECEIVED_STATUS,
  PROCESSING: DiagnosticReportStatus.PROCESSING_STATUS,
  REPORTING: DiagnosticReportStatus.REPORTING,
  PRE_VALIDATED: DiagnosticReportStatus.PRE_VALIDATED,
  VALIDATED: DiagnosticReportStatus.VALIDATED_REPORT,
  SIGNED: DiagnosticReportStatus.SIGNED,
  DELIVERED: DiagnosticReportStatus.DELIVERED,
  DOWNLOADED: DiagnosticReportStatus.DOWNLOADED,
  CANCELLED: DiagnosticReportStatus.CANCELLED_REPORT,
  AMENDED: DiagnosticReportStatus.AMENDED,
};

export function toDiagnosticReportStatus(val: DiagnosticReportStatusType): DiagnosticReportStatus {
  return DR_STATUS_MAP[val];
}

// ── SigningRole ──

const SIGNING_ROLE_MAP: Record<SigningRoleType, SigningRole> = {
  PRIMARY_PATHOLOGIST: SigningRole.PRIMARY_PATHOLOGIST,
  CO_PATHOLOGIST: SigningRole.CO_PATHOLOGIST,
  SUPERVISING_PATHOLOGIST: SigningRole.SUPERVISING_PATHOLOGIST,
  EXTERNAL_CONSULTANT: SigningRole.EXTERNAL_CONSULTANT,
  SCREENING_TECH: SigningRole.SCREENING_TECH,
  SUPERVISING_TECH: SigningRole.SUPERVISING_TECH,
  VISTO_BUENO_TECH: SigningRole.VISTO_BUENO_TECH,
  VALIDATION_CORRECTION: SigningRole.VALIDATION_CORRECTION,
  QC_REVIEWER: SigningRole.QC_REVIEWER,
  OTHER: SigningRole.OTHER_SIGNING,
};

export function toSigningRole(val: SigningRoleType): SigningRole {
  return SIGNING_ROLE_MAP[val];
}

// ── WorkflowEventType ──

const WORKFLOW_EVENT_MAP: Record<WorkflowEventTypeValue, WorkflowEventType> = {
  ORIGIN_INTAKE: WorkflowEventType.ORIGIN_INTAKE,
  ORIGIN_HANDOFF_TO_COURIER: WorkflowEventType.ORIGIN_HANDOFF_TO_COURIER,
  TRANSPORT: WorkflowEventType.TRANSPORT,
  RECEIVED_AT_LAB: WorkflowEventType.RECEIVED_AT_LAB,
  MACROSCOPY: WorkflowEventType.MACROSCOPY,
  EMBEDDING: WorkflowEventType.EMBEDDING,
  CUTTING_STAINING: WorkflowEventType.CUTTING_STAINING,
  HISTOLOGY_REPORTING: WorkflowEventType.HISTOLOGY_REPORTING,
  VALIDATION: WorkflowEventType.VALIDATION,
  APPROVAL: WorkflowEventType.APPROVAL,
  DELIVERY: WorkflowEventType.DELIVERY,
  INTAKE: WorkflowEventType.INTAKE,
  PROCESSING: WorkflowEventType.PROCESSING_EVENT,
  DIAGNOSIS_TRANSCRIPTION: WorkflowEventType.DIAGNOSIS_TRANSCRIPTION,
  PRE_VALIDATION: WorkflowEventType.PRE_VALIDATION,
  SECRETARY_VALIDATION: WorkflowEventType.SECRETARY_VALIDATION,
  PATHOLOGIST_APPROVAL_WEB: WorkflowEventType.PATHOLOGIST_APPROVAL_WEB,
  WEB_VALIDATION: WorkflowEventType.WEB_VALIDATION,
  PDF_GENERATED: WorkflowEventType.PDF_GENERATED,
  WEB_DELIVERY: WorkflowEventType.WEB_DELIVERY,
  WEB_TRANSPORT: WorkflowEventType.WEB_TRANSPORT,
  WEB_RECEPTION: WorkflowEventType.WEB_RECEPTION,
  WEB_EXAM_CYTOLOGY: WorkflowEventType.WEB_EXAM_CYTOLOGY,
  WEB_DOWNLOAD: WorkflowEventType.WEB_DOWNLOAD,
  WEB_ACKNOWLEDGMENT: WorkflowEventType.WEB_ACKNOWLEDGMENT,
  CLIENT_NOTIFIED: WorkflowEventType.CLIENT_NOTIFIED,
  CASE_CORRECTION: WorkflowEventType.CASE_CORRECTION,
  AMENDMENT: WorkflowEventType.AMENDMENT,
  CRITICAL_NOTIFICATION: WorkflowEventType.CRITICAL_NOTIFICATION,
  OTHER: WorkflowEventType.OTHER_EVENT,
};

export function toWorkflowEventType(val: WorkflowEventTypeValue): WorkflowEventType {
  return WORKFLOW_EVENT_MAP[val];
}

// ── CommunicationCategory ──

const COMM_CATEGORY_MAP: Record<CommunicationCategoryType, CommunicationCategory> = {
  SAMPLE_QUALITY_ISSUE: CommunicationCategory.SAMPLE_QUALITY_ISSUE,
  ADDITIONAL_INFO_REQUEST: CommunicationCategory.ADDITIONAL_INFO_REQUEST,
  INTERNAL_QC: CommunicationCategory.INTERNAL_QC,
  CRITICAL_RESULT: CommunicationCategory.CRITICAL_RESULT,
  CLIENT_INQUIRY: CommunicationCategory.CLIENT_INQUIRY,
  CORRECTION_REQUEST: CommunicationCategory.CORRECTION_REQUEST,
  OTHER: CommunicationCategory.OTHER_COMM,
};

export function toCommunicationCategory(val: CommunicationCategoryType): CommunicationCategory {
  return COMM_CATEGORY_MAP[val];
}

// ── AttachmentCategory ──

const ATTACHMENT_CATEGORY_MAP: Record<AttachmentCategoryType, AttachmentCategory> = {
  REPORT_PDF: AttachmentCategory.REPORT_PDF,
  CRITICAL_NOTIFICATION_PDF: AttachmentCategory.CRITICAL_NOTIFICATION_PDF,
  MACRO_PHOTO: AttachmentCategory.MACRO_PHOTO,
  MICRO_PHOTO: AttachmentCategory.MICRO_PHOTO,
  ENCAPSULATION_PHOTO: AttachmentCategory.ENCAPSULATION_PHOTO,
  MACRO_DICTATION: AttachmentCategory.MACRO_DICTATION,
  DIAGNOSIS_MODIFICATION: AttachmentCategory.DIAGNOSIS_MODIFICATION,
  SCANNER_CARTON: AttachmentCategory.SCANNER_CARTON,
  REQUEST_DOCUMENT: AttachmentCategory.REQUEST_DOCUMENT,
  MOLECULAR_CONTAINER: AttachmentCategory.MOLECULAR_CONTAINER,
  ADVERSE_EVENT_PHOTO: AttachmentCategory.ADVERSE_EVENT_PHOTO,
  OTHER: AttachmentCategory.OTHER_ATTACHMENT,
};

export function toAttachmentCategory(val: AttachmentCategoryType): AttachmentCategory {
  return ATTACHMENT_CATEGORY_MAP[val];
}

// ── LabPaymentMethod ──

const PAYMENT_METHOD_MAP: Record<PaymentMethodType, LabPaymentMethod> = {
  CASH: LabPaymentMethod.LAB_CASH,
  BANK_TRANSFER: LabPaymentMethod.LAB_BANK_TRANSFER,
  CHECK: LabPaymentMethod.LAB_CHECK,
  VOUCHER: LabPaymentMethod.LAB_VOUCHER,
  CREDIT_CARD: LabPaymentMethod.LAB_CREDIT_CARD,
  DEBIT_CARD: LabPaymentMethod.LAB_DEBIT_CARD,
  AGREEMENT: LabPaymentMethod.LAB_AGREEMENT,
  PENDING_PAYMENT: LabPaymentMethod.LAB_PENDING_PAYMENT,
  OTHER: LabPaymentMethod.OTHER_PAYMENT,
};

export function toLabPaymentMethod(val: PaymentMethodType): LabPaymentMethod {
  return PAYMENT_METHOD_MAP[val];
}

// ── LabChargeStatus ──

const CHARGE_STATUS_MAP: Record<ChargeStatusType, LabChargeStatus> = {
  REGISTERED: LabChargeStatus.REGISTERED_CHARGE,
  VALIDATED: LabChargeStatus.VALIDATED_CHARGE,
  INVOICED: LabChargeStatus.INVOICED_CHARGE,
  PAID: LabChargeStatus.PAID_CHARGE,
  CANCELLED: LabChargeStatus.CANCELLED_CHARGE,
  REVERSED: LabChargeStatus.REVERSED,
};

export function toLabChargeStatus(val: ChargeStatusType): LabChargeStatus {
  return CHARGE_STATUS_MAP[val];
}

// ── LiquidationStatus ──

const LIQ_STATUS_MAP: Record<LiquidationStatusType, LiquidationStatus> = {
  DRAFT: LiquidationStatus.DRAFT_LIQ,
  CONFIRMED: LiquidationStatus.CONFIRMED,
  INVOICED: LiquidationStatus.INVOICED_LIQ,
  PARTIALLY_PAID: LiquidationStatus.PARTIALLY_PAID,
  PAID: LiquidationStatus.PAID_LIQ,
  OVERDUE: LiquidationStatus.OVERDUE,
  CANCELLED: LiquidationStatus.CANCELLED_LIQ,
};

export function toLiquidationStatus(val: LiquidationStatusType): LiquidationStatus {
  return LIQ_STATUS_MAP[val];
}

// ── FmSource (identical values) ──

export function toFmSource(val: FmSourceType): FmSource {
  return val as FmSource;
}

// ── Gender ──

export function toGender(val: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN' | null): Gender | null {
  if (val === null) return null;
  if (val === 'OTHER') return Gender.OTHER_GENDER;
  return val as Gender;
}

// ── LabExamChargeSource ──

export function toLabExamChargeSource(val: ExamChargeSourceType): LabExamChargeSource {
  return val as LabExamChargeSource;
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern='enum-maps' --no-coverage
```

---

## Task 2: FM range resolver service

**Files:**
- Create: `apps/api/src/modules/lab/services/fm-range-resolver.service.ts`
- Create: `apps/api/src/modules/lab/services/fm-range-resolver.service.spec.ts`

This service queries FM to determine record counts per source, enabling the orchestrator to partition batches.

- [ ] **Step 1: Write tests for FM range resolver**

Create `apps/api/src/modules/lab/services/fm-range-resolver.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { FmRangeResolverService, SourceStats } from './fm-range-resolver.service';
import { FmApiService } from '../../filemaker/services/fm-api.service';

describe('FmRangeResolverService', () => {
  let service: FmRangeResolverService;
  let fmApi: jest.Mocked<FmApiService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FmRangeResolverService,
        {
          provide: FmApiService,
          useValue: {
            findRecords: jest.fn(),
            getRecords: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(FmRangeResolverService);
    fmApi = module.get(FmApiService);
  });

  describe('getSourceStats', () => {
    it('returns total record count for BIOPSIAS without date filter', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [],
        totalRecordCount: 1297449,
      });

      const stats = await service.getSourceStats('BIOPSIAS');

      expect(stats.source).toBe('BIOPSIAS');
      expect(stats.totalRecords).toBe(1297449);
      expect(fmApi.getRecords).toHaveBeenCalledWith(
        'BIOPSIAS',
        'Validación Final*',
        { limit: 1, dateformats: 2 },
      );
    });

    it('returns filtered count for BIOPSIAS with date range', async () => {
      fmApi.findRecords.mockResolvedValue({
        records: [],
        totalRecordCount: 3542,
      });

      const stats = await service.getSourceStats('BIOPSIAS', {
        dateFrom: new Date('2026-03-01'),
        dateTo: new Date('2026-03-31'),
      });

      expect(stats.totalRecords).toBe(3542);
      expect(fmApi.findRecords).toHaveBeenCalledWith(
        'BIOPSIAS',
        'Validación Final*',
        [{ 'FECHA VALIDACIÓN': '03/01/2026...03/31/2026' }],
        { limit: 1, dateformats: 2 },
      );
    });

    it('returns filtered count for PAPANICOLAOU with date range', async () => {
      fmApi.findRecords.mockResolvedValue({
        records: [],
        totalRecordCount: 7200,
      });

      const stats = await service.getSourceStats('PAPANICOLAOU', {
        dateFrom: new Date('2026-03-01'),
        dateTo: new Date('2026-03-31'),
      });

      expect(stats.totalRecords).toBe(7200);
      expect(fmApi.findRecords).toHaveBeenCalledWith(
        'PAPANICOLAOU',
        'INGRESO',
        [{ 'FECHA': '03/01/2026...03/31/2026' }],
        { limit: 1, dateformats: 2 },
      );
    });

    it('returns zero for FM 401 error (no records found)', async () => {
      fmApi.findRecords.mockRejectedValue(new Error('FileMaker error 401: No records match the request'));

      const stats = await service.getSourceStats('BIOPSIAS', {
        dateFrom: new Date('1990-01-01'),
        dateTo: new Date('1990-01-31'),
      });

      expect(stats.totalRecords).toBe(0);
    });
  });

  describe('getChargeStats', () => {
    it('returns biopsy charge count', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [],
        totalRecordCount: 140068,
      });

      const stats = await service.getChargeStats('BIOPSIAS_INGRESOS');

      expect(stats.totalRecords).toBe(140068);
    });
  });

  describe('getLiquidationStats', () => {
    it('returns liquidation count', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [],
        totalRecordCount: 2643,
      });

      const stats = await service.getLiquidationStats();

      expect(stats.totalRecords).toBe(2643);
    });
  });
});
```

- [ ] **Step 2: Implement FM range resolver**

Create `apps/api/src/modules/lab/services/fm-range-resolver.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import type { FmSourceType, ExamChargeSourceType } from '../../filemaker/transformers/types';

export interface SourceStats {
  source: string;
  totalRecords: number;
  database: string;
  layout: string;
}

interface DateFilter {
  dateFrom: Date;
  dateTo: Date;
}

/** FM database/layout configuration per source */
const SOURCE_CONFIG: Record<string, { database: string; layout: string; dateField: string }> = {
  BIOPSIAS: { database: 'BIOPSIAS', layout: 'Validación Final*', dateField: 'FECHA VALIDACIÓN' },
  BIOPSIASRESPALDO: { database: 'BIOPSIASRESPALDO', layout: 'Validación Final*', dateField: 'FECHA VALIDACIÓN' },
  PAPANICOLAOU: { database: 'PAPANICOLAOU', layout: 'INGRESO', dateField: 'FECHA' },
  PAPANICOLAOUHISTORICO: { database: 'PAPANICOLAOUHISTORICO', layout: 'INGRESO', dateField: 'FECHA' },
};

const CHARGE_CONFIG: Record<string, { database: string; layout: string }> = {
  BIOPSIAS_INGRESOS: { database: 'BIOPSIAS', layout: 'Biopsias_Ingresos*' },
  PAP_INGRESOS: { database: 'BIOPSIAS', layout: 'PAP_ingresos*' },
};

const TRACEABILITY_CONFIG: Record<string, { database: string; layout: string }> = {
  BIOPSIAS: { database: 'BIOPSIAS', layout: 'TRAZA' },
  BIOPSIASRESPALDO: { database: 'BIOPSIASRESPALDO', layout: 'TRAZA' },
};

@Injectable()
export class FmRangeResolverService {
  private readonly logger = new Logger(FmRangeResolverService.name);

  constructor(private readonly fmApi: FmApiService) {}

  /**
   * Get total record count for an exam source, optionally filtered by date.
   */
  async getSourceStats(
    source: FmSourceType,
    dateFilter?: DateFilter,
  ): Promise<SourceStats> {
    const config = SOURCE_CONFIG[source];
    if (!config) throw new Error(`Unknown source: ${source}`);

    try {
      if (dateFilter) {
        const rangeStr = this.formatFmDateRange(dateFilter.dateFrom, dateFilter.dateTo);
        const response = await this.fmApi.findRecords(
          config.database,
          config.layout,
          [{ [config.dateField]: rangeStr }],
          { limit: 1, dateformats: 2 },
        );
        return {
          source,
          totalRecords: response.totalRecordCount,
          database: config.database,
          layout: config.layout,
        };
      }

      const response = await this.fmApi.getRecords(
        config.database,
        config.layout,
        { limit: 1, dateformats: 2 },
      );
      return {
        source,
        totalRecords: response.totalRecordCount,
        database: config.database,
        layout: config.layout,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // FM error 401 = "No records match" — not a real error
      if (msg.includes('error 401') || msg.includes('No records match')) {
        this.logger.log(`No records found for ${source} with given filter`);
        return { source, totalRecords: 0, database: config.database, layout: config.layout };
      }
      throw error;
    }
  }

  /**
   * Get total record count for charge source.
   */
  async getChargeStats(source: ExamChargeSourceType): Promise<SourceStats> {
    const config = CHARGE_CONFIG[source];
    if (!config) throw new Error(`Unknown charge source: ${source}`);

    const response = await this.fmApi.getRecords(config.database, config.layout, {
      limit: 1,
      dateformats: 2,
    });
    return {
      source,
      totalRecords: response.totalRecordCount,
      database: config.database,
      layout: config.layout,
    };
  }

  /**
   * Get traceability record count for a biopsy source.
   */
  async getTraceabilityStats(
    source: 'BIOPSIAS' | 'BIOPSIASRESPALDO',
    dateFilter?: DateFilter,
  ): Promise<SourceStats> {
    const config = TRACEABILITY_CONFIG[source];
    if (!config) throw new Error(`Unknown traceability source: ${source}`);

    try {
      if (dateFilter) {
        const rangeStr = this.formatFmDateRange(dateFilter.dateFrom, dateFilter.dateTo);
        const response = await this.fmApi.findRecords(
          config.database,
          config.layout,
          [{ 'Trazabilidad::Fecha_Ingreso examen': rangeStr }],
          { limit: 1, dateformats: 2 },
        );
        return { source, totalRecords: response.totalRecordCount, database: config.database, layout: config.layout };
      }

      const response = await this.fmApi.getRecords(config.database, config.layout, {
        limit: 1,
        dateformats: 2,
      });
      return { source, totalRecords: response.totalRecordCount, database: config.database, layout: config.layout };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('error 401') || msg.includes('No records match')) {
        return { source, totalRecords: 0, database: config.database, layout: config.layout };
      }
      throw error;
    }
  }

  /**
   * Get liquidation record count.
   */
  async getLiquidationStats(): Promise<SourceStats> {
    const response = await this.fmApi.getRecords('BIOPSIAS', 'Liquidaciones', {
      limit: 1,
      dateformats: 2,
    });
    return {
      source: 'LIQUIDACIONES',
      totalRecords: response.totalRecordCount,
      database: 'BIOPSIAS',
      layout: 'Liquidaciones',
    };
  }

  /**
   * Format a date range for FM find query: "MM/DD/YYYY...MM/DD/YYYY"
   */
  private formatFmDateRange(from: Date, to: Date): string {
    const fmt = (d: Date) =>
      `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
    return `${fmt(from)}...${fmt(to)}`;
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern='fm-range-resolver' --no-coverage
```

---

## Task 3: Import orchestrator service

**Files:**
- Create: `apps/api/src/modules/lab/services/lab-import-orchestrator.service.ts`
- Create: `apps/api/src/modules/lab/services/lab-import-orchestrator.service.spec.ts`

The orchestrator creates an `LabImportRun`, queries FM for record counts, partitions into batches, and enqueues phase-by-phase BullMQ jobs.

- [ ] **Step 1: Write orchestrator tests**

Create `apps/api/src/modules/lab/services/lab-import-orchestrator.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { LabImportOrchestratorService } from './lab-import-orchestrator.service';
import { FmRangeResolverService } from './fm-range-resolver.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LAB_IMPORT_QUEUE, ATTACHMENT_MIGRATION_QUEUE } from '../constants/queue.constants';

describe('LabImportOrchestratorService', () => {
  let service: LabImportOrchestratorService;
  let prisma: any;
  let rangeResolver: jest.Mocked<FmRangeResolverService>;
  let importQueue: any;

  beforeEach(async () => {
    prisma = {
      labImportRun: {
        create: jest.fn().mockResolvedValue({ id: 'run-1' }),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
      },
      labImportBatch: {
        create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    importQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      addBulk: jest.fn().mockResolvedValue([]),
    };

    const module = await Test.createTestingModule({
      providers: [
        LabImportOrchestratorService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: FmRangeResolverService,
          useValue: {
            getSourceStats: jest.fn(),
            getChargeStats: jest.fn(),
            getTraceabilityStats: jest.fn(),
            getLiquidationStats: jest.fn(),
          },
        },
        { provide: getQueueToken(LAB_IMPORT_QUEUE), useValue: importQueue },
        { provide: getQueueToken(ATTACHMENT_MIGRATION_QUEUE), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get(LabImportOrchestratorService);
    rangeResolver = module.get(FmRangeResolverService);
  });

  describe('startImport', () => {
    it('creates LabImportRun and partitions into batches', async () => {
      rangeResolver.getSourceStats.mockResolvedValue({
        source: 'BIOPSIAS',
        totalRecords: 250,
        database: 'BIOPSIAS',
        layout: 'Validación Final*',
      });

      const result = await service.startImport({
        tenantId: 'tenant-1',
        sources: ['BIOPSIAS'],
        batchSize: 100,
      });

      expect(result.runId).toBe('run-1');
      expect(prisma.labImportRun.create).toHaveBeenCalledTimes(1);
      // 250 records / 100 batch size = 3 batches
      expect(importQueue.addBulk).toHaveBeenCalled();
    });

    it('applies date filter for test mode', async () => {
      rangeResolver.getSourceStats.mockResolvedValue({
        source: 'BIOPSIAS',
        totalRecords: 50,
        database: 'BIOPSIAS',
        layout: 'Validación Final*',
      });

      await service.startImport({
        tenantId: 'tenant-1',
        sources: ['BIOPSIAS'],
        dateFrom: new Date('2026-03-01'),
        dateTo: new Date('2026-03-31'),
        batchSize: 100,
      });

      expect(rangeResolver.getSourceStats).toHaveBeenCalledWith('BIOPSIAS', {
        dateFrom: expect.any(Date),
        dateTo: expect.any(Date),
      });
    });

    it('skips sources with zero records', async () => {
      rangeResolver.getSourceStats.mockResolvedValue({
        source: 'BIOPSIASRESPALDO',
        totalRecords: 0,
        database: 'BIOPSIASRESPALDO',
        layout: 'Validación Final*',
      });

      const result = await service.startImport({
        tenantId: 'tenant-1',
        sources: ['BIOPSIASRESPALDO'],
        batchSize: 100,
      });

      expect(result.runId).toBe('run-1');
    });
  });

  describe('getRunStatus', () => {
    it('returns run with batch summary', async () => {
      prisma.labImportRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: 'RUNNING',
        phase: 'phase-1-exams',
        totalBatches: 10,
        completedBatches: 5,
        failedBatches: 0,
        totalRecords: 1000,
        processedRecords: 500,
        errorRecords: 2,
        startedAt: new Date(),
        completedAt: null,
        batches: [],
      });

      const status = await service.getRunStatus('run-1');

      expect(status).toBeDefined();
      expect(status!.status).toBe('RUNNING');
      expect(status!.phase).toBe('phase-1-exams');
    });

    it('returns null for non-existent run', async () => {
      prisma.labImportRun.findUnique.mockResolvedValue(null);
      const status = await service.getRunStatus('non-existent');
      expect(status).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Implement the orchestrator service**

Create `apps/api/src/modules/lab/services/lab-import-orchestrator.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmRangeResolverService } from './fm-range-resolver.service';
import {
  LAB_IMPORT_QUEUE,
  ATTACHMENT_MIGRATION_QUEUE,
  JOB_NAMES,
  PHASES,
  IMPORT_QUEUE_CONFIG,
  SOURCE_ORDER,
} from '../constants/queue.constants';
import type { FmSourceType } from '../../filemaker/transformers/types';

export interface StartImportParams {
  tenantId: string;
  sources: FmSourceType[];
  dateFrom?: Date;
  dateTo?: Date;
  batchSize?: number;
}

interface BatchDefinition {
  runId: string;
  tenantId: string;
  phase: string;
  fmSource: FmSourceType;
  batchIndex: number;
  offset: number;
  limit: number;
  dateFrom?: Date;
  dateTo?: Date;
  totalRecords: number;
}

@Injectable()
export class LabImportOrchestratorService {
  private readonly logger = new Logger(LabImportOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rangeResolver: FmRangeResolverService,
    @InjectQueue(LAB_IMPORT_QUEUE)
    private readonly importQueue: Queue,
    @InjectQueue(ATTACHMENT_MIGRATION_QUEUE)
    private readonly attachmentQueue: Queue,
  ) {}

  /**
   * Start a new import run. Creates LabImportRun, queries FM for counts,
   * partitions into batches, enqueues Phase 1 (exams) jobs.
   */
  async startImport(params: StartImportParams): Promise<{ runId: string; totalBatches: number }> {
    const { tenantId, sources, dateFrom, dateTo, batchSize = IMPORT_QUEUE_CONFIG.defaultBatchSize } = params;
    const dateFilter = dateFrom && dateTo ? { dateFrom, dateTo } : undefined;

    // Sort sources per SOURCE_ORDER to ensure primary before backup
    const orderedSources = [...sources].sort(
      (a, b) => SOURCE_ORDER.indexOf(a) - SOURCE_ORDER.indexOf(b),
    );

    // Create the run record
    const run = await this.prisma.labImportRun.create({
      data: {
        tenantId,
        sources: orderedSources,
        dateFrom,
        dateTo,
        batchSize,
        status: 'RUNNING',
        phase: PHASES.EXAMS,
        startedAt: new Date(),
      },
    });

    this.logger.log(`Created import run ${run.id} for sources: ${orderedSources.join(', ')}`);

    // Resolve record counts per source
    let totalBatches = 0;
    const allBatchDefs: BatchDefinition[] = [];

    for (const source of orderedSources) {
      const stats = await this.rangeResolver.getSourceStats(source as FmSourceType, dateFilter);
      this.logger.log(`${source}: ${stats.totalRecords} records`);

      if (stats.totalRecords === 0) continue;

      const batchCount = Math.ceil(stats.totalRecords / batchSize);
      for (let i = 0; i < batchCount; i++) {
        allBatchDefs.push({
          runId: run.id,
          tenantId,
          phase: PHASES.EXAMS,
          fmSource: source as FmSourceType,
          batchIndex: totalBatches + i,
          offset: i * batchSize + 1, // FM uses 1-based offset
          limit: batchSize,
          dateFrom,
          dateTo,
          totalRecords: stats.totalRecords,
        });
      }
      totalBatches += batchCount;
    }

    // Create all batch records
    for (const def of allBatchDefs) {
      await this.prisma.labImportBatch.create({
        data: {
          runId: def.runId,
          phase: def.phase,
          fmSource: def.fmSource,
          batchIndex: def.batchIndex,
          offset: def.offset,
          limit: def.limit,
          status: 'PENDING',
        },
      });
    }

    // Update run totals
    await this.prisma.labImportRun.update({
      where: { id: run.id },
      data: {
        totalBatches,
        totalRecords: allBatchDefs.reduce((sum, d) => sum + d.totalRecords, 0),
      },
    });

    // Enqueue Phase 1 exam batch jobs
    if (allBatchDefs.length > 0) {
      const jobs = allBatchDefs.map((def) => ({
        name: JOB_NAMES.EXAMS_BATCH,
        data: {
          runId: def.runId,
          tenantId: def.tenantId,
          fmSource: def.fmSource,
          batchIndex: def.batchIndex,
          offset: def.offset,
          limit: def.limit,
          dateFrom: def.dateFrom?.toISOString(),
          dateTo: def.dateTo?.toISOString(),
        },
        opts: {
          attempts: IMPORT_QUEUE_CONFIG.retryAttempts,
          backoff: IMPORT_QUEUE_CONFIG.retryBackoff,
          jobId: `${run.id}-exams-${def.fmSource}-${def.batchIndex}`,
        },
      }));

      await this.importQueue.addBulk(jobs);
      this.logger.log(`Enqueued ${jobs.length} Phase 1 (exams) jobs for run ${run.id}`);
    }

    return { runId: run.id, totalBatches };
  }

  /**
   * Called by processors when all jobs in a phase complete.
   * Advances to the next phase.
   */
  async advancePhase(runId: string): Promise<void> {
    const run = await this.prisma.labImportRun.findUnique({
      where: { id: runId },
    });
    if (!run) return;

    const pendingBatches = await this.prisma.labImportBatch.count({
      where: { runId, phase: run.phase, status: { in: ['PENDING', 'RUNNING'] } },
    });

    if (pendingBatches > 0) return; // Not all jobs done yet

    const currentPhase = run.phase;
    this.logger.log(`Phase ${currentPhase} complete for run ${runId}. Advancing...`);

    switch (currentPhase) {
      case PHASES.EXAMS:
        await this.enqueueWorkflowCommsPhase(runId, run.tenantId, run.sources, run.dateFrom, run.dateTo);
        break;
      case PHASES.WORKFLOW_COMMS:
        await this.enqueueLiquidationsPhase(runId, run.tenantId);
        break;
      case PHASES.LIQUIDATIONS:
        await this.enqueueChargesPhase(runId, run.tenantId);
        break;
      case PHASES.CHARGES:
        await this.enqueueAttachmentsPhase(runId, run.tenantId);
        break;
      case PHASES.ATTACHMENTS:
        await this.completeRun(runId);
        return;
    }
  }

  private async enqueueWorkflowCommsPhase(
    runId: string,
    tenantId: string,
    sources: string[],
    dateFrom: Date | null,
    dateTo: Date | null,
  ): Promise<void> {
    await this.prisma.labImportRun.update({
      where: { id: runId },
      data: { phase: PHASES.WORKFLOW_COMMS },
    });

    const dateFilter = dateFrom && dateTo ? { dateFrom, dateTo } : undefined;
    const batchSize = IMPORT_QUEUE_CONFIG.defaultBatchSize;
    const jobs: any[] = [];

    // Workflow events (only for biopsy sources — they have TRAZA layout)
    for (const source of sources) {
      if (source !== 'BIOPSIAS' && source !== 'BIOPSIASRESPALDO') continue;

      const stats = await this.rangeResolver.getTraceabilityStats(
        source as 'BIOPSIAS' | 'BIOPSIASRESPALDO',
        dateFilter,
      );
      if (stats.totalRecords === 0) continue;

      const batchCount = Math.ceil(stats.totalRecords / batchSize);
      for (let i = 0; i < batchCount; i++) {
        const batchRec = await this.prisma.labImportBatch.create({
          data: {
            runId,
            phase: PHASES.WORKFLOW_COMMS,
            fmSource: source,
            batchIndex: i,
            offset: i * batchSize + 1,
            limit: batchSize,
            status: 'PENDING',
          },
        });

        jobs.push({
          name: JOB_NAMES.WORKFLOW_EVENTS_BATCH,
          data: {
            runId,
            tenantId,
            fmSource: source,
            batchIndex: i,
            offset: i * batchSize + 1,
            limit: batchSize,
            batchId: batchRec.id,
            dateFrom: dateFrom?.toISOString(),
            dateTo: dateTo?.toISOString(),
          },
          opts: {
            attempts: IMPORT_QUEUE_CONFIG.retryAttempts,
            backoff: IMPORT_QUEUE_CONFIG.retryBackoff,
            jobId: `${runId}-workflow-${source}-${i}`,
          },
        });
      }
    }

    // Communications batch — one job per source that has communications
    for (const source of sources) {
      jobs.push({
        name: JOB_NAMES.COMMUNICATIONS_BATCH,
        data: {
          runId,
          tenantId,
          fmSource: source,
          dateFrom: dateFrom?.toISOString(),
          dateTo: dateTo?.toISOString(),
        },
        opts: {
          attempts: IMPORT_QUEUE_CONFIG.retryAttempts,
          backoff: IMPORT_QUEUE_CONFIG.retryBackoff,
          jobId: `${runId}-comms-${source}`,
        },
      });

      await this.prisma.labImportBatch.create({
        data: {
          runId,
          phase: PHASES.WORKFLOW_COMMS,
          fmSource: source,
          batchIndex: 0,
          offset: 0,
          limit: 0,
          status: 'PENDING',
        },
      });
    }

    if (jobs.length > 0) {
      await this.importQueue.addBulk(jobs);
      this.logger.log(`Enqueued ${jobs.length} Phase 2 (workflow/comms) jobs for run ${runId}`);
    } else {
      // No Phase 2 work — skip to Phase 3
      await this.enqueueLiquidationsPhase(runId, tenantId);
    }
  }

  private async enqueueLiquidationsPhase(runId: string, tenantId: string): Promise<void> {
    await this.prisma.labImportRun.update({
      where: { id: runId },
      data: { phase: PHASES.LIQUIDATIONS },
    });

    const batchRec = await this.prisma.labImportBatch.create({
      data: {
        runId,
        phase: PHASES.LIQUIDATIONS,
        fmSource: 'BIOPSIAS', // Liquidaciones live in BIOPSIAS db
        batchIndex: 0,
        offset: 1,
        limit: 10000, // All liquidations in one job (~2.6k records)
        status: 'PENDING',
      },
    });

    await this.importQueue.add(
      JOB_NAMES.LIQUIDATIONS,
      { runId, tenantId, batchId: batchRec.id },
      {
        attempts: IMPORT_QUEUE_CONFIG.retryAttempts,
        backoff: IMPORT_QUEUE_CONFIG.retryBackoff,
        jobId: `${runId}-liquidations`,
      },
    );

    this.logger.log(`Enqueued Phase 3 (liquidations) job for run ${runId}`);
  }

  private async enqueueChargesPhase(runId: string, tenantId: string): Promise<void> {
    await this.prisma.labImportRun.update({
      where: { id: runId },
      data: { phase: PHASES.CHARGES },
    });

    const batchSize = IMPORT_QUEUE_CONFIG.defaultBatchSize;
    const jobs: any[] = [];

    for (const chargeSource of ['BIOPSIAS_INGRESOS', 'PAP_INGRESOS'] as const) {
      const stats = await this.rangeResolver.getChargeStats(chargeSource);
      if (stats.totalRecords === 0) continue;

      const batchCount = Math.ceil(stats.totalRecords / batchSize);
      for (let i = 0; i < batchCount; i++) {
        const batchRec = await this.prisma.labImportBatch.create({
          data: {
            runId,
            phase: PHASES.CHARGES,
            fmSource: chargeSource === 'BIOPSIAS_INGRESOS' ? 'BIOPSIAS' : 'PAPANICOLAOU',
            batchIndex: i,
            offset: i * batchSize + 1,
            limit: batchSize,
            status: 'PENDING',
          },
        });

        jobs.push({
          name: JOB_NAMES.CHARGES_BATCH,
          data: {
            runId,
            tenantId,
            chargeSource,
            batchIndex: i,
            offset: i * batchSize + 1,
            limit: batchSize,
            batchId: batchRec.id,
          },
          opts: {
            attempts: IMPORT_QUEUE_CONFIG.retryAttempts,
            backoff: IMPORT_QUEUE_CONFIG.retryBackoff,
            jobId: `${runId}-charges-${chargeSource}-${i}`,
          },
        });
      }
    }

    if (jobs.length > 0) {
      await this.importQueue.addBulk(jobs);
      this.logger.log(`Enqueued ${jobs.length} Phase 4 (charges) jobs for run ${runId}`);
    } else {
      await this.enqueueAttachmentsPhase(runId, tenantId);
    }
  }

  private async enqueueAttachmentsPhase(runId: string, tenantId: string): Promise<void> {
    await this.prisma.labImportRun.update({
      where: { id: runId },
      data: { phase: PHASES.ATTACHMENTS },
    });

    // Find all pending attachment records for this tenant
    const pendingAttachments = await this.prisma.labDiagnosticReportAttachment.findMany({
      where: { tenantId, migrationStatus: 'PENDING_MIGRATION' },
      select: { id: true, s3Key: true, fmContainerUrlOriginal: true, citolabS3KeyOriginal: true },
    });

    if (pendingAttachments.length === 0) {
      this.logger.log(`No pending attachments for run ${runId}. Completing.`);
      await this.completeRun(runId);
      return;
    }

    const jobs = pendingAttachments.map((att, i) => ({
      name: JOB_NAMES.ATTACHMENT_DOWNLOAD,
      data: {
        runId,
        tenantId,
        attachmentId: att.id,
        targetS3Key: att.s3Key,
        fmContainerUrl: att.fmContainerUrlOriginal,
        citolabS3Key: att.citolabS3KeyOriginal,
      },
      opts: {
        attempts: 10,
        backoff: { type: 'exponential' as const, delay: 3000 },
        jobId: `${runId}-attachment-${att.id}`,
      },
    }));

    await this.attachmentQueue.addBulk(jobs);
    this.logger.log(`Enqueued ${jobs.length} Phase 5 (attachment) jobs for run ${runId}`);
  }

  private async completeRun(runId: string): Promise<void> {
    const failedCount = await this.prisma.labImportBatch.count({
      where: { runId, status: 'FAILED' },
    });

    await this.prisma.labImportRun.update({
      where: { id: runId },
      data: {
        status: failedCount > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
        completedAt: new Date(),
      },
    });

    this.logger.log(`Import run ${runId} completed. ${failedCount} failed batches.`);
  }

  /**
   * Get run status with batch summary.
   */
  async getRunStatus(runId: string) {
    return this.prisma.labImportRun.findUnique({
      where: { id: runId },
      include: {
        batches: {
          select: {
            id: true,
            phase: true,
            fmSource: true,
            batchIndex: true,
            status: true,
            recordCount: true,
            processedCount: true,
            errorCount: true,
            startedAt: true,
            completedAt: true,
          },
          orderBy: { batchIndex: 'asc' },
        },
      },
    });
  }
}
```

- [ ] **Step 3: Run orchestrator tests**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern='lab-import-orchestrator' --no-coverage
```

---

## Task 4: Main import processor + exams batch handler (core Phase 1)

**Files:**
- Create: `apps/api/src/modules/lab/processors/lab-import.processor.ts`
- Create: `apps/api/src/modules/lab/processors/handlers/exams-batch.handler.ts`
- Create: `apps/api/src/modules/lab/processors/handlers/exams-batch.handler.spec.ts`

**Important BullMQ pattern:** `@nestjs/bullmq` creates one Worker per `@Processor()` class. Multiple `@Processor()` classes for the same queue name create multiple Workers, each receiving ALL jobs. The correct pattern for multiple job types in one queue is a **single processor** that dispatches by `job.name` to dedicated handler services.

The main `LabImportProcessor` listens on `lab-import` queue and routes jobs to handler classes.

The exams handler is the most complex. For each batch of FM records, it:
1. Fetches records from FM via findRecords/getRecords
2. Runs them through BiopsyTransformer or PapTransformer
3. Creates/upserts LabPatient (dedup by RUT), LabServiceRequest, LabSpecimen, LabDiagnosticReport, LabDiagnosticReportSigner, LabDiagnosticReportAttachment
4. Updates LabImportBatch progress

- [ ] **Step 1: Write handler tests**

Create `apps/api/src/modules/lab/processors/handlers/exams-batch.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ExamsBatchHandler } from './exams-batch.handler';
import { BiopsyTransformer } from '../../filemaker/transformers/biopsy.transformer';
import { PapTransformer } from '../../filemaker/transformers/pap.transformer';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LabImportOrchestratorService } from '../services/lab-import-orchestrator.service';
import { LAB_IMPORT_QUEUE } from '../constants/queue.constants';
import type { FmRecord } from '@zeru/shared';

const makeFmRecord = (overrides: Record<string, unknown> = {}): FmRecord => ({
  recordId: '1',
  modId: '1',
  fieldData: {
    'INFORME Nº': 12345,
    'NOMBRE': 'JUAN',
    'A.PATERNO': 'PEREZ',
    'A.MATERNO': 'SOTO',
    'RUT': '12.345.678-5',
    'TIPO DE EXAMEN': 'Biopsia',
    'PROCEDENCIA CODIGO UNICO': 'LAB-001',
    'DIAGNOSTICO': 'Adenocarcinoma moderadamente diferenciado',
    'TEXTO BIOPSIAS::TEXTO': 'Texto completo del informe...',
    'PATOLOGO': 'Dr. Martinez (PAT-001)',
    'FECHA VALIDACIÓN': '03/15/2026',
    'FECHA': '03/14/2026',
    'URGENTES': '',
    'Alterado o Crítico': '',
    'Activar Subir Examen': '',
    'Estado Web': '',
    'MUESTRA DE': 'Estómago',
    'ANTECEDENTES': 'Dolor epigástrico',
    'SUBTIPO EXAMEN': '',
    'SOLICITADA POR': 'Dr. López',
    'Revisado por patólogo supervisor': '',
    'caso corregido por PAT SUP': '',
    'caso corregido por validacion': '',
    'INFORMES PDF::PDF INFORME': '',
    'EDAD': '55',
    ...overrides,
  },
  portalData: {},
});

describe('ExamsBatchHandler', () => {
  let handler: ExamsBatchHandler;
  let prisma: any;
  let fmApi: jest.Mocked<FmApiService>;

  beforeEach(async () => {
    prisma = {
      labPatient: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'patient-1' }),
        upsert: jest.fn().mockResolvedValue({ id: 'patient-1' }),
      },
      labServiceRequest: {
        upsert: jest.fn().mockResolvedValue({ id: 'sr-1' }),
      },
      labSpecimen: {
        upsert: jest.fn().mockResolvedValue({ id: 'specimen-1' }),
      },
      labDiagnosticReport: {
        upsert: jest.fn().mockResolvedValue({ id: 'dr-1' }),
      },
      labDiagnosticReportSigner: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      labDiagnosticReportAttachment: {
        upsert: jest.fn(),
      },
      labOrigin: {
        findFirst: jest.fn().mockResolvedValue({ id: 'origin-1' }),
      },
      labImportBatch: {
        update: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'batch-1' }),
      },
      labImportRun: {
        update: jest.fn(),
      },
      $transaction: jest.fn((fn) => fn(prisma)),
    };

    const module = await Test.createTestingModule({
      providers: [
        ExamsBatchHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: FmApiService, useValue: { findRecords: jest.fn(), getRecords: jest.fn() } },
        { provide: BiopsyTransformer, useValue: new BiopsyTransformer() },
        { provide: PapTransformer, useValue: new PapTransformer() },
        {
          provide: LabImportOrchestratorService,
          useValue: { advancePhase: jest.fn() },
        },
        { provide: getQueueToken(LAB_IMPORT_QUEUE), useValue: {} },
      ],
    }).compile();

    handler = module.get(ExamsBatchHandler);
    fmApi = module.get(FmApiService);
  });

  describe('process', () => {
    it('processes a batch of biopsy records', async () => {
      fmApi.findRecords.mockResolvedValue({
        records: [makeFmRecord()],
        totalRecordCount: 1,
      });

      const job = {
        data: {
          runId: 'run-1',
          tenantId: 'tenant-1',
          fmSource: 'BIOPSIAS',
          batchIndex: 0,
          offset: 1,
          limit: 100,
        },
      } as any;

      await handler.handle(job.data);

      expect(prisma.labServiceRequest.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.labDiagnosticReport.upsert).toHaveBeenCalledTimes(1);
    });

    it('creates patient with needsMerge=true when no RUT', async () => {
      fmApi.findRecords.mockResolvedValue({
        records: [makeFmRecord({ 'RUT': '' })],
        totalRecordCount: 1,
      });

      const job = {
        data: {
          runId: 'run-1',
          tenantId: 'tenant-1',
          fmSource: 'BIOPSIAS',
          batchIndex: 0,
          offset: 1,
          limit: 100,
        },
      } as any;

      await handler.handle(job.data);

      expect(prisma.labPatient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            needsMerge: true,
            rut: null,
          }),
        }),
      );
    });

    it('updates batch status on failure', async () => {
      fmApi.findRecords.mockRejectedValue(new Error('FM timeout'));

      const job = {
        data: {
          runId: 'run-1',
          tenantId: 'tenant-1',
          fmSource: 'BIOPSIAS',
          batchIndex: 0,
          offset: 1,
          limit: 100,
        },
      } as any;

      await expect(handler.handle(job.data)).rejects.toThrow('FM timeout');

      expect(prisma.labImportBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });
  });
});
```

- [ ] **Step 2: Implement the exams batch handler**

Create `apps/api/src/modules/lab/processors/handlers/exams-batch.handler.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { BiopsyTransformer } from '../../../filemaker/transformers/biopsy.transformer';
import { PapTransformer } from '../../../filemaker/transformers/pap.transformer';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';
import {
  toExamCategory,
  toDiagnosticReportStatus,
  toFmSource,
  toSigningRole,
  toAttachmentCategory,
  toGender,
} from '../../constants/enum-maps';
import type { FmRecord } from '@zeru/shared';
import type { ExtractedExam, FmSourceType } from '../../../filemaker/transformers/types';

export interface ExamsBatchJobData {
  runId: string;
  tenantId: string;
  fmSource: FmSourceType;
  batchIndex: number;
  offset: number;
  limit: number;
  dateFrom?: string;
  dateTo?: string;
}

/** FM source → { database, layout, dateField } */
const SOURCE_META: Record<string, { database: string; layout: string; dateField: string; type: 'biopsy' | 'pap' }> = {
  BIOPSIAS: { database: 'BIOPSIAS', layout: 'Validación Final*', dateField: 'FECHA VALIDACIÓN', type: 'biopsy' },
  BIOPSIASRESPALDO: { database: 'BIOPSIASRESPALDO', layout: 'Validación Final*', dateField: 'FECHA VALIDACIÓN', type: 'biopsy' },
  PAPANICOLAOU: { database: 'PAPANICOLAOU', layout: 'INGRESO', dateField: 'FECHA', type: 'pap' },
  PAPANICOLAOUHISTORICO: { database: 'PAPANICOLAOUHISTORICO', layout: 'INGRESO', dateField: 'FECHA', type: 'pap' },
};

@Injectable()
export class ExamsBatchHandler {
  private readonly logger = new Logger(ExamsBatchHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly biopsyTransformer: BiopsyTransformer,
    private readonly papTransformer: PapTransformer,
    private readonly orchestrator: LabImportOrchestratorService,
  ) {}

  async handle(data: ExamsBatchJobData): Promise<void> {
    const { runId, tenantId, fmSource, batchIndex, offset, limit, dateFrom, dateTo } = data;
    const meta = SOURCE_META[fmSource];

    // Find batch record
    const batch = await this.prisma.labImportBatch.findFirst({
      where: { runId, phase: 'phase-1-exams', fmSource, batchIndex },
    });
    const batchId = batch?.id;

    try {
      if (batchId) {
        await this.prisma.labImportBatch.update({
          where: { id: batchId },
          data: { status: 'RUNNING', startedAt: new Date() },
        });
      }

      // Fetch records from FM
      const records = await this.fetchRecords(meta, offset, limit, dateFrom, dateTo);
      this.logger.log(`[${fmSource}] Batch ${batchIndex}: fetched ${records.length} records`);

      let processedCount = 0;
      let errorCount = 0;
      const errors: Array<{ recordId: string; error: string }> = [];

      for (const record of records) {
        try {
          const exam = meta.type === 'biopsy'
            ? this.biopsyTransformer.extract(record, fmSource)
            : this.papTransformer.extract(record, fmSource);

          await this.processExam(tenantId, exam);
          processedCount++;
        } catch (error) {
          errorCount++;
          const msg = error instanceof Error ? error.message : String(error);
          errors.push({ recordId: record.recordId, error: msg });
          this.logger.warn(`[${fmSource}] Record ${record.recordId} failed: ${msg}`);
        }
      }

      // Update batch status
      if (batchId) {
        await this.prisma.labImportBatch.update({
          where: { id: batchId },
          data: {
            status: errorCount === records.length ? 'FAILED' : 'COMPLETED',
            recordCount: records.length,
            processedCount,
            errorCount,
            errors: errors.length > 0 ? errors : undefined,
            completedAt: new Date(),
          },
        });
      }

      // Update run counters
      await this.prisma.labImportRun.update({
        where: { id: runId },
        data: {
          completedBatches: { increment: 1 },
          processedRecords: { increment: processedCount },
          errorRecords: { increment: errorCount },
          ...(errorCount === records.length ? { failedBatches: { increment: 1 } } : {}),
        },
      });

      // Check if phase is complete
      await this.orchestrator.advancePhase(runId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${fmSource}] Batch ${batchIndex} failed entirely: ${msg}`);

      if (batchId) {
        await this.prisma.labImportBatch.update({
          where: { id: batchId },
          data: { status: 'FAILED', errors: [{ error: msg }], completedAt: new Date() },
        });
      }

      await this.prisma.labImportRun.update({
        where: { id: runId },
        data: {
          completedBatches: { increment: 1 },
          failedBatches: { increment: 1 },
        },
      });

      throw error; // Let BullMQ retry
    }
  }

  private async fetchRecords(
    meta: { database: string; layout: string; dateField: string },
    offset: number,
    limit: number,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<FmRecord[]> {
    if (dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      const rangeStr = `${this.fmDate(from)}...${this.fmDate(to)}`;
      const response = await this.fmApi.findRecords(
        meta.database,
        meta.layout,
        [{ [meta.dateField]: rangeStr }],
        { offset, limit, dateformats: 2 },
      );
      return response.records;
    }

    const response = await this.fmApi.getRecords(meta.database, meta.layout, {
      offset,
      limit,
      dateformats: 2,
    });
    return response.records;
  }

  private async processExam(tenantId: string, exam: ExtractedExam): Promise<void> {
    // 1. Resolve or create Patient
    const patientId = await this.resolvePatient(tenantId, exam);

    // 2. Resolve LabOrigin
    const labOrigin = await this.prisma.labOrigin.findFirst({
      where: { tenantId, code: exam.labOriginCode },
    });
    const labOriginId = labOrigin?.id ?? 'unknown'; // FK must exist

    // 3. Upsert ServiceRequest
    const sr = await this.prisma.labServiceRequest.upsert({
      where: {
        tenantId_fmSource_fmInformeNumber: {
          tenantId,
          fmSource: toFmSource(exam.fmSource),
          fmInformeNumber: exam.fmInformeNumber,
        },
      },
      create: {
        tenantId,
        fmInformeNumber: exam.fmInformeNumber,
        fmSource: toFmSource(exam.fmSource),
        subjectFirstName: exam.subjectFirstName,
        subjectPaternalLastName: exam.subjectPaternalLastName,
        subjectMaternalLastName: exam.subjectMaternalLastName,
        subjectRut: exam.subjectRut,
        subjectAge: exam.subjectAge,
        subjectId: patientId,
        category: toExamCategory(exam.category),
        subcategory: exam.subcategory,
        priority: exam.isUrgent ? 'URGENT' : 'ROUTINE',
        requestingPhysicianName: exam.requestingPhysicianName,
        labOriginId,
        labOriginCodeSnapshot: exam.labOriginCode,
        sampleCollectedAt: exam.sampleCollectedAt,
        receivedAt: exam.receivedAt,
        requestedAt: exam.requestedAt,
        clinicalHistory: exam.clinicalHistory,
        muestraDe: exam.anatomicalSite,
      },
      update: {
        subjectFirstName: exam.subjectFirstName,
        subjectPaternalLastName: exam.subjectPaternalLastName,
        subjectMaternalLastName: exam.subjectMaternalLastName,
        subjectRut: exam.subjectRut,
        subjectAge: exam.subjectAge,
        subjectId: patientId,
        category: toExamCategory(exam.category),
        subcategory: exam.subcategory,
        requestingPhysicianName: exam.requestingPhysicianName,
        labOriginId,
        labOriginCodeSnapshot: exam.labOriginCode,
        sampleCollectedAt: exam.sampleCollectedAt,
        receivedAt: exam.receivedAt,
        requestedAt: exam.requestedAt,
        clinicalHistory: exam.clinicalHistory,
        muestraDe: exam.anatomicalSite,
      },
    });

    // 4. Upsert Specimen (one per exam at import time)
    await this.prisma.labSpecimen.upsert({
      where: {
        // Use composite workaround: find by serviceRequestId + sequenceNumber
        tenantId_serviceRequestId_sequenceNumber: undefined, // Not a unique key — use manual approach
      },
      create: {
        tenantId,
        serviceRequestId: sr.id,
        sequenceNumber: 1,
        anatomicalSite: exam.anatomicalSite,
        muestraDeText: exam.anatomicalSite,
        status: 'RECEIVED_SPECIMEN',
      },
      update: {
        anatomicalSite: exam.anatomicalSite,
        muestraDeText: exam.anatomicalSite,
      },
    }).catch(async () => {
      // Fallback: findFirst + create/update
      const existing = await this.prisma.labSpecimen.findFirst({
        where: { tenantId, serviceRequestId: sr.id, sequenceNumber: 1 },
      });
      if (existing) {
        await this.prisma.labSpecimen.update({
          where: { id: existing.id },
          data: { anatomicalSite: exam.anatomicalSite, muestraDeText: exam.anatomicalSite },
        });
      } else {
        await this.prisma.labSpecimen.create({
          data: {
            tenantId,
            serviceRequestId: sr.id,
            sequenceNumber: 1,
            anatomicalSite: exam.anatomicalSite,
            muestraDeText: exam.anatomicalSite,
            status: 'RECEIVED_SPECIMEN',
          },
        });
      }
    });

    // 5. Upsert DiagnosticReport
    const dr = await this.prisma.labDiagnosticReport.upsert({
      where: {
        tenantId_fmSource_fmInformeNumber: {
          tenantId,
          fmSource: toFmSource(exam.fmSource),
          fmInformeNumber: exam.fmInformeNumber,
        },
      },
      create: {
        tenantId,
        serviceRequestId: sr.id,
        fmInformeNumber: exam.fmInformeNumber,
        fmSource: toFmSource(exam.fmSource),
        status: toDiagnosticReportStatus(exam.status),
        conclusion: exam.conclusion,
        fullText: exam.fullText,
        microscopicDescription: exam.microscopicDescription,
        macroscopicDescription: exam.macroscopicDescription,
        isUrgent: exam.isUrgent,
        isAlteredOrCritical: exam.isAlteredOrCritical,
        validatedAt: exam.validatedAt,
        issuedAt: exam.issuedAt,
        primarySignerCodeSnapshot: exam.signers.find((s) => s.role === 'PRIMARY_PATHOLOGIST')?.codeSnapshot ?? null,
      },
      update: {
        status: toDiagnosticReportStatus(exam.status),
        conclusion: exam.conclusion,
        fullText: exam.fullText,
        microscopicDescription: exam.microscopicDescription,
        macroscopicDescription: exam.macroscopicDescription,
        isUrgent: exam.isUrgent,
        isAlteredOrCritical: exam.isAlteredOrCritical,
        validatedAt: exam.validatedAt,
        issuedAt: exam.issuedAt,
        primarySignerCodeSnapshot: exam.signers.find((s) => s.role === 'PRIMARY_PATHOLOGIST')?.codeSnapshot ?? null,
      },
    });

    // 6. Replace Signers (delete + recreate for idempotency)
    if (exam.signers.length > 0) {
      await this.prisma.labDiagnosticReportSigner.deleteMany({
        where: { tenantId, diagnosticReportId: dr.id },
      });
      await this.prisma.labDiagnosticReportSigner.createMany({
        data: exam.signers.map((s) => ({
          tenantId,
          diagnosticReportId: dr.id,
          codeSnapshot: s.codeSnapshot,
          nameSnapshot: s.nameSnapshot,
          role: toSigningRole(s.role),
          signatureOrder: s.signatureOrder,
          signedAt: s.signedAt ?? new Date(),
          isActive: s.isActive,
          supersededBy: s.supersededBy,
          correctionReason: s.correctionReason,
        })),
      });
    }

    // 7. Create Attachment Refs (upsert by s3Key)
    for (const ref of exam.attachmentRefs) {
      const existing = await this.prisma.labDiagnosticReportAttachment.findFirst({
        where: { tenantId, diagnosticReportId: dr.id, s3Key: ref.s3Key },
      });
      if (existing) {
        await this.prisma.labDiagnosticReportAttachment.update({
          where: { id: existing.id },
          data: {
            category: toAttachmentCategory(ref.category),
            label: ref.label,
            sequenceOrder: ref.sequenceOrder,
            contentType: ref.contentType,
            fmSourceField: ref.fmSourceField,
            fmContainerUrlOriginal: ref.fmContainerUrlOriginal,
            citolabS3KeyOriginal: ref.citolabS3KeyOriginal,
          },
        });
      } else {
        await this.prisma.labDiagnosticReportAttachment.create({
          data: {
            tenantId,
            diagnosticReportId: dr.id,
            category: toAttachmentCategory(ref.category),
            label: ref.label,
            sequenceOrder: ref.sequenceOrder,
            s3Bucket: '', // Will be filled by attachment processor
            s3Key: ref.s3Key,
            contentType: ref.contentType,
            fmSourceField: ref.fmSourceField,
            fmContainerUrlOriginal: ref.fmContainerUrlOriginal,
            citolabS3KeyOriginal: ref.citolabS3KeyOriginal,
            migrationStatus: 'PENDING_MIGRATION',
          },
        });
      }
    }
  }

  /**
   * Resolve or create a LabPatient. Dedup by RUT when present.
   * No RUT → creates new patient with needsMerge=true.
   */
  private async resolvePatient(tenantId: string, exam: ExtractedExam): Promise<string | null> {
    if (exam.subjectRut) {
      // Try to find by RUT
      const existing = await this.prisma.labPatient.findFirst({
        where: { tenantId, rut: exam.subjectRut },
      });
      if (existing) return existing.id;

      // Create new patient with RUT
      const patient = await this.prisma.labPatient.create({
        data: {
          tenantId,
          rut: exam.subjectRut,
          firstName: exam.subjectFirstName,
          paternalLastName: exam.subjectPaternalLastName,
          maternalLastName: exam.subjectMaternalLastName,
          gender: toGender(exam.subjectGender),
          needsMerge: false,
        },
      }).catch(async () => {
        // Unique constraint race condition — find the existing one
        const found = await this.prisma.labPatient.findFirst({
          where: { tenantId, rut: exam.subjectRut },
        });
        return found;
      });

      return patient?.id ?? null;
    }

    // No RUT — create a new patient with needsMerge=true
    const patient = await this.prisma.labPatient.create({
      data: {
        tenantId,
        rut: null,
        firstName: exam.subjectFirstName,
        paternalLastName: exam.subjectPaternalLastName,
        maternalLastName: exam.subjectMaternalLastName,
        gender: toGender(exam.subjectGender),
        needsMerge: true,
      },
    });
    return patient.id;
  }

  private fmDate(d: Date): string {
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  }
}
```

- [ ] **Step 3: Create the main import queue dispatcher processor**

Create `apps/api/src/modules/lab/processors/lab-import.processor.ts`:

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LAB_IMPORT_QUEUE, JOB_NAMES } from '../constants/queue.constants';
import { ExamsBatchHandler } from './handlers/exams-batch.handler';
import { WorkflowEventsBatchHandler } from './handlers/workflow-events-batch.handler';
import { CommunicationsBatchHandler } from './handlers/communications-batch.handler';
import { LiquidationsHandler } from './handlers/liquidations.handler';
import { ChargesBatchHandler } from './handlers/charges-batch.handler';

/**
 * Single processor for the lab-import queue.
 * Dispatches to the correct handler based on job.name.
 *
 * BullMQ creates one Worker per @Processor class. Having multiple
 * @Processor classes for the same queue creates multiple Workers,
 * each receiving ALL jobs. This dispatcher pattern is the correct
 * approach for multiple job types in a single queue.
 */
@Processor(LAB_IMPORT_QUEUE)
export class LabImportProcessor extends WorkerHost {
  private readonly logger = new Logger(LabImportProcessor.name);

  constructor(
    private readonly examsBatchHandler: ExamsBatchHandler,
    private readonly workflowHandler: WorkflowEventsBatchHandler,
    private readonly commsHandler: CommunicationsBatchHandler,
    private readonly liquidationsHandler: LiquidationsHandler,
    private readonly chargesHandler: ChargesBatchHandler,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job ${job.name} (id: ${job.id})`);

    switch (job.name) {
      case JOB_NAMES.EXAMS_BATCH:
        return this.examsBatchHandler.handle(job.data);
      case JOB_NAMES.WORKFLOW_EVENTS_BATCH:
        return this.workflowHandler.handle(job.data);
      case JOB_NAMES.COMMUNICATIONS_BATCH:
        return this.commsHandler.handle(job.data);
      case JOB_NAMES.LIQUIDATIONS:
        return this.liquidationsHandler.handle(job.data);
      case JOB_NAMES.CHARGES_BATCH:
        return this.chargesHandler.handle(job.data);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern='exams-batch.handler' --no-coverage
```

---

## Task 5: Workflow events batch handler (Phase 2a)

**Files:**
- Create: `apps/api/src/modules/lab/processors/handlers/workflow-events-batch.handler.ts`
- Create: `apps/api/src/modules/lab/processors/handlers/workflow-events-batch.handler.spec.ts`

- [ ] **Step 1: Write workflow events handler tests**

Create `apps/api/src/modules/lab/processors/handlers/workflow-events-batch.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { WorkflowEventsBatchHandler } from './workflow-events-batch.handler';
import { TraceabilityTransformer } from '../../filemaker/transformers/traceability.transformer';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LabImportOrchestratorService } from '../services/lab-import-orchestrator.service';
import type { FmRecord } from '@zeru/shared';

const makeTraceRecord = (): FmRecord => ({
  recordId: '100',
  modId: '1',
  fieldData: {
    'INFORME Nº': 12345,
    'Trazabilidad::Responsable_Ingreso examen': 'María López',
    'Trazabilidad::Fecha_Ingreso examen': '03/10/2026',
    'Trazabilidad::Responsable_Macroscopía': 'Pedro Gómez',
    'Trazabilidad::Fecha_Macroscopía': '03/11/2026',
    'Trazabilidad::Responsable_Validación': 'Dr. Martínez',
    'Trazabilidad::Fecha_Validación': '03/15/2026',
  },
  portalData: {},
});

describe('WorkflowEventsBatchHandler', () => {
  let handler: WorkflowEventsBatchHandler;
  let prisma: any;
  let fmApi: jest.Mocked<FmApiService>;

  beforeEach(async () => {
    prisma = {
      labDiagnosticReport: {
        findFirst: jest.fn().mockResolvedValue({ id: 'dr-1' }),
      },
      labExamWorkflowEvent: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      labImportBatch: {
        update: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'batch-1' }),
      },
      labImportRun: { update: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        WorkflowEventsBatchHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: FmApiService, useValue: { getRecords: jest.fn(), findRecords: jest.fn() } },
        { provide: TraceabilityTransformer, useValue: new TraceabilityTransformer() },
        { provide: LabImportOrchestratorService, useValue: { advancePhase: jest.fn() } },
      ],
    }).compile();

    handler = module.get(WorkflowEventsBatchHandler);
    fmApi = module.get(FmApiService);
  });

  it('creates workflow events for a traceability record', async () => {
    fmApi.getRecords.mockResolvedValue({
      records: [makeTraceRecord()],
      totalRecordCount: 1,
    });

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        fmSource: 'BIOPSIAS',
        batchIndex: 0,
        offset: 1,
        limit: 100,
        batchId: 'batch-1',
      },
    } as any;

    await handler.handle(job.data);

    expect(prisma.labExamWorkflowEvent.deleteMany).toHaveBeenCalled();
    expect(prisma.labExamWorkflowEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'ORIGIN_INTAKE',
            performedByNameSnapshot: 'María López',
          }),
        ]),
      }),
    );
  });

  it('skips records with no matching diagnostic report', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue(null);
    fmApi.getRecords.mockResolvedValue({
      records: [makeTraceRecord()],
      totalRecordCount: 1,
    });

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        fmSource: 'BIOPSIAS',
        batchIndex: 0,
        offset: 1,
        limit: 100,
        batchId: 'batch-1',
      },
    } as any;

    await handler.handle(job.data);

    expect(prisma.labExamWorkflowEvent.createMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement workflow events handler**

Create `apps/api/src/modules/lab/processors/handlers/workflow-events-batch.handler.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { TraceabilityTransformer } from '../../../filemaker/transformers/traceability.transformer';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';
import { toWorkflowEventType, toFmSource } from '../../constants/enum-maps';
import type { FmSourceType } from '../../../filemaker/transformers/types';

export interface WorkflowBatchJobData {
  runId: string;
  tenantId: string;
  fmSource: FmSourceType;
  batchIndex: number;
  offset: number;
  limit: number;
  batchId: string;
  dateFrom?: string;
  dateTo?: string;
}

const TRAZA_CONFIG: Record<string, { database: string; layout: string }> = {
  BIOPSIAS: { database: 'BIOPSIAS', layout: 'TRAZA' },
  BIOPSIASRESPALDO: { database: 'BIOPSIASRESPALDO', layout: 'TRAZA' },
};

@Injectable()
export class WorkflowEventsBatchHandler {
  private readonly logger = new Logger(WorkflowEventsBatchHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly traceabilityTransformer: TraceabilityTransformer,
    private readonly orchestrator: LabImportOrchestratorService,
  ) {}

  async handle(data: WorkflowBatchJobData): Promise<void> {
    const { runId, tenantId, fmSource, offset, limit, batchId } = data;
    const config = TRAZA_CONFIG[fmSource];
    if (!config) {
      this.logger.warn(`No traceability config for source ${fmSource}, skipping`);
      return;
    }

    try {
      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const response = await this.fmApi.getRecords(config.database, config.layout, {
        offset,
        limit,
        dateformats: 2,
      });

      let processedCount = 0;
      let errorCount = 0;
      const errors: Array<{ recordId: string; error: string }> = [];

      for (const record of response.records) {
        try {
          const result = this.traceabilityTransformer.extract(record);
          if (result.events.length === 0) continue;

          // Find the DiagnosticReport
          const dr = await this.prisma.labDiagnosticReport.findFirst({
            where: {
              tenantId,
              fmSource: toFmSource(fmSource),
              fmInformeNumber: result.fmInformeNumber,
            },
          });

          if (!dr) {
            this.logger.debug(`No DR for informe ${result.fmInformeNumber} in ${fmSource}`);
            continue;
          }

          // Replace workflow events for this DR (idempotent)
          await this.prisma.labExamWorkflowEvent.deleteMany({
            where: { tenantId, diagnosticReportId: dr.id },
          });

          await this.prisma.labExamWorkflowEvent.createMany({
            data: result.events.map((e) => ({
              tenantId,
              diagnosticReportId: dr.id,
              eventType: toWorkflowEventType(e.eventType),
              sequenceOrder: e.sequenceOrder,
              occurredAt: e.occurredAt,
              performedByNameSnapshot: e.performedByNameSnapshot,
              sourceField: e.sourceField,
            })),
          });

          processedCount++;
        } catch (error) {
          errorCount++;
          const msg = error instanceof Error ? error.message : String(error);
          errors.push({ recordId: record.recordId, error: msg });
        }
      }

      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: {
          status: 'COMPLETED',
          recordCount: response.records.length,
          processedCount,
          errorCount,
          errors: errors.length > 0 ? errors : undefined,
          completedAt: new Date(),
        },
      });

      await this.prisma.labImportRun.update({
        where: { id: runId },
        data: {
          completedBatches: { increment: 1 },
          processedRecords: { increment: processedCount },
          errorRecords: { increment: errorCount },
        },
      });

      await this.orchestrator.advancePhase(runId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Workflow batch ${batchId} failed: ${msg}`);

      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: { status: 'FAILED', errors: [{ error: msg }], completedAt: new Date() },
      });

      throw error;
    }
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern='workflow-events-batch.handler' --no-coverage
```

---

## Task 6: Communications batch handler (Phase 2b)

**Files:**
- Create: `apps/api/src/modules/lab/processors/handlers/communications-batch.handler.ts`
- Create: `apps/api/src/modules/lab/processors/handlers/communications-batch.handler.spec.ts`

- [ ] **Step 1: Write communications handler tests**

Create `apps/api/src/modules/lab/processors/handlers/communications-batch.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { CommunicationsBatchHandler } from './communications-batch.handler';
import { CommunicationTransformer } from '../../filemaker/transformers/communication.transformer';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LabImportOrchestratorService } from '../services/lab-import-orchestrator.service';
import type { FmRecord } from '@zeru/shared';

describe('CommunicationsBatchHandler', () => {
  let handler: CommunicationsBatchHandler;
  let prisma: any;
  let fmApi: jest.Mocked<FmApiService>;

  beforeEach(async () => {
    prisma = {
      labDiagnosticReport: {
        findFirst: jest.fn().mockResolvedValue({ id: 'dr-1' }),
      },
      labCommunication: {
        create: jest.fn().mockResolvedValue({ id: 'comm-1' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      labImportBatch: {
        update: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'batch-1' }),
      },
      labImportRun: { update: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        CommunicationsBatchHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: FmApiService, useValue: { getAllRecords: jest.fn(), findAll: jest.fn() } },
        { provide: CommunicationTransformer, useValue: new CommunicationTransformer() },
        { provide: LabImportOrchestratorService, useValue: { advancePhase: jest.fn() } },
      ],
    }).compile();

    handler = module.get(CommunicationsBatchHandler);
    fmApi = module.get(FmApiService);
  });

  it('processes PAP communications from standalone COMUNICACIONES table', async () => {
    fmApi.getAllRecords.mockResolvedValue([
      {
        recordId: '1',
        modId: '1',
        fieldData: {
          'fk_InformeNumero': 5000,
          'Comentario': 'Muestra insuficiente para análisis',
          'Motivo': 'Muestra insuficiente',
          'Respuesta': 'Se solicitó nueva muestra',
          'IngresoFecha': '03/10/2026',
          'IngresoHora': '10:30',
          'IngresoResponsable': 'Ana Torres',
        },
      },
    ]);

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        fmSource: 'PAPANICOLAOU',
      },
    } as any;

    await handler.handle(job.data);

    expect(prisma.labCommunication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: 'Muestra insuficiente para análisis',
          loggedByNameSnapshot: 'Ana Torres',
        }),
      }),
    );
  });

  it('skips sources that have no communication data', async () => {
    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        fmSource: 'BIOPSIASRESPALDO',
      },
    } as any;

    await handler.handle(job.data);

    // BIOPSIASRESPALDO communications are embedded in exam portals (handled during exam import)
    // This processor skips non-primary sources
    expect(fmApi.getAllRecords).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement communications handler**

Create `apps/api/src/modules/lab/processors/handlers/communications-batch.handler.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { CommunicationTransformer } from '../../../filemaker/transformers/communication.transformer';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';
import { toCommunicationCategory, toFmSource } from '../../constants/enum-maps';
import type { FmSourceType, ExtractedCommunication } from '../../../filemaker/transformers/types';

export interface CommsBatchJobData {
  runId: string;
  tenantId: string;
  fmSource: FmSourceType;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class CommunicationsBatchHandler {
  private readonly logger = new Logger(CommunicationsBatchHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly communicationTransformer: CommunicationTransformer,
    private readonly orchestrator: LabImportOrchestratorService,
  ) {}

  async handle(data: CommsBatchJobData): Promise<void> {
    const { runId, tenantId, fmSource } = data;

    const batch = await this.prisma.labImportBatch.findFirst({
      where: { runId, phase: 'phase-2-workflow-comms', fmSource },
      orderBy: { createdAt: 'desc' },
    });

    try {
      if (batch) {
        await this.prisma.labImportBatch.update({
          where: { id: batch.id },
          data: { status: 'RUNNING', startedAt: new Date() },
        });
      }

      let processedCount = 0;
      let errorCount = 0;

      // PAP: standalone COMUNICACIONES table
      if (fmSource === 'PAPANICOLAOU') {
        const records = await this.fmApi.getAllRecords(
          this.communicationTransformer.papDatabase,
          this.communicationTransformer.papLayout,
          { dateformats: 2 },
        );

        for (const record of records) {
          try {
            const comm = this.communicationTransformer.extractFromPapRecord(record);
            if (!comm) continue;

            await this.persistCommunication(tenantId, fmSource, comm);
            processedCount++;
          } catch (error) {
            errorCount++;
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.warn(`PAP comm record ${record.recordId} failed: ${msg}`);
          }
        }
      }

      // BIOPSIAS: communications are in the exam portal, already extracted during Phase 1
      // We re-fetch only the exam records that have communications (portal data)
      // This is handled separately — for biopsies we re-read the exams and extract portal
      if (fmSource === 'BIOPSIAS') {
        // Fetch all biopsy records (paginated) and extract communications from portal
        const allRecords = await this.fmApi.getAllRecords(
          this.communicationTransformer.biopsyDatabase,
          this.communicationTransformer.biopsyLayout,
          { dateformats: 2, portals: ['COMUNICACIONES'] },
        );

        for (const record of allRecords) {
          try {
            const comms = this.communicationTransformer.extractFromBiopsyPortal(record);
            if (comms.length === 0) continue;

            for (const comm of comms) {
              await this.persistCommunication(tenantId, fmSource, comm);
              processedCount++;
            }
          } catch (error) {
            errorCount++;
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Biopsy comm for record ${record.recordId} failed: ${msg}`);
          }
        }
      }

      // Other sources (BIOPSIASRESPALDO, PAPANICOLAOUHISTORICO) don't have separate comm data
      if (fmSource !== 'BIOPSIAS' && fmSource !== 'PAPANICOLAOU') {
        this.logger.log(`No communications to import for source ${fmSource}`);
      }

      if (batch) {
        await this.prisma.labImportBatch.update({
          where: { id: batch.id },
          data: {
            status: 'COMPLETED',
            processedCount,
            errorCount,
            completedAt: new Date(),
          },
        });
      }

      await this.orchestrator.advancePhase(runId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Communications batch failed for ${fmSource}: ${msg}`);

      if (batch) {
        await this.prisma.labImportBatch.update({
          where: { id: batch.id },
          data: { status: 'FAILED', errors: [{ error: msg }], completedAt: new Date() },
        });
      }

      throw error;
    }
  }

  private async persistCommunication(
    tenantId: string,
    fmSource: FmSourceType,
    comm: ExtractedCommunication,
  ): Promise<void> {
    // Find DiagnosticReport by informe number
    // For BIOPSIAS comms, the DR source is BIOPSIAS; for PAP, it's PAPANICOLAOU
    const dr = await this.prisma.labDiagnosticReport.findFirst({
      where: {
        tenantId,
        fmSource: toFmSource(fmSource),
        fmInformeNumber: comm.fkInformeNumber,
      },
    });

    if (!dr) {
      this.logger.debug(`No DR for informe ${comm.fkInformeNumber} in ${fmSource}`);
      return;
    }

    // Dedup by content + loggedAt + DR
    const existing = await this.prisma.labCommunication.findFirst({
      where: {
        tenantId,
        diagnosticReportId: dr.id,
        content: comm.content,
        loggedAt: comm.loggedAt ?? new Date(0),
      },
    });

    if (existing) return;

    await this.prisma.labCommunication.create({
      data: {
        tenantId,
        diagnosticReportId: dr.id,
        reason: comm.reason,
        content: comm.content,
        response: comm.response,
        loggedAt: comm.loggedAt ?? new Date(0),
        loggedByNameSnapshot: comm.loggedByNameSnapshot,
        category: comm.category ? toCommunicationCategory(comm.category) : null,
      },
    });
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern='communications-batch.handler' --no-coverage
```

---

## Task 7: Liquidations handler (Phase 3)

**Files:**
- Create: `apps/api/src/modules/lab/processors/handlers/liquidations.handler.ts`
- Create: `apps/api/src/modules/lab/processors/handlers/liquidations.handler.spec.ts`

- [ ] **Step 1: Write liquidations handler tests**

Create `apps/api/src/modules/lab/processors/handlers/liquidations.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { LiquidationsHandler } from './liquidations.handler';
import { LiquidationTransformer } from '../../filemaker/transformers/liquidation.transformer';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LabImportOrchestratorService } from '../services/lab-import-orchestrator.service';

describe('LiquidationsHandler', () => {
  let handler: LiquidationsHandler;
  let prisma: any;
  let fmApi: jest.Mocked<FmApiService>;

  beforeEach(async () => {
    prisma = {
      labLiquidation: {
        upsert: jest.fn().mockResolvedValue({ id: 'liq-1' }),
      },
      labOrigin: {
        findFirst: jest.fn().mockResolvedValue({ id: 'origin-1', legalEntityId: 'le-1', billingAgreementId: 'agr-1' }),
      },
      labImportBatch: {
        update: jest.fn(),
      },
      labImportRun: { update: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        LiquidationsHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: FmApiService, useValue: { getAllRecords: jest.fn() } },
        { provide: LiquidationTransformer, useValue: new LiquidationTransformer() },
        { provide: LabImportOrchestratorService, useValue: { advancePhase: jest.fn() } },
      ],
    }).compile();

    handler = module.get(LiquidationsHandler);
    fmApi = module.get(FmApiService);
  });

  it('imports liquidation records', async () => {
    fmApi.getAllRecords.mockResolvedValue([
      {
        recordId: '1',
        modId: '1',
        fieldData: {
          '__pk_liquidaciones_instituciones': 100,
          'CODIGO INSTITUCION': 'LAB-001',
          'PERIODO COBRO': 'Marzo 2026',
          'ESTADO': 'Confirmado',
          'TOTAL LIQUIDACIÓN': '500000',
          'TOTAL FINAL': '500000',
          'VALOR TOTAL BIOPSIAS': '300000',
          'VALOR TOTAL PAP': '150000',
          'VALOR TOTAL CITOLOGÍAS': '50000',
          'VALOR TOTAL INMUNOS': '0',
          'Nº DE BIOPSIAS': '15',
          'Nº DE PAP': '20',
          'Nº DE CITOLOGÍAS': '5',
          'Nº DE INMUNOS': '0',
          'DEUDA ANTERIOR': '0',
          'SALDO A FAVOR': '0',
          'Confirmado': 'Confirmado',
          'NUMERO DOCUMENTO': '',
          'FECHA FACTURA': '',
          'MONTO CANCELADO': '',
          'FECHA PAGO': '',
          'MODO DE PAGO': '',
        },
      },
    ]);

    const job = {
      data: { runId: 'run-1', tenantId: 'tenant-1', batchId: 'batch-1' },
    } as any;

    await handler.handle(job.data);

    expect(prisma.labLiquidation.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.labLiquidation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          periodLabel: 'Marzo 2026',
          status: 'CONFIRMED',
          totalAmount: 500000,
          legalEntityId: 'le-1',
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Implement liquidations handler**

Create `apps/api/src/modules/lab/processors/handlers/liquidations.handler.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { LiquidationTransformer } from '../../../filemaker/transformers/liquidation.transformer';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';
import { toLiquidationStatus } from '../../constants/enum-maps';

export interface LiquidationsJobData {
  runId: string;
  tenantId: string;
  batchId: string;
}

@Injectable()
export class LiquidationsHandler {
  private readonly logger = new Logger(LiquidationsHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly liquidationTransformer: LiquidationTransformer,
    private readonly orchestrator: LabImportOrchestratorService,
  ) {}

  async handle(data: LiquidationsJobData): Promise<void> {
    const { runId, tenantId, batchId } = data;

    try {
      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const records = await this.fmApi.getAllRecords(
        this.liquidationTransformer.database,
        this.liquidationTransformer.layout,
        { dateformats: 2 },
      );

      this.logger.log(`Fetched ${records.length} liquidation records`);

      let processedCount = 0;
      let errorCount = 0;
      const errors: Array<{ recordId: string; error: string }> = [];

      for (const record of records) {
        try {
          const liq = this.liquidationTransformer.extract(record);

          // Resolve LabOrigin → LegalEntity
          const origin = await this.prisma.labOrigin.findFirst({
            where: { tenantId, code: liq.labOriginCode },
            select: { id: true, legalEntityId: true, billingAgreementId: true },
          });

          const legalEntityId = origin?.legalEntityId ?? null;
          if (!legalEntityId) {
            this.logger.warn(`No LegalEntity for origin code ${liq.labOriginCode}, skipping liquidation ${liq.fmPk}`);
            errorCount++;
            errors.push({ recordId: record.recordId, error: `No LegalEntity for origin ${liq.labOriginCode}` });
            continue;
          }

          await this.prisma.labLiquidation.upsert({
            where: {
              tenantId_fmRecordId: {
                tenantId,
                fmRecordId: record.recordId,
              },
            },
            create: {
              tenantId,
              fmRecordId: record.recordId,
              fmPk: liq.fmPk,
              legalEntityId,
              billingAgreementId: origin?.billingAgreementId ?? null,
              period: liq.period ?? new Date(0),
              periodLabel: liq.periodLabel,
              totalAmount: liq.totalAmount,
              biopsyAmount: liq.biopsyAmount,
              papAmount: liq.papAmount,
              cytologyAmount: liq.cytologyAmount,
              immunoAmount: liq.immunoAmount,
              biopsyCount: liq.biopsyCount,
              papCount: liq.papCount,
              cytologyCount: liq.cytologyCount,
              immunoCount: liq.immunoCount,
              previousDebt: liq.previousDebt,
              creditBalance: liq.creditBalance,
              status: toLiquidationStatus(liq.status),
              confirmedAt: liq.confirmedAt,
              confirmedByNameSnapshot: liq.confirmedByNameSnapshot,
              invoiceNumber: liq.invoiceNumber,
              invoiceDate: liq.invoiceDate,
              paymentAmount: liq.paymentAmount,
              paymentDate: liq.paymentDate,
              paymentMethodText: liq.paymentMethodText,
              notes: liq.notes,
            },
            update: {
              fmPk: liq.fmPk,
              legalEntityId,
              billingAgreementId: origin?.billingAgreementId ?? null,
              period: liq.period ?? new Date(0),
              periodLabel: liq.periodLabel,
              totalAmount: liq.totalAmount,
              biopsyAmount: liq.biopsyAmount,
              papAmount: liq.papAmount,
              cytologyAmount: liq.cytologyAmount,
              immunoAmount: liq.immunoAmount,
              biopsyCount: liq.biopsyCount,
              papCount: liq.papCount,
              cytologyCount: liq.cytologyCount,
              immunoCount: liq.immunoCount,
              previousDebt: liq.previousDebt,
              creditBalance: liq.creditBalance,
              status: toLiquidationStatus(liq.status),
              confirmedAt: liq.confirmedAt,
              confirmedByNameSnapshot: liq.confirmedByNameSnapshot,
              invoiceNumber: liq.invoiceNumber,
              invoiceDate: liq.invoiceDate,
              paymentAmount: liq.paymentAmount,
              paymentDate: liq.paymentDate,
              paymentMethodText: liq.paymentMethodText,
              notes: liq.notes,
            },
          });

          processedCount++;
        } catch (error) {
          errorCount++;
          const msg = error instanceof Error ? error.message : String(error);
          errors.push({ recordId: record.recordId, error: msg });
          this.logger.warn(`Liquidation record ${record.recordId} failed: ${msg}`);
        }
      }

      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: {
          status: 'COMPLETED',
          recordCount: records.length,
          processedCount,
          errorCount,
          errors: errors.length > 0 ? errors : undefined,
          completedAt: new Date(),
        },
      });

      await this.prisma.labImportRun.update({
        where: { id: runId },
        data: {
          completedBatches: { increment: 1 },
          processedRecords: { increment: processedCount },
          errorRecords: { increment: errorCount },
        },
      });

      await this.orchestrator.advancePhase(runId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Liquidations batch failed: ${msg}`);

      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: { status: 'FAILED', errors: [{ error: msg }], completedAt: new Date() },
      });

      throw error;
    }
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern='liquidations.handler' --no-coverage
```

---

## Task 8: Charges batch handler (Phase 4)

**Files:**
- Create: `apps/api/src/modules/lab/processors/handlers/charges-batch.handler.ts`
- Create: `apps/api/src/modules/lab/processors/handlers/charges-batch.handler.spec.ts`

- [ ] **Step 1: Write charges handler tests**

Create `apps/api/src/modules/lab/processors/handlers/charges-batch.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ChargesBatchHandler } from './charges-batch.handler';
import { ExamChargeTransformer } from '../../filemaker/transformers/exam-charge.transformer';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LabImportOrchestratorService } from '../services/lab-import-orchestrator.service';

describe('ChargesBatchHandler', () => {
  let handler: ChargesBatchHandler;
  let prisma: any;
  let fmApi: jest.Mocked<FmApiService>;

  beforeEach(async () => {
    prisma = {
      labExamCharge: {
        upsert: jest.fn().mockResolvedValue({ id: 'charge-1' }),
      },
      labDiagnosticReport: {
        findFirst: jest.fn().mockResolvedValue({ id: 'dr-1' }),
      },
      labOrigin: {
        findFirst: jest.fn().mockResolvedValue({ id: 'origin-1', legalEntityId: 'le-1' }),
      },
      labLiquidation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'liq-1' }),
      },
      labDirectPaymentBatch: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      labImportBatch: { update: jest.fn() },
      labImportRun: { update: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        ChargesBatchHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: FmApiService, useValue: { getRecords: jest.fn() } },
        { provide: ExamChargeTransformer, useValue: new ExamChargeTransformer() },
        { provide: LabImportOrchestratorService, useValue: { advancePhase: jest.fn() } },
      ],
    }).compile();

    handler = module.get(ChargesBatchHandler);
    fmApi = module.get(FmApiService);
  });

  it('imports biopsy charge records', async () => {
    fmApi.getRecords.mockResolvedValue({
      records: [
        {
          recordId: '1',
          modId: '1',
          fieldData: {
            '__pk_Biopsia_Ingreso': 500,
            '_fk_Informe_Número': 12345,
            'Tipo de Ingreso::Nombre': 'Efectivo',
            'Valor': '25000',
            'Códigos Prestación': 'BIO-001',
            'Estado Ingreso': 'Validado',
            'BIOPSIAS Cobranzas::PROCEDENCIA CODIGO UNICO': 'LAB-001',
            'Ingreso Fecha': '03/15/2026',
            'Ingreso Responsable': 'Secretaria 1',
            'Punto de ingreso': 'Caja central',
            '_fk_Liquidaciones Instituciones': '',
            '_fk_Rendición Pago directo': '',
          },
        },
      ],
      totalRecordCount: 1,
    });

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        chargeSource: 'BIOPSIAS_INGRESOS',
        batchIndex: 0,
        offset: 1,
        limit: 100,
        batchId: 'batch-1',
      },
    } as any;

    await handler.handle(job.data);

    expect(prisma.labExamCharge.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.labExamCharge.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          fmRecordPk: 500,
          amount: expect.any(Object), // Prisma Decimal
          paymentMethod: 'LAB_CASH',
          status: 'VALIDATED_CHARGE',
        }),
      }),
    );
  });

  it('links charge to liquidation when fk exists', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue({ id: 'liq-99' });

    fmApi.getRecords.mockResolvedValue({
      records: [
        {
          recordId: '1',
          modId: '1',
          fieldData: {
            '__pk_Biopsia_Ingreso': 501,
            '_fk_Informe_Número': 12346,
            'Tipo de Ingreso::Nombre': 'Convenio',
            'Valor': '30000',
            'Códigos Prestación': '',
            'Estado Ingreso': '',
            'BIOPSIAS Cobranzas::PROCEDENCIA CODIGO UNICO': 'LAB-002',
            'Ingreso Fecha': '03/16/2026',
            'Ingreso Responsable': 'Secretaria 2',
            'Punto de ingreso': '',
            '_fk_Liquidaciones Instituciones': '42',
            '_fk_Rendición Pago directo': '',
          },
        },
      ],
      totalRecordCount: 1,
    });

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        chargeSource: 'BIOPSIAS_INGRESOS',
        batchIndex: 0,
        offset: 1,
        limit: 100,
        batchId: 'batch-1',
      },
    } as any;

    await handler.handle(job.data);

    expect(prisma.labExamCharge.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          liquidationId: 'liq-99',
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Implement charges batch handler**

Create `apps/api/src/modules/lab/processors/handlers/charges-batch.handler.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../../prisma/prisma.service';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { ExamChargeTransformer } from '../../../filemaker/transformers/exam-charge.transformer';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';
import {
  toLabPaymentMethod,
  toLabChargeStatus,
  toLabExamChargeSource,
  toFmSource,
} from '../../constants/enum-maps';
import type { ExamChargeSourceType } from '../../../filemaker/transformers/types';

export interface ChargesBatchJobData {
  runId: string;
  tenantId: string;
  chargeSource: ExamChargeSourceType;
  batchIndex: number;
  offset: number;
  limit: number;
  batchId: string;
}

@Injectable()
export class ChargesBatchHandler {
  private readonly logger = new Logger(ChargesBatchHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly examChargeTransformer: ExamChargeTransformer,
    private readonly orchestrator: LabImportOrchestratorService,
  ) {}

  async handle(data: ChargesBatchJobData): Promise<void> {
    const { runId, tenantId, chargeSource, offset, limit, batchId } = data;
    const layout = chargeSource === 'BIOPSIAS_INGRESOS'
      ? this.examChargeTransformer.biopsyLayout
      : this.examChargeTransformer.papLayout;

    try {
      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const response = await this.fmApi.getRecords(
        this.examChargeTransformer.database,
        layout,
        { offset, limit, dateformats: 2 },
      );

      let processedCount = 0;
      let errorCount = 0;
      const errors: Array<{ recordId: string; error: string }> = [];

      for (const record of response.records) {
        try {
          const charge = chargeSource === 'BIOPSIAS_INGRESOS'
            ? this.examChargeTransformer.extractBiopsyCharge(record)
            : this.examChargeTransformer.extractPapCharge(record);

          // Resolve DiagnosticReport by informe number
          // For biopsy charges, the DR is in BIOPSIAS; for PAP charges, in PAPANICOLAOU
          const drFmSource = chargeSource === 'BIOPSIAS_INGRESOS' ? 'BIOPSIAS' : 'PAPANICOLAOU';
          const dr = await this.prisma.labDiagnosticReport.findFirst({
            where: {
              tenantId,
              fmSource: toFmSource(drFmSource),
              fmInformeNumber: charge.fkInformeNumber,
            },
          });

          if (!dr) {
            // Try backup source
            const backupSource = chargeSource === 'BIOPSIAS_INGRESOS' ? 'BIOPSIASRESPALDO' : 'PAPANICOLAOUHISTORICO';
            const drBackup = await this.prisma.labDiagnosticReport.findFirst({
              where: {
                tenantId,
                fmSource: toFmSource(backupSource),
                fmInformeNumber: charge.fkInformeNumber,
              },
            });

            if (!drBackup) {
              this.logger.debug(`No DR for charge informe ${charge.fkInformeNumber}`);
              errorCount++;
              errors.push({ recordId: record.recordId, error: `No DR for informe ${charge.fkInformeNumber}` });
              continue;
            }
          }

          const diagnosticReportId = dr?.id ?? (await this.prisma.labDiagnosticReport.findFirst({
            where: {
              tenantId,
              fmInformeNumber: charge.fkInformeNumber,
            },
          }))?.id;

          if (!diagnosticReportId) {
            errorCount++;
            errors.push({ recordId: record.recordId, error: `No DR for informe ${charge.fkInformeNumber}` });
            continue;
          }

          // Resolve LabOrigin
          const origin = await this.prisma.labOrigin.findFirst({
            where: { tenantId, code: charge.labOriginCodeSnapshot },
            select: { id: true, legalEntityId: true },
          });

          // Resolve Liquidation (if FK exists)
          let liquidationId: string | null = null;
          if (charge.fkLiquidacion) {
            const liq = await this.prisma.labLiquidation.findFirst({
              where: { tenantId, fmPk: parseInt(charge.fkLiquidacion, 10) || undefined },
            });
            liquidationId = liq?.id ?? null;
          }

          // Resolve DirectPaymentBatch (if FK exists)
          let directPaymentBatchId: string | null = null;
          if (charge.fkRendicion) {
            const dpb = await this.prisma.labDirectPaymentBatch.findFirst({
              where: { tenantId, fmPk: parseInt(charge.fkRendicion, 10) || undefined },
            });
            directPaymentBatchId = dpb?.id ?? null;
          }

          await this.prisma.labExamCharge.upsert({
            where: {
              tenantId_fmSource_fmRecordPk: {
                tenantId,
                fmSource: toLabExamChargeSource(charge.fmSource),
                fmRecordPk: charge.fmRecordPk,
              },
            },
            create: {
              tenantId,
              fmSource: toLabExamChargeSource(charge.fmSource),
              fmRecordPk: charge.fmRecordPk,
              diagnosticReportId,
              feeCodesText: charge.feeCodesText,
              feeCodes: charge.feeCodes,
              paymentMethod: toLabPaymentMethod(charge.paymentMethod),
              amount: new Decimal(charge.amount),
              status: toLabChargeStatus(charge.status),
              labOriginId: origin?.id ?? 'unknown',
              labOriginCodeSnapshot: charge.labOriginCodeSnapshot,
              legalEntityId: origin?.legalEntityId ?? null,
              liquidationId,
              directPaymentBatchId,
              enteredAt: charge.enteredAt ?? new Date(0),
              enteredByNameSnapshot: charge.enteredByNameSnapshot,
              pointOfEntry: charge.pointOfEntry,
            },
            update: {
              diagnosticReportId,
              feeCodesText: charge.feeCodesText,
              feeCodes: charge.feeCodes,
              paymentMethod: toLabPaymentMethod(charge.paymentMethod),
              amount: new Decimal(charge.amount),
              status: toLabChargeStatus(charge.status),
              labOriginId: origin?.id ?? 'unknown',
              labOriginCodeSnapshot: charge.labOriginCodeSnapshot,
              legalEntityId: origin?.legalEntityId ?? null,
              liquidationId,
              directPaymentBatchId,
              enteredAt: charge.enteredAt ?? new Date(0),
              enteredByNameSnapshot: charge.enteredByNameSnapshot,
              pointOfEntry: charge.pointOfEntry,
            },
          });

          processedCount++;
        } catch (error) {
          errorCount++;
          const msg = error instanceof Error ? error.message : String(error);
          errors.push({ recordId: record.recordId, error: msg });
        }
      }

      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: {
          status: 'COMPLETED',
          recordCount: response.records.length,
          processedCount,
          errorCount,
          errors: errors.length > 0 ? errors : undefined,
          completedAt: new Date(),
        },
      });

      await this.prisma.labImportRun.update({
        where: { id: runId },
        data: {
          completedBatches: { increment: 1 },
          processedRecords: { increment: processedCount },
          errorRecords: { increment: errorCount },
        },
      });

      await this.orchestrator.advancePhase(runId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Charges batch ${batchId} failed: ${msg}`);

      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: { status: 'FAILED', errors: [{ error: msg }], completedAt: new Date() },
      });

      throw error;
    }
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern='charges-batch.handler' --no-coverage
```

---

## Task 9: Attachment download processor (Phase 5)

**Files:**
- Create: `apps/api/src/modules/lab/processors/attachment-download.processor.ts`
- Create: `apps/api/src/modules/lab/processors/attachment-download.processor.spec.ts`

- [ ] **Step 1: Write attachment processor tests**

Create `apps/api/src/modules/lab/processors/attachment-download.processor.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { AttachmentDownloadProcessor } from './attachment-download.processor';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../files/s3.service';
import { FmApiService } from '../../filemaker/services/fm-api.service';

describe('AttachmentDownloadProcessor', () => {
  let processor: AttachmentDownloadProcessor;
  let prisma: any;
  let s3Service: jest.Mocked<S3Service>;

  beforeEach(async () => {
    prisma = {
      labDiagnosticReportAttachment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'att-1',
          tenantId: 'tenant-1',
          s3Key: 'Biopsias/LAB-001/2026/03/12345.pdf',
          fmContainerUrlOriginal: null,
          citolabS3KeyOriginal: 'Biopsias/LAB-001/2026/03/12345.pdf',
          migrationStatus: 'PENDING_MIGRATION',
          migrationAttempts: 0,
        }),
        update: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AttachmentDownloadProcessor,
        { provide: PrismaService, useValue: prisma },
        {
          provide: S3Service,
          useValue: {
            upload: jest.fn(),
            download: jest.fn().mockResolvedValue({
              buffer: Buffer.from('fake-pdf'),
              contentType: 'application/pdf',
            }),
          },
        },
        { provide: FmApiService, useValue: {} },
        { provide: 'CITOLAB_S3_CONFIG', useValue: { bucket: 'archivos-citolab-virginia', region: 'us-east-1' } },
      ],
    }).compile();

    processor = module.get(AttachmentDownloadProcessor);
    s3Service = module.get(S3Service);
  });

  it('copies PDF from Citolab S3 to Zeru S3', async () => {
    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        attachmentId: 'att-1',
        targetS3Key: 'Biopsias/LAB-001/2026/03/12345.pdf',
        fmContainerUrl: null,
        citolabS3Key: 'Biopsias/LAB-001/2026/03/12345.pdf',
      },
    } as any;

    await processor.process(job);

    expect(prisma.labDiagnosticReportAttachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          migrationStatus: 'UPLOADED',
          migratedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('marks as FAILED after error', async () => {
    s3Service.download.mockRejectedValue(new Error('NoSuchKey'));

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        attachmentId: 'att-1',
        targetS3Key: 'Biopsias/LAB-001/2026/03/12345.pdf',
        fmContainerUrl: null,
        citolabS3Key: 'Biopsias/LAB-001/2026/03/12345.pdf',
      },
    } as any;

    await expect(processor.process(job)).rejects.toThrow('NoSuchKey');

    expect(prisma.labDiagnosticReportAttachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          migrationStatus: 'FAILED_MIGRATION',
          migrationError: expect.stringContaining('NoSuchKey'),
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Implement attachment download processor**

Create `apps/api/src/modules/lab/processors/attachment-download.processor.ts`:

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../files/s3.service';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import { ATTACHMENT_MIGRATION_QUEUE, JOB_NAMES } from '../constants/queue.constants';

interface AttachmentJobData {
  runId: string;
  tenantId: string;
  attachmentId: string;
  targetS3Key: string;
  fmContainerUrl: string | null;
  citolabS3Key: string | null;
}

export interface CitolabS3Config {
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

@Processor(ATTACHMENT_MIGRATION_QUEUE)
export class AttachmentDownloadProcessor extends WorkerHost {
  private readonly logger = new Logger(AttachmentDownloadProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly fmApi: FmApiService,
    @Inject('CITOLAB_S3_CONFIG')
    private readonly citolabConfig: CitolabS3Config,
  ) {
    super();
  }

  async process(job: Job<AttachmentJobData>): Promise<void> {
    const { tenantId, attachmentId, targetS3Key, fmContainerUrl, citolabS3Key } = job.data;

    const attachment = await this.prisma.labDiagnosticReportAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.migrationStatus === 'UPLOADED') return;

    // Mark as downloading
    await this.prisma.labDiagnosticReportAttachment.update({
      where: { id: attachmentId },
      data: {
        migrationStatus: 'DOWNLOADING',
        migrationAttempts: { increment: 1 },
      },
    });

    try {
      let fileBuffer: Buffer;
      let contentType: string;

      if (citolabS3Key) {
        // Download from Citolab S3
        const result = await this.downloadFromCitolabS3(citolabS3Key);
        fileBuffer = result.buffer;
        contentType = result.contentType;
      } else if (fmContainerUrl) {
        // Download from FM container via streaming URL
        const result = await this.downloadFromFmContainer(fmContainerUrl);
        fileBuffer = result.buffer;
        contentType = result.contentType;
      } else {
        // No source available — skip
        await this.prisma.labDiagnosticReportAttachment.update({
          where: { id: attachmentId },
          data: { migrationStatus: 'SKIPPED', migrationError: 'No source URL available' },
        });
        return;
      }

      // Upload to Zeru S3
      await this.s3Service.upload(tenantId, targetS3Key, fileBuffer, contentType);

      // Update attachment record
      await this.prisma.labDiagnosticReportAttachment.update({
        where: { id: attachmentId },
        data: {
          migrationStatus: 'UPLOADED',
          migratedAt: new Date(),
          sizeBytes: fileBuffer.length,
          migrationError: null,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Attachment ${attachmentId} download failed: ${msg}`);

      await this.prisma.labDiagnosticReportAttachment.update({
        where: { id: attachmentId },
        data: {
          migrationStatus: 'FAILED_MIGRATION',
          migrationError: msg,
        },
      });

      throw error; // Let BullMQ retry
    }
  }

  private async downloadFromCitolabS3(key: string): Promise<{ buffer: Buffer; contentType: string }> {
    const client = new S3Client({
      region: this.citolabConfig.region,
      ...(this.citolabConfig.accessKeyId && this.citolabConfig.secretAccessKey
        ? {
            credentials: {
              accessKeyId: this.citolabConfig.accessKeyId,
              secretAccessKey: this.citolabConfig.secretAccessKey,
            },
          }
        : {}),
    });

    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: this.citolabConfig.bucket,
          Key: key,
        }),
      );

      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as AsyncIterable<Buffer>) {
        chunks.push(chunk);
      }

      return {
        buffer: Buffer.concat(chunks),
        contentType: response.ContentType ?? 'application/octet-stream',
      };
    } finally {
      client.destroy();
    }
  }

  private async downloadFromFmContainer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    // FM container URLs are streaming URLs (Streaming_SSL)
    // They require authentication — use the FM API's auth token
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`FM container download failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    };
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern='attachment-download' --no-coverage
```

---

## Task 10: REST controller and DTO

**Files:**
- Create: `apps/api/src/modules/lab/dto/start-import.dto.ts`
- Create: `apps/api/src/modules/lab/controllers/lab-import.controller.ts`

- [ ] **Step 1: Create the start-import DTO**

Create `apps/api/src/modules/lab/dto/start-import.dto.ts`:

```typescript
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

enum FmSourceDto {
  BIOPSIAS = 'BIOPSIAS',
  BIOPSIASRESPALDO = 'BIOPSIASRESPALDO',
  PAPANICOLAOU = 'PAPANICOLAOU',
  PAPANICOLAOUHISTORICO = 'PAPANICOLAOUHISTORICO',
}

export class StartImportDto {
  @IsArray()
  @IsEnum(FmSourceDto, { each: true })
  sources: FmSourceDto[];

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(500)
  batchSize?: number;
}
```

- [ ] **Step 2: Create the lab import controller**

Create `apps/api/src/modules/lab/controllers/lab-import.controller.ts`:

```typescript
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { LabImportOrchestratorService } from '../services/lab-import-orchestrator.service';
import { StartImportDto } from '../dto/start-import.dto';
import type { FmSourceType } from '../../filemaker/transformers/types';

@Controller('lab/import')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class LabImportController {
  constructor(
    private readonly orchestrator: LabImportOrchestratorService,
  ) {}

  @Post('start')
  @RequirePermission('lab', 'admin')
  async startImport(@Request() req: any, @Body() dto: StartImportDto) {
    const tenantId = req.user.tenantId;

    const result = await this.orchestrator.startImport({
      tenantId,
      sources: dto.sources as FmSourceType[],
      dateFrom: dto.dateFrom ? new Date(dto.dateFrom) : undefined,
      dateTo: dto.dateTo ? new Date(dto.dateTo) : undefined,
      batchSize: dto.batchSize,
    });

    return {
      runId: result.runId,
      totalBatches: result.totalBatches,
      message: `Import started with ${result.totalBatches} batches`,
    };
  }

  @Get('runs/:id/status')
  @RequirePermission('lab', 'admin')
  async getRunStatus(@Param('id') runId: string) {
    const status = await this.orchestrator.getRunStatus(runId);
    if (!status) throw new NotFoundException(`Import run ${runId} not found`);
    return status;
  }
}
```

---

## Task 11: Wire up LabModule with BullMQ

**Files:**
- Modify: `apps/api/src/modules/lab/lab.module.ts`

- [ ] **Step 1: Update LabModule to register all components**

Replace the contents of `apps/api/src/modules/lab/lab.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { FileMakerModule } from '../filemaker/filemaker.module';
import { FilesModule } from '../files/files.module';

// Constants
import { LAB_IMPORT_QUEUE, ATTACHMENT_MIGRATION_QUEUE, ATTACHMENT_QUEUE_CONFIG } from './constants/queue.constants';

// Services
import { LabImportOrchestratorService } from './services/lab-import-orchestrator.service';
import { FmRangeResolverService } from './services/fm-range-resolver.service';

// Processor (queue dispatcher)
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

@Module({
  imports: [
    PrismaModule,
    FileMakerModule,
    FilesModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
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
      {
        name: ATTACHMENT_MIGRATION_QUEUE,
        defaultJobOptions: {
          limiter: ATTACHMENT_QUEUE_CONFIG.rateLimiter,
        },
      },
    ),
  ],
  controllers: [LabImportController],
  providers: [
    // Services
    LabImportOrchestratorService,
    FmRangeResolverService,

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
  exports: [LabImportOrchestratorService],
})
export class LabModule {}
```

- [ ] **Step 2: Run lint**

```bash
cd /Users/camiloespinoza/Zeru && pnpm lint
```

- [ ] **Step 3: Run all new tests**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test -- --testPathPattern='(enum-maps|fm-range-resolver|lab-import-orchestrator|exams-batch.handler|workflow-events-batch.handler|communications-batch.handler|liquidations.handler|charges-batch.handler|attachment-download)' --no-coverage
```

---

## Task 12: Integration smoke test

**Files:**
- No new files — this task validates the full pipeline compiles and module wires correctly.

- [ ] **Step 1: Verify NestJS module bootstrap**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api build
```

The build must complete without errors.

- [ ] **Step 2: Verify Prisma generates correctly**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api prisma generate
```

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/api test --no-coverage
```

All existing tests (168 transformer tests + new pipeline tests) must pass.

- [ ] **Step 4: Final lint check**

```bash
cd /Users/camiloespinoza/Zeru && pnpm lint
```

---

## Summary of env variables needed

Add to `.env` (or `.env.local`):

```env
# Already configured
REDIS_URL=redis://localhost:6380

# New for Citolab S3 attachment migration
CITOLAB_S3_BUCKET=archivos-citolab-virginia
CITOLAB_S3_REGION=us-east-1
CITOLAB_AWS_ACCESS_KEY_ID=<rotated-key>
CITOLAB_AWS_SECRET_ACCESS_KEY=<rotated-secret>
```

---

## Verification checklist

| Check | How to verify |
|-------|--------------|
| Queue constants compile | `pnpm --filter @zeru/api build` |
| Enum maps pass all tests | `pnpm --filter @zeru/api test -- --testPathPattern=enum-maps` |
| FM range resolver works | `pnpm --filter @zeru/api test -- --testPathPattern=fm-range-resolver` |
| Orchestrator creates runs | `pnpm --filter @zeru/api test -- --testPathPattern=lab-import-orchestrator` |
| Exams handler upserts correctly | `pnpm --filter @zeru/api test -- --testPathPattern=exams-batch.handler` |
| Workflow events replace correctly | `pnpm --filter @zeru/api test -- --testPathPattern=workflow-events-batch.handler` |
| Communications dedup works | `pnpm --filter @zeru/api test -- --testPathPattern=communications-batch.handler` |
| Liquidations import + link | `pnpm --filter @zeru/api test -- --testPathPattern=liquidations.handler` |
| Charges link DR + Liquidation | `pnpm --filter @zeru/api test -- --testPathPattern=charges-batch.handler` |
| Attachment S3 copy works | `pnpm --filter @zeru/api test -- --testPathPattern=attachment-download` |
| REST endpoints guarded | Check `@RequirePermission('lab', 'admin')` on controller |
| BullMQ module registered | Check `LabModule` imports `BullModule.registerQueue` |
| All 168 transformer tests still pass | `pnpm --filter @zeru/api test --no-coverage` |
| Lint clean | `pnpm lint` |
