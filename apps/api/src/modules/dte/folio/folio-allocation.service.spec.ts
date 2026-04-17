import { Test } from '@nestjs/testing';
import { FolioAllocationService } from './folio-allocation.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('FolioAllocationService', () => {
  let service: FolioAllocationService;
  let prisma: any;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((fn) =>
        fn({
          $queryRawUnsafe: jest.fn().mockResolvedValue([
            {
              id: 'range-1',
              nextFolio: 100,
              rangeTo: 200,
              alertThreshold: 10,
            },
          ]),
          $executeRawUnsafe: jest.fn(),
        }),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        FolioAllocationService,
        { provide: PrismaService, useValue: prisma },
        EventEmitter2,
      ],
    }).compile();

    service = module.get(FolioAllocationService);
    eventEmitter = module.get(EventEmitter2);
    jest.spyOn(eventEmitter, 'emit');
  });

  it('should allocate next folio', async () => {
    const result = await service.allocate(
      'tenant-1',
      'FACTURA_ELECTRONICA',
      'CERTIFICATION',
    );
    expect(result.folio).toBe(100);
    expect(result.folioRangeId).toBe('range-1');
  });

  it('should throw when no folios available', async () => {
    prisma.$transaction = jest.fn((fn) =>
      fn({
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
        $executeRawUnsafe: jest.fn(),
      }),
    );

    await expect(
      service.allocate('tenant-1', 'FACTURA_ELECTRONICA', 'CERTIFICATION'),
    ).rejects.toThrow('No hay folios disponibles');
  });

  it('should emit low_stock event when remaining <= threshold', async () => {
    prisma.$transaction = jest.fn((fn) =>
      fn({
        $queryRawUnsafe: jest.fn().mockResolvedValue([
          {
            id: 'range-1',
            nextFolio: 195,
            rangeTo: 200,
            alertThreshold: 10,
          },
        ]),
        $executeRawUnsafe: jest.fn(),
      }),
    );

    await service.allocate(
      'tenant-1',
      'FACTURA_ELECTRONICA',
      'CERTIFICATION',
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'dte.folio.low_stock',
      expect.objectContaining({
        tenantId: 'tenant-1',
        remaining: 5,
      }),
    );
  });

  it('should emit exhausted event when last folio used', async () => {
    prisma.$transaction = jest.fn((fn) =>
      fn({
        $queryRawUnsafe: jest.fn().mockResolvedValue([
          {
            id: 'range-1',
            nextFolio: 200,
            rangeTo: 200,
            alertThreshold: 10,
          },
        ]),
        $executeRawUnsafe: jest.fn(),
      }),
    );

    await service.allocate(
      'tenant-1',
      'FACTURA_ELECTRONICA',
      'CERTIFICATION',
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'dte.folio.exhausted',
      expect.objectContaining({
        tenantId: 'tenant-1',
      }),
    );
  });
});
