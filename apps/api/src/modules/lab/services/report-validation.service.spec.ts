import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReportValidationService } from './report-validation.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import { FmAuthService } from '../../filemaker/services/fm-auth.service';
import { BiopsyTransformer } from '../../filemaker/transformers/biopsy.transformer';
import { PapTransformer } from '../../filemaker/transformers/pap.transformer';
import {
  REPORT_VALIDATION_QUEUE,
  REPORT_VALIDATION_JOB_NAMES,
} from '../constants/queue.constants';

describe('ReportValidationService', () => {
  let service: ReportValidationService;
  let queueAdd: jest.Mock;
  let prismaFindFirst: jest.Mock;

  beforeEach(async () => {
    queueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
    prismaFindFirst = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportValidationService,
        {
          provide: PrismaService,
          useValue: {
            labDiagnosticReport: { findFirst: prismaFindFirst },
          },
        },
        { provide: FmApiService, useValue: {} },
        { provide: FmAuthService, useValue: {} },
        { provide: BiopsyTransformer, useValue: {} },
        { provide: PapTransformer, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('tenant-1') },
        },
        {
          provide: getQueueToken(REPORT_VALIDATION_QUEUE),
          useValue: { add: queueAdd },
        },
      ],
    }).compile();

    service = module.get(ReportValidationService);
  });

  describe('enqueueValidation', () => {
    it('enqueues a job with correct payload', async () => {
      await service.enqueueValidation({
        tenantId: 'tenant-1',
        database: 'BIOPSIAS',
        informeNumber: 42,
        triggeredByUserId: 'user-1',
      });

      expect(queueAdd).toHaveBeenCalledWith(
        REPORT_VALIDATION_JOB_NAMES.PROCESS_VALIDATION,
        expect.objectContaining({
          tenantId: 'tenant-1',
          database: 'BIOPSIAS',
          informeNumber: 42,
          triggeredByUserId: 'user-1',
        }),
        expect.any(Object),
      );
    });

    it('returns the job id', async () => {
      const result = await service.enqueueValidation({
        tenantId: 'tenant-1',
        database: 'BIOPSIAS',
        informeNumber: 42,
      });
      expect(result.jobId).toBe('job-1');
    });
  });

  describe('getCanDispatch', () => {
    it('returns true when report is not blocked', async () => {
      prismaFindFirst.mockResolvedValue({ id: 'r1', blockedForDispatch: false });
      const result = await service.getCanDispatch('tenant-1', 42, 'BIOPSIAS');
      expect(result.canDispatch).toBe(true);
    });

    it('returns false when report is blocked', async () => {
      prismaFindFirst.mockResolvedValue({ id: 'r1', blockedForDispatch: true });
      const result = await service.getCanDispatch('tenant-1', 42, 'BIOPSIAS');
      expect(result.canDispatch).toBe(false);
    });

    it('returns true (default) when report not found yet', async () => {
      prismaFindFirst.mockResolvedValue(null);
      const result = await service.getCanDispatch('tenant-1', 42, 'BIOPSIAS');
      expect(result.canDispatch).toBe(true);
      expect(result.reason).toContain('not-found');
    });
  });
});
