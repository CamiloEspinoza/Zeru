import { Test } from '@nestjs/testing';
import { SiiStatusCheckProcessor } from './sii-status-check.processor';
import { PrismaService } from '../../../prisma/prisma.service';
import { DteConfigService } from '../services/dte-config.service';
import { CertificateService } from '../certificate/certificate.service';
import { SiiStatusService } from '../sii/sii-status.service';
import { DteStateMachineService } from '../services/dte-state-machine.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getQueueToken } from '@nestjs/bullmq';
import { DTE_STATUS_CHECK_QUEUE } from '../constants/queue.constants';
import { Job } from 'bullmq';

describe('SiiStatusCheckProcessor', () => {
  let processor: SiiStatusCheckProcessor;
  let prisma: any;
  let tenantDb: any;
  let configService: any;
  let certService: any;
  let siiStatus: any;
  let stateMachine: any;
  let eventEmitter: any;
  let statusQueue: any;

  const tenantId = 'tenant-1';
  const dteId = 'dte-1';
  const trackId = 'track-xyz';

  const mockConfig = { rut: '76123456-7', environment: 'CERTIFICATION' };
  const mockCert = { rut: '12345678-9' };

  const baseDte = {
    id: dteId,
    status: 'SENT',
    folio: 555,
    dteType: 'FACTURA_ELECTRONICA',
  };

  beforeEach(async () => {
    tenantDb = {
      dte: {
        findUniqueOrThrow: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      dteLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = { forTenant: jest.fn().mockReturnValue(tenantDb) };

    configService = { get: jest.fn().mockResolvedValue(mockConfig) };
    certService = { getPrimaryCert: jest.fn().mockResolvedValue(mockCert) };
    siiStatus = { checkUploadStatus: jest.fn() };
    stateMachine = { transition: jest.fn().mockResolvedValue(undefined) };
    eventEmitter = { emit: jest.fn() };
    statusQueue = { add: jest.fn().mockResolvedValue({ id: 'x' }) };

    const mod = await Test.createTestingModule({
      providers: [
        SiiStatusCheckProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: DteConfigService, useValue: configService },
        { provide: CertificateService, useValue: certService },
        { provide: SiiStatusService, useValue: siiStatus },
        { provide: DteStateMachineService, useValue: stateMachine },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: getQueueToken(DTE_STATUS_CHECK_QUEUE), useValue: statusQueue },
      ],
    }).compile();

    processor = mod.get(SiiStatusCheckProcessor);
  });

  function makeJob(data: any = { dteId, tenantId, trackId }): Job<any> {
    return {
      data,
      attemptsMade: 0,
      opts: { attempts: 10 },
    } as unknown as Job<any>;
  }

  it('transitions SENT → ACCEPTED and emits dte.accepted with folio+dteType when SII returns EPR / aceptados', async () => {
    tenantDb.dte.findUniqueOrThrow.mockResolvedValue({ ...baseDte });
    siiStatus.checkUploadStatus.mockResolvedValue({
      status: 'EPR',
      statusGlosa: 'Aceptado',
      accepted: 1,
      rejected: 0,
      objected: 0,
      raw: { raw: true },
    });

    await processor.process(makeJob());

    expect(siiStatus.checkUploadStatus).toHaveBeenCalledWith(
      trackId,
      mockConfig.rut,
      mockCert,
      mockConfig.environment,
    );

    expect(stateMachine.transition).toHaveBeenCalledWith(
      dteId,
      'SENT',
      'ACCEPTED',
      tenantDb,
      'Aceptado',
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'dte.accepted',
      expect.objectContaining({
        tenantId,
        dteId,
        folio: 555,
        dteType: 'FACTURA_ELECTRONICA',
        status: 'ACCEPTED',
      }),
    );

    // no re-queue when terminal
    expect(statusQueue.add).not.toHaveBeenCalled();
  });

  it('re-queues with 60s delay when SII reports a non-terminal state (e.g. SOK/CRT/RFR)', async () => {
    tenantDb.dte.findUniqueOrThrow.mockResolvedValue({ ...baseDte });
    siiStatus.checkUploadStatus.mockResolvedValue({
      status: 'SOK',
      statusGlosa: 'En proceso',
      accepted: 0,
      rejected: 0,
      objected: 0,
      raw: {},
    });

    await processor.process(makeJob({ dteId, tenantId, trackId, recheckCount: 3 }));

    expect(stateMachine.transition).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();

    expect(statusQueue.add).toHaveBeenCalledWith(
      'dte.check-status',
      expect.objectContaining({
        dteId,
        tenantId,
        trackId,
        recheckCount: 4,
      }),
      expect.objectContaining({ delay: 60_000 }),
    );
  });

  it('transitions to ERROR and emits dte.failed when recheckCount reaches 100', async () => {
    tenantDb.dte.findUniqueOrThrow.mockResolvedValue({ ...baseDte });
    siiStatus.checkUploadStatus.mockResolvedValue({
      status: 'SOK',
      statusGlosa: 'En proceso',
      accepted: 0,
      rejected: 0,
      objected: 0,
      raw: {},
    });

    await processor.process(makeJob({ dteId, tenantId, trackId, recheckCount: 100 }));

    expect(statusQueue.add).not.toHaveBeenCalled();
    expect(stateMachine.transition).toHaveBeenCalledWith(
      dteId,
      'SENT',
      'ERROR',
      tenantDb,
      expect.stringContaining('100'),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'dte.failed',
      expect.objectContaining({
        dteId,
        folio: 555,
        dteType: 'FACTURA_ELECTRONICA',
      }),
    );
  });

  it('skips the check entirely when DTE is already in a terminal state', async () => {
    tenantDb.dte.findUniqueOrThrow.mockResolvedValue({
      ...baseDte,
      status: 'ACCEPTED',
    });

    await processor.process(makeJob());

    expect(siiStatus.checkUploadStatus).not.toHaveBeenCalled();
    expect(stateMachine.transition).not.toHaveBeenCalled();
    expect(statusQueue.add).not.toHaveBeenCalled();
  });

  it('emits dte.rejected with enriched payload when SII returns rejected > 0', async () => {
    tenantDb.dte.findUniqueOrThrow.mockResolvedValue({ ...baseDte });
    siiStatus.checkUploadStatus.mockResolvedValue({
      status: 'EPR',
      statusGlosa: 'Rechazado',
      accepted: 0,
      rejected: 1,
      objected: 0,
      raw: {},
    });

    await processor.process(makeJob());

    expect(stateMachine.transition).toHaveBeenCalledWith(
      dteId,
      'SENT',
      'REJECTED',
      tenantDb,
      'Rechazado',
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'dte.rejected',
      expect.objectContaining({
        dteId,
        folio: 555,
        dteType: 'FACTURA_ELECTRONICA',
        status: 'REJECTED',
      }),
    );
  });
});
