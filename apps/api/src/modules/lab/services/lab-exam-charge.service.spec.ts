import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LabExamChargeService } from './lab-exam-charge.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('LabExamChargeService', () => {
  let service: LabExamChargeService;
  let prisma: any;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    prisma = {
      labExamCharge: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        aggregate: jest.fn().mockResolvedValue({ _min: { fmRecordPk: null } }),
      },
      labDiagnosticReport: { findFirst: jest.fn() },
      labLiquidation: { findFirst: jest.fn() },
      labDirectPaymentBatch: { findFirst: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        LabExamChargeService,
        { provide: PrismaService, useValue: prisma },
        EventEmitter2,
      ],
    }).compile();

    service = module.get(LabExamChargeService);
    eventEmitter = module.get(EventEmitter2);
    jest.spyOn(eventEmitter, 'emit');
  });

  it('create emits fm.lab.sync event', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue({
      id: 'dr-1',
      fmInformeNumber: 100,
    });
    prisma.labExamCharge.create.mockResolvedValue({ id: 'charge-1' });

    await service.create('tenant-1', {
      fmSource: 'BIOPSIAS_INGRESOS',
      diagnosticReportId: 'dr-1',
      paymentMethod: 'CASH',
      amount: 25000,
      labOriginId: 'origin-1',
      labOriginCodeSnapshot: 'CLI-001',
      enteredByNameSnapshot: 'Test User',
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({
        entityType: 'lab-exam-charge',
        action: 'create',
      }),
    );
  });

  it('cancel throws if already cancelled', async () => {
    prisma.labExamCharge.findFirst.mockResolvedValue({
      id: 'charge-1',
      status: 'CANCELLED_CHARGE',
    });

    await expect(
      service.cancel('charge-1', 'tenant-1', {
        cancelReason: 'test',
        cancelledByNameSnapshot: 'Admin',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('findById throws NotFoundException for missing charge', async () => {
    prisma.labExamCharge.findFirst.mockResolvedValue(null);

    await expect(
      service.findById('nonexistent', 'tenant-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('assignToLiquidation emits sync event', async () => {
    prisma.labExamCharge.findFirst.mockResolvedValue({ id: 'charge-1' });
    prisma.labLiquidation.findFirst.mockResolvedValue({ id: 'liq-1' });
    prisma.labExamCharge.updateMany.mockResolvedValue({ count: 1 });
    prisma.labExamCharge.findUniqueOrThrow.mockResolvedValue({ id: 'charge-1' });

    await service.assignToLiquidation('charge-1', 'tenant-1', 'liq-1');

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({
        action: 'update',
        changedFields: ['liquidationId'],
      }),
    );
  });

  it('assignToDirectPaymentBatch emits sync event', async () => {
    prisma.labExamCharge.findFirst.mockResolvedValue({ id: 'charge-1' });
    prisma.labDirectPaymentBatch.findFirst.mockResolvedValue({ id: 'dpb-1' });
    prisma.labExamCharge.updateMany.mockResolvedValue({ count: 1 });
    prisma.labExamCharge.findUniqueOrThrow.mockResolvedValue({ id: 'charge-1' });

    await service.assignToDirectPaymentBatch('charge-1', 'tenant-1', 'dpb-1');

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({
        action: 'update',
        changedFields: ['directPaymentBatchId'],
      }),
    );
  });

  it('update throws if charge not found', async () => {
    prisma.labExamCharge.findFirst.mockResolvedValue(null);

    await expect(
      service.update('nonexistent', 'tenant-1', { amount: 5000 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('update throws BadRequestException for cancelled charge', async () => {
    prisma.labExamCharge.findFirst.mockResolvedValue({
      id: 'charge-1',
      status: 'CANCELLED_CHARGE',
    });

    await expect(
      service.update('charge-1', 'tenant-1', { amount: 5000 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('update emits sync event with changed fields', async () => {
    prisma.labExamCharge.findFirst.mockResolvedValue({
      id: 'charge-1',
      status: 'REGISTERED_CHARGE',
    });
    prisma.labExamCharge.updateMany.mockResolvedValue({ count: 1 });
    prisma.labExamCharge.findUniqueOrThrow.mockResolvedValue({ id: 'charge-1' });

    await service.update('charge-1', 'tenant-1', { amount: 5000, notes: 'updated' });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({
        entityType: 'lab-exam-charge',
        action: 'update',
        changedFields: ['amount', 'notes'],
      }),
    );
  });

  it('cancel emits sync event with cancel action', async () => {
    prisma.labExamCharge.findFirst.mockResolvedValue({
      id: 'charge-1',
      status: 'REGISTERED_CHARGE',
    });
    prisma.labExamCharge.updateMany.mockResolvedValue({ count: 1 });
    prisma.labExamCharge.findUniqueOrThrow.mockResolvedValue({ id: 'charge-1' });

    await service.cancel('charge-1', 'tenant-1', {
      cancelReason: 'duplicate',
      cancelledByNameSnapshot: 'Admin',
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({
        entityType: 'lab-exam-charge',
        entityId: 'charge-1',
        action: 'cancel',
      }),
    );
  });

  it('findAll returns paginated results', async () => {
    const items = [{ id: 'charge-1' }, { id: 'charge-2' }];
    prisma.labExamCharge.findMany.mockResolvedValue(items);
    prisma.labExamCharge.count.mockResolvedValue(2);

    const result = await service.findAll('tenant-1', { page: 1, pageSize: 50 });

    expect(result).toEqual({ items, total: 2, page: 1, pageSize: 50 });
    expect(prisma.labExamCharge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
        skip: 0,
        take: 50,
      }),
    );
  });

  it('create throws BadRequestException if DR not found', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue(null);

    await expect(
      service.create('tenant-1', {
        fmSource: 'BIOPSIAS_INGRESOS',
        diagnosticReportId: 'nonexistent-dr',
        paymentMethod: 'CASH',
        amount: 25000,
        labOriginId: 'origin-1',
        labOriginCodeSnapshot: 'CLI-001',
        enteredByNameSnapshot: 'Test User',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('assignToLiquidation throws if liquidation not found', async () => {
    prisma.labExamCharge.findFirst.mockResolvedValue({ id: 'charge-1' });
    prisma.labLiquidation.findFirst.mockResolvedValue(null);

    await expect(
      service.assignToLiquidation('charge-1', 'tenant-1', 'nonexistent-liq'),
    ).rejects.toThrow(NotFoundException);
  });

  it('assignToDirectPaymentBatch throws if batch not found', async () => {
    prisma.labExamCharge.findFirst.mockResolvedValue({ id: 'charge-1' });
    prisma.labDirectPaymentBatch.findFirst.mockResolvedValue(null);

    await expect(
      service.assignToDirectPaymentBatch('charge-1', 'tenant-1', 'nonexistent-batch'),
    ).rejects.toThrow(NotFoundException);
  });
});
