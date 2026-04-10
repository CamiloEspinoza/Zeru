import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';
import { LabDirectPaymentBatchService } from './lab-direct-payment-batch.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('LabDirectPaymentBatchService', () => {
  let service: LabDirectPaymentBatchService;
  let prisma: any;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    prisma = {
      labDirectPaymentBatch: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      labExamCharge: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: null },
          _count: 0,
        }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        LabDirectPaymentBatchService,
        { provide: PrismaService, useValue: prisma },
        EventEmitter2,
      ],
    }).compile();

    service = module.get(LabDirectPaymentBatchService);
    eventEmitter = module.get(EventEmitter2);
    jest.spyOn(eventEmitter, 'emit');
  });

  it('create emits fm.lab.sync event', async () => {
    prisma.labDirectPaymentBatch.create.mockResolvedValue({ id: 'dpb-1' });

    await service.create('tenant-1', {
      period: '2026-03-01T00:00:00.000Z',
      rendicionType: 'BIOPSY_DIRECT',
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({
        entityType: 'lab-direct-payment-batch',
        action: 'create',
      }),
    );
  });

  it('close rejects non-OPEN batch', async () => {
    prisma.labDirectPaymentBatch.findFirst.mockResolvedValue({
      id: 'dpb-1',
      status: 'RENDIDA',
    });

    await expect(
      service.close('dpb-1', 'tenant-1', {}),
    ).rejects.toThrow(BadRequestException);
  });
});
