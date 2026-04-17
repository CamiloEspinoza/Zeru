import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { OrphanRecoveryCron } from './orphan-recovery.cron';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DTE_EMISSION_QUEUE,
  DTE_JOB_NAMES,
} from '../constants/queue.constants';

describe('OrphanRecoveryCron', () => {
  let cron: OrphanRecoveryCron;
  let prisma: any;
  let tenantDb: any;
  let emissionQueue: any;

  const NOW = new Date('2026-04-16T12:00:00.000Z');

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    tenantDb = {
      dteLog: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
      },
    };

    prisma = {
      dte: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      forTenant: jest.fn().mockReturnValue(tenantDb),
    };

    emissionQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrphanRecoveryCron,
        { provide: PrismaService, useValue: prisma },
        {
          provide: getQueueToken(DTE_EMISSION_QUEUE),
          useValue: emissionQueue,
        },
      ],
    }).compile();

    cron = moduleRef.get(OrphanRecoveryCron);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does nothing when there are no orphaned DTEs', async () => {
    prisma.dte.findMany.mockResolvedValueOnce([]);

    await cron.recoverOrphanedDtes();

    expect(prisma.forTenant).not.toHaveBeenCalled();
    expect(emissionQueue.add).not.toHaveBeenCalled();
  });

  it('searches for SIGNED DTEs without trackId that were updated >15 minutes ago', async () => {
    prisma.dte.findMany.mockResolvedValueOnce([]);

    await cron.recoverOrphanedDtes();

    expect(prisma.dte.findMany).toHaveBeenCalledTimes(1);
    const arg = prisma.dte.findMany.mock.calls[0][0];
    expect(arg.where.status).toBe('SIGNED');
    expect(arg.where.siiTrackId).toBeNull();
    expect(arg.where.updatedAt.lt).toBeInstanceOf(Date);
    // 15 minutes before NOW
    const expected = new Date(NOW.getTime() - 15 * 60 * 1000).getTime();
    expect(arg.where.updatedAt.lt.getTime()).toBe(expected);
  });

  it('skips DTEs that have a SII_SEND_ATTEMPTED log within the 5-minute grace period', async () => {
    const orphan = {
      id: 'dte-skip',
      tenantId: 'tenant-1',
      folio: 500,
    };
    prisma.dte.findMany.mockResolvedValueOnce([orphan]);

    // Recent attempt: 2 minutes ago → within the 5-minute grace window
    tenantDb.dteLog.findFirst.mockResolvedValueOnce({
      createdAt: new Date(NOW.getTime() - 2 * 60 * 1000),
    });

    await cron.recoverOrphanedDtes();

    expect(tenantDb.dteLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dteId: 'dte-skip',
          action: 'SENT_TO_SII',
          message: { startsWith: 'SII_SEND_ATTEMPTED' },
        }),
      }),
    );

    // No log entry created, no queue add
    expect(tenantDb.dteLog.create).not.toHaveBeenCalled();
    expect(emissionQueue.add).not.toHaveBeenCalled();
  });

  it('re-queues the emission job and logs when there is no recent send attempt', async () => {
    const orphan = {
      id: 'dte-retry',
      tenantId: 'tenant-1',
      folio: 501,
    };
    prisma.dte.findMany.mockResolvedValueOnce([orphan]);
    tenantDb.dteLog.findFirst.mockResolvedValueOnce(null);

    await cron.recoverOrphanedDtes();

    expect(tenantDb.dteLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dteId: 'dte-retry',
        action: 'QUEUED',
        message: expect.stringContaining('cron'),
      }),
    });

    expect(emissionQueue.add).toHaveBeenCalledTimes(1);
    const [jobName, payload, opts] = emissionQueue.add.mock.calls[0];
    expect(jobName).toBe(DTE_JOB_NAMES.EMIT);
    expect(payload).toEqual({ dteId: 'dte-retry', tenantId: 'tenant-1' });
    expect(opts.jobId).toBe('emit-dte-retry');
  });

  it('re-queues when the last SII_SEND_ATTEMPTED log is OLDER than the 5-min grace period', async () => {
    const orphan = {
      id: 'dte-old-attempt',
      tenantId: 'tenant-1',
      folio: 502,
    };
    prisma.dte.findMany.mockResolvedValueOnce([orphan]);

    // Old attempt: 10 minutes ago → outside grace window → should re-queue
    tenantDb.dteLog.findFirst.mockResolvedValueOnce({
      createdAt: new Date(NOW.getTime() - 10 * 60 * 1000),
    });

    await cron.recoverOrphanedDtes();

    expect(emissionQueue.add).toHaveBeenCalledTimes(1);
    expect(tenantDb.dteLog.create).toHaveBeenCalledTimes(1);
  });

  it('handles orphans from multiple tenants using tenant-scoped prisma clients', async () => {
    const orphans = [
      { id: 'dte-a', tenantId: 'tenant-a', folio: 1 },
      { id: 'dte-b', tenantId: 'tenant-b', folio: 2 },
      { id: 'dte-c', tenantId: 'tenant-a', folio: 3 },
    ];
    prisma.dte.findMany.mockResolvedValueOnce(orphans);
    tenantDb.dteLog.findFirst.mockResolvedValue(null);

    await cron.recoverOrphanedDtes();

    expect(prisma.forTenant).toHaveBeenCalledWith('tenant-a');
    expect(prisma.forTenant).toHaveBeenCalledWith('tenant-b');
    expect(emissionQueue.add).toHaveBeenCalledTimes(3);
    const jobIds = emissionQueue.add.mock.calls.map((c: any[]) => c[2].jobId);
    expect(jobIds).toEqual(
      expect.arrayContaining(['emit-dte-a', 'emit-dte-b', 'emit-dte-c']),
    );
  });

  it('continues processing remaining orphans when re-queue fails for one', async () => {
    const orphans = [
      { id: 'dte-fail', tenantId: 'tenant-1', folio: 10 },
      { id: 'dte-ok', tenantId: 'tenant-1', folio: 11 },
    ];
    prisma.dte.findMany.mockResolvedValueOnce(orphans);
    tenantDb.dteLog.findFirst.mockResolvedValue(null);

    // Queue add fails the first time, succeeds the second
    emissionQueue.add
      .mockRejectedValueOnce(new Error('queue boom'))
      .mockResolvedValueOnce({ id: 'job-ok' });

    // Emit the queue is always used — but DteLog.create happens before add
    await cron.recoverOrphanedDtes();

    expect(tenantDb.dteLog.create).toHaveBeenCalledTimes(2);
    expect(emissionQueue.add).toHaveBeenCalledTimes(2);
  });

  it('uses tenant-scoped prisma client for dteLog writes (tenant isolation)', async () => {
    const orphan = { id: 'dte-iso', tenantId: 'tenant-xyz', folio: 99 };
    prisma.dte.findMany.mockResolvedValueOnce([orphan]);
    tenantDb.dteLog.findFirst.mockResolvedValueOnce(null);

    await cron.recoverOrphanedDtes();

    expect(prisma.forTenant).toHaveBeenCalledWith('tenant-xyz');
    // Ensure dteLog ops went through tenant-scoped client
    expect(tenantDb.dteLog.findFirst).toHaveBeenCalled();
    expect(tenantDb.dteLog.create).toHaveBeenCalled();
  });
});
