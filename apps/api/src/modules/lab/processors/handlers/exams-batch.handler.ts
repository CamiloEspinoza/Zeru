import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { BiopsyTransformer } from '../../../filemaker/transformers/biopsy.transformer';
import { PapTransformer } from '../../../filemaker/transformers/pap.transformer';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';
import {
  toExamCategory,
  toDiagnosticReportStatus,
  toFmSource,
  toSigningRole,
  toAttachmentCategory,
  toGender,
} from '../../constants/enum-maps';
import {
  AdverseSeverity,
  AdverseStatus,
  WorkflowEventType,
} from '@prisma/client';
import type { FmRecord } from '@zeru/shared';
import type { ExtractedExam, FmSourceType } from '../../../filemaker/transformers/types';

export interface ExamsBatchJobData {
  runId: string;
  tenantId: string;
  fmSource: FmSourceType;
  batchIndex: number;
  offset: number;
  limit: number;
  dateFrom?: string;
  dateTo?: string;
}

/** FM source -> { database, layout, dateField } */
const SOURCE_META: Record<
  string,
  { database: string; layout: string; dateField: string; type: 'biopsy' | 'pap' }
> = {
  BIOPSIAS: {
    database: 'BIOPSIAS',
    layout: 'Validación Final*',
    dateField: 'FECHA VALIDACIÓN',
    type: 'biopsy',
  },
  BIOPSIASRESPALDO: {
    database: 'BIOPSIASRESPALDO',
    layout: 'Validación Final*',
    dateField: 'FECHA VALIDACIÓN',
    type: 'biopsy',
  },
  PAPANICOLAOU: {
    database: 'PAPANICOLAOU',
    layout: 'INGRESO',
    dateField: 'FECHA',
    type: 'pap',
  },
  PAPANICOLAOUHISTORICO: {
    database: 'PAPANICOLAOUHISTORICO',
    layout: 'INGRESO',
    dateField: 'FECHA',
    type: 'pap',
  },
};

@Injectable()
export class ExamsBatchHandler {
  private readonly logger = new Logger(ExamsBatchHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly biopsyTransformer: BiopsyTransformer,
    private readonly papTransformer: PapTransformer,
    private readonly orchestrator: LabImportOrchestratorService,
  ) {}

  async handle(data: ExamsBatchJobData): Promise<void> {
    const { runId, tenantId, fmSource, batchIndex, offset, limit, dateFrom, dateTo } = data;
    const meta = SOURCE_META[fmSource];

    // Find batch record
    const batch = await this.prisma.labImportBatch.findFirst({
      where: { runId, phase: 'phase-1-exams', fmSource, batchIndex },
    });
    const batchId = batch?.id;

    try {
      if (batchId) {
        await this.prisma.labImportBatch.update({
          where: { id: batchId },
          data: { status: 'RUNNING', startedAt: new Date() },
        });
      }

      // Fetch records from FM
      const records = await this.fetchRecords(meta, offset, limit, dateFrom, dateTo);
      this.logger.log(`[${fmSource}] Batch ${batchIndex}: fetched ${records.length} records`);

      let processedCount = 0;
      let errorCount = 0;
      const errors: Array<{ recordId: string; error: string }> = [];

      for (const record of records) {
        try {
          const exam =
            meta.type === 'biopsy'
              ? this.biopsyTransformer.extract(record, fmSource)
              : this.papTransformer.extract(record, fmSource);

          await this.processExam(tenantId, exam);
          processedCount++;
        } catch (error) {
          errorCount++;
          const msg = error instanceof Error ? error.message : String(error);
          errors.push({ recordId: record.recordId, error: msg });
          this.logger.warn(`[${fmSource}] Record ${record.recordId} failed: ${msg}`);
        }
      }

      // Update batch status
      if (batchId) {
        await this.prisma.labImportBatch.update({
          where: { id: batchId },
          data: {
            status: errorCount === records.length ? 'FAILED' : 'COMPLETED',
            recordCount: records.length,
            processedCount,
            errorCount,
            errors: errors.length > 0 ? errors : undefined,
            completedAt: new Date(),
          },
        });
      }

      // Update run counters
      await this.prisma.labImportRun.update({
        where: { id: runId },
        data: {
          completedBatches: { increment: 1 },
          processedRecords: { increment: processedCount },
          errorRecords: { increment: errorCount },
          ...(errorCount === records.length ? { failedBatches: { increment: 1 } } : {}),
        },
      });

      // Check if phase is complete
      await this.orchestrator.advancePhase(runId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${fmSource}] Batch ${batchIndex} failed entirely: ${msg}`);

      if (batchId) {
        try {
          await this.prisma.labImportBatch.update({
            where: { id: batchId },
            data: {
              status: 'PENDING', // Keep PENDING so advancePhase counts it during retries
              errors: [{ error: msg }],
            },
          });
        } catch (e) {
          this.logger.error(`Failed to update batch status: ${e}`);
        }
      }

      throw error; // Let BullMQ retry
    }
  }

  private async fetchRecords(
    meta: { database: string; layout: string; dateField: string },
    offset: number,
    limit: number,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<FmRecord[]> {
    if (dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      const rangeStr = `${this.fmDate(from)}...${this.fmDate(to)}`;
      const response = await this.fmApi.findRecords(
        meta.database,
        meta.layout,
        [{ [meta.dateField]: rangeStr }],
        { offset, limit, dateformats: 2 },
      );
      return response.records;
    }

    const response = await this.fmApi.getRecords(meta.database, meta.layout, {
      offset,
      limit,
      dateformats: 2,
    });
    return response.records;
  }

  private async processExam(tenantId: string, exam: ExtractedExam): Promise<void> {
    // 1. Resolve or create Patient
    const patientId = await this.resolvePatient(tenantId, exam);

    // 2. Resolve LabOrigin
    const labOrigin = await this.prisma.labOrigin.findFirst({
      where: { tenantId, code: exam.labOriginCode },
    });
    if (!labOrigin) {
      throw new Error(
        `Unknown labOriginCode: ${exam.labOriginCode} (informe ${exam.fmInformeNumber})`,
      );
    }
    const labOriginId = labOrigin.id;

    // 3. Upsert ServiceRequest
    const sr = await this.prisma.labServiceRequest.upsert({
      where: {
        tenantId_fmSource_fmInformeNumber: {
          tenantId,
          fmSource: toFmSource(exam.fmSource),
          fmInformeNumber: exam.fmInformeNumber,
        },
      },
      create: {
        tenantId,
        fmInformeNumber: exam.fmInformeNumber,
        fmSource: toFmSource(exam.fmSource),
        subjectFirstName: exam.subjectFirstName,
        subjectPaternalLastName: exam.subjectPaternalLastName,
        subjectMaternalLastName: exam.subjectMaternalLastName,
        subjectRut: exam.subjectRut,
        subjectAge: exam.subjectAge,
        subjectId: patientId,
        category: toExamCategory(exam.category),
        subcategory: exam.subcategory,
        priority: exam.isUrgent ? 'URGENT' : 'ROUTINE',
        requestingPhysicianName: exam.requestingPhysicianName,
        requestingPhysicianEmail: exam.requestingPhysicianEmail ?? null,
        labOriginId,
        labOriginCodeSnapshot: exam.labOriginCode,
        sampleCollectedAt: exam.sampleCollectedAt,
        receivedAt: exam.receivedAt,
        requestedAt: exam.requestedAt,
        clinicalHistory: exam.clinicalHistory,
        muestraDe: exam.anatomicalSite,
        externalFolioNumber: exam.externalFolioNumber ?? null,
        externalInstitutionId: exam.externalInstitutionId ?? null,
        externalOrderNumber: exam.externalOrderNumber ?? null,
      },
      update: {
        subjectFirstName: exam.subjectFirstName,
        subjectPaternalLastName: exam.subjectPaternalLastName,
        subjectMaternalLastName: exam.subjectMaternalLastName,
        subjectRut: exam.subjectRut,
        subjectAge: exam.subjectAge,
        subjectId: patientId,
        category: toExamCategory(exam.category),
        subcategory: exam.subcategory,
        requestingPhysicianName: exam.requestingPhysicianName,
        requestingPhysicianEmail: exam.requestingPhysicianEmail ?? null,
        labOriginId,
        labOriginCodeSnapshot: exam.labOriginCode,
        sampleCollectedAt: exam.sampleCollectedAt,
        receivedAt: exam.receivedAt,
        requestedAt: exam.requestedAt,
        clinicalHistory: exam.clinicalHistory,
        muestraDe: exam.anatomicalSite,
        externalFolioNumber: exam.externalFolioNumber ?? null,
        externalInstitutionId: exam.externalInstitutionId ?? null,
        externalOrderNumber: exam.externalOrderNumber ?? null,
      },
    });

    // 4. Upsert Specimen (one per exam at import time)
    // LabSpecimen has no unique key on serviceRequestId+sequenceNumber,
    // so use findFirst + create/update pattern
    const existingSpecimen = await this.prisma.labSpecimen.findFirst({
      where: { tenantId, serviceRequestId: sr.id, sequenceNumber: 1 },
    });
    const specimenFields = {
      anatomicalSite: exam.anatomicalSite,
      muestraDeText: exam.anatomicalSite,
      containerType: exam.containerType ?? null,
      tacoCount: exam.tacoCount ?? null,
      cassetteCount: exam.cassetteCount ?? null,
      placaHeCount: exam.placaHeCount ?? null,
      specialTechniquesCount: exam.specialTechniquesCount ?? null,
      ihqAntibodies: exam.ihqAntibodies ?? [],
      ihqNumbers: exam.ihqNumbers ?? null,
      ihqStatus: exam.ihqStatus ?? null,
      ihqRequestedAt: exam.ihqRequestedAt ?? null,
      ihqRespondedAt: exam.ihqRespondedAt ?? null,
      ihqResponsibleNameSnapshot: exam.ihqResponsibleNameSnapshot ?? null,
    };
    const specimen = existingSpecimen
      ? await this.prisma.labSpecimen.update({
          where: { id: existingSpecimen.id },
          data: specimenFields,
        })
      : await this.prisma.labSpecimen.create({
          data: {
            tenantId,
            serviceRequestId: sr.id,
            sequenceNumber: 1,
            status: 'RECEIVED_SPECIMEN',
            ...specimenFields,
          },
        });

    // 4b. Replace Slides for this specimen (atomic delete + createMany).
    // Source: FM portal `Placas` on the biopsy record. Idempotent on re-run.
    const slides = exam.slides ?? [];
    if (slides.length > 0) {
      await this.prisma.$transaction([
        this.prisma.labSlide.deleteMany({
          where: { tenantId, specimenId: specimen.id },
        }),
        this.prisma.labSlide.createMany({
          data: slides.map((s) => ({
            tenantId,
            specimenId: specimen.id,
            placaCode: s.placaCode ?? null,
            stain: s.stain ?? null,
            level: parseSlideLevel(s.level),
          })),
        }),
      ]);
    } else {
      // Clear any stale slides if the latest extract has none.
      await this.prisma.labSlide.deleteMany({
        where: { tenantId, specimenId: specimen.id },
      });
    }

    // 5. Upsert DiagnosticReport
    const dr = await this.prisma.labDiagnosticReport.upsert({
      where: {
        tenantId_fmSource_fmInformeNumber: {
          tenantId,
          fmSource: toFmSource(exam.fmSource),
          fmInformeNumber: exam.fmInformeNumber,
        },
      },
      create: {
        tenantId,
        serviceRequestId: sr.id,
        fmInformeNumber: exam.fmInformeNumber,
        fmSource: toFmSource(exam.fmSource),
        status: toDiagnosticReportStatus(exam.status),
        conclusion: exam.conclusion,
        fullText: exam.fullText,
        microscopicDescription: exam.microscopicDescription,
        macroscopicDescription: exam.macroscopicDescription,
        isUrgent: exam.isUrgent,
        isAlteredOrCritical: exam.isAlteredOrCritical,
        validatedAt: exam.validatedAt,
        issuedAt: exam.issuedAt,
        primarySignerCodeSnapshot:
          exam.signers.find((s) => s.role === 'PRIMARY_PATHOLOGIST')?.codeSnapshot ?? null,
        criticalPatientNotifyFlag: exam.criticalPatientNotifyFlag ?? false,
        criticalNotifiedAt: exam.criticalNotifiedAt ?? null,
        criticalNotifiedByNameSnapshot: exam.criticalNotifiedBy ?? null,
        criticalNotificationPdfKey: exam.criticalNotificationPdfKey ?? null,
        rejectedByCcb: exam.rejectedByCcb ?? false,
        ccbComments: exam.ccbComments ?? null,
        diagnosticModified: exam.diagnosticModified ?? false,
        modifiedByNameSnapshot: exam.modifiedByUser ?? null,
        modifiedAt: exam.modifiedAt ?? null,
      },
      update: {
        status: toDiagnosticReportStatus(exam.status),
        conclusion: exam.conclusion,
        fullText: exam.fullText,
        microscopicDescription: exam.microscopicDescription,
        macroscopicDescription: exam.macroscopicDescription,
        isUrgent: exam.isUrgent,
        isAlteredOrCritical: exam.isAlteredOrCritical,
        validatedAt: exam.validatedAt,
        issuedAt: exam.issuedAt,
        primarySignerCodeSnapshot:
          exam.signers.find((s) => s.role === 'PRIMARY_PATHOLOGIST')?.codeSnapshot ?? null,
        criticalPatientNotifyFlag: exam.criticalPatientNotifyFlag ?? false,
        criticalNotifiedAt: exam.criticalNotifiedAt ?? null,
        criticalNotifiedByNameSnapshot: exam.criticalNotifiedBy ?? null,
        criticalNotificationPdfKey: exam.criticalNotificationPdfKey ?? null,
        rejectedByCcb: exam.rejectedByCcb ?? false,
        ccbComments: exam.ccbComments ?? null,
        diagnosticModified: exam.diagnosticModified ?? false,
        modifiedByNameSnapshot: exam.modifiedByUser ?? null,
        modifiedAt: exam.modifiedAt ?? null,
      },
    });

    // 5b. Replace Adverse Events (atomic per DR).
    // Source: FM portal `portalEventosAdversos`. Required fields missing in FM
    // (reportedBy, firm occurredAt) are filled with import defaults so we don't
    // drop incident records — see DEFAULT_* constants below.
    const adverseEvents = exam.adverseEvents ?? [];
    await this.prisma.labAdverseEvent.deleteMany({
      where: { tenantId, diagnosticReportId: dr.id },
    });
    if (adverseEvents.length > 0) {
      await this.prisma.labAdverseEvent.createMany({
        data: adverseEvents.map((e) => ({
          tenantId,
          diagnosticReportId: dr.id,
          eventType: e.eventType,
          severity: toAdverseSeverity(e.severity),
          description: e.description,
          occurredAt: e.occurredAt ?? e.detectedAt ?? exam.validatedAt ?? new Date(),
          detectedAt: e.detectedAt ?? null,
          reportedByNameSnapshot: DEFAULT_REPORTED_BY,
          status: toAdverseStatus(e.status),
        })),
      });
    }

    // 5c. Replace Technical Observations (atomic per DR).
    // Source: FM portal `Observaciones Tecnicas`. Same pattern.
    const techObservations = exam.technicalObservations ?? [];
    await this.prisma.labTechnicalObservation.deleteMany({
      where: { tenantId, diagnosticReportId: dr.id },
    });
    if (techObservations.length > 0) {
      await this.prisma.labTechnicalObservation.createMany({
        data: techObservations.map((o) => ({
          tenantId,
          diagnosticReportId: dr.id,
          workflowStage: toWorkflowStageSafe(o.workflowStage),
          description: o.description,
          observedAt: o.observedAt ?? exam.validatedAt ?? new Date(),
          observedByNameSnapshot: o.observedByNameSnapshot ?? DEFAULT_REPORTED_BY,
        })),
      });
    }

    // 6. Replace Signers (atomic delete + recreate for idempotency)
    if (exam.signers.length > 0) {
      await this.prisma.$transaction([
        this.prisma.labDiagnosticReportSigner.deleteMany({
          where: { tenantId, diagnosticReportId: dr.id },
        }),
        this.prisma.labDiagnosticReportSigner.createMany({
          data: exam.signers.map((s) => ({
            tenantId,
            diagnosticReportId: dr.id,
            codeSnapshot: s.codeSnapshot,
            nameSnapshot: s.nameSnapshot,
            role: toSigningRole(s.role),
            signatureOrder: s.signatureOrder,
            signedAt: s.signedAt ?? new Date(),
            isActive: s.isActive,
            supersededBy: s.supersededBy,
            correctionReason: s.correctionReason,
          })),
        }),
      ]);
    }

    // 7. Create Attachment Refs (upsert by s3Key)
    for (const ref of exam.attachmentRefs) {
      const existing = await this.prisma.labDiagnosticReportAttachment.findFirst({
        where: { tenantId, diagnosticReportId: dr.id, s3Key: ref.s3Key },
      });
      if (existing) {
        await this.prisma.labDiagnosticReportAttachment.update({
          where: { id: existing.id },
          data: {
            category: toAttachmentCategory(ref.category),
            label: ref.label,
            sequenceOrder: ref.sequenceOrder,
            contentType: ref.contentType,
            fmSourceField: ref.fmSourceField,
            fmContainerUrlOriginal: ref.fmContainerUrlOriginal,
            citolabS3KeyOriginal: ref.citolabS3KeyOriginal,
          },
        });
      } else {
        await this.prisma.labDiagnosticReportAttachment.create({
          data: {
            tenantId,
            diagnosticReportId: dr.id,
            category: toAttachmentCategory(ref.category),
            label: ref.label,
            sequenceOrder: ref.sequenceOrder,
            s3Bucket: '', // Will be filled by attachment processor
            s3Key: ref.s3Key,
            contentType: ref.contentType,
            fmSourceField: ref.fmSourceField,
            fmContainerUrlOriginal: ref.fmContainerUrlOriginal,
            citolabS3KeyOriginal: ref.citolabS3KeyOriginal,
            migrationStatus: 'PENDING_MIGRATION',
          },
        });
      }
    }
  }

  /**
   * Resolve or create a LabPatient. Dedup by RUT when present.
   * No RUT -> creates new patient with needsMerge=true.
   */
  private async resolvePatient(tenantId: string, exam: ExtractedExam): Promise<string | null> {
    if (exam.subjectRut) {
      // Try to find by RUT
      const existing = await this.prisma.labPatient.findFirst({
        where: { tenantId, rut: exam.subjectRut },
      });
      if (existing) return existing.id;

      // Create new patient with RUT
      const patient = await this.prisma.labPatient
        .create({
          data: {
            tenantId,
            rut: exam.subjectRut,
            firstName: exam.subjectFirstName,
            paternalLastName: exam.subjectPaternalLastName,
            maternalLastName: exam.subjectMaternalLastName,
            birthDate: exam.subjectBirthDate ?? null,
            gender: toGender(exam.subjectGender),
            needsMerge: false,
          },
        })
        .catch(async (error) => {
          if (error?.code === 'P2002') {
            // Unique constraint race condition -- find the existing one
            return this.prisma.labPatient.findFirst({
              where: { tenantId, rut: exam.subjectRut },
            });
          }
          throw error; // Re-throw non-unique-constraint errors
        });

      return patient?.id ?? null;
    }

    // No RUT -- create a new patient with needsMerge=true
    const patient = await this.prisma.labPatient.create({
      data: {
        tenantId,
        rut: null,
        firstName: exam.subjectFirstName,
        paternalLastName: exam.subjectPaternalLastName,
        maternalLastName: exam.subjectMaternalLastName,
        birthDate: exam.subjectBirthDate ?? null,
        gender: toGender(exam.subjectGender),
        needsMerge: true,
      },
    });
    return patient.id;
  }

  private fmDate(d: Date): string {
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  }
}

/**
 * Coerce the FM portal `Placas::nivel` string to the schema's Int column.
 * FM sometimes stores "1", "2", "1.0" or noise — anything unparseable → null.
 * Note: plain `Number("")` is 0, not NaN, so we must reject the empty string
 * after stripping non-numeric chars before calling Number().
 */
function parseSlideLevel(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = String(raw).trim().replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// ── Adverse event + tech observation helpers ──

/**
 * Marker for NameSnapshot columns when FM doesn't track the reporter.
 * Lets the F3 risk dashboard filter out backfilled records if needed.
 */
const DEFAULT_REPORTED_BY = 'FM_IMPORT';

const ADVERSE_SEVERITY_MAP: Record<string, AdverseSeverity> = {
  LOW: AdverseSeverity.MINOR_SEV,
  MEDIUM: AdverseSeverity.MODERATE_SEV,
  HIGH: AdverseSeverity.MAJOR_SEV,
  CRITICAL: AdverseSeverity.CRITICAL_SEV,
};

/**
 * Map the transformer-normalized severity to the Prisma enum.
 * - `null` (FM had nothing) → MINOR_SEV: benign default for "unclassified".
 * - Unknown non-null value → MAJOR_SEV: fail-safe so unmapped severities
 *   surface in risk dashboards instead of hiding as MINOR. Upstream should
 *   then extend ADVERSE_SEVERITY_MAP with the new label.
 */
function toAdverseSeverity(raw: string | null | undefined): AdverseSeverity {
  if (!raw) return AdverseSeverity.MINOR_SEV;
  return ADVERSE_SEVERITY_MAP[raw] ?? AdverseSeverity.MAJOR_SEV;
}

function toAdverseStatus(raw: string | null | undefined): AdverseStatus {
  if (!raw) return AdverseStatus.OPEN_ADV;
  const v = raw.trim().toUpperCase();
  if (v.includes('RESUELT') || v.includes('RESOLVED')) return AdverseStatus.RESOLVED;
  if (v.includes('CERRADO') || v.includes('CLOSED')) return AdverseStatus.CLOSED_ADV;
  if (v.includes('INVESTIG')) return AdverseStatus.INVESTIGATING;
  return AdverseStatus.OPEN_ADV;
}

function toWorkflowStageSafe(raw: string | null | undefined): WorkflowEventType | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  // Direct match against the enum values — unknown strings become null rather
  // than corrupting the record with OTHER_EVENT.
  return (WorkflowEventType as Record<string, WorkflowEventType>)[v] ?? null;
}
