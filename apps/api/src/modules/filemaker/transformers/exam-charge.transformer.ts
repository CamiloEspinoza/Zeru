import { Injectable } from '@nestjs/common';
import type { FmRecord } from '@zeru/shared';
import { str, parseNum, parseDate } from './helpers';
import type {
  ExtractedExamCharge,
  PaymentMethodType,
  ChargeStatusType,
  ExamChargeSourceType,
} from './types';

@Injectable()
export class ExamChargeTransformer {
  readonly database = 'BIOPSIAS';
  readonly biopsyLayout = 'Biopsias_Ingresos*';
  readonly papLayout = 'PAP_ingresos*';

  extractBiopsyCharge(record: FmRecord): ExtractedExamCharge {
    const d = record.fieldData;
    return this.extractCharge(d, 'BIOPSIAS_INGRESOS', {
      pkField: '__pk_Biopsia_Ingreso',
      procedenciaField: 'BIOPSIAS Cobranzas::PROCEDENCIA CODIGO UNICO',
    });
  }

  extractPapCharge(record: FmRecord): ExtractedExamCharge {
    const d = record.fieldData;
    return this.extractCharge(d, 'PAP_INGRESOS', {
      pkField: '__pk_PAP_Ingreso',
      procedenciaField: 'PAP Cobranzas::CODIGO UNICO PROCEDENCIA',
    });
  }

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
   * Partial update for cancellation -- only updates status field.
   */
  cancelToFm(): Record<string, unknown> {
    return {
      'Estado Ingreso': 'Cancelado',
    };
  }

  private extractCharge(
    d: Record<string, unknown>,
    source: ExamChargeSourceType,
    fields: { pkField: string; procedenciaField: string },
  ): ExtractedExamCharge {
    const statusRaw = str(d['Estado Ingreso']);
    const feeCodesRaw = str(d['Códigos Prestación']);
    const paymentMethodRaw = str(d['Tipo de Ingreso::Nombre']);

    return {
      fmRecordPk: parseNum(d[fields.pkField]),
      fmSource: source,
      fkInformeNumber: parseNum(d['_fk_Informe_Número']),
      paymentMethod: parsePaymentMethod(paymentMethodRaw),
      paymentMethodRaw,
      amount: parseAmount(d['Valor']),
      feeCodesText: feeCodesRaw || null,
      feeCodes: parseFeeCodes(feeCodesRaw),
      status: parseChargeStatus(statusRaw),
      statusRaw,
      labOriginCodeSnapshot: str(d[fields.procedenciaField]),
      enteredAt: parseDate(str(d['Ingreso Fecha'])),
      enteredByNameSnapshot: str(d['Ingreso Responsable']),
      pointOfEntry: str(d['Punto de ingreso']) || null,
      fkLiquidacion: str(d['_fk_Liquidaciones Instituciones']) || null,
      fkRendicion: str(d['_fk_Rendición Pago directo']) || null,
    };
  }
}

// ── Pure helpers ──

/**
 * Parse a monetary amount. Handles Chilean currency formats like "$25.000"
 * where dots are thousand separators, as well as plain numbers.
 * If the value contains a dot followed by exactly 3 digits (and no other dots),
 * it's treated as a thousand separator and removed.
 */
function parseAmount(val: unknown): number {
  const s = str(val);
  if (!s) return 0;
  // Strip currency symbol and spaces
  let cleaned = s.replace(/[$\s]/g, '');
  // Chilean format: dots as thousand separators (e.g., "25.000" or "1.250.000")
  // Detect: if ALL dots are followed by exactly 3 digits, treat them as thousand separators
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '');
  }
  const n = Number(cleaned.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parsePaymentMethod(val: string): PaymentMethodType {
  const lower = val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (lower.includes('convenio') || lower.includes('liquidacion')) return 'AGREEMENT';
  if (lower.includes('efectivo')) return 'CASH';
  if (lower.includes('bono') || lower.includes('fonasa') || lower.includes('isapre')) return 'VOUCHER';
  if (lower.includes('cheque')) return 'CHECK';
  if (lower.includes('transferencia')) return 'BANK_TRANSFER';
  if (lower.includes('credito') || lower.includes('tarjeta credito')) return 'CREDIT_CARD';
  if (lower.includes('debito') || lower.includes('tarjeta debito') || lower.includes('redcompra')) return 'DEBIT_CARD';
  if (lower.includes('pendiente') || lower.includes('por cobrar')) return 'PENDING_PAYMENT';
  if (!val) return 'OTHER';
  return 'OTHER';
}

function parseChargeStatus(val: string): ChargeStatusType {
  const lower = val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (lower.startsWith('validado')) return 'VALIDATED';
  if (lower.includes('cancelado') || lower.includes('anulado')) return 'CANCELLED';
  if (lower.includes('facturado')) return 'INVOICED';
  if (lower.includes('pagado')) return 'PAID';
  if (lower.includes('reversado') || lower.includes('revertido')) return 'REVERSED';
  return 'REGISTERED';
}

function parseFeeCodes(val: string): string[] {
  if (!val) return [];
  return val
    .split(/[|,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Format a Date as MM/DD/YYYY for FM Data API (US format with dateformats=0).
 */
function formatFmDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}
