import { Test, TestingModule } from '@nestjs/testing';
import type { Job } from 'bullmq';
import { ReportValidationProcessor } from './report-validation.processor';
import { ReportValidationService } from '../services/report-validation.service';
import { REPORT_VALIDATION_JOB_NAMES } from '../constants/queue.constants';
import type { ProcessValidationJobData } from '../services/report-validation.service';

describe('ReportValidationProcessor', () => {
  let processor: ReportValidationProcessor;
  let processValidation: jest.Mock;

  beforeEach(async () => {
    processValidation = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportValidationProcessor,
        {
          provide: ReportValidationService,
          useValue: { processValidation },
        },
      ],
    }).compile();

    processor = module.get(ReportValidationProcessor);
  });

  function makeJob(data: ProcessValidationJobData): Job<ProcessValidationJobData> {
    return {
      id: 'job-1',
      name: REPORT_VALIDATION_JOB_NAMES.PROCESS_VALIDATION,
      data,
      updateProgress: jest.fn(),
    } as unknown as Job<ProcessValidationJobData>;
  }

  it('delegates job processing to ReportValidationService.processValidation', async () => {
    const job = makeJob({
      tenantId: 'tenant-1',
      database: 'BIOPSIAS',
      informeNumber: 42,
      triggeredByUserId: 'user-1',
      enqueuedAt: new Date().toISOString(),
    });

    await processor.process(job);

    expect(processValidation).toHaveBeenCalledWith({
      database: 'BIOPSIAS',
      informeNumber: 42,
      tenantId: 'tenant-1',
      triggeredByUserId: 'user-1',
    });
  });

  it('rejects unknown job names', async () => {
    const job = makeJob({
      tenantId: 'tenant-1',
      database: 'BIOPSIAS',
      informeNumber: 42,
      triggeredByUserId: null,
      enqueuedAt: new Date().toISOString(),
    });
    (job as { name: string }).name = 'unknown-job';

    await expect(processor.process(job)).rejects.toThrow(/Unknown job name/);
  });
});
