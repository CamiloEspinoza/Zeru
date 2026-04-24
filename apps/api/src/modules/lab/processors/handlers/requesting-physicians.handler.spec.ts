import { Test } from '@nestjs/testing';
import { RequestingPhysiciansHandler } from './requesting-physicians.handler';
import { RequestingPhysiciansTransformer } from '../../../filemaker/transformers/requesting-physicians.transformer';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';

describe('RequestingPhysiciansHandler', () => {
  let handler: RequestingPhysiciansHandler;
  let prisma: any;
  let fmApi: jest.Mocked<FmApiService>;
  let orchestrator: { advancePhase: jest.Mock };

  const makeRec = (fieldData: Record<string, unknown>, recordId = '1') => ({
    recordId,
    modId: '0',
    fieldData,
  });

  beforeEach(async () => {
    prisma = {
      labPractitioner: {
        upsert: jest.fn().mockResolvedValue({ id: 'pract-1' }),
      },
      labImportBatch: { update: jest.fn() },
      labImportRun: { update: jest.fn() },
    };
    orchestrator = { advancePhase: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        RequestingPhysiciansHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: FmApiService, useValue: { getAllRecords: jest.fn() } },
        {
          provide: RequestingPhysiciansTransformer,
          useValue: new RequestingPhysiciansTransformer(),
        },
        { provide: LabImportOrchestratorService, useValue: orchestrator },
      ],
    }).compile();

    handler = module.get(RequestingPhysiciansHandler);
    fmApi = module.get(FmApiService);
  });

  it('upserts each requesting physician with REQUESTING_PHYSICIAN role', async () => {
    fmApi.getAllRecords.mockResolvedValue([
      makeRec({ 'SOLICITADO POR': 'Dr. Juan Pérez Soto', 'CODIGO': 100 }, '1'),
      makeRec({ 'SOLICITADO POR': 'Ana Díaz', 'CODIGO': 200 }, '2'),
    ]);

    await handler.handle({ runId: 'run-1', tenantId: 'tenant-1', batchId: 'batch-1' });

    expect(prisma.labPractitioner.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.labPractitioner.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { tenantId_code: { tenantId: 'tenant-1', code: '100' } },
        create: expect.objectContaining({
          code: '100',
          codeSnapshot: '100',
          firstName: 'Juan',
          paternalLastName: 'Pérez',
          maternalLastName: 'Soto',
          roles: ['REQUESTING_PHYSICIAN'],
          isInternal: false,
        }),
      }),
    );
    expect(orchestrator.advancePhase).toHaveBeenCalledWith('run-1');
  });

  it('skips records without CODIGO and records an error', async () => {
    fmApi.getAllRecords.mockResolvedValue([
      makeRec({ 'SOLICITADO POR': 'Sin codigo', 'CODIGO': '' }, '1'),
      makeRec({ 'SOLICITADO POR': 'Ana Díaz', 'CODIGO': 200 }, '2'),
    ]);

    await handler.handle({ runId: 'run-1', tenantId: 'tenant-1', batchId: 'batch-1' });

    expect(prisma.labPractitioner.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.labImportBatch.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          recordCount: 2,
          processedCount: 1,
          errorCount: 1,
        }),
      }),
    );
  });

  it('keeps batch PENDING on top-level failure (lets BullMQ retry)', async () => {
    fmApi.getAllRecords.mockRejectedValue(new Error('FM timeout'));

    await expect(
      handler.handle({ runId: 'run-1', tenantId: 'tenant-1', batchId: 'batch-1' }),
    ).rejects.toThrow('FM timeout');

    expect(prisma.labImportBatch.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING' }),
      }),
    );
    expect(orchestrator.advancePhase).not.toHaveBeenCalled();
  });
});
