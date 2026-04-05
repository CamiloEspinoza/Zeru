import { z } from 'zod';
import { validateRut } from '../utils/format-rut';

const BANK_ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'VISTA', 'OTHER'] as const;

export const createLegalEntitySchema = z.object({
  rut: z
    .string()
    .min(3, 'RUT requerido')
    .refine((val) => validateRut(val), { message: 'RUT inválido' }),
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
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional(),
});

export const updateLegalEntitySchema = createLegalEntitySchema.partial();

export const createLegalEntityContactSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  role: z.string().optional(),
  email: z.string().email().optional().nullable().or(z.literal('')),
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
