import { Test } from '@nestjs/testing';
import { LiquidationsHandler } from './liquidations.handler';
import { LiquidationTransformer } from '../../../filemaker/transformers/liquidation.transformer';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';

describe('LiquidationsHandler', () => {
  let handler: LiquidationsHandler;
  let prisma: any;
  let fmApi: jest.Mocked<FmApiService>;

  beforeEach(async () => {
    prisma = {
      labLiquidation: {
        upsert: jest.fn().mockResolvedValue({ id: 'liq-1' }),
      },
      labOrigin: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'origin-1', legalEntityId: 'le-1', billingAgreementId: 'agr-1' }),
      },
      labImportBatch: {
        update: jest.fn(),
      },
      labImportRun: { update: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        LiquidationsHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: FmApiService, useValue: { getAllRecords: jest.fn() } },
        { provide: LiquidationTransformer, useValue: new LiquidationTransformer() },
        { provide: LabImportOrchestratorService, useValue: { advancePhase: jest.fn() } },
      ],
    }).compile();

    handler = module.get(LiquidationsHandler);
    fmApi = module.get(FmApiService);
  });

  it('imports liquidation records', async () => {
    fmApi.getAllRecords.mockResolvedValue([
      {
        recordId: '1',
        modId: '1',
        fieldData: {
          '__pk_liquidaciones_instituciones': 100,
          'CODIGO INSTITUCION': 'LAB-001',
          'PERIODO COBRO': 'Marzo 2026',
          'ESTADO': 'Confirmado',
          'TOTAL LIQUIDACIÓN': '500000',
          'TOTAL FINAL': '500000',
          'VALOR TOTAL BIOPSIAS': '300000',
          'VALOR TOTAL PAP': '150000',
          'VALOR TOTAL CITOLOGÍAS': '50000',
          'VALOR TOTAL INMUNOS': '0',
          'Nº DE BIOPSIAS': '15',
          'Nº DE PAP': '20',
          'Nº DE CITOLOGÍAS': '5',
          'Nº DE INMUNOS': '0',
          'DEUDA ANTERIOR': '0',
          'SALDO A FAVOR': '0',
          'Confirmado': 'Confirmado',
          'NUMERO DOCUMENTO': '',
          'FECHA FACTURA': '',
          'MONTO CANCELADO': '',
          'FECHA PAGO': '',
          'MODO DE PAGO': '',
        },
      },
    ]);

    const job = {
      data: { runId: 'run-1', tenantId: 'tenant-1', batchId: 'batch-1' },
    } as any;

    await handler.handle(job.data);

    expect(prisma.labLiquidation.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.labLiquidation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          periodLabel: 'Marzo 2026',
          status: 'CONFIRMED',
          totalAmount: 500000,
          legalEntityId: 'le-1',
        }),
      }),
    );
  });
});
