import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmRangeResolverService } from './fm-range-resolver.service';
import {
  LAB_IMPORT_QUEUE,
  ATTACHMENT_MIGRATION_QUEUE,
  JOB_NAMES,
  PHASES,
  IMPORT_QUEUE_CONFIG,
  SOURCE_ORDER,
} from '../constants/queue.constants';
import type { FmSourceType } from '../../filemaker/transformers/types';

export interface StartImportParams {
  tenantId: string;
  sources: FmSourceType[];
  dateFrom?: Date;
  dateTo?: Date;
  batchSize?: number;
}

interface BatchDefinition {
  runId: string;
  tenantId: string;
  phase: string;
  fmSource: FmSourceType;
  batchIndex: number;
  offset: number;
  limit: number;
  dateFrom?: Date;
  dateTo?: Date;
  totalRecords: number;
}

@Injectable()
export class LabImportOrchestratorService {
  private readonly logger = new Logger(LabImportOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rangeResolver: FmRangeResolverService,
    @InjectQueue(LAB_IMPORT_QUEUE)
    private readonly importQueue: Queue,
    @InjectQueue(ATTACHMENT_MIGRATION_QUEUE)
    private readonly attachmentQueue: Queue,
  ) {}

  // TODO: Add Phase 0 for practitioners import. Currently, LabPractitioner records
  // are NOT populated during import. Practitioners referenced by signers (via codeSnapshot)
  // and requesting physicians (via name) are not resolved to LabPractitioner records.
  // A dedicated phase or on-the-fly upsert in exams-batch.handler should be added.

  /**
   * Start a new import run. Creates LabImportRun, queries FM for counts,
   * partitions into batches, enqueues Phase 1 (exams) jobs.
   */
  async startImport(params: StartImportParams): Promise<{ runId: string; totalBatches: number }> {
    const {
      tenantId,
      sources,
      dateFrom,
      dateTo,
      batchSize = IMPORT_QUEUE_CONFIG.defaultBatchSize,
    } = params;
    const dateFilter = dateFrom && dateTo ? { dateFrom, dateTo } : undefined;

    // Sort sources per SOURCE_ORDER to ensure primary before backup
    const orderedSources = [...sources].sort(
      (a, b) => SOURCE_ORDER.indexOf(a) - SOURCE_ORDER.indexOf(b),
    );

    // Create the run record
    const run = await this.prisma.labImportRun.create({
      data: {
        tenantId,
        sources: orderedSources,
        dateFrom,
        dateTo,
        batchSize,
        status: 'RUNNING',
        phase: PHASES.EXAMS,
        startedAt: new Date(),
      },
    });

    this.logger.log(`Created import run ${run.id} for sources: ${orderedSources.join(', ')}`);

    // Resolve record counts per source
    let totalBatches = 0;
    const allBatchDefs: BatchDefinition[] = [];

    for (const source of orderedSources) {
      const stats = await this.rangeResolver.getSourceStats(
        source as FmSourceType,
        dateFilter,
      );
      this.logger.log(`${source}: ${stats.totalRecords} records`);

      if (stats.totalRecords === 0) continue;

      const batchCount = Math.ceil(stats.totalRecords / batchSize);
      for (let i = 0; i < batchCount; i++) {
        allBatchDefs.push({
          runId: run.id,
          tenantId,
          phase: PHASES.EXAMS,
          fmSource: source as FmSourceType,
          batchIndex: totalBatches + i,
          offset: i * batchSize + 1, // FM uses 1-based offset
          limit: batchSize,
          dateFrom,
          dateTo,
          totalRecords: stats.totalRecords,
        });
      }
      totalBatches += batchCount;
    }

    // If no records to import, complete the run immediately
    if (allBatchDefs.length === 0) {
      await this.prisma.labImportRun.update({
        where: { id: run.id },
        data: { status: 'COMPLETED', completedAt: new Date(), phase: 'completed' },
      });
      return { runId: run.id, totalBatches: 0 };
    }

    // Create all batch records
    for (const def of allBatchDefs) {
      await this.prisma.labImportBatch.create({
        data: {
          runId: def.runId,
          phase: def.phase,
          fmSource: def.fmSource,
          batchIndex: def.batchIndex,
          offset: def.offset,
          limit: def.limit,
          status: 'PENDING',
        },
      });
    }

    // Update run totals
    await this.prisma.labImportRun.update({
      where: { id: run.id },
      data: {
        totalBatches,
        totalRecords: allBatchDefs.reduce((sum, d) => sum + d.totalRecords, 0),
      },
    });

    // Enqueue Phase 1 exam batch jobs
    if (allBatchDefs.length > 0) {
      const jobs = allBatchDefs.map((def) => ({
        name: JOB_NAMES.EXAMS_BATCH,
        data: {
          runId: def.runId,
          tenantId: def.tenantId,
          fmSource: def.fmSource,
          batchIndex: def.batchIndex,
          offset: def.offset,
          limit: def.limit,
          dateFrom: def.dateFrom?.toISOString(),
          dateTo: def.dateTo?.toISOString(),
        },
        opts: {
          attempts: IMPORT_QUEUE_CONFIG.retryAttempts,
          backoff: IMPORT_QUEUE_CONFIG.retryBackoff,
          jobId: `${run.id}-exams-${def.fmSource}-${def.batchIndex}`,
        },
      }));

      await this.importQueue.addBulk(jobs);
      this.logger.log(`Enqueued ${jobs.length} Phase 1 (exams) jobs for run ${run.id}`);
    }

    return { runId: run.id, totalBatches };
  }

  /**
   * Called by processors when all jobs in a phase complete.
   * Advances to the next phase.
   */
  async advancePhase(runId: string): Promise<void> {
    const run = await this.prisma.labImportRun.findUnique({
      where: { id: runId },
    });
    if (!run || run.status !== 'RUNNING') return;

    const pendingBatches = await this.prisma.labImportBatch.count({
      where: { runId, phase: run.phase, status: { in: ['PENDING', 'RUNNING'] } },
    });

    if (pendingBatches > 0) return; // Not all jobs done yet

    // Determine the next phase before the CAS
    let nextPhase: string;
    switch (run.phase) {
      case PHASES.EXAMS:
        nextPhase = PHASES.WORKFLOW_COMMS;
        break;
      case PHASES.WORKFLOW_COMMS:
        nextPhase = PHASES.LIQUIDATIONS;
        break;
      case PHASES.LIQUIDATIONS:
        nextPhase = PHASES.CHARGES;
        break;
      case PHASES.CHARGES:
        nextPhase = PHASES.ATTACHMENTS;
        break;
      case PHASES.ATTACHMENTS:
        nextPhase = 'completed';
        break;
      default:
        this.logger.error(`advancePhase called with unknown phase "${run.phase}" for run ${runId}`);
        return;
    }

    // Atomic compare-and-swap: changes phase so second worker's WHERE won't match
    const result = await this.prisma.labImportRun.updateMany({
      where: { id: runId, status: 'RUNNING', phase: run.phase },
      data: { phase: nextPhase, updatedAt: new Date() },
    });
    if (result.count === 0) return; // Another worker already advanced

    const currentPhase = run.phase;
    this.logger.log(`Phase ${currentPhase} complete for run ${runId}. Advancing to ${nextPhase}...`);

    switch (currentPhase) {
      case PHASES.EXAMS:
        await this.enqueueWorkflowCommsPhase(
          runId,
          run.tenantId,
          run.sources,
          run.dateFrom,
          run.dateTo,
        );
        break;
      case PHASES.WORKFLOW_COMMS:
        await this.enqueueLiquidationsPhase(runId, run.tenantId);
        break;
      case PHASES.LIQUIDATIONS:
        await this.enqueueChargesPhase(runId, run.tenantId);
        break;
      case PHASES.CHARGES:
        await this.enqueueAttachmentsPhase(runId, run.tenantId);
        break;
      case PHASES.ATTACHMENTS:
        await this.completeRun(runId);
        return;
    }
  }

  private async enqueueWorkflowCommsPhase(
    runId: string,
    tenantId: string,
    sources: string[],
    dateFrom: Date | null,
    dateTo: Date | null,
  ): Promise<void> {
    // Phase already set by advancePhase CAS

    const dateFilter = dateFrom && dateTo ? { dateFrom, dateTo } : undefined;
    const batchSize = IMPORT_QUEUE_CONFIG.defaultBatchSize;
    const jobs: {
      name: string;
      data: Record<string, unknown>;
      opts: Record<string, unknown>;
    }[] = [];

    // Workflow events (only for biopsy sources — they have TRAZA layout)
    for (const source of sources) {
      if (source !== 'BIOPSIAS' && source !== 'BIOPSIASRESPALDO') continue;

      const stats = await this.rangeResolver.getTraceabilityStats(
        source as 'BIOPSIAS' | 'BIOPSIASRESPALDO',
        dateFilter,
      );
      if (stats.totalRecords === 0) continue;

      const batchCount = Math.ceil(stats.totalRecords / batchSize);
      for (let i = 0; i < batchCount; i++) {
        const batchRec = await this.prisma.labImportBatch.create({
          data: {
            runId,
            phase: PHASES.WORKFLOW_COMMS,
            fmSource: source,
            batchIndex: i,
            offset: i * batchSize + 1,
            limit: batchSize,
            status: 'PENDING',
          },
        });

        jobs.push({
          name: JOB_NAMES.WORKFLOW_EVENTS_BATCH,
          data: {
            runId,
            tenantId,
            fmSource: source,
            batchIndex: i,
            offset: i * batchSize + 1,
            limit: batchSize,
            batchId: batchRec.id,
            dateFrom: dateFrom?.toISOString(),
            dateTo: dateTo?.toISOString(),
          },
          opts: {
            attempts: IMPORT_QUEUE_CONFIG.retryAttempts,
            backoff: IMPORT_QUEUE_CONFIG.retryBackoff,
            jobId: `${runId}-workflow-${source}-${i}`,
          },
        });
      }
    }

    // Communications batch — one job per source that has communications
    for (const source of sources) {
      jobs.push({
        name: JOB_NAMES.COMMUNICATIONS_BATCH,
        data: {
          runId,
          tenantId,
          fmSource: source,
          dateFrom: dateFrom?.toISOString(),
          dateTo: dateTo?.toISOString(),
        },
        opts: {
          attempts: IMPORT_QUEUE_CONFIG.retryAttempts,
          backoff: IMPORT_QUEUE_CONFIG.retryBackoff,
          jobId: `${runId}-comms-${source}`,
        },
      });

      await this.prisma.labImportBatch.create({
        data: {
          runId,
          phase: PHASES.WORKFLOW_COMMS,
          fmSource: source,
          batchIndex: 0,
          offset: 0,
          limit: 0,
          status: 'PENDING',
        },
      });
    }

    if (jobs.length > 0) {
      await this.importQueue.addBulk(jobs);
      this.logger.log(
        `Enqueued ${jobs.length} Phase 2 (workflow/comms) jobs for run ${runId}`,
      );
    } else {
      // No Phase 2 work — update phase before skipping to Phase 3
      await this.prisma.labImportRun.updateMany({
        where: { id: runId, phase: PHASES.WORKFLOW_COMMS },
        data: { phase: PHASES.LIQUIDATIONS },
      });
      await this.enqueueLiquidationsPhase(runId, tenantId);
    }
  }

  private async enqueueLiquidationsPhase(runId: string, tenantId: string): Promise<void> {
    // Phase already set by advancePhase CAS

    const batchRec = await this.prisma.labImportBatch.create({
      data: {
        runId,
        phase: PHASES.LIQUIDATIONS,
        fmSource: 'BIOPSIAS', // Liquidaciones live in BIOPSIAS db
        batchIndex: 0,
        offset: 1,
        limit: 10000, // All liquidations in one job (~2.6k records)
        status: 'PENDING',
      },
    });

    await this.importQueue.add(
      JOB_NAMES.LIQUIDATIONS,
      { runId, tenantId, batchId: batchRec.id },
      {
        attempts: IMPORT_QUEUE_CONFIG.retryAttempts,
        backoff: IMPORT_QUEUE_CONFIG.retryBackoff,
        jobId: `${runId}-liquidations`,
      },
    );

    this.logger.log(`Enqueued Phase 3 (liquidations) job for run ${runId}`);
  }

  private async enqueueChargesPhase(runId: string, tenantId: string): Promise<void> {
    // Phase already set by advancePhase CAS

    const batchSize = IMPORT_QUEUE_CONFIG.defaultBatchSize;
    const jobs: {
      name: string;
      data: Record<string, unknown>;
      opts: Record<string, unknown>;
    }[] = [];

    for (const chargeSource of ['BIOPSIAS_INGRESOS', 'PAP_INGRESOS'] as const) {
      const stats = await this.rangeResolver.getChargeStats(chargeSource);
      if (stats.totalRecords === 0) continue;

      const batchCount = Math.ceil(stats.totalRecords / batchSize);
      for (let i = 0; i < batchCount; i++) {
        const batchRec = await this.prisma.labImportBatch.create({
          data: {
            runId,
            phase: PHASES.CHARGES,
            fmSource: chargeSource === 'BIOPSIAS_INGRESOS' ? 'BIOPSIAS' : 'PAPANICOLAOU',
            batchIndex: i,
            offset: i * batchSize + 1,
            limit: batchSize,
            status: 'PENDING',
          },
        });

        jobs.push({
          name: JOB_NAMES.CHARGES_BATCH,
          data: {
            runId,
            tenantId,
            chargeSource,
            batchIndex: i,
            offset: i * batchSize + 1,
            limit: batchSize,
            batchId: batchRec.id,
          },
          opts: {
            attempts: IMPORT_QUEUE_CONFIG.retryAttempts,
            backoff: IMPORT_QUEUE_CONFIG.retryBackoff,
            jobId: `${runId}-charges-${chargeSource}-${i}`,
          },
        });
      }
    }

    if (jobs.length > 0) {
      await this.importQueue.addBulk(jobs);
      this.logger.log(`Enqueued ${jobs.length} Phase 4 (charges) jobs for run ${runId}`);
    } else {
      // No Phase 4 work — update phase before skipping to Phase 5
      await this.prisma.labImportRun.updateMany({
        where: { id: runId, phase: PHASES.CHARGES },
        data: { phase: PHASES.ATTACHMENTS },
      });
      await this.enqueueAttachmentsPhase(runId, tenantId);
    }
  }

  private async enqueueAttachmentsPhase(runId: string, tenantId: string): Promise<void> {
    // Phase already set by advancePhase CAS

    // Find all pending attachment records for this tenant
    const pendingAttachments = await this.prisma.labDiagnosticReportAttachment.findMany({
      where: { tenantId, migrationStatus: 'PENDING_MIGRATION' },
      select: {
        id: true,
        s3Key: true,
        fmContainerUrlOriginal: true,
        citolabS3KeyOriginal: true,
      },
    });

    if (pendingAttachments.length === 0) {
      this.logger.log(`No pending attachments for run ${runId}. Completing.`);
      await this.completeRun(runId);
      return;
    }

    const jobs = pendingAttachments.map((att) => ({
      name: JOB_NAMES.ATTACHMENT_DOWNLOAD,
      data: {
        runId,
        tenantId,
        attachmentId: att.id,
        targetS3Key: att.s3Key,
        fmContainerUrl: att.fmContainerUrlOriginal,
        citolabS3Key: att.citolabS3KeyOriginal,
      },
      opts: {
        attempts: 10,
        backoff: { type: 'exponential' as const, delay: 3000 },
        jobId: `${runId}-attachment-${att.id}`,
      },
    }));

    await this.attachmentQueue.addBulk(jobs);
    this.logger.log(`Enqueued ${jobs.length} Phase 5 (attachment) jobs for run ${runId}`);
  }

  private async completeRun(runId: string): Promise<void> {
    const failedCount = await this.prisma.labImportBatch.count({
      where: { runId, status: 'FAILED' },
    });

    await this.prisma.labImportRun.update({
      where: { id: runId },
      data: {
        status: failedCount > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
        completedAt: new Date(),
      },
    });

    this.logger.log(`Import run ${runId} completed. ${failedCount} failed batches.`);
  }

  /**
   * Get run status with batch summary.
   */
  async getRunStatus(runId: string, tenantId?: string) {
    return this.prisma.labImportRun.findFirst({
      where: { id: runId, ...(tenantId ? { tenantId } : {}) },
      include: {
        batches: {
          select: {
            id: true,
            phase: true,
            fmSource: true,
            batchIndex: true,
            status: true,
            recordCount: true,
            processedCount: true,
            errorCount: true,
            startedAt: true,
            completedAt: true,
          },
          orderBy: { batchIndex: 'asc' },
        },
      },
    });
  }
}
