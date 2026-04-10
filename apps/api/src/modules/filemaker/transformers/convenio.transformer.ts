import { Injectable } from '@nestjs/common';
import { normalizeRut } from '@zeru/shared';
import type { FmRecord } from '@zeru/shared';
import { str, parseNum, parseDate, isYes } from './helpers';

// ── Extracted DTOs ──

export interface ExtractedBillingConcept {
  code: string;
  name: string;
  description: string | null;
  referencePrice: number;
}

export interface ExtractedBillingAgreement {
  code: string;
  name: string;
  rut: string | null; // for LegalEntity lookup
  status: 'ACTIVE' | 'EXPIRED' | 'DRAFT';
  contractDate: Date | null;
  paymentTerms: 'IMMEDIATE' | 'NET_15' | 'NET_30' | 'NET_45' | 'NET_60' | 'NET_90' | 'CUSTOM';
  customPaymentDays: number | null;
  billingDayOfMonth: number | null;
  isMonthlySettlement: boolean;
  billingModalities: string[];
  examTypes: string[];
  operationalFlags: Record<string, boolean> | null;
  isActive: boolean;
  notes: string | null;
}

export interface ExtractedBillingLine {
  fmConceptRecordId: string; // FM recordId of the CDC concept — for FK mapping
  factor: number;
  negotiatedPrice: number;
  referencePrice: number | null;
  description: string | null;
}

export interface ExtractedContact {
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
}

@Injectable()
export class ConvenioTransformer {
  readonly database = 'BIOPSIAS';
  readonly agreementLayout = 'CONVENIOS Conceptos de cobro*';
  readonly conceptLayout = 'Conceptos de cobro (CDC)*';
  readonly pricingLayout = 'conceptos de cobro procedencia';

  // ── BillingConcept (from Conceptos de cobro (CDC)* layout) ──

  extractBillingConcept(record: FmRecord): ExtractedBillingConcept {
    const d = record.fieldData;
    return {
      code: str(d['Concepto']) || `CDC-${record.recordId}`,
      name: str(d['Concepto']) || 'Sin nombre',
      description: str(d['Decripción']) || null, // Note: FM has typo "Decripción"
      referencePrice: parseNum(d['Valor']),
    };
  }

  // ── BillingAgreement (from CONVENIOS Conceptos de cobro* layout) ──

  extractBillingAgreement(record: FmRecord): ExtractedBillingAgreement {
    const d = record.fieldData;
    return {
      code: str(d['Código']) || str(d['__pk_convenio']) || record.recordId,
      name: str(d['Nombre Institución']) || 'Sin nombre',
      rut: normalizeRut(str(d['Rut'])) || null,
      status: parseAgreementStatus(str(d['Estado Revisión Convenio'])),
      contractDate: parseDate(str(d['Fecha Contrato'])),
      paymentTerms: parsePaymentTerms(str(d['PlazoPago'])),
      customPaymentDays: parseCustomPaymentDays(str(d['PlazoPago'])),
      billingDayOfMonth: parseBillingDay(str(d['Día de Facturación'])),
      isMonthlySettlement: isYes(str(d['Liquidación Mensual'])),
      billingModalities: parseModalities(str(d['Modalidades Cobro'])),
      examTypes: parseExamTypes(str(d['Exámenes'])),
      operationalFlags: parseOperationalFlags(d),
      isActive: isYes(str(d['Activo'])),
      notes: str(d['Comentarios Cobro']) || null,
    };
  }

  // ── BillingAgreementLine (from portal portal_cdc or standalone layout) ──

  extractPricingLines(record: FmRecord): ExtractedBillingLine[] {
    const portalData = record.portalData?.['portal_cdc'];
    if (!portalData || !Array.isArray(portalData)) return [];

    // Portal field names use the Table Occurrence prefix, not the portal object name
    const TO = 'Conceptos de cobro_procedencia';
    return portalData
      .map((row: Record<string, unknown>) => {
        const conceptFk = str(row[`${TO}::Concepto de cobro_fk`]);
        if (!conceptFk) return null;

        const rawFactor = str(row[`${TO}::Factor`]);
        return {
          fmConceptRecordId: conceptFk,
          factor: rawFactor ? parseNum(row[`${TO}::Factor`]) : 1,
          negotiatedPrice: parseNum(row[`${TO}::Valor`]),
          referencePrice: str(row[`${TO}::Valor Referencia`])
            ? parseNum(row[`${TO}::Valor Referencia`])
            : null,
          description: str(row[`${TO}::Descripción`]) || null,
        };
      })
      .filter((l): l is ExtractedBillingLine => l !== null);
  }

  extractPricingLineFromRecord(record: FmRecord): ExtractedBillingLine | null {
    const d = record.fieldData;
    const conceptFk = str(d['Concepto de cobro_fk']);
    if (!conceptFk) return null;

    const rawFactor = str(d['Factor']);
    return {
      fmConceptRecordId: conceptFk,
      factor: rawFactor ? parseNum(d['Factor']) : 1,
      negotiatedPrice: parseNum(d['Valor']),
      referencePrice: str(d['Valor Referencia']) ? parseNum(d['Valor Referencia']) : null,
      description: str(d['Descripción']) || null,
    };
  }

  // For the pricing layout, extract the Convenio FK
  extractConvenioFk(record: FmRecord): string {
    return str(record.fieldData['Convenio_fk']);
  }

  // ── Contacts (from portal CONTACTOS Cobranzas) ──

  extractContacts(record: FmRecord): ExtractedContact[] {
    const portalData = record.portalData?.['CONTACTOS Cobranzas'];
    if (!portalData || !Array.isArray(portalData)) return [];

    return portalData
      .map((row: Record<string, unknown>) => {
        const firstName = str(row['CONTACTOS Cobranzas::Nombre']);
        const lastName = str(row['CONTACTOS Cobranzas::Apellido']);
        const name = [firstName, lastName].filter(Boolean).join(' ');
        if (!name) return null;
        return {
          name,
          role: str(row['CONTACTOS Cobranzas::Cargo']) || null,
          email: str(row['CONTACTOS Cobranzas::Email']) || null,
          phone: str(row['CONTACTOS Cobranzas::Tel Fijo']) || null,
          mobile: str(row['CONTACTOS Cobranzas::Tel Celular']) || null,
        };
      })
      .filter((c): c is ExtractedContact => c !== null);
  }
}

// ── Pure helpers (domain-specific to convenio) ──

function parsePaymentTerms(val: string): ExtractedBillingAgreement['paymentTerms'] {
  if (!val) return 'NET_30';
  const n = Number(val.replace(/[^0-9]/g, ''));
  if (isNaN(n)) return 'NET_30';
  if (n <= 0) return 'IMMEDIATE';
  if (n <= 15) return 'NET_15';
  if (n <= 30) return 'NET_30';
  if (n <= 45) return 'NET_45';
  if (n <= 60) return 'NET_60';
  if (n <= 90) return 'NET_90';
  return 'CUSTOM';
}

function parseCustomPaymentDays(val: string): number | null {
  const n = Number(val?.replace(/[^0-9]/g, ''));
  if (!n || isNaN(n) || n <= 90) return null;
  return n;
}

function parseBillingDay(val: string): number | null {
  if (!val) return null;
  const n = Number(val.replace(/[^0-9]/g, ''));
  if (!n || isNaN(n) || n < 1 || n > 28) return null;
  return n;
}

function parseAgreementStatus(val: string): ExtractedBillingAgreement['status'] {
  const lower = val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (lower.includes('ok') || lower.includes('activ') || lower.includes('vigente')) return 'ACTIVE';
  if (lower.includes('vencid') || lower.includes('expir') || lower.includes('inactiv')) return 'EXPIRED';
  if (lower.includes('borrador') || lower.includes('draft') || lower.includes('revision')) return 'DRAFT';
  return 'ACTIVE'; // default
}

function parseModalities(val: string): string[] {
  if (!val) return [];
  // FM stores as return-separated multivalue
  return val.split(/[\r\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const upper = s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (upper.includes('LIQUIDACION') && upper.includes('MENSUAL')) return 'MONTHLY_SETTLEMENT';
      if (upper.includes('FONASA')) return 'FONASA_VOUCHER';
      if (upper.includes('ISAPRE')) return 'ISAPRE_VOUCHER';
      if (upper.includes('EFECTIVO')) return 'CASH';
      if (upper.includes('CHEQUE')) return 'CHECK';
      if (upper.includes('TRANSFER')) return 'BANK_TRANSFER';
      return 'OTHER';
    });
}

function parseExamTypes(val: string): string[] {
  if (!val) return [];
  return val.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
}

function parseOperationalFlags(d: Record<string, unknown>): Record<string, boolean> | null {
  const flags: Record<string, boolean> = {};
  const mapping: Record<string, string> = {
    'Registro de documentos en recepción': 'registroDocumentos',
    'Registro de códigos': 'registroCodigos',
    'Registro Diario de Ingresos': 'registroDiarioIngresos',
    'Envío desfasado de bonos': 'envioDesfasadoBonos',
    'Carga diaria a cuenta médica': 'cargaDiariaCuentaMedica',
  };
  let hasAny = false;
  for (const [fmField, zeruKey] of Object.entries(mapping)) {
    const val = str(d[fmField]);
    if (val) {
      flags[zeruKey] = isYes(val);
      hasAny = true;
    }
  }
  return hasAny ? flags : null;
}
