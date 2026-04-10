import { Injectable } from '@nestjs/common';
import type { FmRecord } from '@zeru/shared';
import { str, parseNum, parseDate, parsePeriod } from './helpers';
import type { ExtractedLiquidation, LiquidationStatusType } from './types';

@Injectable()
export class LiquidationTransformer {
  readonly database = 'BIOPSIAS';
  readonly layout = 'Liquidaciones';

  /**
   * Convert Zeru Liquidation to FM field data for Liquidaciones layout (create).
   */
  toFm(liq: {
    labOriginCode: string;
    periodLabel: string;
    statusName: string;
    totalAmount: number;
    biopsyAmount: number;
    papAmount: number;
    cytologyAmount: number;
    immunoAmount: number;
    biopsyCount: number;
    papCount: number;
    cytologyCount: number;
    immunoCount: number;
    previousDebt: number;
    creditBalance: number;
  }): Record<string, unknown> {
    return {
      'CODIGO INSTITUCION': liq.labOriginCode,
      'PERIODO COBRO': liq.periodLabel,
      'ESTADO': liq.statusName,
      'TOTAL LIQUIDACIÓN': liq.totalAmount,
      'VALOR TOTAL BIOPSIAS': liq.biopsyAmount,
      'VALOR TOTAL PAP': liq.papAmount,
      'VALOR TOTAL CITOLOGÍAS': liq.cytologyAmount,
      'VALOR TOTAL INMUNOS': liq.immunoAmount,
      'Nº DE BIOPSIAS': liq.biopsyCount,
      'Nº DE PAP': liq.papCount,
      'Nº DE CITOLOGÍAS': liq.cytologyCount,
      'Nº DE INMUNOS': liq.immunoCount,
      'DEUDA ANTERIOR': liq.previousDebt,
      'SALDO A FAVOR': liq.creditBalance,
    };
  }

  /**
   * Partial update for confirm action.
   */
  confirmToFm(confirmedByName: string): Record<string, unknown> {
    return {
      'Confirmado': `Confirmado - ${confirmedByName}`,
    };
  }

  /**
   * Partial update for invoice action.
   */
  invoiceToFm(invoice: {
    invoiceNumber: string;
    invoiceDate: Date;
  }): Record<string, unknown> {
    return {
      'NUMERO DOCUMENTO': invoice.invoiceNumber,
      'FECHA FACTURA': formatFmDate(invoice.invoiceDate),
    };
  }

  /**
   * Partial update for payment registration.
   */
  paymentToFm(payment: {
    paymentAmount: number;
    paymentDate: Date;
    paymentMethodText: string;
  }): Record<string, unknown> {
    return {
      'MONTO CANCELADO': payment.paymentAmount,
      'FECHA PAGO': formatFmDate(payment.paymentDate),
      'MODO DE PAGO': payment.paymentMethodText,
    };
  }

  extract(record: FmRecord): ExtractedLiquidation {
    const d = record.fieldData;
    const periodRaw = str(d['PERIODO COBRO']);
    const statusRaw = str(d['ESTADO']);
    const totalLiq = parseNum(d['TOTAL LIQUIDACIÓN']);
    const totalFinal = parseNum(d['TOTAL FINAL']);
    const montoCanc = str(d['MONTO CANCELADO']);
    const confirmadoField = str(d['Confirmado']);

    return {
      fmPk: parseNum(d['__pk_liquidaciones_instituciones']),
      labOriginCode: str(d['CODIGO INSTITUCION']),
      period: parsePeriod(periodRaw),
      periodLabel: periodRaw,
      status: parseLiquidationStatus(statusRaw),
      statusRaw,
      totalAmount: totalLiq || totalFinal,
      biopsyAmount: parseNum(d['VALOR TOTAL BIOPSIAS']),
      papAmount: parseNum(d['VALOR TOTAL PAP']),
      cytologyAmount: parseNum(d['VALOR TOTAL CITOLOGÍAS']),
      immunoAmount: parseNum(d['VALOR TOTAL INMUNOS']),
      biopsyCount: parseNum(d['Nº DE BIOPSIAS']),
      papCount: parseNum(d['Nº DE PAP']),
      cytologyCount: parseNum(d['Nº DE CITOLOGÍAS']),
      immunoCount: parseNum(d['Nº DE INMUNOS']),
      previousDebt: parseNum(d['DEUDA ANTERIOR']),
      creditBalance: parseNum(d['SALDO A FAVOR']),
      confirmedAt: confirmadoField.toLowerCase().includes('confirmado') ? new Date() : null,
      confirmedByNameSnapshot: confirmadoField.toLowerCase().includes('confirmado')
        ? confirmadoField
        : null,
      invoiceNumber: str(d['NUMERO DOCUMENTO']) || null,
      invoiceDate: parseDate(str(d['FECHA FACTURA'])),
      paymentAmount: montoCanc ? parseNum(d['MONTO CANCELADO']) || null : null,
      paymentDate: parseDate(str(d['FECHA PAGO'])),
      paymentMethodText: str(d['MODO DE PAGO']) || null,
      notes: null,
    };
  }
}

// ── Pure helpers ──

function formatFmDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

function parseLiquidationStatus(val: string): LiquidationStatusType {
  const lower = val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (lower.includes('confirmado')) return 'CONFIRMED';
  if (lower.includes('facturado')) return 'INVOICED';
  if (lower.includes('pagado') || lower.includes('cancelado total'))
    return 'PAID';
  if (lower.includes('parcial')) return 'PARTIALLY_PAID';
  if (lower.includes('vencido') || lower.includes('moroso')) return 'OVERDUE';
  if (lower.includes('cancelado') || lower.includes('anulado')) return 'CANCELLED';
  return 'DRAFT';
}
