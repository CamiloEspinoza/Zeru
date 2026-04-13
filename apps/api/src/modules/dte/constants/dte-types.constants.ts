export const DTE_TYPE_CODES = {
  FACTURA_ELECTRONICA: 33,
  FACTURA_EXENTA_ELECTRONICA: 34,
  BOLETA_ELECTRONICA: 39,
  BOLETA_EXENTA_ELECTRONICA: 41,
  LIQUIDACION_FACTURA_ELECTRONICA: 43,
  FACTURA_COMPRA_ELECTRONICA: 46,
  GUIA_DESPACHO_ELECTRONICA: 52,
  NOTA_DEBITO_ELECTRONICA: 56,
  NOTA_CREDITO_ELECTRONICA: 61,
} as const;

export const DTE_TYPE_NAMES: Record<number, string> = {
  33: 'Factura Electrónica',
  34: 'Factura No Afecta o Exenta Electrónica',
  39: 'Boleta Electrónica',
  41: 'Boleta Exenta Electrónica',
  43: 'Liquidación-Factura Electrónica',
  46: 'Factura de Compra Electrónica',
  52: 'Guía de Despacho Electrónica',
  56: 'Nota de Débito Electrónica',
  61: 'Nota de Crédito Electrónica',
};

export const TASA_IVA = 19;

export const CODIGOS_REFERENCIA = {
  ANULA: 1,
  CORRIGE_TEXTO: 2,
  CORRIGE_MONTOS: 3,
} as const;

export const BOLETA_TYPES = [39, 41] as const;
export const FACTURA_TYPES = [33, 34, 46] as const;
export const NC_ND_TYPES = [56, 61] as const;

export const SII_CODE_TO_DTE_TYPE: Record<number, string> = {
  33: 'FACTURA_ELECTRONICA',
  34: 'FACTURA_EXENTA_ELECTRONICA',
  39: 'BOLETA_ELECTRONICA',
  41: 'BOLETA_EXENTA_ELECTRONICA',
  43: 'LIQUIDACION_FACTURA_ELECTRONICA',
  46: 'FACTURA_COMPRA_ELECTRONICA',
  52: 'GUIA_DESPACHO_ELECTRONICA',
  56: 'NOTA_DEBITO_ELECTRONICA',
  61: 'NOTA_CREDITO_ELECTRONICA',
};

export const DTE_TYPE_TO_SII_CODE: Record<string, number> = Object.fromEntries(
  Object.entries(SII_CODE_TO_DTE_TYPE).map(([code, type]) => [type, Number(code)]),
);
