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
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
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
    it('creates LabImportRun and enqueues Phase 0 jobs (pathologists + requesting physicians)', async () => {
      const result = await service.startImport({
        tenantId: 'tenant-1',
        sources: ['BIOPSIAS'],
        batchSize: 100,
      });

      expect(result.runId).toBe('run-1');
      expect(result.totalBatches).toBe(2);
      expect(prisma.labImportRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phase: 'phase-0-practitioners' }),
        }),
      );
      expect(importQueue.addBulk).toHaveBeenCalled();
      const jobs = importQueue.addBulk.mock.calls[0][0];
      expect(jobs).toHaveLength(2);
      expect(jobs.map((j: { name: string }) => j.name).sort()).toEqual([
        'practitioners-import',
        'requesting-physicians-import',
      ]);
    });
  });

  describe('advancePhase', () => {
    it('transitions from PRACTITIONERS to EXAMS and enqueues batch jobs', async () => {
      prisma.labImportRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: 'RUNNING',
        phase: 'phase-0-practitioners',
        tenantId: 'tenant-1',
        sources: ['BIOPSIAS'],
        dateFrom: null,
        dateTo: null,
        batchSize: 100,
      });
      rangeResolver.getSourceStats.mockResolvedValue({
        source: 'BIOPSIAS',
        totalRecords: 250,
        database: 'BIOPSIAS',
        layout: 'Validación Final*',
      });

      await service.advancePhase('run-1');

      expect(prisma.labImportRun.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ phase: 'phase-0-practitioners' }),
          data: expect.objectContaining({ phase: 'phase-1-exams' }),
        }),
      );
      // 250 / 100 = 3 exam batches
      expect(importQueue.addBulk).toHaveBeenCalled();
      const enqueued = importQueue.addBulk.mock.calls[0][0];
      expect(enqueued).toHaveLength(3);
      expect(enqueued[0].name).toBe('exams-batch');
    });
  });

  describe('getRunStatus', () => {
    it('returns run with batch summary', async () => {
      prisma.labImportRun.findFirst.mockResolvedValue({
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
      prisma.labImportRun.findFirst.mockResolvedValue(null);
      const status = await service.getRunStatus('non-existent');
      expect(status).toBeNull();
    });
  });
});
