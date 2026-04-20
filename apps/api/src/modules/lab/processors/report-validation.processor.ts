import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  REPORT_VALIDATION_QUEUE,
  REPORT_VALIDATION_JOB_NAMES,
  REPORT_VALIDATION_QUEUE_CONFIG,
} from '../constants/queue.constants';
import {
  ReportValidationService,
  type ProcessValidationJobData,
} from '../services/report-validation.service';

@Injectable()
@Processor(REPORT_VALIDATION_QUEUE, {
  concurrency: REPORT_VALIDATION_QUEUE_CONFIG.concurrency,
})
export class ReportValidationProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportValidationProcessor.name);

  constructor(private readonly validationService: ReportValidationService) {
    super();
  }

  async process(job: Job<ProcessValidationJobData>): Promise<void> {
    if (job.name !== REPORT_VALIDATION_JOB_NAMES.PROCESS_VALIDATION) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    const { tenantId, database, informeNumber, triggeredByUserId } = job.data;
    this.logger.log(
      `Processing validation ${database}:${informeNumber} (tenant=${tenantId}, job=${job.id})`,
    );

    await job.updateProgress(10);
    await this.validationService.processValidation({
      database,
      informeNumber,
      tenantId,
      triggeredByUserId,
    });
    await job.updateProgress(100);
  }
}
