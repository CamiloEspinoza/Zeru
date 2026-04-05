import { z } from 'zod';

const BILLING_AGREEMENT_STATUSES = ['ACTIVE', 'EXPIRED', 'DRAFT'] as const;
const BILLING_MODALITIES = [
  'MONTHLY_SETTLEMENT', 'FONASA_VOUCHER', 'ISAPRE_VOUCHER',
  'CASH', 'CHECK', 'BANK_TRANSFER', 'OTHER',
] as const;
const PAYMENT_TERMS = [
  'IMMEDIATE', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90', 'CUSTOM',
] as const;

export const createBillingConceptSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  referencePrice: z.number().min(0, 'Precio debe ser >= 0'),
  currency: z.string().length(3).optional(),
});

export const updateBillingConceptSchema = createBillingConceptSchema.partial();

export const createBillingAgreementSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  legalEntityId: z.string().uuid('Persona jurídica requerida'),
  status: z.enum(BILLING_AGREEMENT_STATUSES).optional(),
  contractDate: z.string().date().optional(),
  effectiveFrom: z.string().date().optional(),
  effectiveTo: z.string().date().optional(),
  paymentTerms: z.enum(PAYMENT_TERMS).optional(),
  customPaymentDays: z.number().int().min(1).optional(),
  billingDayOfMonth: z.number().int().min(1).max(28).optional(),
  isMonthlySettlement: z.boolean().optional(),
  billingModalities: z.array(z.enum(BILLING_MODALITIES)).optional(),
  examTypes: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const updateBillingAgreementSchema = createBillingAgreementSchema.partial();

export const createBillingAgreementLineSchema = z.object({
  billingConceptId: z.string().uuid('Concepto requerido'),
  factor: z.number().min(0).optional(),
  negotiatedPrice: z.number().min(0, 'Precio debe ser >= 0'),
  referencePrice: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
});

export const createBillingContactSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  role: z.string().optional(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional(),
});

export type CreateBillingConceptSchema = z.infer<typeof createBillingConceptSchema>;
export type UpdateBillingConceptSchema = z.infer<typeof updateBillingConceptSchema>;
export type CreateBillingAgreementSchema = z.infer<typeof createBillingAgreementSchema>;
export type UpdateBillingAgreementSchema = z.infer<typeof updateBillingAgreementSchema>;
export type CreateBillingAgreementLineSchema = z.infer<typeof createBillingAgreementLineSchema>;
export type CreateBillingContactSchema = z.infer<typeof createBillingContactSchema>;
