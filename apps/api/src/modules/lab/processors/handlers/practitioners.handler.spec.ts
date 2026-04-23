import { Test } from '@nestjs/testing';
import { PractitionersHandler } from './practitioners.handler';
import { PractitionersTransformer } from '../../../filemaker/transformers/practitioners.transformer';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';

describe('PractitionersHandler', () => {
  let handler: PractitionersHandler;
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
        PractitionersHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: FmApiService, useValue: { getAllRecords: jest.fn() } },
        { provide: PractitionersTransformer, useValue: new PractitionersTransformer() },
        { provide: LabImportOrchestratorService, useValue: orchestrator },
      ],
    }).compile();

    handler = module.get(PractitionersHandler);
    fmApi = module.get(FmApiService);
  });

  it('upserts each practitioner by (tenantId, code)', async () => {
    fmApi.getAllRecords.mockResolvedValue([
      makeRec({ Nombre: 'Ricardo Lobos Cofré', Codigo: 'RLC', ESPECIALIDAD: 'Anatomía', Asignable: 'Si' }, '1'),
      makeRec({ Nombre: 'Ana Pérez', Codigo: 'AP', ESPECIALIDAD: '', Asignable: 'No' }, '2'),
    ]);

    await handler.handle({ runId: 'run-1', tenantId: 'tenant-1', batchId: 'batch-1' });

    expect(prisma.labPractitioner.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.labPractitioner.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { tenantId_code: { tenantId: 'tenant-1', code: 'RLC' } },
        create: expect.objectContaining({
          code: 'RLC',
          codeSnapshot: 'RLC',
          firstName: 'Ricardo',
          paternalLastName: 'Lobos',
          maternalLastName: 'Cofré',
          roles: ['PATHOLOGIST'],
          isInternal: true,
          specialty: 'Anatomía',
          isActive: true,
        }),
      }),
    );
    expect(orchestrator.advancePhase).toHaveBeenCalledWith('run-1');
  });

  it('skips records with empty Codigo and records an error', async () => {
    fmApi.getAllRecords.mockResolvedValue([
      makeRec({ Nombre: 'Sin Codigo', Codigo: '', ESPECIALIDAD: '', Asignable: 'Si' }, '1'),
      makeRec({ Nombre: 'Ana Pérez', Codigo: 'AP', ESPECIALIDAD: '', Asignable: 'Si' }, '2'),
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

  it('continues on per-record failure and reports errors', async () => {
    prisma.labPractitioner.upsert
      .mockResolvedValueOnce({ id: 'pract-1' })
      .mockRejectedValueOnce(new Error('db fail'));

    fmApi.getAllRecords.mockResolvedValue([
      makeRec({ Nombre: 'Ricardo Lobos Cofré', Codigo: 'RLC', ESPECIALIDAD: '', Asignable: 'Si' }, '1'),
      makeRec({ Nombre: 'Ana Pérez', Codigo: 'AP', ESPECIALIDAD: '', Asignable: 'Si' }, '2'),
    ]);

    await handler.handle({ runId: 'run-1', tenantId: 'tenant-1', batchId: 'batch-1' });

    expect(prisma.labImportBatch.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
          processedCount: 1,
          errorCount: 1,
        }),
      }),
    );
    expect(orchestrator.advancePhase).toHaveBeenCalledWith('run-1');
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
