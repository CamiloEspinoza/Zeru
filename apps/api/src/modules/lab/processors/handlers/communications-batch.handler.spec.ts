import { Test } from '@nestjs/testing';
import { CommunicationsBatchHandler } from './communications-batch.handler';
import { CommunicationTransformer } from '../../../filemaker/transformers/communication.transformer';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';
describe('CommunicationsBatchHandler', () => {
  let handler: CommunicationsBatchHandler;
  let prisma: any;
  let fmApi: jest.Mocked<FmApiService>;

  beforeEach(async () => {
    prisma = {
      labDiagnosticReport: {
        findFirst: jest.fn().mockResolvedValue({ id: 'dr-1' }),
      },
      labCommunication: {
        create: jest.fn().mockResolvedValue({ id: 'comm-1' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      labImportBatch: {
        update: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'batch-1' }),
      },
      labImportRun: { update: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        CommunicationsBatchHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: FmApiService, useValue: { getAllRecords: jest.fn(), findAll: jest.fn() } },
        { provide: CommunicationTransformer, useValue: new CommunicationTransformer() },
        { provide: LabImportOrchestratorService, useValue: { advancePhase: jest.fn() } },
      ],
    }).compile();

    handler = module.get(CommunicationsBatchHandler);
    fmApi = module.get(FmApiService);
  });

  it('processes PAP communications from standalone COMUNICACIONES table', async () => {
    fmApi.getAllRecords.mockResolvedValue([
      {
        recordId: '1',
        modId: '1',
        fieldData: {
          'fk_InformeNumero': 5000,
          'Comentario': 'Muestra insuficiente para análisis',
          'Motivo': 'Muestra insuficiente',
          'Respuesta': 'Se solicitó nueva muestra',
          'IngresoFecha': '03/10/2026',
          'IngresoHora': '10:30',
          'IngresoResponsable': 'Ana Torres',
        },
      },
    ]);

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        fmSource: 'PAPANICOLAOU',
      },
    } as any;

    await handler.handle(job.data);

    expect(prisma.labCommunication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: 'Muestra insuficiente para análisis',
          loggedByNameSnapshot: 'Ana Torres',
        }),
      }),
    );
  });

  it('BIOPSIAS filters by FECHA VALIDACIÓN range when dateFrom/dateTo are provided', async () => {
    fmApi.findAll.mockResolvedValue([]);

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        fmSource: 'BIOPSIAS',
        dateFrom: '2026-03-01T00:00:00.000Z',
        dateTo: '2026-03-31T23:59:59.000Z',
      },
    } as any;

    await handler.handle(job.data);

    expect(fmApi.findAll).toHaveBeenCalledWith(
      'BIOPSIAS',
      'Validación Final*',
      [{ 'FECHA VALIDACIÓN': '03/01/2026...03/31/2026' }],
      expect.objectContaining({ dateformats: 2, portals: ['COMUNICACIONES'] }),
    );
    expect(fmApi.getAllRecords).not.toHaveBeenCalled();
  });

  it('BIOPSIAS falls back to getAllRecords when no date range is provided', async () => {
    fmApi.getAllRecords.mockResolvedValue([]);

    const job = {
      data: { runId: 'run-1', tenantId: 'tenant-1', fmSource: 'BIOPSIAS' },
    } as any;

    await handler.handle(job.data);

    expect(fmApi.getAllRecords).toHaveBeenCalledWith(
      'BIOPSIAS',
      'Validación Final*',
      expect.objectContaining({ dateformats: 2, portals: ['COMUNICACIONES'] }),
    );
    expect(fmApi.findAll).not.toHaveBeenCalled();
  });

  it('does NOT count as processed when no DR exists for the informe', async () => {
    // Simulates real bug: PAP run finished with processedCount=1361 but
    // lab_communications stayed at 0 because none of the informe numbers
    // had a matching DR in the DB (phase-1 hadn't completed for that run).
    prisma.labDiagnosticReport.findFirst = jest.fn().mockResolvedValue(null);

    fmApi.getAllRecords.mockResolvedValue([
      {
        recordId: '1',
        modId: '1',
        fieldData: {
          'fk_InformeNumero': 5000,
          'Comentario': 'Sin DR asociado',
          'Motivo': 'Test',
          'IngresoResponsable': 'X',
        },
      },
    ]);

    const job = { data: { runId: 'run-1', tenantId: 't1', fmSource: 'PAPANICOLAOU' } } as any;
    await handler.handle(job.data);

    // Must not create anything
    expect(prisma.labCommunication.create).not.toHaveBeenCalled();
    // Must not inflate processedCount on the batch row
    const batchUpdate = prisma.labImportBatch.update.mock.calls.find((c: any) =>
      'processedCount' in (c[0]?.data ?? {}),
    );
    expect(batchUpdate?.[0].data.processedCount).toBe(0);
    // Must not inflate processedRecords on the run row
    const runUpdate = prisma.labImportRun.update.mock.calls[0];
    expect(runUpdate[0].data.processedRecords.increment).toBe(0);
  });

  it('does NOT double-count when the communication already exists', async () => {
    prisma.labCommunication.findFirst = jest.fn().mockResolvedValue({ id: 'already' });

    fmApi.getAllRecords.mockResolvedValue([
      {
        recordId: '1',
        modId: '1',
        fieldData: {
          'fk_InformeNumero': 5000,
          'Comentario': 'Dup',
          'Motivo': 'Test',
          'IngresoResponsable': 'X',
        },
      },
    ]);

    const job = { data: { runId: 'run-1', tenantId: 't1', fmSource: 'PAPANICOLAOU' } } as any;
    await handler.handle(job.data);

    expect(prisma.labCommunication.create).not.toHaveBeenCalled();
    const batchUpdate = prisma.labImportBatch.update.mock.calls.find((c: any) =>
      'processedCount' in (c[0]?.data ?? {}),
    );
    expect(batchUpdate?.[0].data.processedCount).toBe(0);
  });

  it('skips sources that have no communication data', async () => {
    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        fmSource: 'BIOPSIASRESPALDO',
      },
    } as any;

    await handler.handle(job.data);

    // BIOPSIASRESPALDO communications are embedded in exam portals (handled during exam import)
    // This processor skips non-primary sources
    expect(fmApi.getAllRecords).not.toHaveBeenCalled();
  });
});
