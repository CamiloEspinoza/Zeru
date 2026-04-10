import { Test } from '@nestjs/testing';
import { WorkflowEventsBatchHandler } from './workflow-events-batch.handler';
import { TraceabilityTransformer } from '../../../filemaker/transformers/traceability.transformer';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';
import type { FmRecord } from '@zeru/shared';

const makeTraceRecord = (): FmRecord => ({
  recordId: '100',
  modId: '1',
  fieldData: {
    'INFORME Nº': 12345,
    'Trazabilidad::Responsable_Ingreso examen': 'María López',
    'Trazabilidad::Fecha_Ingreso examen': '03/10/2026',
    'Trazabilidad::Responsable_Macroscopía': 'Pedro Gómez',
    'Trazabilidad::Fecha_Macroscopía': '03/11/2026',
    'Trazabilidad::Responsable_Validación': 'Dr. Martínez',
    'Trazabilidad::Fecha_Validación': '03/15/2026',
  },
  portalData: {},
});

describe('WorkflowEventsBatchHandler', () => {
  let handler: WorkflowEventsBatchHandler;
  let prisma: any;
  let fmApi: jest.Mocked<FmApiService>;

  beforeEach(async () => {
    prisma = {
      labDiagnosticReport: {
        findFirst: jest.fn().mockResolvedValue({ id: 'dr-1' }),
      },
      labExamWorkflowEvent: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      labImportBatch: {
        update: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'batch-1' }),
      },
      labImportRun: { update: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        WorkflowEventsBatchHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: FmApiService, useValue: { getRecords: jest.fn(), findRecords: jest.fn() } },
        { provide: TraceabilityTransformer, useValue: new TraceabilityTransformer() },
        { provide: LabImportOrchestratorService, useValue: { advancePhase: jest.fn() } },
      ],
    }).compile();

    handler = module.get(WorkflowEventsBatchHandler);
    fmApi = module.get(FmApiService);
  });

  it('creates workflow events for a traceability record', async () => {
    fmApi.getRecords.mockResolvedValue({
      records: [makeTraceRecord()],
      totalRecordCount: 1,
    });

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        fmSource: 'BIOPSIAS',
        batchIndex: 0,
        offset: 1,
        limit: 100,
        batchId: 'batch-1',
      },
    } as any;

    await handler.handle(job.data);

    expect(prisma.labExamWorkflowEvent.deleteMany).toHaveBeenCalled();
    expect(prisma.labExamWorkflowEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'ORIGIN_INTAKE',
            performedByNameSnapshot: 'María López',
          }),
        ]),
      }),
    );
  });

  it('skips records with no matching diagnostic report', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue(null);
    fmApi.getRecords.mockResolvedValue({
      records: [makeTraceRecord()],
      totalRecordCount: 1,
    });

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        fmSource: 'BIOPSIAS',
        batchIndex: 0,
        offset: 1,
        limit: 100,
        batchId: 'batch-1',
      },
    } as any;

    await handler.handle(job.data);

    expect(prisma.labExamWorkflowEvent.createMany).not.toHaveBeenCalled();
  });
});
