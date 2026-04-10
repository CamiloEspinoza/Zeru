/**
 * Spanish label maps for FM-imported enums.
 * Use these everywhere FM data is rendered to keep labels consistent.
 */

export const STATUS_LABELS = {
  ACTIVE: "Vigente",
  EXPIRED: "Expirado",
  DRAFT: "Borrador",
} as const;

export const STATUS_BADGE_VARIANT = {
  ACTIVE: "default",
  EXPIRED: "outline",
  DRAFT: "secondary",
} as const;

export const PAYMENT_TERMS_LABELS = {
  IMMEDIATE: "Contado",
  NET_15: "15 días",
  NET_30: "30 días",
  NET_45: "45 días",
  NET_60: "60 días",
  NET_90: "90 días",
  CUSTOM: "Personalizado",
} as const;

export const MODALITY_LABELS = {
  MONTHLY_SETTLEMENT: "Liquidación mensual",
  FONASA_VOUCHER: "Bono FONASA",
  ISAPRE_VOUCHER: "Bono ISAPRE",
  CASH: "Efectivo",
  CHECK: "Cheque",
  BANK_TRANSFER: "Transferencia",
  OTHER: "Otra",
} as const;

export const CATEGORY_LABELS = {
  CONSULTA: "Consulta",
  CENTRO_MEDICO: "Centro médico",
  CLINICA_HOSPITAL: "Clínica / Hospital",
  LABORATORIO: "Laboratorio",
  OTRO: "Otro",
} as const;

export const RECEPTION_MODE_LABELS = {
  PRESENCIAL: "Presencial",
  COURIER: "Courier",
  AMBAS: "Ambas",
} as const;

export const DELIVERY_METHOD_LABELS = {
  WEB: "Portal web",
  IMPRESO: "Impreso",
  FTP: "FTP",
  EMAIL: "Email",
} as const;

export type StatusKey = keyof typeof STATUS_LABELS;
export type PaymentTermsKey = keyof typeof PAYMENT_TERMS_LABELS;
export type ModalityKey = keyof typeof MODALITY_LABELS;
export type CategoryKey = keyof typeof CATEGORY_LABELS;
export type ReceptionModeKey = keyof typeof RECEPTION_MODE_LABELS;
export type DeliveryMethodKey = keyof typeof DELIVERY_METHOD_LABELS;
