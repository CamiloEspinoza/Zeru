import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import { FmAuthService } from '../../filemaker/services/fm-auth.service';
import { BiopsyTransformer } from '../../filemaker/transformers/biopsy.transformer';
import { PapTransformer } from '../../filemaker/transformers/pap.transformer';
import type { FmSourceType, ExtractedExam } from '../../filemaker/transformers/types';
import {
  toExamCategory,
  toDiagnosticReportStatus,
  toFmSource,
  toSigningRole,
  toGender,
} from '../constants/enum-maps';
import {
  REPORT_VALIDATION_QUEUE,
  REPORT_VALIDATION_JOB_NAMES,
  REPORT_VALIDATION_QUEUE_CONFIG,
} from '../constants/queue.constants';

// ── Types ──

export interface ReportValidationTrigger {
  database: string;
  informeNumber: number;
  tenantId?: string;
  triggeredByUserId?: string | null;
}

export interface ProcessValidationJobData {
  tenantId: string;
  database: string;
  informeNumber: number;
  triggeredByUserId: string | null;
  enqueuedAt: string;
}

export type CanDispatchResult =
  | { canDispatch: true; reason: string }
  | { canDispatch: false; reason: string };

interface SyncResult {
  serviceRequestId: string;
  diagnosticReportId: string;
  exam: ExtractedExam;
  pdfBuffer: Buffer | null;
  pdfContentType: string | null;
}

/** FM source -> { database, layout, type } */
const SOURCE_META: Record<string, { layout: string; type: 'biopsy' | 'pap' }> = {
  BIOPSIAS: { layout: 'Validación Final*', type: 'biopsy' },
  BIOPSIASRESPALDO: { layout: 'Validación Final*', type: 'biopsy' },
  PAPANICOLAOU: { layout: 'INGRESO', type: 'pap' },
  PAPANICOLAOUHISTORICO: { layout: 'INGRESO', type: 'pap' },
};

@Injectable()
export class ReportValidationService {
  private readonly logger = new Logger(ReportValidationService.name);
  private readonly tenantId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly fmAuth: FmAuthService,
    private readonly biopsyTransformer: BiopsyTransformer,
    private readonly papTransformer: PapTransformer,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(REPORT_VALIDATION_QUEUE) private readonly queue: Queue,
    config: ConfigService,
  ) {
    this.tenantId = config.getOrThrow<string>('FM_TENANT_ID');
  }

  /**
   * Enqueue a validation job. The processor picks it up and runs the pipeline.
   */
  async enqueueValidation(trigger: ReportValidationTrigger): Promise<{ jobId: string }> {
    const tenantId = trigger.tenantId ?? this.tenantId;
    const data: ProcessValidationJobData = {
      tenantId,
      database: trigger.database,
      informeNumber: trigger.informeNumber,
      triggeredByUserId: trigger.triggeredByUserId ?? null,
      enqueuedAt: new Date().toISOString(),
    };

    const job = await this.queue.add(
      REPORT_VALIDATION_JOB_NAMES.PROCESS_VALIDATION,
      data,
      {
        ...REPORT_VALIDATION_QUEUE_CONFIG.defaultJobOptions,
        jobId: `${tenantId}:${trigger.database}:${trigger.informeNumber}`,
      },
    );

    this.logger.log(
      `Enqueued validation job ${job.id} for ${trigger.database}:${trigger.informeNumber} (tenant=${tenantId})`,
    );
    return { jobId: job.id ?? 'unknown' };
  }

  /**
   * Tell FM whether it should dispatch this report (i.e. set Activar Subir Examen).
   * Default to true when the report is unknown — FM may be calling before sync.
   */
  async getCanDispatch(
    tenantId: string,
    informeNumber: number,
    fmSource: string,
  ): Promise<CanDispatchResult> {
    const report = await this.prisma.labDiagnosticReport.findFirst({
      where: {
        tenantId,
        fmInformeNumber: informeNumber,
        fmSource: toFmSource(fmSource as FmSourceType),
      },
      select: { id: true, blockedForDispatch: true },
    });

    if (!report) {
      return { canDispatch: true, reason: 'report-not-found-yet' };
    }
    if (report.blockedForDispatch) {
      return { canDispatch: false, reason: 'blocked-by-validation' };
    }
    return { canDispatch: true, reason: 'not-blocked' };
  }

  /**
   * Process a report validation request (runs in background).
   * 1. Sync the record from FM
   * 2. Download the PDF
   * 3. Emit event for AI analysis (phase 2)
   * 4. Write results back to FM
   */
  async processValidation(trigger: ReportValidationTrigger): Promise<void> {
    const { database, informeNumber, triggeredByUserId } = trigger;
    const tenantId = trigger.tenantId ?? this.tenantId;
    const fmSource = database as FmSourceType;

    this.logger.log(`[Validation] Starting for ${database} #${informeNumber} (tenant=${tenantId})`);

    try {
      // Step 1: Sync from FM
      const syncResult = await this.syncFromFm(tenantId, fmSource, informeNumber);
      this.logger.log(
        `[Validation] Synced ${database} #${informeNumber} → SR:${syncResult.serviceRequestId} DR:${syncResult.diagnosticReportId}`,
      );

      // Step 2: Create validation record
      const validation = await this.prisma.labReportValidation.create({
        data: {
          tenantId,
          diagnosticReportId: syncResult.diagnosticReportId,
          fmSource: toFmSource(fmSource),
          fmInformeNumber: informeNumber,
          triggeredByUserId: triggeredByUserId ?? null,
          status: 'SYNCED',
          syncedAt: new Date(),
        },
      });

      // Step 3: Emit event for AI processing (will be handled by AI service)
      this.eventEmitter.emit('lab.report.validation.synced', {
        validationId: validation.id,
        tenantId,
        diagnosticReportId: syncResult.diagnosticReportId,
        serviceRequestId: syncResult.serviceRequestId,
        fmSource,
        fmInformeNumber: informeNumber,
        exam: syncResult.exam,
        pdfBuffer: syncResult.pdfBuffer,
      });

      this.logger.log(`[Validation] Emitted analysis event for validation ${validation.id}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Validation] Failed for ${database} #${informeNumber}: ${msg}`);

      // Try to record the failure
      try {
        const dr = await this.prisma.labDiagnosticReport.findFirst({
          where: {
            tenantId,
            fmSource: toFmSource(fmSource),
            fmInformeNumber: informeNumber,
          },
        });
        if (dr) {
          await this.prisma.labReportValidation.create({
            data: {
              tenantId,
              diagnosticReportId: dr.id,
              fmSource: toFmSource(fmSource),
              fmInformeNumber: informeNumber,
              triggeredByUserId: triggeredByUserId ?? null,
              status: 'ERROR',
              errorMessage: msg,
            },
          });
        }
      } catch {
        // Best effort
      }
      throw error;
    }
  }

  /**
   * Sync a single report from FM: fetch record, transform, upsert in DB, download PDF.
   */
  private async syncFromFm(
    tenantId: string,
    fmSource: FmSourceType,
    informeNumber: number,
  ): Promise<SyncResult> {
    const meta = SOURCE_META[fmSource];
    if (!meta) throw new Error(`Unknown FM source: ${fmSource}`);

    // 1. Find the record in FM by informe number
    const response = await this.fmApi.findRecords(
      fmSource,
      meta.layout,
      [{ 'INFORME No': `=${informeNumber}` }],
      { limit: 1, dateformats: 2 },
    );

    if (response.records.length === 0) {
      throw new Error(`Record not found in FM: ${fmSource} #${informeNumber}`);
    }

    const record = response.records[0];

    // 2. Transform to ExtractedExam
    const exam =
      meta.type === 'biopsy'
        ? this.biopsyTransformer.extract(record, fmSource)
        : this.papTransformer.extract(record, fmSource);

    // 3. Upsert in DB (reuse the same logic as import)
    const { serviceRequestId, diagnosticReportId } = await this.upsertExam(tenantId, exam);

    // 4. Download the PDF from FM container
    let pdfBuffer: Buffer | null = null;
    let pdfContentType: string | null = null;

    const pdfRef = exam.attachmentRefs.find((a) => a.category === 'REPORT_PDF');
    if (pdfRef?.fmContainerUrlOriginal) {
      try {
        const downloaded = await this.downloadFmContainer(
          fmSource,
          pdfRef.fmContainerUrlOriginal,
        );
        pdfBuffer = downloaded.buffer;
        pdfContentType = downloaded.contentType;
        this.logger.log(`[Validation] Downloaded PDF: ${pdfBuffer.length} bytes`);
      } catch (err) {
        this.logger.warn(
          `[Validation] PDF download failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return { serviceRequestId, diagnosticReportId, exam, pdfBuffer, pdfContentType };
  }

  /**
   * Upsert a single exam into the DB. Returns the IDs.
   */
  private async upsertExam(tenantId: string, exam: ExtractedExam): Promise<{
    serviceRequestId: string;
    diagnosticReportId: string;
  }> {

    // Resolve patient
    let patientId: string | null = null;
    if (exam.subjectRut) {
      const patient = await this.prisma.labPatient.upsert({
        where: { tenantId_rut: { tenantId, rut: exam.subjectRut } },
        create: {
          tenantId,
          rut: exam.subjectRut,
          firstName: exam.subjectFirstName,
          paternalLastName: exam.subjectPaternalLastName,
          maternalLastName: exam.subjectMaternalLastName,
          gender: exam.subjectGender ? toGender(exam.subjectGender) : null,
        },
        update: {
          firstName: exam.subjectFirstName,
          paternalLastName: exam.subjectPaternalLastName,
          maternalLastName: exam.subjectMaternalLastName,
        },
      });
      patientId = patient.id;
    }

    // Resolve origin
    const labOrigin = await this.prisma.labOrigin.findFirst({
      where: { tenantId, code: exam.labOriginCode },
    });
    if (!labOrigin) {
      throw new Error(`Unknown labOriginCode: ${exam.labOriginCode}`);
    }

    // Upsert ServiceRequest
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
        labOriginId: labOrigin.id,
        labOriginCodeSnapshot: exam.labOriginCode,
        sampleCollectedAt: exam.sampleCollectedAt,
        receivedAt: exam.receivedAt,
        requestedAt: exam.requestedAt,
        clinicalHistory: exam.clinicalHistory,
        muestraDe: exam.anatomicalSite,
      },
      update: {
        subjectFirstName: exam.subjectFirstName,
        subjectPaternalLastName: exam.subjectPaternalLastName,
        subjectMaternalLastName: exam.subjectMaternalLastName,
        subjectRut: exam.subjectRut,
        subjectAge: exam.subjectAge,
        subjectId: patientId,
        category: toExamCategory(exam.category),
        requestingPhysicianName: exam.requestingPhysicianName,
        labOriginId: labOrigin.id,
        labOriginCodeSnapshot: exam.labOriginCode,
        receivedAt: exam.receivedAt,
        clinicalHistory: exam.clinicalHistory,
        muestraDe: exam.anatomicalSite,
      },
    });

    // Upsert DiagnosticReport
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
      },
    });

    // Upsert signers
    for (const signer of exam.signers) {
      await this.prisma.labDiagnosticReportSigner.upsert({
        where: {
          diagnosticReportId_signatureOrder: {
            diagnosticReportId: dr.id,
            signatureOrder: signer.signatureOrder,
          },
        },
        create: {
          tenantId,
          diagnosticReportId: dr.id,
          codeSnapshot: signer.codeSnapshot,
          nameSnapshot: signer.nameSnapshot,
          role: toSigningRole(signer.role),
          signatureOrder: signer.signatureOrder,
          signedAt: signer.signedAt,
          isActive: signer.isActive,
          supersededBy: signer.supersededBy,
          correctionReason: signer.correctionReason,
        },
        update: {
          codeSnapshot: signer.codeSnapshot,
          nameSnapshot: signer.nameSnapshot,
          role: toSigningRole(signer.role),
          signedAt: signer.signedAt,
          isActive: signer.isActive,
          supersededBy: signer.supersededBy,
          correctionReason: signer.correctionReason,
        },
      });
    }

    return { serviceRequestId: sr.id, diagnosticReportId: dr.id };
  }

  /**
   * Download a file from an FM container URL using the FM session token.
   */
  private async downloadFmContainer(
    database: string,
    url: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const token = await this.fmAuth.getToken(database);
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`FM container download failed: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? 'application/pdf';
    const arrayBuffer = await response.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), contentType };
  }

  /**
   * Write validation results back to FM by executing a script.
   */
  async writeResultToFm(
    fmSource: FmSourceType,
    informeNumber: number,
    result: Record<string, unknown>,
  ): Promise<void> {
    const meta = SOURCE_META[fmSource];
    if (!meta) return;

    try {
      const scriptResult = await this.fmApi.runScript(
        fmSource,
        meta.layout,
        'Zeru_Validacion_Resultado',
        JSON.stringify({ informeNumber, ...result }),
      );

      if (scriptResult.scriptError && scriptResult.scriptError !== '0') {
        this.logger.warn(
          `[Validation] FM script error ${scriptResult.scriptError} for #${informeNumber}`,
        );
      } else {
        this.logger.log(`[Validation] FM script executed for #${informeNumber}`);
      }
    } catch (err) {
      this.logger.warn(
        `[Validation] Failed to write to FM: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
