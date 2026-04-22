import { Test } from '@nestjs/testing';
import { ChargesBatchHandler } from './charges-batch.handler';
import { ExamChargeTransformer } from '../../../filemaker/transformers/exam-charge.transformer';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';

describe('ChargesBatchHandler', () => {
  let handler: ChargesBatchHandler;
  let prisma: any;
  let fmApi: jest.Mocked<FmApiService>;

  beforeEach(async () => {
    prisma = {
      labExamCharge: {
        upsert: jest.fn().mockResolvedValue({ id: 'charge-1' }),
      },
      labDiagnosticReport: {
        findFirst: jest.fn().mockResolvedValue({ id: 'dr-1' }),
      },
      labOrigin: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'origin-1', legalEntityId: 'le-1' }),
      },
      labLiquidation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'liq-1' }),
      },
      labDirectPaymentBatch: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      labImportBatch: { update: jest.fn() },
      labImportRun: { update: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        ChargesBatchHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: FmApiService, useValue: { getRecords: jest.fn() } },
        {
          provide: ExamChargeTransformer,
          useValue: new ExamChargeTransformer(),
        },
        {
          provide: LabImportOrchestratorService,
          useValue: { advancePhase: jest.fn() },
        },
      ],
    }).compile();

    handler = module.get(ChargesBatchHandler);
    fmApi = module.get(FmApiService);
  });

  it('imports biopsy charge records', async () => {
    fmApi.getRecords.mockResolvedValue({
      records: [
        {
          recordId: '1',
          modId: '1',
          fieldData: {
            __pk_Biopsia_Ingreso: 500,
            '_fk_Informe_Número': 12345,
            'Tipo de Ingreso::Nombre': 'Efectivo',
            Valor: '25000',
            'Códigos Prestación': 'BIO-001',
            'Estado Ingreso': 'Validado',
            'BIOPSIAS Cobranzas::PROCEDENCIA CODIGO UNICO': 'LAB-001',
            'Ingreso Fecha': '03/15/2026',
            'Ingreso Responsable': 'Secretaria 1',
            'Punto de ingreso': 'Caja central',
            '_fk_Liquidaciones Instituciones': '',
            '_fk_Rendición Pago directo': '',
          },
        },
      ],
      totalRecordCount: 1,
    });

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        chargeSource: 'BIOPSIAS_INGRESOS',
        batchIndex: 0,
        offset: 1,
        limit: 100,
        batchId: 'batch-1',
      },
    } as any;

    await handler.handle(job.data);

    expect(prisma.labExamCharge.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.labExamCharge.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          fmRecordPk: 500,
          amount: expect.any(Object), // Prisma Decimal
          paymentMethod: 'LAB_CASH',
          status: 'VALIDATED_CHARGE',
        }),
      }),
    );
  });

  it('skips records with fkInformeNumber=0 without counting as error', async () => {
    // Many FM charges have no associated informe (fkInformeNumber=0 / empty)
    // because they represent service-level adjustments, not per-report items.
    // Those are legitimate data, not corruption — they must not pollute errorRecords.
    fmApi.getRecords.mockResolvedValue({
      records: [
        {
          recordId: '42',
          modId: '1',
          fieldData: {
            __pk_Biopsia_Ingreso: 999,
            '_fk_Informe_Número': 0,
            'Tipo de Ingreso::Nombre': 'Efectivo',
            Valor: '1000',
            'BIOPSIAS Cobranzas::PROCEDENCIA CODIGO UNICO': 'LAB-001',
            'Ingreso Fecha': '03/10/2026',
            'Ingreso Responsable': 'X',
            '_fk_Liquidaciones Instituciones': '',
            '_fk_Rendición Pago directo': '',
          },
        },
      ],
      totalRecordCount: 1,
    });

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        chargeSource: 'BIOPSIAS_INGRESOS',
        batchIndex: 0,
        offset: 1,
        limit: 100,
        batchId: 'batch-1',
      },
    } as any;

    await handler.handle(job.data);

    // No DR lookup and no persist
    expect(prisma.labDiagnosticReport.findFirst).not.toHaveBeenCalled();
    expect(prisma.labExamCharge.upsert).not.toHaveBeenCalled();
    // Batch counters: 0 processed, 0 errors
    const batchUpdate = prisma.labImportBatch.update.mock.calls.find((c: any) =>
      'processedCount' in (c[0]?.data ?? {}),
    );
    expect(batchUpdate?.[0].data.processedCount).toBe(0);
    expect(batchUpdate?.[0].data.errorCount).toBe(0);
  });

  it('links charge to liquidation when fk exists', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue({ id: 'liq-99' });

    fmApi.getRecords.mockResolvedValue({
      records: [
        {
          recordId: '1',
          modId: '1',
          fieldData: {
            __pk_Biopsia_Ingreso: 501,
            '_fk_Informe_Número': 12346,
            'Tipo de Ingreso::Nombre': 'Convenio',
            Valor: '30000',
            'Códigos Prestación': '',
            'Estado Ingreso': '',
            'BIOPSIAS Cobranzas::PROCEDENCIA CODIGO UNICO': 'LAB-002',
            'Ingreso Fecha': '03/16/2026',
            'Ingreso Responsable': 'Secretaria 2',
            'Punto de ingreso': '',
            '_fk_Liquidaciones Instituciones': '42',
            '_fk_Rendición Pago directo': '',
          },
        },
      ],
      totalRecordCount: 1,
    });

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        chargeSource: 'BIOPSIAS_INGRESOS',
        batchIndex: 0,
        offset: 1,
        limit: 100,
        batchId: 'batch-1',
      },
    } as any;

    await handler.handle(job.data);

    expect(prisma.labExamCharge.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          liquidationId: 'liq-99',
        }),
      }),
    );
  });
});
