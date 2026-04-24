import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { LabImportOrchestratorService } from '../services/lab-import-orchestrator.service';
import { LAB_IMPORT_QUEUE, JOB_NAMES, IMPORT_QUEUE_CONFIG } from '../constants/queue.constants';
import { ExamsBatchHandler } from './handlers/exams-batch.handler';
import { WorkflowEventsBatchHandler } from './handlers/workflow-events-batch.handler';
import { CommunicationsBatchHandler } from './handlers/communications-batch.handler';
import { LiquidationsHandler } from './handlers/liquidations.handler';
import { ChargesBatchHandler } from './handlers/charges-batch.handler';
import { PractitionersHandler } from './handlers/practitioners.handler';
import { RequestingPhysiciansHandler } from './handlers/requesting-physicians.handler';

/**
 * Single processor for the lab-import queue.
 * Dispatches to the correct handler based on job.name.
 *
 * BullMQ creates one Worker per @Processor class. Having multiple
 * @Processor classes for the same queue creates multiple Workers,
 * each receiving ALL jobs. This dispatcher pattern is the correct
 * approach for multiple job types in a single queue.
 */
@Processor(LAB_IMPORT_QUEUE, { concurrency: IMPORT_QUEUE_CONFIG.concurrency })
export class LabImportProcessor extends WorkerHost {
  private readonly logger = new Logger(LabImportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: LabImportOrchestratorService,
    private readonly examsBatchHandler: ExamsBatchHandler,
    private readonly workflowHandler: WorkflowEventsBatchHandler,
    private readonly commsHandler: CommunicationsBatchHandler,
    private readonly liquidationsHandler: LiquidationsHandler,
    private readonly chargesHandler: ChargesBatchHandler,
    private readonly practitionersHandler: PractitionersHandler,
    private readonly requestingPhysiciansHandler: RequestingPhysiciansHandler,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job ${job.name} (id: ${job.id})`);

    switch (job.name) {
      case JOB_NAMES.PRACTITIONERS_IMPORT:
        return this.practitionersHandler.handle(job.data);
      case JOB_NAMES.REQUESTING_PHYSICIANS_IMPORT:
        return this.requestingPhysiciansHandler.handle(job.data);
      case JOB_NAMES.EXAMS_BATCH:
        return this.examsBatchHandler.handle(job.data);
      case JOB_NAMES.WORKFLOW_EVENTS_BATCH:
        return this.workflowHandler.handle(job.data);
      case JOB_NAMES.COMMUNICATIONS_BATCH:
        return this.commsHandler.handle(job.data);
      case JOB_NAMES.LIQUIDATIONS:
        return this.liquidationsHandler.handle(job.data);
      case JOB_NAMES.CHARGES_BATCH:
        return this.chargesHandler.handle(job.data);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    if (job.attemptsMade >= (job.opts?.attempts ?? 1)) {
      const runId = job.data?.runId;
      this.logger.warn(
        `Job ${job.name} (id: ${job.id}) exhausted all ${job.attemptsMade} attempts: ${error.message}`,
      );
      if (runId) {
        try {
          // Mark the batch as definitively FAILED on final exhaustion
          const batchIndex = job.data?.batchIndex;
          const fmSource = job.data?.fmSource || job.data?.chargeSource;
          const phaseMap: Record<string, string> = {
            [JOB_NAMES.PRACTITIONERS_IMPORT]: 'phase-0-practitioners',
            [JOB_NAMES.REQUESTING_PHYSICIANS_IMPORT]: 'phase-0-practitioners',
            [JOB_NAMES.EXAMS_BATCH]: 'phase-1-exams',
            [JOB_NAMES.WORKFLOW_EVENTS_BATCH]: 'phase-2-workflow-comms',
            [JOB_NAMES.COMMUNICATIONS_BATCH]: 'phase-2-workflow-comms',
            [JOB_NAMES.LIQUIDATIONS]: 'phase-3-liquidations',
            [JOB_NAMES.CHARGES_BATCH]: 'phase-4-charges',
          };
          const phase = phaseMap[job.name];

          if (phase) {
            // Try by batchId first (some handlers pass it), then fall back to batchIndex
            const batchId = job.data?.batchId;
            const batch = batchId
              ? await this.prisma.labImportBatch.findUnique({ where: { id: batchId } })
              : batchIndex !== undefined
                ? await this.prisma.labImportBatch.findFirst({
                    where: { runId, batchIndex, phase, ...(fmSource ? { fmSource } : {}) },
                  })
                : null;

            if (batch) {
              await this.prisma.labImportBatch.update({
                where: { id: batch.id },
                data: {
                  status: 'FAILED',
                  completedAt: new Date(),
                  errors: [{ error: error.message }],
                },
              });
            }
          }

          // Increment failedBatches counter on final exhaustion
          await this.prisma.labImportRun
            .update({
              where: { id: runId },
              data: { failedBatches: { increment: 1 } },
            })
            .catch((e) =>
              this.logger.error(`Counter update failed: ${e}`),
            );
          await this.orchestrator.advancePhase(runId);
        } catch (e) {
          this.logger.error(
            `Failed to advance phase after job exhaustion: ${e}`,
          );
        }
      }
    }
  }
}
