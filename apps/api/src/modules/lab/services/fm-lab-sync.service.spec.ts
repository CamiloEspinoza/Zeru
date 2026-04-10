import { Test } from '@nestjs/testing';
import { FmLabSyncService } from './fm-lab-sync.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import { ExamChargeTransformer } from '../../filemaker/transformers/exam-charge.transformer';
import { LiquidationTransformer } from '../../filemaker/transformers/liquidation.transformer';
import { BiopsyTransformer } from '../../filemaker/transformers/biopsy.transformer';
import { TraceabilityTransformer } from '../../filemaker/transformers/traceability.transformer';

describe('FmLabSyncService', () => {
  let service: FmLabSyncService;
  let prisma: any;
  let fmApi: any;

  beforeEach(async () => {
    prisma = {
      fmSyncRecord: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      fmSyncLog: { create: jest.fn() },
      labExamCharge: { findUniqueOrThrow: jest.fn() },
      labLiquidation: { findUniqueOrThrow: jest.fn() },
      labDiagnosticReport: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
      labExamWorkflowEvent: { findUniqueOrThrow: jest.fn() },
      labDiagnosticReportSigner: { findUniqueOrThrow: jest.fn() },
      labDirectPaymentBatch: { findUnique: jest.fn() },
      labOrigin: { findFirst: jest.fn() },
    };

    fmApi = {
      getRecord: jest.fn(),
      createRecord: jest.fn().mockResolvedValue({ recordId: 'fm-123' }),
      updateRecord: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        FmLabSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: FmApiService, useValue: fmApi },
        ExamChargeTransformer,
        LiquidationTransformer,
        BiopsyTransformer,
        TraceabilityTransformer,
      ],
    }).compile();

    service = module.get(FmLabSyncService);
  });

  it('marks existing FmSyncRecord as PENDING_TO_FM on update event', async () => {
    prisma.fmSyncRecord.findFirst.mockResolvedValue({
      id: 'sync-1',
      entityType: 'lab-exam-charge',
      entityId: 'charge-1',
    });

    await service.handleLabSyncEvent({
      tenantId: 'tenant-1',
      entityType: 'lab-exam-charge',
      entityId: 'charge-1',
      action: 'update',
    });

    expect(prisma.fmSyncRecord.update).toHaveBeenCalledWith({
      where: { id: 'sync-1' },
      data: { syncStatus: 'PENDING_TO_FM', syncError: null },
    });
  });

  it('creates FM record and FmSyncRecord on create event', async () => {
    const mockCharge = {
      id: 'charge-1',
      fmSource: 'BIOPSIAS_INGRESOS',
      fmRecordPk: 1,
      diagnosticReportId: 'dr-1',
      paymentMethod: 'LAB_CASH',
      amount: 25000,
      feeCodesText: null,
      status: 'REGISTERED_CHARGE',
      labOriginCodeSnapshot: 'CLI-001',
      enteredAt: new Date(),
      enteredByNameSnapshot: 'Test User',
      pointOfEntry: null,
      liquidationId: null,
      directPaymentBatchId: null,
    };

    prisma.labExamCharge.findUniqueOrThrow.mockResolvedValue(mockCharge);
    prisma.labDiagnosticReport.findUnique.mockResolvedValue({
      fmInformeNumber: 12345,
    });

    await service.handleLabSyncEvent({
      tenantId: 'tenant-1',
      entityType: 'lab-exam-charge',
      entityId: 'charge-1',
      action: 'create',
    });

    expect(fmApi.createRecord).toHaveBeenCalled();
    expect(prisma.fmSyncRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'lab-exam-charge',
          entityId: 'charge-1',
          syncStatus: 'SYNCED',
        }),
      }),
    );
  });

  it('falls back to create when no FmSyncRecord exists on update', async () => {
    prisma.fmSyncRecord.findFirst.mockResolvedValue(null);

    const mockCharge = {
      id: 'charge-2',
      fmSource: 'BIOPSIAS_INGRESOS',
      fmRecordPk: 2,
      diagnosticReportId: 'dr-2',
      paymentMethod: 'LAB_CASH',
      amount: 10000,
      feeCodesText: null,
      status: 'REGISTERED_CHARGE',
      labOriginCodeSnapshot: 'CLI-002',
      enteredAt: new Date(),
      enteredByNameSnapshot: 'User 2',
      pointOfEntry: null,
      liquidationId: null,
      directPaymentBatchId: null,
    };

    prisma.labExamCharge.findUniqueOrThrow.mockResolvedValue(mockCharge);
    prisma.labDiagnosticReport.findUnique.mockResolvedValue({
      fmInformeNumber: 22222,
    });

    await service.handleLabSyncEvent({
      tenantId: 'tenant-1',
      entityType: 'lab-exam-charge',
      entityId: 'charge-2',
      action: 'update',
    });

    // Should have created in FM since no sync record existed
    expect(fmApi.createRecord).toHaveBeenCalled();
  });

  it('creates error FmSyncRecord when FM creation fails', async () => {
    prisma.labExamCharge.findUniqueOrThrow.mockRejectedValue(
      new Error('Not found'),
    );

    await service.handleLabSyncEvent({
      tenantId: 'tenant-1',
      entityType: 'lab-exam-charge',
      entityId: 'charge-fail',
      action: 'create',
    });

    expect(prisma.fmSyncRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          syncStatus: 'ERROR',
          syncError: expect.stringContaining('[zeru-to-fm]'),
        }),
      }),
    );
  });

  it('creates liquidation in FM', async () => {
    const mockLiq = {
      id: 'liq-1',
      legalEntityId: 'le-1',
      periodLabel: 'Marzo 2026',
      status: 'DRAFT_LIQ',
      totalAmount: 500000,
      biopsyAmount: 300000,
      papAmount: 100000,
      cytologyAmount: 50000,
      immunoAmount: 50000,
      biopsyCount: 30,
      papCount: 10,
      cytologyCount: 5,
      immunoCount: 5,
      previousDebt: 0,
      creditBalance: 0,
    };

    prisma.labLiquidation.findUniqueOrThrow.mockResolvedValue(mockLiq);
    prisma.labOrigin.findFirst.mockResolvedValue({ code: 'CLI-001' });

    await service.handleLabSyncEvent({
      tenantId: 'tenant-1',
      entityType: 'lab-liquidation',
      entityId: 'liq-1',
      action: 'create',
    });

    expect(fmApi.createRecord).toHaveBeenCalledWith(
      'BIOPSIAS',
      'Liquidaciones',
      expect.objectContaining({
        'CODIGO INSTITUCION': 'CLI-001',
        'PERIODO COBRO': 'Marzo 2026',
      }),
    );
  });
});
