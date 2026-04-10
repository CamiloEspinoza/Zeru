import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LAB_IMPORT_QUEUE, JOB_NAMES, IMPORT_QUEUE_CONFIG } from '../constants/queue.constants';
import { ExamsBatchHandler } from './handlers/exams-batch.handler';
import { WorkflowEventsBatchHandler } from './handlers/workflow-events-batch.handler';
import { CommunicationsBatchHandler } from './handlers/communications-batch.handler';
import { LiquidationsHandler } from './handlers/liquidations.handler';
import { ChargesBatchHandler } from './handlers/charges-batch.handler';

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
    private readonly examsBatchHandler: ExamsBatchHandler,
    private readonly workflowHandler: WorkflowEventsBatchHandler,
    private readonly commsHandler: CommunicationsBatchHandler,
    private readonly liquidationsHandler: LiquidationsHandler,
    private readonly chargesHandler: ChargesBatchHandler,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job ${job.name} (id: ${job.id})`);

    switch (job.name) {
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
}
