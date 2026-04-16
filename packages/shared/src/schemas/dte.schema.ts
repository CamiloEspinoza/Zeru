import { z } from 'zod';

// ─── Helpers ──────────────────────────────────────

const rutSchema = z
  .string()
  .min(3)
  .max(12)
  .regex(
    /^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$|^\d{7,8}-[\dkK]$/,
    'RUT inválido',
  );

// ─── DteConfig ────────────────────────────────────

export const createDteConfigSchema = z.object({
  rut: rutSchema,
  razonSocial: z.string().min(1).max(100),
  giro: z.string().min(1).max(80),
  actividadEco: z.number().int().positive(),
  direccion: z.string().min(1).max(70),
  comuna: z.string().min(1).max(20),
  ciudad: z.string().min(1).max(20),
  codigoSucursal: z.number().int().optional(),
  environment: z.enum(['CERTIFICATION', 'PRODUCTION']).default('CERTIFICATION'),
  resolutionNum: z.number().int(),
  resolutionDate: z.string(),
  exchangeEmail: z.string().email().optional(),
});

export type CreateDteConfigSchema = z.infer<typeof createDteConfigSchema>;

export const updateDteConfigSchema = createDteConfigSchema.partial();
export type UpdateDteConfigSchema = z.infer<typeof updateDteConfigSchema>;

// ─── DTE Items ────────────────────────────────────

export const dteItemSchema = z.object({
  itemName: z.string().min(1).max(80),
  description: z.string().max(1000).optional(),
  quantity: z.number().positive(),
  unit: z.string().max(4).optional(),
  unitPrice: z.number().nonnegative(),
  descuentoPct: z.number().min(0).max(100).optional(),
  descuentoMonto: z.number().nonnegative().optional(),
  recargoPct: z.number().min(0).max(100).optional(),
  recargoMonto: z.number().nonnegative().optional(),
  indExe: z.number().int().optional(),
  codigosItem: z
    .array(z.object({ tipo: z.string(), valor: z.string() }))
    .optional(),
});

export type DteItemSchema = z.infer<typeof dteItemSchema>;

// ─── DTE References (for NC/ND) ──────────────────

export const dteReferenceSchema = z.object({
  tipoDocRef: z.number().int(),
  folioRef: z.number().int().positive(),
  fechaRef: z.string(),
  codRef: z
    .enum(['ANULA_DOCUMENTO', 'CORRIGE_TEXTO', 'CORRIGE_MONTOS'])
    .optional(),
  razonRef: z.string().max(90).optional(),
});

export type DteReferenceSchema = z.infer<typeof dteReferenceSchema>;

// ─── DTE Emission ─────────────────────────────────

export const DTE_TYPES = [
  'FACTURA_ELECTRONICA',
  'FACTURA_EXENTA_ELECTRONICA',
  'NOTA_DEBITO_ELECTRONICA',
  'NOTA_CREDITO_ELECTRONICA',
  'GUIA_DESPACHO_ELECTRONICA',
  'BOLETA_ELECTRONICA',
  'BOLETA_EXENTA_ELECTRONICA',
  'FACTURA_COMPRA_ELECTRONICA',
  'LIQUIDACION_FACTURA_ELECTRONICA',
] as const;

export const emitDteSchema = z
  .object({
    dteType: z.enum(DTE_TYPES),
    receptorRut: rutSchema.optional(),
    receptorRazon: z.string().min(1).max(100).optional(),
    receptorGiro: z.string().max(80).optional(),
    receptorDir: z.string().max(70).optional(),
    receptorComuna: z.string().max(20).optional(),
    receptorCiudad: z.string().max(20).optional(),
    fechaEmision: z.string().optional(),
    fechaVenc: z.string().optional(),
    formaPago: z.number().int().min(1).max(3).optional(),
    medioPago: z.string().max(3).optional(),
    indServicio: z.number().int().min(1).max(3).optional(),
    periodoDesde: z.string().optional(),
    periodoHasta: z.string().optional(),
    items: z.array(dteItemSchema).min(1),
    references: z.array(dteReferenceSchema).optional(),
    legalEntityId: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      const requiresRef = [
        'NOTA_CREDITO_ELECTRONICA',
        'NOTA_DEBITO_ELECTRONICA',
      ].includes(data.dteType);
      return !requiresRef || (data.references && data.references.length > 0);
    },
    {
      message:
        'Notas de crédito y débito requieren al menos una referencia al documento original',
    },
  )
  .refine(
    (data) => {
      const isBoleta = [
        'BOLETA_ELECTRONICA',
        'BOLETA_EXENTA_ELECTRONICA',
      ].includes(data.dteType);
      if (isBoleta) return true;
      return !!data.receptorRut && !!data.receptorRazon;
    },
    { message: 'Facturas y notas requieren RUT y razón social del receptor' },
  );

export type EmitDteSchema = z.infer<typeof emitDteSchema>;

// ─── Draft Update ─────────────────────────────────

export const updateDteDraftSchema = z.object({
  receptorRut: rutSchema.optional(),
  receptorRazon: z.string().min(1).max(100).optional(),
  receptorGiro: z.string().max(80).optional(),
  receptorDir: z.string().max(70).optional(),
  receptorComuna: z.string().max(20).optional(),
  fechaVenc: z.string().optional(),
  formaPago: z.number().int().min(1).max(3).optional(),
  items: z.array(dteItemSchema).min(1).optional(),
  references: z.array(dteReferenceSchema).optional(),
});

export type UpdateDteDraftSchema = z.infer<typeof updateDteDraftSchema>;

// ─── Certificate Upload ───────────────────────────

export const uploadCertificateSchema = z.object({
  password: z.string().min(1),
  isPrimary: z.boolean().default(false),
});

export type UploadCertificateSchema = z.infer<typeof uploadCertificateSchema>;

// ─── Void DTE ─────────────────────────────────────

export const voidDteSchema = z.object({
  reason: z.string().min(1).max(256),
});

export type VoidDteSchema = z.infer<typeof voidDteSchema>;

// ─── Correct Amounts ──────────────────────────────

export const correctAmountsSchema = z.object({
  strategy: z.enum(['PARTIAL_NC', 'FULL_NC_AND_REISSUE']),
  items: z
    .array(
      z.object({
        lineNumber: z.number().int().positive(),
        correctedQuantity: z.number().positive().optional(),
        correctedUnitPrice: z.number().nonnegative().optional(),
      }),
    )
    .min(1),
  reason: z.string().min(1).max(256),
});

export type CorrectAmountsSchema = z.infer<typeof correctAmountsSchema>;

// ─── Decide Received DTE ──────────────────────────

export const decideReceivedDteSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT', 'CLAIM_PARTIAL', 'CLAIM_TOTAL']),
  notes: z.string().max(500).optional(),
});

export type DecideReceivedDteSchema = z.infer<typeof decideReceivedDteSchema>;

// ─── Account Mapping ─────────────────────────────

export const dteAccountMappingSchema = z.object({
  dteTypeCode: z.number().int(),
  direction: z.enum(['EMITTED', 'RECEIVED']),
  receivableAccountId: z.string().uuid().optional(),
  payableAccountId: z.string().uuid().optional(),
  cashAccountId: z.string().uuid().optional(),
  revenueAccountId: z.string().uuid().optional(),
  revenueExemptAccountId: z.string().uuid().optional(),
  purchaseAccountId: z.string().uuid().optional(),
  ivaDebitoAccountId: z.string().uuid().optional(),
  ivaCreditoAccountId: z.string().uuid().optional(),
  salesReturnAccountId: z.string().uuid().optional(),
  purchaseReturnAccountId: z.string().uuid().optional(),
});

export type DteAccountMappingSchema = z.infer<typeof dteAccountMappingSchema>;
