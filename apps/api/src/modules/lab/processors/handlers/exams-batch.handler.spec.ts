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
      labSlide: {
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

    it('persists subjectBirthDate and subjectGender when creating a new patient', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [
          makeFmRecord({
            'RUT': '',
            'SEXO': 'FEMENINO',
            'FECHA NACIMIENTO': '05/15/1960',
          }),
        ],
        totalRecordCount: 1,
      });

      await handler.handle({
        runId: 'run-1',
        tenantId: 'tenant-1',
        fmSource: 'BIOPSIAS',
        batchIndex: 0,
        offset: 1,
        limit: 100,
      } as any);

      expect(prisma.labPatient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gender: 'FEMALE',
            birthDate: expect.any(Date),
          }),
        }),
      );
      const call = prisma.labPatient.create.mock.calls[0][0];
      expect(call.data.birthDate.getFullYear()).toBe(1960);
    });

    it('keeps batch PENDING on intermediate failure (retries)', async () => {
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

      // On intermediate failures, batch stays PENDING so advancePhase still counts it.
      // FAILED is only set on final retry exhaustion via @OnWorkerEvent('failed').
      expect(prisma.labImportBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING' }),
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

    it('persists F0 fields on ServiceRequest (externalFolio/Institution/Order, requestingPhysicianEmail)', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [
          makeFmRecord({
            'NºFOLIO': 'FOLIO-99',
            'Nº ORDEN ATENCION': 'ORD-55',
            'NUMERO IDENTIFICADOR INSTITUCION': 'INST-7',
          }),
        ],
        totalRecordCount: 1,
      });

      await handler.handle({
        runId: 'run-1',
        tenantId: 'tenant-1',
        fmSource: 'BIOPSIAS',
        batchIndex: 0,
        offset: 1,
        limit: 100,
      } as any);

      expect(prisma.labServiceRequest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            externalFolioNumber: 'FOLIO-99',
            externalInstitutionId: 'INST-7',
            externalOrderNumber: 'ORD-55',
          }),
        }),
      );
    });

    it('persists F0 specimen fields (containerType, tacoCount, cassetteCount, IHQ)', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [
          makeFmRecord({
            'TIPO ENVASE': 'FORMOL',
            'TACOS': '3',
            'CASSETTES DE INCLUSION': '4',
            'PLACAS HE': '8',
            'Total especiales': '2',
            'ANTICUERPOS': 'anti-CD20; anti-CK7',
            'INMUNO NUMEROS': 'I-123',
            'INMUNOS Estado Solicitud': 'Solicitada',
          }),
        ],
        totalRecordCount: 1,
      });

      await handler.handle({
        runId: 'run-1',
        tenantId: 'tenant-1',
        fmSource: 'BIOPSIAS',
        batchIndex: 0,
        offset: 1,
        limit: 100,
      } as any);

      expect(prisma.labSpecimen.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            containerType: 'FORMOL',
            tacoCount: 3,
            cassetteCount: 4,
            placaHeCount: 8,
            specialTechniquesCount: 2,
            ihqAntibodies: ['anti-CD20', 'anti-CK7'],
            ihqNumbers: 'I-123',
            ihqStatus: 'Solicitada',
          }),
        }),
      );
    });

    it('persists F0 DR fields (critical notification, CCB rejection, diagnostic modification)', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [
          makeFmRecord({
            'AVISAR PACIENTE': 'Si',
            'RESULTADO CRITICO RESPONSABLE NOTIFICACION': 'Dra. Contreras',
            'FECHA NOTIFICACION CRITICO': '03/16/2026',
            'PDF Notificación Crítico': '/fmi/foo',
            'Rechazado por CCB': 'Si',
            'COMENTARIOS CCB': 'Muestra insuficiente',
            'DIAGNOSTICO MODIFICADO': 'Si',
            'Modifcado Por': 'Dr. Silva',
          }),
        ],
        totalRecordCount: 1,
      });

      await handler.handle({
        runId: 'run-1',
        tenantId: 'tenant-1',
        fmSource: 'BIOPSIAS',
        batchIndex: 0,
        offset: 1,
        limit: 100,
      } as any);

      expect(prisma.labDiagnosticReport.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            criticalPatientNotifyFlag: true,
            criticalNotifiedByNameSnapshot: 'Dra. Contreras',
            criticalNotificationPdfKey: '/fmi/foo',
            rejectedByCcb: true,
            ccbComments: 'Muestra insuficiente',
            diagnosticModified: true,
            modifiedByNameSnapshot: 'Dr. Silva',
          }),
        }),
      );
    });

    it('persists slides from the Placas portal (replace semantics)', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [
          {
            ...makeFmRecord(),
            portalData: {
              Placas: [
                { 'Placas::codigo': 'PLC-01', 'Placas::tincion': 'HE', 'Placas::nivel': '1' },
                { 'Placas::codigo': 'PLC-02', 'Placas::tincion': 'IHQ', 'Placas::nivel': '2' },
                { 'Placas::codigo': '', 'Placas::tincion': '', 'Placas::nivel': '' },
              ],
            },
          },
        ],
        totalRecordCount: 1,
      });

      await handler.handle({
        runId: 'run-1',
        tenantId: 'tenant-1',
        fmSource: 'BIOPSIAS',
        batchIndex: 0,
        offset: 1,
        limit: 100,
      } as any);

      expect(prisma.labSlide.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', specimenId: 'specimen-1' },
        }),
      );
      expect(prisma.labSlide.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            { tenantId: 'tenant-1', specimenId: 'specimen-1', placaCode: 'PLC-01', stain: 'HE', level: 1 },
            { tenantId: 'tenant-1', specimenId: 'specimen-1', placaCode: 'PLC-02', stain: 'IHQ', level: 2 },
          ],
        }),
      );
    });

    it('clears stale slides when the latest record has none', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [makeFmRecord()],
        totalRecordCount: 1,
      });

      await handler.handle({
        runId: 'run-1',
        tenantId: 'tenant-1',
        fmSource: 'BIOPSIAS',
        batchIndex: 0,
        offset: 1,
        limit: 100,
      } as any);

      expect(prisma.labSlide.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', specimenId: 'specimen-1' },
        }),
      );
      expect(prisma.labSlide.createMany).not.toHaveBeenCalled();
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
