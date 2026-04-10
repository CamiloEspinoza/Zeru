import { Injectable } from '@nestjs/common';
import { normalizeRut } from '@zeru/shared';
import type { FmRecord } from '@zeru/shared';
import { str, parseNum, parseDate, encodeS3Path } from './helpers';
import type {
  ExtractedExam,
  ExtractedSigner,
  ExtractedAttachmentRef,
  FmSourceType,
  ExamCategoryType,
  DiagnosticReportStatusType,
} from './types';

@Injectable()
export class PapTransformer {
  readonly database = 'PAPANICOLAOU';
  readonly layout = 'INGRESO';

  /**
   * Extract a unified ExamDTO from a PAPANICOLAOU or PAPANICOLAOUHISTORICO record.
   */
  extract(record: FmRecord, fmSource: FmSourceType): ExtractedExam {
    const d = record.fieldData;

    const informeNumber = parseNum(d['INFORME Nº']);
    const rawRut = str(d['RUT']);
    const rut = rawRut ? normalizeRut(rawRut) : null;
    const labOriginCode = str(d['CODIGO UNICO PROCEDENCIA']) || str(d['PROCEDENCIA']);
    const fecha = str(d['FECHA']);
    const validatedAt = parseDate(fecha);
    const sampleCollectedAt = parseDate(str(d['FECHA TOMA MUESTRA']));

    return {
      fmInformeNumber: informeNumber,
      fmSource,
      fmRecordId: record.recordId,

      // Patient snapshot
      subjectFirstName: str(d['NOMBRES']),
      subjectPaternalLastName: str(d['A.PATERNO']),
      subjectMaternalLastName: str(d['A.MATERNO']) || null,
      subjectRut: rut && rut.length >= 3 ? rut : null,
      subjectAge: parseNum(d['EDAD']) || null,
      subjectGender: null,

      // ServiceRequest
      category: parsePapCategory(str(d['EXAMEN'])),
      subcategory: null, // PAPs don't have subcategory
      isUrgent: false, // PAPs are never urgent
      requestingPhysicianName: str(d['SOLICITADO POR']) || null,
      labOriginCode: labOriginCode || record.recordId,
      anatomicalSite: str(d['MUESTRA DE']) || null,
      clinicalHistory: null, // PAPs don't have antecedentes field
      sampleCollectedAt,
      receivedAt: null,
      requestedAt: validatedAt,

      // DiagnosticReport
      status: inferPapStatus(d, validatedAt),
      conclusion: null, // PAP conclusion is in the fullText
      fullText: str(d['PAP TEXTO::TEXTO']) || null,
      microscopicDescription: null,
      macroscopicDescription: null,
      isAlteredOrCritical: false,
      validatedAt,
      issuedAt: validatedAt,

      // Signers
      signers: extractPapSigners(d, validatedAt),

      // Attachment refs
      attachmentRefs: extractPapAttachmentRefs(d, labOriginCode, validatedAt, informeNumber),
    };
  }
}

// ── Pure helper functions ──

function parsePapCategory(val: string): ExamCategoryType {
  const upper = val
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (upper.includes('PAP') || upper.includes('PAPANICOLAOU')) return 'PAP';
  if (upper.includes('CITOLOGIA') || upper.includes('THIN PREP')) return 'CYTOLOGY';
  // Default for the PAP table
  return 'PAP';
}

function inferPapStatus(
  d: Record<string, unknown>,
  validatedAt: Date | null,
): DiagnosticReportStatusType {
  const estadoWeb = str(d['Estado WEB']).toLowerCase();

  if (estadoWeb.includes('publicado') || estadoWeb.includes('descargado')) return 'DELIVERED';
  if (str(d['APROBACION PATOLOGO WEB'])) return 'SIGNED';
  if (validatedAt) return 'VALIDATED';
  return 'REGISTERED';
}

function extractPapSigners(d: Record<string, unknown>, validatedAt: Date | null): ExtractedSigner[] {
  const signers: ExtractedSigner[] = [];
  const signedAt = validatedAt ?? new Date();
  let order = 0;

  // 1. Screening tech (LECTOR SCREANING)
  const screener = str(d['LECTOR SCREANING']);
  if (screener) {
    order++;
    signers.push({
      codeSnapshot: screener,
      nameSnapshot: screener,
      role: 'SCREENING_TECH',
      signatureOrder: order,
      signedAt,
      isActive: true,
      supersededBy: null,
      correctionReason: null,
    });
  }

  // 2. Supervising tech (SUPERVISORA PAP)
  const supervisor = str(d['SUPERVISORA PAP']);
  if (supervisor) {
    order++;
    signers.push({
      codeSnapshot: supervisor,
      nameSnapshot: supervisor,
      role: 'SUPERVISING_TECH',
      signatureOrder: order,
      signedAt,
      isActive: true,
      supersededBy: null,
      correctionReason: null,
    });
  }

  // 3. Visto bueno tech (VISTO BUENO)
  const vistoBueno = str(d['VISTO BUENO']);
  if (vistoBueno) {
    order++;
    signers.push({
      codeSnapshot: vistoBueno,
      nameSnapshot: vistoBueno,
      role: 'VISTO_BUENO_TECH',
      signatureOrder: order,
      signedAt,
      isActive: true,
      supersededBy: null,
      correctionReason: null,
    });
  }

  // 4. Primary pathologist (APROBACION PATOLOGO WEB)
  const pathologist = str(d['APROBACION PATOLOGO WEB']);
  if (pathologist) {
    order++;
    signers.push({
      codeSnapshot: pathologist,
      nameSnapshot: pathologist,
      role: 'PRIMARY_PATHOLOGIST',
      signatureOrder: order,
      signedAt,
      isActive: true,
      supersededBy: null,
      correctionReason: null,
    });
  }

  return signers;
}

function extractPapAttachmentRefs(
  d: Record<string, unknown>,
  labOriginCode: string,
  validatedAt: Date | null,
  informeNumber: number,
): ExtractedAttachmentRef[] {
  const refs: ExtractedAttachmentRef[] = [];

  // Build S3 key components
  const year = validatedAt ? String(validatedAt.getFullYear()) : 'unknown';
  const month = validatedAt ? String(validatedAt.getMonth() + 1).padStart(2, '0') : 'unknown';
  const encodedOrigin = encodeS3Path(labOriginCode);

  // PAP PDFs come from Citolab S3 — always create a ref for matching
  if (informeNumber > 0 && labOriginCode) {
    refs.push({
      category: 'REPORT_PDF',
      label: `Informe PAP ${informeNumber}`,
      sequenceOrder: 0,
      s3Key: `Papanicolaous/${encodedOrigin}/${year}/${month}/${informeNumber}.pdf`,
      contentType: 'application/pdf',
      fmSourceField: 'PDF_FROM_S3_CITOLAB',
      fmContainerUrlOriginal: null,
      citolabS3KeyOriginal: `Papanicolaous/${labOriginCode}/${year}/${month}/${informeNumber}.pdf`,
    });
  }

  // Scanner Cartón
  const scannerCarton = str(d['Scanner Cartón']);
  if (scannerCarton) {
    refs.push({
      category: 'SCANNER_CARTON',
      label: `Scanner Cartón ${informeNumber}`,
      sequenceOrder: 1,
      s3Key: `Papanicolaous/${encodedOrigin}/${year}/${month}/${informeNumber}_scanner.jpg`,
      contentType: 'image/jpeg',
      fmSourceField: 'Scanner Cartón',
      fmContainerUrlOriginal: scannerCarton,
      citolabS3KeyOriginal: null,
    });
  }

  return refs;
}
