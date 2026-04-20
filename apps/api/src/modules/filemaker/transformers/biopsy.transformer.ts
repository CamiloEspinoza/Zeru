import { Injectable } from '@nestjs/common';
import { normalizeRut } from '@zeru/shared';
import type { FmRecord } from '@zeru/shared';
import { str, parseNum, parseDate, parseFmDateTime, encodeS3Path, isYes } from './helpers';

function mapGender(raw: string | null | undefined): 'MALE' | 'FEMALE' | 'OTHER' | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v === 'M' || v === 'MASCULINO' || v === 'MALE' || v === 'HOMBRE') return 'MALE';
  if (v === 'F' || v === 'FEMENINO' || v === 'FEMALE' || v === 'MUJER') return 'FEMALE';
  return 'OTHER';
}

function mapSeverity(
  raw: string | null | undefined,
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v === 'BAJA' || v === 'LOW') return 'LOW';
  if (v === 'MEDIA' || v === 'MEDIUM') return 'MEDIUM';
  if (v === 'ALTA' || v === 'HIGH') return 'HIGH';
  if (v === 'CRÍTICA' || v === 'CRITICA' || v === 'CRITICAL') return 'CRITICAL';
  return null;
}
import type {
  ExtractedExam,
  ExtractedSigner,
  ExtractedAttachmentRef,
  FmSourceType,
  ExamCategoryType,
  DiagnosticReportStatusType,
} from './types';

@Injectable()
export class BiopsyTransformer {
  readonly database = 'BIOPSIAS';
  readonly layout = 'Validación Final*';

  /**
   * Layout for macroscopy text write-back.
   * TEXTO* layout contains the TEXTO BIOPSIAS::TEXTO field and macroscopy fields.
   */
  readonly macroscopyLayout = 'TEXTO*';

  /**
   * Convert macroscopic description to FM field data.
   * The macroscopy text is stored in the TEXTO* layout's macro fields.
   */
  macroscopyToFm(data: {
    macroscopicDescription: string;
  }): Record<string, unknown> {
    return {
      'TEXTO BIOPSIAS::MACRO': data.macroscopicDescription,
    };
  }

  /**
   * Layout for macro signer registration.
   */
  readonly macroSignerLayout = 'Ingreso Trazabilidad Macroscopía*';

  /**
   * Create a macro signer record in FM.
   */
  macroSignerToFm(data: {
    fkInformeNumber: number;
    pathologistCode: string;
    pathologistName: string;
    assistantCode: string | null;
    assistantName: string | null;
  }): Record<string, unknown> {
    const fields: Record<string, unknown> = {
      '_fk_Informe_Número': data.fkInformeNumber,
      'PATÓLOGO MACRO': data.pathologistName,
    };
    if (data.assistantName) {
      fields['AYUDANTE MACRO'] = data.assistantName;
    }
    return fields;
  }

  /**
   * Extract a unified ExamDTO from a BIOPSIAS or BIOPSIASRESPALDO record.
   */
  extract(record: FmRecord, fmSource: FmSourceType): ExtractedExam {
    const d = record.fieldData;

    const informeNumber = parseNum(d['INFORME Nº']);
    const rawRut = str(d['RUT']);
    const rut = rawRut ? normalizeRut(rawRut) : null;
    const labOriginCode = str(d['PROCEDENCIA CODIGO UNICO']);

    // Use FECHA APROBACION for BIOPSIASRESPALDO, FECHA VALIDACIÓN for BIOPSIAS
    const validationDateField =
      fmSource === 'BIOPSIASRESPALDO' && !str(d['FECHA VALIDACIÓN'])
        ? str(d['FECHA APROBACION'])
        : str(d['FECHA VALIDACIÓN']);
    const validatedAt = parseDate(validationDateField);
    const requestedAt = parseDate(str(d['FECHA']));

    const result: ExtractedExam = {
      fmInformeNumber: informeNumber,
      fmSource,
      fmRecordId: record.recordId,

      // Patient snapshot
      subjectFirstName: str(d['NOMBRE']),
      subjectPaternalLastName: str(d['A.PATERNO']),
      subjectMaternalLastName: str(d['A.MATERNO']) || null,
      subjectRut: rut && rut.length >= 3 ? rut : null,
      subjectAge: parseNum(d['EDAD']) || null,
      subjectGender: mapGender(str(d['SEXO'])),

      // ServiceRequest
      category: parseExamCategory(str(d['TIPO DE EXAMEN'])),
      subcategory: str(d['SUBTIPO EXAMEN']) || null,
      isUrgent: str(d['URGENTES']).toUpperCase().includes('URGENTE'),
      requestingPhysicianName: str(d['SOLICITADA POR']) || null,
      // Sentinel cuando FM no entrega código — evita crear procedencias fantasma
      // basadas en recordId volátil. Downstream debe filtrar/loggear UNKNOWN.
      labOriginCode: labOriginCode || 'UNKNOWN',
      anatomicalSite: str(d['MUESTRA DE']) || null,
      clinicalHistory: str(d['ANTECEDENTES']) || null,
      sampleCollectedAt: null, // Not typically in biopsies
      receivedAt: null,
      requestedAt,

      // DiagnosticReport
      status: inferStatus(d, validatedAt),
      conclusion: str(d['DIAGNOSTICO']) || null,
      fullText: str(d['TEXTO BIOPSIAS::TEXTO']) || null,
      microscopicDescription: null,
      macroscopicDescription: null,
      isAlteredOrCritical: isYes(str(d['Alterado o Crítico'])),
      validatedAt,
      issuedAt: validatedAt,

      // Signers
      signers: extractSigners(d, validatedAt),

      // Attachment refs
      attachmentRefs: extractAttachmentRefs(record, labOriginCode, validatedAt, informeNumber),
    };

    // F0 — nuevos campos
    result.subjectBirthDate = parseDate(str(d['FECHA NACIMIENTO']));
    result.externalFolioNumber = str(d['NºFOLIO']) || null;
    result.externalOrderNumber = str(d['Nº ORDEN ATENCION']) || null;
    result.externalInstitutionId = str(d['NUMERO IDENTIFICADOR INSTITUCION']) || null;
    result.requestingPhysicianCode = str(d['COD. MEDICO']) || null;
    const reqRut = str(d['Biopsias::Rut Medico Solicitante']);
    result.requestingPhysicianRut = reqRut ? normalizeRut(reqRut) : null;
    result.containerType = str(d['TIPO ENVASE']) || null;
    result.tacoCount = parseNum(d['TACOS']) || null;
    result.cassetteCount = parseNum(d['CASSETTES DE INCLUSION']) || null;
    result.placaHeCount = parseNum(d['PLACAS HE']) || null;
    result.specialTechniquesCount = parseNum(d['Total especiales']) || null;
    // Solo separamos por | y ; (la coma aparece en nombres reales como "anti-CD20, clon L26")
    const anticuerpos = str(d['ANTICUERPOS']);
    result.ihqAntibodies = anticuerpos
      ? anticuerpos.split(/[|;]/).map((s) => s.trim()).filter(Boolean)
      : [];
    result.ihqNumbers = str(d['INMUNO NUMEROS']) || null;
    result.ihqStatus = str(d['INMUNOS Estado Solicitud']) || null;
    result.ihqRequestedAt = parseDate(str(d['INMUNOS Fecha solicitud']));
    result.ihqRespondedAt = parseDate(str(d['INMUNOS Fecha Respuesta']));
    result.ihqResponsibleNameSnapshot = str(d['INMUNOS Responsable solicitud']) || null;
    result.criticalPatientNotifyFlag = isYes(str(d['AVISAR PACIENTE']));
    result.criticalNotifiedBy = str(d['RESULTADO CRITICO RESPONSABLE NOTIFICACION']) || null;
    result.criticalNotifiedAt = parseFmDateTime(
      str(d['FECHA NOTIFICACION CRITICO']),
      str(d['HORA NOTIFICACION VALOR CRITICO']),
    );
    result.criticalNotificationPdfKey = str(d['PDF Notificación Crítico']) || null;
    result.ccbComments = str(d['COMENTARIOS CCB']) || null;
    result.rejectedByCcb = isYes(str(d['Rechazado por CCB']));
    result.diagnosticModified = isYes(str(d['DIAGNOSTICO MODIFICADO']));
    result.modifiedByUser = str(d['Modifcado Por']) || null;
    result.modifiedAt = parseFmDateTime(
      str(d['Modifcado Por Fecha']),
      str(d['Modifcado Por Hora']),
    );

    // Portales F0
    const pd = (record.portalData ?? {}) as Record<string, Record<string, unknown>[]>;

    result.adverseEvents = (pd['portalEventosAdversos'] ?? [])
      .map((row) => ({
        eventType: str(row['EventosAdversos::tipo']) || 'DESCONOCIDO',
        severity: mapSeverity(str(row['EventosAdversos::severidad'])),
        description: str(row['EventosAdversos::descripcion']),
        occurredAt: parseDate(str(row['EventosAdversos::fechaOcurrencia'])),
        detectedAt: parseDate(str(row['EventosAdversos::fechaDeteccion'])),
        status: str(row['EventosAdversos::estado']) || null,
      }))
      .filter((e) => e.description);

    result.technicalObservations = (pd['Observaciones Tecnicas'] ?? [])
      .map((row) => ({
        workflowStage: str(row['Obs::etapa']) || null,
        description: str(row['Obs::descripcion']),
        observedAt: parseDate(str(row['Obs::fecha'])),
        observedByNameSnapshot: str(row['Obs::responsable']) || null,
      }))
      .filter((o) => o.description);

    result.slides = (pd['Placas'] ?? [])
      .map((row) => ({
        placaCode: str(row['Placas::codigo']) || null,
        stain: str(row['Placas::tincion']) || null,
        level: str(row['Placas::nivel']) || null,
      }))
      .filter((s) => s.placaCode);

    result.specialTechniques = (pd['TÉCNICAS ESPECIALES'] ?? [])
      .map((row) => ({
        name: str(row['Tec::nombre']),
        code: str(row['Tec::codigo']) || null,
        status: str(row['Tec::estado']) || null,
        requestedAt: parseDate(str(row['Tec::fechaSolicitud'])),
        respondedAt: parseDate(str(row['Tec::fechaRespuesta'])),
        responsibleNameSnapshot: str(row['Tec::responsable']) || null,
      }))
      .filter((t) => t.name);

    return result;
  }
}

// ── Pure helper functions ──

function parseExamCategory(val: string): ExamCategoryType {
  const upper = val
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (upper.includes('BIOPSIA')) return 'BIOPSY';
  if (upper.includes('INMUNOHISTOQUIMICA') || upper.includes('IHQ') || upper.includes('INMUNO'))
    return 'IMMUNOHISTOCHEMISTRY';
  if (upper.includes('CITOLOGIA') || upper.includes('THIN PREP')) return 'CYTOLOGY';
  if (upper.includes('MOLECULAR')) return 'MOLECULAR';
  if (upper.includes('PAP')) return 'PAP';
  return 'OTHER';
}

function inferStatus(
  d: Record<string, unknown>,
  validatedAt: Date | null,
): DiagnosticReportStatusType {
  const activarSubir = str(d['Activar Subir Examen']);
  const estadoWeb = str(d['Estado Web']).toLowerCase();

  if (estadoWeb.includes('publicado') || estadoWeb.includes('descargado')) return 'DELIVERED';
  if (activarSubir && /^s[iíÍ]/i.test(activarSubir)) return 'SIGNED';
  if (validatedAt) return 'VALIDATED';
  return 'REGISTERED';
}

function extractSigners(d: Record<string, unknown>, validatedAt: Date | null): ExtractedSigner[] {
  const signers: ExtractedSigner[] = [];
  const signedAt = validatedAt ?? new Date();
  let order = 0;

  // Primary pathologist
  const patologo = str(d['PATOLOGO']);
  if (patologo) {
    order++;
    signers.push({
      codeSnapshot: extractCode(patologo),
      nameSnapshot: patologo,
      role: 'PRIMARY_PATHOLOGIST',
      signatureOrder: order,
      signedAt,
      isActive: true,
      supersededBy: null,
      correctionReason: null,
    });
  }

  // Supervising pathologist
  const supervisor = str(d['Revisado por patólogo supervisor']);
  const patSupCorrection = str(d['caso corregido por PAT SUP']);

  if (supervisor) {
    order++;
    signers.push({
      codeSnapshot: extractCode(supervisor),
      nameSnapshot: supervisor,
      role: 'SUPERVISING_PATHOLOGIST',
      signatureOrder: order,
      signedAt,
      isActive: !patSupCorrection, // Superseded if PAT SUP correction exists
      supersededBy: patSupCorrection || null,
      correctionReason: patSupCorrection ? 'Corregido por patólogo supervisor' : null,
    });
  }

  // PAT SUP correction (new supervising pathologist)
  if (patSupCorrection) {
    order++;
    signers.push({
      codeSnapshot: extractCode(patSupCorrection),
      nameSnapshot: patSupCorrection,
      role: 'SUPERVISING_PATHOLOGIST',
      signatureOrder: order,
      signedAt,
      isActive: true,
      supersededBy: null,
      correctionReason: null,
    });
  }

  // Validation correction
  const validationCorrection = str(d['caso corregido por validacion']);
  if (validationCorrection) {
    order++;
    signers.push({
      codeSnapshot: extractCode(validationCorrection),
      nameSnapshot: validationCorrection,
      role: 'VALIDATION_CORRECTION',
      signatureOrder: order,
      signedAt,
      isActive: true,
      supersededBy: null,
      correctionReason: null,
    });
  }

  return signers;
}

/**
 * Extract a practitioner code from strings like "Dr. Martínez (PAT-001)".
 * Falls back to full string if no parenthesized code found.
 */
function extractCode(name: string): string {
  const match = name.match(/\(([^)]+)\)/);
  return match ? match[1] : name;
}

function extractAttachmentRefs(
  record: FmRecord,
  labOriginCode: string,
  validatedAt: Date | null,
  informeNumber: number,
): ExtractedAttachmentRef[] {
  const refs: ExtractedAttachmentRef[] = [];
  const d = record.fieldData;

  // Build S3 key components
  const year = validatedAt ? String(validatedAt.getFullYear()) : 'unknown';
  const month = validatedAt ? String(validatedAt.getMonth() + 1).padStart(2, '0') : 'unknown';
  const encodedOrigin = encodeS3Path(labOriginCode);

  // PDF report
  const pdfUrl = str(d['INFORMES PDF::PDF INFORME']);
  if (pdfUrl) {
    refs.push({
      category: 'REPORT_PDF',
      label: `Informe ${informeNumber}`,
      sequenceOrder: 0,
      s3Key: `Biopsias/${encodedOrigin}/${year}/${month}/${informeNumber}.pdf`,
      contentType: 'application/pdf',
      fmSourceField: 'INFORMES PDF::PDF INFORME',
      fmContainerUrlOriginal: pdfUrl,
      citolabS3KeyOriginal: `Biopsias/${labOriginCode}/${year}/${month}/${informeNumber}.pdf`,
    });
  }

  // Scanner/micro photos from portal SCANNER BP 8
  const scannerPortal = record.portalData?.['SCANNER BP 8'];
  if (scannerPortal && Array.isArray(scannerPortal)) {
    let photoIndex = 0;
    let dictationIndex = 0;
    for (const row of scannerPortal) {
      // Check FOTO 1 through FOTO 22
      for (let i = 1; i <= 22; i++) {
        const fotoUrl = str(row[`SCANNER BP 8::FOTO ${i}`]);
        if (fotoUrl) {
          photoIndex++;
          refs.push({
            category: 'MICRO_PHOTO',
            label: `Foto ${photoIndex}`,
            sequenceOrder: photoIndex,
            s3Key: `Biopsias/${encodedOrigin}/${year}/${month}/${informeNumber}_foto_${photoIndex}.jpg`,
            contentType: 'image/jpeg',
            fmSourceField: `SCANNER BP 8::FOTO ${i}`,
            fmContainerUrlOriginal: fotoUrl,
            citolabS3KeyOriginal: null,
          });
        }
      }

      // Check MACRO
      const macroUrl = str(row['SCANNER BP 8::MACRO']);
      if (macroUrl) {
        photoIndex++;
        refs.push({
          category: 'MACRO_PHOTO',
          label: `Macro ${photoIndex}`,
          sequenceOrder: photoIndex,
          s3Key: `Biopsias/${encodedOrigin}/${year}/${month}/${informeNumber}_macro_${photoIndex}.jpg`,
          contentType: 'image/jpeg',
          fmSourceField: 'SCANNER BP 8::MACRO',
          fmContainerUrlOriginal: macroUrl,
          citolabS3KeyOriginal: null,
        });
      }

      // F0 — DICTADO MACRO (audio del patólogo)
      const dictationUrl = str(row['SCANNER BP 8::DICTADO MACRO']);
      if (dictationUrl) {
        dictationIndex++;
        refs.push({
          category: 'MACRO_DICTATION',
          label: `Dictado macro ${dictationIndex}`,
          sequenceOrder: dictationIndex,
          s3Key: `Biopsias/${encodedOrigin}/${year}/${month}/${informeNumber}_dictado_${dictationIndex}.mp3`,
          contentType: 'audio/mpeg',
          fmSourceField: 'SCANNER BP 8::DICTADO MACRO',
          fmContainerUrlOriginal: dictationUrl,
          citolabS3KeyOriginal: null,
        });
      }
    }
  }

  // F0 — REQUEST_DOCUMENT (solicitud escaneada)
  const requestDocUrl = str(d['Biopsias_Ingresos::Scanner Documento']);
  if (requestDocUrl) {
    refs.push({
      category: 'REQUEST_DOCUMENT',
      label: `Solicitud ${informeNumber}`,
      sequenceOrder: 0,
      s3Key: `Biopsias/${encodedOrigin}/${year}/${month}/${informeNumber}_solicitud.pdf`,
      contentType: 'application/pdf',
      fmSourceField: 'Biopsias_Ingresos::Scanner Documento',
      fmContainerUrlOriginal: requestDocUrl,
      citolabS3KeyOriginal: null,
    });
  }

  // F0 — CRITICAL_NOTIFICATION_PDF
  const critPdfUrl = str(d['PDF Notificación Crítico']);
  if (critPdfUrl) {
    refs.push({
      category: 'CRITICAL_NOTIFICATION_PDF',
      label: `Notificación crítico ${informeNumber}`,
      sequenceOrder: 0,
      s3Key: `Biopsias/${encodedOrigin}/${year}/${month}/${informeNumber}_critico.pdf`,
      contentType: 'application/pdf',
      fmSourceField: 'PDF Notificación Crítico',
      fmContainerUrlOriginal: critPdfUrl,
      citolabS3KeyOriginal: null,
    });
  }

  return refs;
}
