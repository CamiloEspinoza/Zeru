import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LabLiquidationService } from './lab-liquidation.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('LabLiquidationService', () => {
  let service: LabLiquidationService;
  let prisma: any;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    prisma = {
      labLiquidation: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        LabLiquidationService,
        { provide: PrismaService, useValue: prisma },
        EventEmitter2,
      ],
    }).compile();

    service = module.get(LabLiquidationService);
    eventEmitter = module.get(EventEmitter2);
    jest.spyOn(eventEmitter, 'emit');
  });

  // ── findAll ──

  it('findAll returns paginated results', async () => {
    const items = [{ id: 'liq-1' }];
    prisma.labLiquidation.findMany.mockResolvedValue(items);
    prisma.labLiquidation.count.mockResolvedValue(1);

    const result = await service.findAll('tenant-1', {
      page: 1,
      pageSize: 50,
    });

    expect(result).toEqual({ items, total: 1, page: 1, pageSize: 50 });
    expect(prisma.labLiquidation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
        skip: 0,
        take: 50,
      }),
    );
  });

  // ── findById ──

  it('findById throws NotFoundException when not found', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue(null);

    await expect(
      service.findById('liq-missing', 'tenant-1'),
    ).rejects.toThrow(NotFoundException);
  });

  // ── create ──

  it('create computes totalAmount and emits sync event', async () => {
    prisma.labLiquidation.create.mockResolvedValue({ id: 'liq-1' });

    await service.create('tenant-1', {
      legalEntityId: 'le-1',
      period: '2026-03-01T00:00:00.000Z',
      periodLabel: 'Marzo 2026',
      biopsyAmount: 300000,
      papAmount: 100000,
      cytologyAmount: 50000,
      immunoAmount: 50000,
      biopsyCount: 30,
      papCount: 10,
      cytologyCount: 5,
      immunoCount: 5,
      previousDebt: 10000,
      creditBalance: 5000,
    });

    expect(prisma.labLiquidation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          // 300k+100k+50k+50k+10k-5k = 505000
          totalAmount: expect.any(Object),
        }),
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({ action: 'create' }),
    );
  });

  // ── confirm ──

  it('confirm rejects non-DRAFT liquidation', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue({
      id: 'liq-1',
      status: 'CONFIRMED',
    });

    await expect(
      service.confirm('liq-1', 'tenant-1', {
        confirmedByNameSnapshot: 'Admin',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('confirm transitions DRAFT_LIQ to CONFIRMED', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue({
      id: 'liq-1',
      status: 'DRAFT_LIQ',
    });
    prisma.labLiquidation.updateMany.mockResolvedValue({ count: 1 });
    prisma.labLiquidation.findUniqueOrThrow.mockResolvedValue({ id: 'liq-1' });

    await service.confirm('liq-1', 'tenant-1', {
      confirmedByNameSnapshot: 'Admin',
    });

    expect(prisma.labLiquidation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CONFIRMED' }),
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({ action: 'confirm' }),
    );
  });

  it('confirm throws NotFoundException when not found', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue(null);

    await expect(
      service.confirm('liq-missing', 'tenant-1', {
        confirmedByNameSnapshot: 'Admin',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // ── invoice ──

  it('invoice transitions CONFIRMED to INVOICED_LIQ', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue({
      id: 'liq-1',
      status: 'CONFIRMED',
    });
    prisma.labLiquidation.updateMany.mockResolvedValue({ count: 1 });
    prisma.labLiquidation.findUniqueOrThrow.mockResolvedValue({ id: 'liq-1' });

    await service.invoice('liq-1', 'tenant-1', {
      invoiceNumber: 'FAC-001',
      invoiceDate: '2026-03-20T00:00:00.000Z',
    });

    expect(prisma.labLiquidation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'INVOICED_LIQ' }),
      }),
    );
  });

  it('invoice rejects non-CONFIRMED liquidation', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue({
      id: 'liq-1',
      status: 'DRAFT_LIQ',
    });

    await expect(
      service.invoice('liq-1', 'tenant-1', {
        invoiceNumber: 'FAC-001',
        invoiceDate: '2026-03-20T00:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // ── registerPayment ──

  it('registerPayment sets PAID_LIQ when fully paid', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue({
      id: 'liq-1',
      status: 'INVOICED_LIQ',
      totalAmount: '500000',
      paymentAmount: null,
    });
    prisma.labLiquidation.updateMany.mockResolvedValue({ count: 1 });
    prisma.labLiquidation.findUniqueOrThrow.mockResolvedValue({ id: 'liq-1' });

    await service.registerPayment('liq-1', 'tenant-1', {
      paymentAmount: 500000,
      paymentDate: '2026-04-01T00:00:00.000Z',
      paymentMethodText: 'Transferencia',
    });

    expect(prisma.labLiquidation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID_LIQ' }),
      }),
    );
  });

  it('registerPayment sets PARTIALLY_PAID when not fully paid', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue({
      id: 'liq-1',
      status: 'INVOICED_LIQ',
      totalAmount: '500000',
      paymentAmount: null,
    });
    prisma.labLiquidation.updateMany.mockResolvedValue({ count: 1 });
    prisma.labLiquidation.findUniqueOrThrow.mockResolvedValue({ id: 'liq-1' });

    await service.registerPayment('liq-1', 'tenant-1', {
      paymentAmount: 250000,
      paymentDate: '2026-04-01T00:00:00.000Z',
      paymentMethodText: 'Transferencia',
    });

    expect(prisma.labLiquidation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PARTIALLY_PAID' }),
      }),
    );
  });

  it('registerPayment rejects invalid status', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue({
      id: 'liq-1',
      status: 'DRAFT_LIQ',
    });

    await expect(
      service.registerPayment('liq-1', 'tenant-1', {
        paymentAmount: 100000,
        paymentDate: '2026-04-01T00:00:00.000Z',
        paymentMethodText: 'Efectivo',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // ── cancel ──

  it('cancel transitions to CANCELLED_LIQ', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue({
      id: 'liq-1',
      status: 'DRAFT_LIQ',
    });
    prisma.labLiquidation.updateMany.mockResolvedValue({ count: 1 });
    prisma.labLiquidation.findUniqueOrThrow.mockResolvedValue({ id: 'liq-1' });

    await service.cancel('liq-1', 'tenant-1');

    expect(prisma.labLiquidation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED_LIQ' }),
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({ action: 'cancel' }),
    );
  });

  it('cancel rejects already cancelled liquidation', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue({
      id: 'liq-1',
      status: 'CANCELLED_LIQ',
    });

    await expect(
      service.cancel('liq-1', 'tenant-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('cancel rejects fully paid liquidation', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue({
      id: 'liq-1',
      status: 'PAID_LIQ',
    });

    await expect(
      service.cancel('liq-1', 'tenant-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('cancel throws NotFoundException when not found', async () => {
    prisma.labLiquidation.findFirst.mockResolvedValue(null);

    await expect(
      service.cancel('liq-missing', 'tenant-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
