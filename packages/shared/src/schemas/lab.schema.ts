import { z } from 'zod';

// -- Enum constants --

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

// -- ExamCharge DTOs --

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
  cancelReason: z.string().min(1, 'Motivo de cancelacion requerido'),
  cancelledByNameSnapshot: z.string().min(1, 'Responsable requerido'),
});

export const assignChargeToLiquidationSchema = z.object({
  liquidationId: z.string().uuid(),
});

export const assignChargeToDirectPaymentBatchSchema = z.object({
  directPaymentBatchId: z.string().uuid(),
});

// -- Liquidation DTOs --

export const createLiquidationSchema = z.object({
  legalEntityId: z.string().uuid('Persona juridica requerida'),
  billingAgreementId: z.string().uuid().optional().nullable(),
  period: z.string().datetime(),
  periodLabel: z.string().min(1, 'Etiqueta periodo requerida'),
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
  invoiceNumber: z.string().min(1, 'Numero de documento requerido'),
  invoiceType: z.string().optional().nullable(),
  invoiceDate: z.string().datetime(),
});

export const paymentLiquidationSchema = z.object({
  paymentAmount: z.number().min(0, 'Monto de pago debe ser >= 0'),
  paymentDate: z.string().datetime(),
  paymentMethodText: z.string().min(1, 'Modo de pago requerido'),
});

// -- DirectPaymentBatch DTOs --

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

// -- DiagnosticReport Macroscopy DTOs --

export const updateMacroscopySchema = z.object({
  macroscopicDescription: z.string().min(1, 'Descripcion macroscopica requerida'),
});

export const completeMacroscopySchema = z.object({
  performedByNameSnapshot: z.string().min(1, 'Responsable requerido'),
  performedById: z.string().uuid().optional().nullable(),
});

export const registerMacroSignerSchema = z.object({
  diagnosticReportId: z.string().uuid(),
  pathologistCode: z.string().min(1, 'Codigo patologo requerido'),
  pathologistName: z.string().min(1, 'Nombre patologo requerido'),
  assistantCode: z.string().optional().nullable(),
  assistantName: z.string().optional().nullable(),
});

// -- Search / List DTOs --

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

export const labDirectPaymentBatchListSchema = z.object({
  status: z.enum(['OPEN', 'RENDIDA', 'CANCELLED']).optional(),
  legalEntityId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

// -- Exported types --

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
export type LabDirectPaymentBatchListDto = z.infer<typeof labDirectPaymentBatchListSchema>;
