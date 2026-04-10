import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { LabImportOrchestratorService } from './lab-import-orchestrator.service';
import { FmRangeResolverService } from './fm-range-resolver.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LAB_IMPORT_QUEUE, ATTACHMENT_MIGRATION_QUEUE } from '../constants/queue.constants';

describe('LabImportOrchestratorService', () => {
  let service: LabImportOrchestratorService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let rangeResolver: jest.Mocked<FmRangeResolverService>;
  let importQueue: { add: jest.Mock; addBulk: jest.Mock };

  beforeEach(async () => {
    prisma = {
      labImportRun: {
        create: jest.fn().mockResolvedValue({ id: 'run-1' }),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
      },
      labImportBatch: {
        create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    importQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      addBulk: jest.fn().mockResolvedValue([]),
    };

    const module = await Test.createTestingModule({
      providers: [
        LabImportOrchestratorService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: FmRangeResolverService,
          useValue: {
            getSourceStats: jest.fn(),
            getChargeStats: jest.fn(),
            getTraceabilityStats: jest.fn(),
            getLiquidationStats: jest.fn(),
          },
        },
        { provide: getQueueToken(LAB_IMPORT_QUEUE), useValue: importQueue },
        { provide: getQueueToken(ATTACHMENT_MIGRATION_QUEUE), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get(LabImportOrchestratorService);
    rangeResolver = module.get(FmRangeResolverService);
  });

  describe('startImport', () => {
    it('creates LabImportRun and partitions into batches', async () => {
      rangeResolver.getSourceStats.mockResolvedValue({
        source: 'BIOPSIAS',
        totalRecords: 250,
        database: 'BIOPSIAS',
        layout: 'Validación Final*',
      });

      const result = await service.startImport({
        tenantId: 'tenant-1',
        sources: ['BIOPSIAS'],
        batchSize: 100,
      });

      expect(result.runId).toBe('run-1');
      expect(prisma.labImportRun.create).toHaveBeenCalledTimes(1);
      // 250 records / 100 batch size = 3 batches
      expect(importQueue.addBulk).toHaveBeenCalled();
    });

    it('applies date filter for test mode', async () => {
      rangeResolver.getSourceStats.mockResolvedValue({
        source: 'BIOPSIAS',
        totalRecords: 50,
        database: 'BIOPSIAS',
        layout: 'Validación Final*',
      });

      await service.startImport({
        tenantId: 'tenant-1',
        sources: ['BIOPSIAS'],
        dateFrom: new Date('2026-03-01'),
        dateTo: new Date('2026-03-31'),
        batchSize: 100,
      });

      expect(rangeResolver.getSourceStats).toHaveBeenCalledWith('BIOPSIAS', {
        dateFrom: expect.any(Date),
        dateTo: expect.any(Date),
      });
    });

    it('skips sources with zero records', async () => {
      rangeResolver.getSourceStats.mockResolvedValue({
        source: 'BIOPSIASRESPALDO',
        totalRecords: 0,
        database: 'BIOPSIASRESPALDO',
        layout: 'Validación Final*',
      });

      const result = await service.startImport({
        tenantId: 'tenant-1',
        sources: ['BIOPSIASRESPALDO'],
        batchSize: 100,
      });

      expect(result.runId).toBe('run-1');
    });
  });

  describe('getRunStatus', () => {
    it('returns run with batch summary', async () => {
      prisma.labImportRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: 'RUNNING',
        phase: 'phase-1-exams',
        totalBatches: 10,
        completedBatches: 5,
        failedBatches: 0,
        totalRecords: 1000,
        processedRecords: 500,
        errorRecords: 2,
        startedAt: new Date(),
        completedAt: null,
        batches: [],
      });

      const status = await service.getRunStatus('run-1');

      expect(status).toBeDefined();
      expect(status!.status).toBe('RUNNING');
      expect(status!.phase).toBe('phase-1-exams');
    });

    it('returns null for non-existent run', async () => {
      prisma.labImportRun.findUnique.mockResolvedValue(null);
      const status = await service.getRunStatus('non-existent');
      expect(status).toBeNull();
    });
  });
});
