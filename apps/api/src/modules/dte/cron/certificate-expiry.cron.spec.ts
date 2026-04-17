import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CertificateExpiryCron } from './certificate-expiry.cron';
import { PrismaService } from '../../../prisma/prisma.service';

describe('CertificateExpiryCron', () => {
  let cron: CertificateExpiryCron;
  let prisma: any;
  let tenantDb: any;
  let eventEmitter: any;

  const NOW = new Date('2026-04-16T12:00:00.000Z');

  function daysFromNow(n: number): Date {
    return new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    tenantDb = {
      dteCertificate: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    prisma = {
      dteCertificate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      forTenant: jest.fn().mockReturnValue(tenantDb),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CertificateExpiryCron,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    cron = moduleRef.get(CertificateExpiryCron);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does nothing and emits no events when no certificates are expiring', async () => {
    prisma.dteCertificate.findMany.mockResolvedValueOnce([]);

    await cron.checkExpiringCertificates();

    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(tenantDb.dteCertificate.update).not.toHaveBeenCalled();
  });

  it('emits dte.certificate.expired and updates status for certificates past validUntil', async () => {
    const cert = {
      id: 'cert-expired',
      tenantId: 'tenant-1',
      subjectName: 'Empresa Expirada',
      subjectRut: '76111111-1',
      validUntil: daysFromNow(-2),
    };
    prisma.dteCertificate.findMany.mockResolvedValueOnce([cert]);

    await cron.checkExpiringCertificates();

    expect(tenantDb.dteCertificate.update).toHaveBeenCalledWith({
      where: { id: 'cert-expired' },
      data: { status: 'EXPIRED' },
    });
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'dte.certificate.expired',
      expect.objectContaining({
        tenantId: 'tenant-1',
        certificateId: 'cert-expired',
        subjectRut: '76111111-1',
      }),
    );
  });

  it('emits dte.certificate.expiring-critical when validUntil is within 7 days', async () => {
    const cert = {
      id: 'cert-critical',
      tenantId: 'tenant-2',
      subjectName: 'Empresa Crítica',
      subjectRut: '76222222-2',
      validUntil: daysFromNow(3),
    };
    prisma.dteCertificate.findMany.mockResolvedValueOnce([cert]);

    await cron.checkExpiringCertificates();

    expect(tenantDb.dteCertificate.update).not.toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'dte.certificate.expiring-critical',
      expect.objectContaining({
        certificateId: 'cert-critical',
        daysRemaining: 3,
      }),
    );
  });

  it('emits dte.certificate.expiring-soon when validUntil is within 30 days (but >7)', async () => {
    const cert = {
      id: 'cert-warning',
      tenantId: 'tenant-3',
      subjectName: 'Empresa Warning',
      subjectRut: '76333333-3',
      validUntil: daysFromNow(20),
    };
    prisma.dteCertificate.findMany.mockResolvedValueOnce([cert]);

    await cron.checkExpiringCertificates();

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'dte.certificate.expiring-soon',
      expect.objectContaining({
        certificateId: 'cert-warning',
        daysRemaining: 20,
      }),
    );
  });

  it('emits only ONE event per certificate — the most urgent applicable bucket', async () => {
    const expired = {
      id: 'c1',
      tenantId: 'tenant-a',
      subjectName: 'Exp',
      subjectRut: '1',
      validUntil: daysFromNow(-5),
    };
    const critical = {
      id: 'c2',
      tenantId: 'tenant-a',
      subjectName: 'Crit',
      subjectRut: '2',
      validUntil: daysFromNow(5),
    };
    const warning = {
      id: 'c3',
      tenantId: 'tenant-a',
      subjectName: 'Warn',
      subjectRut: '3',
      validUntil: daysFromNow(25),
    };
    prisma.dteCertificate.findMany.mockResolvedValueOnce([
      expired,
      critical,
      warning,
    ]);

    await cron.checkExpiringCertificates();

    // Exactly 3 emit calls — one per certificate, never multiple for the same
    expect(eventEmitter.emit).toHaveBeenCalledTimes(3);

    const events = eventEmitter.emit.mock.calls.map(
      (c: any[]) => `${c[0]}:${c[1].certificateId}`,
    );
    expect(events).toEqual(
      expect.arrayContaining([
        'dte.certificate.expired:c1',
        'dte.certificate.expiring-critical:c2',
        'dte.certificate.expiring-soon:c3',
      ]),
    );
  });

  it('iterates across multiple tenants, using tenant-scoped prisma client for updates', async () => {
    const t1Cert = {
      id: 'cert-t1',
      tenantId: 'tenant-1',
      subjectName: 'T1',
      subjectRut: '1',
      validUntil: daysFromNow(-1),
    };
    const t2Cert = {
      id: 'cert-t2',
      tenantId: 'tenant-2',
      subjectName: 'T2',
      subjectRut: '2',
      validUntil: daysFromNow(-1),
    };
    prisma.dteCertificate.findMany.mockResolvedValueOnce([t1Cert, t2Cert]);

    await cron.checkExpiringCertificates();

    expect(prisma.forTenant).toHaveBeenCalledWith('tenant-1');
    expect(prisma.forTenant).toHaveBeenCalledWith('tenant-2');
    expect(tenantDb.dteCertificate.update).toHaveBeenCalledTimes(2);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
  });
});
