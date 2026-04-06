import { Injectable } from '@nestjs/common';
import { EncryptionService } from '../../../common/services/encryption.service';
import { normalizeRut } from '@zeru/shared';
import type { FmRecord } from '@zeru/shared';

// ── Extracted DTO shapes ──

export interface ExtractedLegalEntity {
  rut: string;
  legalName: string;
  email: string | null;
  isClient: boolean;
}

export interface ExtractedLabOrigin {
  code: string;
  name: string;
  category: 'CONSULTA' | 'CENTRO_MEDICO' | 'CLINICA_HOSPITAL' | 'LABORATORIO' | 'OTRO';
  street: string | null;
  streetNumber: string | null;
  unit: string | null;
  commune: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  sampleReceptionMode: 'PRESENCIAL' | 'COURIER' | 'AMBAS';
  reportDeliveryMethods: ('WEB' | 'IMPRESO' | 'FTP' | 'EMAIL')[];
  deliveryDaysBiopsy: number | null;
  deliveryDaysPap: number | null;
  deliveryDaysCytology: number | null;
  deliveryDaysIhc: number | null;
  deliveryDaysDefault: number | null;
  encryptedFtpHost: string | null;
  encryptedFtpUser: string | null;
  encryptedFtpPassword: string | null;
  ftpPath: string | null;
  criticalNotificationEmails: string[];
  sendsQualityReports: boolean;
  receptionDays: string | null;
  receptionSchedule: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface ExtractedContact {
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
}

@Injectable()
export class ProcedenciasTransformer {
  readonly database = 'BIOPSIAS';
  readonly layout = 'Procedencias*';

  constructor(private readonly encryption: EncryptionService) {}

  // ── FM → Zeru extraction ──

  extractLegalEntity(record: FmRecord): ExtractedLegalEntity | null {
    const d = record.fieldData;
    const rawRut = str(d['INSTITUCIONES::Rut']);
    if (!rawRut) return null;

    const rut = normalizeRut(rawRut);
    if (rut.length < 3) return null;

    return {
      rut,
      legalName: str(d['INSTITUCIONES::Razón Social']) || `Sin razón social (${rut})`,
      email: str(d['INSTITUCIONES::Email encargado cuentas médicas']) || null,
      isClient: true,
    };
  }

  extractLabOrigin(record: FmRecord): ExtractedLabOrigin {
    const d = record.fieldData;
    const baseName = str(d['nombre_procedencia']) || 'Sin nombre';
    const subName = str(d['nombre_subprocedencia']);
    const name = subName ? `${baseName} - ${subName}` : baseName;

    return {
      code: str(d['codigo_unico']) || record.recordId,
      name,
      category: parseCategory(str(d['Categoria'])),
      street: str(d['calle']) || null,
      streetNumber: str(d['numero']) || null,
      unit: str(d['oficina']) || null,
      commune: str(d['comuna']) || null,
      city: str(d['ciudad']) || null,
      phone: str(d['telefono']) || null,
      email: str(d['email']) || null,
      sampleReceptionMode: parseReceptionMode(str(d['modalidad_recepcion _examenes'])),
      reportDeliveryMethods: parseDeliveryMethods(str(d['VIA ENTREGA INFORMES'])),
      deliveryDaysBiopsy: safeParseInt(d['PLAZO BIOPSIAS']),
      deliveryDaysPap: safeParseInt(d['PLAZO PAP']),
      deliveryDaysCytology: safeParseInt(d['PLAZO THIN PREP']),
      deliveryDaysIhc: null,
      deliveryDaysDefault: null,
      encryptedFtpHost: this.encryptIfPresent(str(d['FTP Servidor'])),
      encryptedFtpUser: this.encryptIfPresent(str(d['FTP Usuario'])),
      encryptedFtpPassword: this.encryptIfPresent(str(d['FTP Constraseña'])),
      ftpPath: str(d['FTP Path']) || null,
      criticalNotificationEmails: collectEmails(d),
      sendsQualityReports: isYes(str(d['ENVÍO INFORMES CALIDAD'])),
      receptionDays: str(d['días_recepcion']) || null,
      receptionSchedule: str(d['horario_recepcion']) || null,
      notes: str(d['OBSERVACIONES']) || null,
      isActive: isYes(str(d['Activo'])),
    };
  }

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

  extractGeneralContacts(record: FmRecord): ExtractedContact[] {
    const portalData = record.portalData?.['CONTACTOS'];
    if (!portalData || !Array.isArray(portalData)) return [];

    return portalData
      .map((row: Record<string, unknown>) => {
        const name = str(row['CONTACTOS::Nombre']);
        if (!name) return null;

        return {
          name,
          role: str(row['CONTACTOS::Cargo']) || null,
          email: str(row['CONTACTOS::Email']) || null,
          phone: str(row['CONTACTOS::Tel Fijo']) || null,
          mobile: str(row['CONTACTOS::Tel Celular']) || null,
        };
      })
      .filter((c): c is ExtractedContact => c !== null);
  }

  // ── Zeru → FM (write-back) ──

  legalEntityToFm(entity: {
    legalName: string;
    email?: string | null;
  }): Record<string, unknown> {
    return {
      'INSTITUCIONES::Razón Social': entity.legalName,
      ...(entity.email && { 'INSTITUCIONES::Email encargado cuentas médicas': entity.email }),
    };
  }

  labOriginToFm(origin: {
    name: string;
    street?: string | null;
    streetNumber?: string | null;
    unit?: string | null;
    commune?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
    isActive: boolean;
  }): Record<string, unknown> {
    return {
      nombre_procedencia: origin.name,
      calle: origin.street ?? '',
      numero: origin.streetNumber ?? '',
      oficina: origin.unit ?? '',
      comuna: origin.commune ?? '',
      ciudad: origin.city ?? '',
      telefono: origin.phone ?? '',
      email: origin.email ?? '',
      Activo: origin.isActive ? 'SI' : 'No',
    };
  }

  // ── Private helpers ──

  private encryptIfPresent(value: string | null): string | null {
    if (!value) return null;
    return this.encryption.encrypt(value);
  }
}

// ── Pure helper functions ──

function str(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function safeParseInt(val: unknown): number | null {
  const s = str(val);
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : Math.round(n);
}

function isYes(val: string): boolean {
  return /^s[iíÍ]/i.test(val);
}

function parseCategory(val: string): ExtractedLabOrigin['category'] {
  // Normalize: remove accents for robust matching
  const normalized = val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (normalized.includes('consulta')) return 'CONSULTA';
  if (normalized.includes('centro') && normalized.includes('med'))
    return 'CENTRO_MEDICO';
  if (normalized.includes('clinica') || normalized.includes('hospital'))
    return 'CLINICA_HOSPITAL';
  if (normalized.includes('laboratorio')) return 'LABORATORIO';
  return 'OTRO';
}

function parseReceptionMode(val: string): ExtractedLabOrigin['sampleReceptionMode'] {
  const lower = val.toLowerCase();
  if (lower.includes('ambas') || (lower.includes('presencial') && lower.includes('courier'))) return 'AMBAS';
  if (lower.includes('courier') || lower.includes('transporte')) return 'COURIER';
  return 'PRESENCIAL';
}

function parseDeliveryMethods(val: string): ExtractedLabOrigin['reportDeliveryMethods'] {
  if (!val) return [];
  const upper = val.toUpperCase();
  const methods: ExtractedLabOrigin['reportDeliveryMethods'] = [];
  if (upper.includes('WEB')) methods.push('WEB');
  if (upper.includes('FTP')) methods.push('FTP');
  if (upper.includes('IMPRES') || upper.includes('PAPEL')) methods.push('IMPRESO');
  if (upper.includes('EMAIL') || upper.includes('MAIL') || upper.includes('CORREO')) methods.push('EMAIL');
  return methods;
}

function collectEmails(data: Record<string, unknown>): string[] {
  const emails: string[] = [];
  for (const [key, val] of Object.entries(data)) {
    const keyLower = key.toLowerCase();
    // Only collect from critical notification email fields
    if (!keyLower.includes('receptor_critico') && !keyLower.includes('criticos'))
      continue;
    if (!keyLower.includes('email')) continue;
    const s = str(val);
    if (!s || !s.includes('@')) continue;
    for (const part of s.split(/[,;]\s*/)) {
      const trimmed = part.trim();
      if (trimmed.includes('@')) emails.push(trimmed);
    }
  }
  return [...new Set(emails)];
}
