import { Injectable } from '@nestjs/common';
import type { FmRecord } from '@zeru/shared';
import { str, parseNum, parseDate, parsePeriod } from './helpers';
import type { ExtractedLiquidation, LiquidationStatusType } from './types';

@Injectable()
export class LiquidationTransformer {
  readonly database = 'BIOPSIAS';
  readonly layout = 'Liquidaciones';

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
