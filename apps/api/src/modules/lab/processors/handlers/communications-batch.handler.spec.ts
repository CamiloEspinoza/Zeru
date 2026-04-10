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
