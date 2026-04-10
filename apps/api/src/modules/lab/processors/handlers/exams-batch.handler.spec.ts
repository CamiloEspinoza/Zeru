import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ExamsBatchHandler } from './exams-batch.handler';
import { BiopsyTransformer } from '../../../filemaker/transformers/biopsy.transformer';
import { PapTransformer } from '../../../filemaker/transformers/pap.transformer';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';
import { LAB_IMPORT_QUEUE } from '../../constants/queue.constants';
import type { FmRecord } from '@zeru/shared';

const makeFmRecord = (overrides: Record<string, unknown> = {}): FmRecord => ({
  recordId: '1',
  modId: '1',
  fieldData: {
    'INFORME Nº': 12345,
    'NOMBRE': 'JUAN',
    'A.PATERNO': 'PEREZ',
    'A.MATERNO': 'SOTO',
    'RUT': '12.345.678-5',
    'TIPO DE EXAMEN': 'Biopsia',
    'PROCEDENCIA CODIGO UNICO': 'LAB-001',
    'DIAGNOSTICO': 'Adenocarcinoma moderadamente diferenciado',
    'TEXTO BIOPSIAS::TEXTO': 'Texto completo del informe...',
    'PATOLOGO': 'Dr. Martinez (PAT-001)',
    'FECHA VALIDACIÓN': '03/15/2026',
    'FECHA': '03/14/2026',
    'URGENTES': '',
    'Alterado o Crítico': '',
    'Activar Subir Examen': '',
    'Estado Web': '',
    'MUESTRA DE': 'Estómago',
    'ANTECEDENTES': 'Dolor epigástrico',
    'SUBTIPO EXAMEN': '',
    'SOLICITADA POR': 'Dr. López',
    'Revisado por patólogo supervisor': '',
    'caso corregido por PAT SUP': '',
    'caso corregido por validacion': '',
    'INFORMES PDF::PDF INFORME': '',
    'EDAD': '55',
    ...overrides,
  },
  portalData: {},
});

describe('ExamsBatchHandler', () => {
  let handler: ExamsBatchHandler;
  let prisma: any;
  let fmApi: jest.Mocked<FmApiService>;

  beforeEach(async () => {
    prisma = {
      labPatient: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'patient-1' }),
        upsert: jest.fn().mockResolvedValue({ id: 'patient-1' }),
      },
      labServiceRequest: {
        upsert: jest.fn().mockResolvedValue({ id: 'sr-1' }),
      },
      labSpecimen: {
        upsert: jest.fn().mockResolvedValue({ id: 'specimen-1' }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'specimen-1' }),
        update: jest.fn().mockResolvedValue({ id: 'specimen-1' }),
      },
      labDiagnosticReport: {
        upsert: jest.fn().mockResolvedValue({ id: 'dr-1' }),
      },
      labDiagnosticReportSigner: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      labDiagnosticReportAttachment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      labOrigin: {
        findFirst: jest.fn().mockResolvedValue({ id: 'origin-1' }),
      },
      labImportBatch: {
        update: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'batch-1' }),
      },
      labImportRun: {
        update: jest.fn(),
      },
      $transaction: jest.fn((fn) => fn(prisma)),
    };

    const module = await Test.createTestingModule({
      providers: [
        ExamsBatchHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: FmApiService, useValue: { findRecords: jest.fn(), getRecords: jest.fn() } },
        { provide: BiopsyTransformer, useValue: new BiopsyTransformer() },
        { provide: PapTransformer, useValue: new PapTransformer() },
        {
          provide: LabImportOrchestratorService,
          useValue: { advancePhase: jest.fn() },
        },
        { provide: getQueueToken(LAB_IMPORT_QUEUE), useValue: {} },
      ],
    }).compile();

    handler = module.get(ExamsBatchHandler);
    fmApi = module.get(FmApiService);
  });

  describe('process', () => {
    it('processes a batch of biopsy records', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [makeFmRecord()],
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
        },
      } as any;

      await handler.handle(job.data);

      expect(prisma.labServiceRequest.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.labDiagnosticReport.upsert).toHaveBeenCalledTimes(1);
    });

    it('creates patient with needsMerge=true when no RUT', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [makeFmRecord({ 'RUT': '' })],
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
        },
      } as any;

      await handler.handle(job.data);

      expect(prisma.labPatient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            needsMerge: true,
            rut: null,
          }),
        }),
      );
    });

    it('updates batch status on failure', async () => {
      fmApi.getRecords.mockRejectedValue(new Error('FM timeout'));

      const job = {
        data: {
          runId: 'run-1',
          tenantId: 'tenant-1',
          fmSource: 'BIOPSIAS',
          batchIndex: 0,
          offset: 1,
          limit: 100,
        },
      } as any;

      await expect(handler.handle(job.data)).rejects.toThrow('FM timeout');

      expect(prisma.labImportBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('upserts existing patient by RUT instead of creating new', async () => {
      prisma.labPatient.findFirst.mockResolvedValue({ id: 'existing-patient' });

      fmApi.getRecords.mockResolvedValue({
        records: [makeFmRecord()],
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
        },
      } as any;

      await handler.handle(job.data);

      // Should use existing patient, not create a new one
      expect(prisma.labPatient.create).not.toHaveBeenCalled();
      expect(prisma.labServiceRequest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            subjectId: 'existing-patient',
          }),
        }),
      );
    });

    it('creates signers for the diagnostic report', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [makeFmRecord()],
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
        },
      } as any;

      await handler.handle(job.data);

      expect(prisma.labDiagnosticReportSigner.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            diagnosticReportId: 'dr-1',
          }),
        }),
      );
      expect(prisma.labDiagnosticReportSigner.createMany).toHaveBeenCalled();
    });

    it('uses getRecords when no date range specified', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [makeFmRecord()],
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
          // No dateFrom/dateTo
        },
      } as any;

      await handler.handle(job.data);

      expect(fmApi.getRecords).toHaveBeenCalled();
      expect(fmApi.findRecords).not.toHaveBeenCalled();
    });

    it('uses findRecords when date range is specified', async () => {
      fmApi.findRecords.mockResolvedValue({
        records: [makeFmRecord()],
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
          dateFrom: '2026-01-01',
          dateTo: '2026-03-31',
        },
      } as any;

      await handler.handle(job.data);

      expect(fmApi.findRecords).toHaveBeenCalled();
      expect(fmApi.getRecords).not.toHaveBeenCalled();
    });
  });
});
