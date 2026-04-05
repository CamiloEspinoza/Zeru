import { z } from 'zod';

const LAB_ORIGIN_CATEGORIES = [
  'CONSULTA', 'CENTRO_MEDICO', 'CLINICA_HOSPITAL', 'LABORATORIO', 'OTRO',
] as const;

const SAMPLE_RECEPTION_MODES = ['PRESENCIAL', 'COURIER', 'AMBAS'] as const;

const REPORT_DELIVERY_METHODS = ['WEB', 'IMPRESO', 'FTP', 'EMAIL'] as const;

export const createLabOriginSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  category: z.enum(LAB_ORIGIN_CATEGORIES).optional(),
  legalEntityId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  street: z.string().optional(),
  streetNumber: z.string().optional(),
  unit: z.string().optional(),
  commune: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  sampleReceptionMode: z.enum(SAMPLE_RECEPTION_MODES).optional(),
  reportDeliveryMethods: z.array(z.enum(REPORT_DELIVERY_METHODS)).optional(),
  deliveryDaysBiopsy: z.number().int().min(0).optional(),
  deliveryDaysPap: z.number().int().min(0).optional(),
  deliveryDaysCytology: z.number().int().min(0).optional(),
  deliveryDaysIhc: z.number().int().min(0).optional(),
  deliveryDaysDefault: z.number().int().min(0).optional(),
  criticalNotificationEmails: z.array(z.string().email()).optional(),
  sendsQualityReports: z.boolean().optional(),
  contractDate: z.string().date().optional(),
  contractActive: z.boolean().optional(),
  incorporationDate: z.string().date().optional(),
  agreementDate: z.string().date().optional(),
  lastAddendumNumber: z.string().optional(),
  lastAddendumDate: z.string().date().optional(),
  lastAddendumDetail: z.string().optional(),
  receptionDays: z.string().optional(),
  receptionSchedule: z.string().optional(),
  notes: z.string().optional(),
});

export const updateLabOriginSchema = createLabOriginSchema.partial();

export const createLabOriginPricingSchema = z.object({
  billingConcept: z.string().min(1, 'Concepto requerido'),
  description: z.string().optional(),
  basePrice: z.number().min(0, 'Precio debe ser >= 0'),
  referencePrice: z.number().min(0).optional(),
  multiplier: z.number().min(0).optional(),
  currency: z.string().length(3, 'Código ISO 4217 (ej: CLP, USD, UF)').optional(),
});

export type CreateLabOriginSchema = z.infer<typeof createLabOriginSchema>;
export type UpdateLabOriginSchema = z.infer<typeof updateLabOriginSchema>;
export type CreateLabOriginPricingSchema = z.infer<typeof createLabOriginPricingSchema>;
