import { Test } from '@nestjs/testing';
import { BulkBoletaProcessor } from './bulk-boleta.processor';
import { PrismaService } from '../../../prisma/prisma.service';
import { BoletaBuilderService } from '../services/boleta-builder.service';
import { DteConfigService } from '../services/dte-config.service';
import { CertificateService } from '../certificate/certificate.service';
import { SiiBoletaRestService } from '../sii/sii-boleta-rest.service';
import { DteStateMachineService } from '../services/dte-state-machine.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getQueueToken } from '@nestjs/bullmq';
import { DTE_STATUS_CHECK_QUEUE } from '../constants/queue.constants';
import { Job } from 'bullmq';

describe('BulkBoletaProcessor', () => {
  let processor: BulkBoletaProcessor;
  let prisma: any;
  let tenantDb: any;
  let boletaBuilder: any;
  let configService: any;
  let certService: any;
  let siiBoletaRest: any;
  let stateMachine: any;
  let eventEmitter: any;
  let statusQueue: any;

  const tenantId = 'tenant-1';

  const mockConfig = {
    rut: '76123456-7',
    razonSocial: 'Test SpA',
    environment: 'CERTIFICATION',
    resolutionNum: 0,
    resolutionDate: new Date('2020-01-01'),
  };
  const mockCert = { rut: '12345678-9', nombre: 'Test User' };

  const signedBoleta = (id: string, folio: number) => ({
    id,
    status: 'SIGNED',
    folio,
    dteType: 'BOLETA_ELECTRONICA',
    xmlContent: `<DTE>${id}</DTE>`,
  });

  beforeEach(async () => {
    tenantDb = {
      dte: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    prisma = { forTenant: jest.fn().mockReturnValue(tenantDb) };

    boletaBuilder = {
      buildEnvelope: jest.fn().mockReturnValue('<EnvioBOLETA/>'),
    };
    configService = { get: jest.fn().mockResolvedValue(mockConfig) };
    certService = { getPrimaryCert: jest.fn().mockResolvedValue(mockCert) };
    siiBoletaRest = {
      sendBoletas: jest.fn().mockResolvedValue({ trackId: 'bulk-track-42' }),
    };
    stateMachine = { transition: jest.fn().mockResolvedValue(undefined) };
    eventEmitter = { emit: jest.fn() };
    statusQueue = { add: jest.fn().mockResolvedValue({ id: 'sj' }) };

    const mod = await Test.createTestingModule({
      providers: [
        BulkBoletaProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: BoletaBuilderService, useValue: boletaBuilder },
        { provide: DteConfigService, useValue: configService },
        { provide: CertificateService, useValue: certService },
        { provide: SiiBoletaRestService, useValue: siiBoletaRest },
        { provide: DteStateMachineService, useValue: stateMachine },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: getQueueToken(DTE_STATUS_CHECK_QUEUE), useValue: statusQueue },
      ],
    }).compile();

    processor = mod.get(BulkBoletaProcessor);
  });

  function makeJob(dteIds: string[], attemptsMade = 0): Job<any> {
    return {
      data: { tenantId, dteIds },
      attemptsMade,
      opts: { attempts: 3 },
    } as unknown as Job<any>;
  }

  it('builds a single envelope, sends to SII, updates all boletas and queues status checks', async () => {
    tenantDb.dte.findMany.mockResolvedValue([
      signedBoleta('b1', 1),
      signedBoleta('b2', 2),
    ]);

    await processor.process(makeJob(['b1', 'b2']));

    // Single envelope built with both XMLs
    expect(boletaBuilder.buildEnvelope).toHaveBeenCalledTimes(1);
    const [xmls] = boletaBuilder.buildEnvelope.mock.calls[0];
    expect(xmls).toEqual(['<DTE>b1</DTE>', '<DTE>b2</DTE>']);

    // Single SII send
    expect(siiBoletaRest.sendBoletas).toHaveBeenCalledTimes(1);
    expect(siiBoletaRest.sendBoletas).toHaveBeenCalledWith(
      '<EnvioBOLETA/>',
      mockCert,
      'CERTIFICATION',
    );

    // All boletas updated with trackId
    expect(tenantDb.dte.update).toHaveBeenCalledTimes(2);
    expect(tenantDb.dte.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b1' },
        data: expect.objectContaining({ siiTrackId: 'bulk-track-42' }),
      }),
    );

    // State transitions SIGNED → SENT for all
    expect(stateMachine.transition).toHaveBeenCalledWith(
      'b1',
      'SIGNED',
      'SENT',
      tenantDb,
      expect.stringContaining('bulk-track-42'),
    );
    expect(stateMachine.transition).toHaveBeenCalledWith(
      'b2',
      'SIGNED',
      'SENT',
      tenantDb,
      expect.any(String),
    );

    // Status-check enqueued per boleta
    expect(statusQueue.add).toHaveBeenCalledTimes(2);
    expect(statusQueue.add).toHaveBeenCalledWith(
      'dte.check-status',
      expect.objectContaining({ dteId: 'b1', trackId: 'bulk-track-42' }),
      expect.objectContaining({ delay: 30_000, jobId: 'status-b1' }),
    );
  });

  it('skips non-SIGNED boletas and does nothing when batch has no signed items', async () => {
    tenantDb.dte.findMany.mockResolvedValue([
      { id: 'x1', status: 'QUEUED', folio: 10, dteType: 'BOLETA_ELECTRONICA', xmlContent: '<x/>' },
    ]);

    await processor.process(makeJob(['x1']));

    expect(siiBoletaRest.sendBoletas).not.toHaveBeenCalled();
    expect(stateMachine.transition).not.toHaveBeenCalled();
    expect(statusQueue.add).not.toHaveBeenCalled();
  });

  it('throws when batch exceeds MAX_BOLETAS_PER_JOB (50)', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `b${i}`);

    await expect(processor.process(makeJob(ids))).rejects.toThrow(
      /max 50 boletas/,
    );
    expect(tenantDb.dte.findMany).not.toHaveBeenCalled();
  });

  it('onFailed after max attempts marks SIGNED boletas as ERROR and emits dte.failed with folio+dteType', async () => {
    const failedJob = makeJob(['b1', 'b2'], 3);

    tenantDb.dte.findUnique
      .mockResolvedValueOnce({ status: 'SIGNED', folio: 77, dteType: 'BOLETA_ELECTRONICA' })
      .mockResolvedValueOnce({ status: 'SENT', folio: 78, dteType: 'BOLETA_ELECTRONICA' });

    await processor.onFailed(failedJob, new Error('SII 500'));

    // First boleta (SIGNED) transitions to ERROR
    expect(stateMachine.transition).toHaveBeenCalledWith(
      'b1',
      'SIGNED',
      'ERROR',
      tenantDb,
      expect.stringContaining('SII 500'),
    );
    // Second boleta (SENT) is skipped
    expect(stateMachine.transition).not.toHaveBeenCalledWith(
      'b2',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'dte.failed',
      expect.objectContaining({
        tenantId,
        dteId: 'b1',
        folio: 77,
        dteType: 'BOLETA_ELECTRONICA',
        error: 'SII 500',
      }),
    );
  });

  it('onFailed before max attempts does not mutate state', async () => {
    const failingJob = makeJob(['b1'], 1);

    await processor.onFailed(failingJob, new Error('transient'));

    expect(stateMachine.transition).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
