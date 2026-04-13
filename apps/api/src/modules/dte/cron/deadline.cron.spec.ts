import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeadlineCron } from './deadline.cron';
import { PrismaService } from '../../../prisma/prisma.service';

describe('DeadlineCron', () => {
  let cron: DeadlineCron;
  let prisma: any;
  let eventEmitter: any;

  beforeEach(async () => {
    prisma = {
      dte: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      dteExchange: {
        updateMany: jest.fn(),
      },
      dteLog: {
        create: jest.fn(),
      },
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        DeadlineCron,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    cron = module.get(DeadlineCron);
  });

  it('should mark expired DTEs as tacitly accepted', async () => {
    const expiredDte = {
      id: 'dte-expired',
      tenantId: 'tenant-1',
      folio: 100,
      emisorRut: '76123456-7',
    };

    // First call: expired DTEs (tacit acceptance)
    // Second call: approaching deadline (alerts)
    prisma.dte.findMany
      .mockResolvedValueOnce([expiredDte])
      .mockResolvedValueOnce([]);

    // Also mock the update call
    prisma.dte.update = jest.fn();

    await cron.processDeadlines();

    expect(prisma.dte.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dte-expired' },
        data: expect.objectContaining({ status: 'ACCEPTED' }),
      }),
    );

    expect(prisma.dteExchange.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'TACIT_ACCEPTANCE' },
      }),
    );

    expect(prisma.dteLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dteId: 'dte-expired',
          action: 'ACCEPTED',
          message: expect.stringContaining('tácita'),
        }),
      }),
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'dte.received.tacit-acceptance',
      expect.objectContaining({ dteId: 'dte-expired' }),
    );
  });

  it('should send alerts for DTEs approaching deadline', async () => {
    const approachingDte = {
      id: 'dte-approaching',
      tenantId: 'tenant-1',
      folio: 200,
      emisorRut: '76111222-3',
      emisorRazon: 'Proveedor SpA',
      deadlineDate: new Date('2026-04-15'),
      dteType: 'FACTURA_ELECTRONICA',
    };

    // First call: no expired DTEs
    // Second call: approaching deadline
    prisma.dte.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([approachingDte]);

    await cron.processDeadlines();

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'dte.received.deadline-approaching',
      expect.objectContaining({
        dteId: 'dte-approaching',
        folio: 200,
      }),
    );
  });

  it('should do nothing when no expired or approaching DTEs exist', async () => {
    prisma.dte.findMany.mockResolvedValue([]);

    await cron.processDeadlines();

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
