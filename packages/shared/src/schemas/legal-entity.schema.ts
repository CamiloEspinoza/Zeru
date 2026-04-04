import { z } from 'zod';

const PAYMENT_TERMS = [
  'IMMEDIATE', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90', 'CUSTOM',
] as const;

const BANK_ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'VISTA', 'OTHER'] as const;

export const createLegalEntitySchema = z.object({
  rut: z.string().min(3, 'RUT requerido'),
  legalName: z.string().min(1, 'Razón social requerida'),
  tradeName: z.string().optional(),
  businessActivity: z.string().optional(),
  isClient: z.boolean().optional(),
  isSupplier: z.boolean().optional(),
  street: z.string().optional(),
  streetNumber: z.string().optional(),
  unit: z.string().optional(),
  commune: z.string().optional(),
  city: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional(),
  paymentTerms: z.enum(PAYMENT_TERMS).optional(),
  customPaymentDays: z.number().int().min(1).optional(),
  billingDayOfMonth: z.number().int().min(1).max(28).optional(),
});

export const updateLegalEntitySchema = createLegalEntitySchema.partial();

export const createLegalEntityContactSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  role: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional(),
});

export const createBankAccountSchema = z.object({
  bankName: z.string().min(1, 'Banco requerido'),
  accountType: z.enum(BANK_ACCOUNT_TYPES),
  accountNumber: z.string().min(1, 'Número de cuenta requerido'),
  holderName: z.string().min(1, 'Titular requerido'),
  holderRut: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export type CreateLegalEntitySchema = z.infer<typeof createLegalEntitySchema>;
export type UpdateLegalEntitySchema = z.infer<typeof updateLegalEntitySchema>;
export type CreateLegalEntityContactSchema = z.infer<typeof createLegalEntityContactSchema>;
export type CreateBankAccountSchema = z.infer<typeof createBankAccountSchema>;
