import { Test } from '@nestjs/testing';
import { DteEmissionProcessor } from './dte-emission.processor';
import { PrismaService } from '../../../prisma/prisma.service';
import { DteBuilderService } from '../services/dte-builder.service';
import { DteConfigService } from '../services/dte-config.service';
import { DteStateMachineService } from '../services/dte-state-machine.service';
import { CertificateService } from '../certificate/certificate.service';
import { FolioService } from '../folio/folio.service';
import { SiiSenderService } from '../sii/sii-sender.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getQueueToken } from '@nestjs/bullmq';
import { DTE_STATUS_CHECK_QUEUE } from '../constants/queue.constants';
import { Job } from 'bullmq';

describe('DteEmissionProcessor', () => {
  let processor: DteEmissionProcessor;
  let prisma: any;
  let tenantDb: any;
  let builder: any;
  let configService: any;
  let certService: any;
  let folioService: any;
  let siiSender: any;
  let stateMachine: any;
  let eventEmitter: any;
  let statusQueue: any;

  const tenantId = 'tenant-1';
  const dteId = 'dte-1';
  const jobData = { dteId, tenantId };

  const baseDte = {
    id: dteId,
    dteType: 'FACTURA_ELECTRONICA',
    folio: 100,
    folioRangeId: 'range-1',
    fechaEmision: new Date('2024-06-15'),
    formaPago: 1,
    medioPago: null,
    indServicio: null,
    receptorRut: '77654321-K',
    receptorRazon: 'Cliente Ltda',
    receptorGiro: 'Servicios',
    receptorDir: 'Av Test 456',
    receptorComuna: 'Providencia',
    siiTrackId: null,
    items: [
      {
        itemName: 'Test Service',
        description: null,
        quantity: 1,
        unit: null,
        unitPrice: 100000,
        descuentoMonto: 0,
        indExe: 0,
      },
    ],
    references: [],
  };

  const mockConfig = {
    rut: '76123456-7',
    razonSocial: 'Test SpA',
    giro: 'Servicios',
    actividadEco: 620100,
    direccion: 'Test 123',
    comuna: 'Santiago',
    environment: 'CERTIFICATION',
    resolutionNum: 80,
    resolutionDate: new Date('2014-08-22'),
  };

  const mockCert = { rut: '12345678-9', nombre: 'Test User' };
  const mockCaf = { tipo: 33, rango: { desde: 1, hasta: 200 } };

  beforeEach(async () => {
    tenantDb = {
      dte: {
        findUniqueOrThrow: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      dteLog: { create: jest.fn() },
    };

    prisma = { forTenant: jest.fn().mockReturnValue(tenantDb) };

    builder = {
      build: jest.fn().mockReturnValue({
        xml: '<DTE>signed</DTE>',
        tedXml: '<TED>barcode</TED>',
        montoTotal: 119000,
      }),
      buildEnvelope: jest.fn().mockReturnValue('<EnvioDTE>envelope</EnvioDTE>'),
    };

    configService = { get: jest.fn().mockResolvedValue(mockConfig) };
    certService = { getPrimaryCert: jest.fn().mockResolvedValue(mockCert) };
    folioService = { getDecryptedCaf: jest.fn().mockResolvedValue(mockCaf) };
    siiSender = {
      sendDte: jest.fn().mockResolvedValue({ trackId: 'track-999' }),
    };
    stateMachine = { transition: jest.fn().mockResolvedValue(undefined) };
    eventEmitter = { emit: jest.fn() };
    statusQueue = { add: jest.fn().mockResolvedValue({ id: 'job-status-1' }) };

    const module = await Test.createTestingModule({
      providers: [
        DteEmissionProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: DteBuilderService, useValue: builder },
        { provide: DteConfigService, useValue: configService },
        { provide: CertificateService, useValue: certService },
        { provide: FolioService, useValue: folioService },
        { provide: SiiSenderService, useValue: siiSender },
        { provide: DteStateMachineService, useValue: stateMachine },
        { provide: EventEmitter2, useValue: eventEmitter },
        {
          provide: getQueueToken(DTE_STATUS_CHECK_QUEUE),
          useValue: statusQueue,
        },
      ],
    }).compile();

    processor = module.get(DteEmissionProcessor);
  });

  function makeJob(data = jobData): Job<any> {
    return {
      data,
      attemptsMade: 0,
      opts: { attempts: 5 },
    } as unknown as Job<any>;
  }

  // ─── Idempotency: skip terminal states ─────────────
  it.each(['ACCEPTED', 'REJECTED', 'ACCEPTED_WITH_OBJECTION', 'VOIDED'])(
    'should skip DTE in terminal state %s',
    async (status) => {
      tenantDb.dte.findUniqueOrThrow.mockResolvedValue({
        ...baseDte,
        status,
      });

      await processor.process(makeJob());

      expect(builder.build).not.toHaveBeenCalled();
      expect(siiSender.sendDte).not.toHaveBeenCalled();
      expect(stateMachine.transition).not.toHaveBeenCalled();
    },
  );

  // ─── Phase 1 success: QUEUED → SIGNED ──────────────
  it('should sign a QUEUED DTE (Phase 1) and emit dte.signed event', async () => {
    tenantDb.dte.findUniqueOrThrow
      .mockResolvedValueOnce({ ...baseDte, status: 'QUEUED' }) // initial fetch
      .mockResolvedValueOnce({
        ...baseDte,
        status: 'SIGNED',
        xmlContent: '<DTE>signed</DTE>',
      }); // Phase 2 fetch

    await processor.process(makeJob());

    // Phase 1: build + sign
    expect(builder.build).toHaveBeenCalledWith(
      expect.objectContaining({
        dteType: 'FACTURA_ELECTRONICA',
        folio: 100,
      }),
      mockCaf,
      mockCert,
    );

    // Phase 1: update XML on DTE
    expect(tenantDb.dte.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: dteId },
        data: expect.objectContaining({
          xmlContent: '<DTE>signed</DTE>',
          tedXml: '<TED>barcode</TED>',
          montoTotal: 119000,
        }),
      }),
    );

    // Phase 1: transition QUEUED → SIGNED
    expect(stateMachine.transition).toHaveBeenCalledWith(
      dteId,
      'QUEUED',
      'SIGNED',
      tenantDb,
      'XML generado, timbrado y firmado',
    );

    // Phase 1: emit event
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'dte.signed',
      expect.objectContaining({ tenantId, dteId, folio: 100 }),
    );
  });

  // ─── Phase 2 success: SIGNED → SENT ───────────────
  it('should send a SIGNED DTE to SII (Phase 2) and queue status check', async () => {
    tenantDb.dte.findUniqueOrThrow
      .mockResolvedValueOnce({ ...baseDte, status: 'SIGNED' }) // initial fetch — not QUEUED so Phase 1 skipped
      .mockResolvedValueOnce({
        ...baseDte,
        status: 'SIGNED',
        xmlContent: '<DTE>signed</DTE>',
      }); // Phase 2 re-fetch

    await processor.process(makeJob());

    // Phase 2: build envelope + send
    expect(builder.buildEnvelope).toHaveBeenCalled();
    expect(siiSender.sendDte).toHaveBeenCalledWith(
      '<EnvioDTE>envelope</EnvioDTE>',
      mockCert,
      'CERTIFICATION',
    );

    // Phase 2: update trackId
    expect(tenantDb.dte.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: dteId },
        data: expect.objectContaining({ siiTrackId: 'track-999' }),
      }),
    );

    // Phase 2: transition SIGNED → SENT
    expect(stateMachine.transition).toHaveBeenCalledWith(
      dteId,
      'SIGNED',
      'SENT',
      tenantDb,
      'Enviado al SII, TrackID: track-999',
    );

    // Phase 2: queue status check
    expect(statusQueue.add).toHaveBeenCalledWith(
      'dte.check-status',
      expect.objectContaining({ dteId, tenantId, trackId: 'track-999' }),
      expect.objectContaining({ delay: 30_000, jobId: `status-${dteId}` }),
    );
  });

  // ─── Phase 2 failure: SII down → throw for BullMQ retry ──
  it('should re-throw when SII send fails so BullMQ retries', async () => {
    tenantDb.dte.findUniqueOrThrow
      .mockResolvedValueOnce({ ...baseDte, status: 'SIGNED' })
      .mockResolvedValueOnce({
        ...baseDte,
        status: 'SIGNED',
        xmlContent: '<DTE>signed</DTE>',
      });

    siiSender.sendDte.mockRejectedValue(new Error('SII timeout'));

    await expect(processor.process(makeJob())).rejects.toThrow('SII timeout');

    // Should NOT have transitioned to SENT
    expect(stateMachine.transition).not.toHaveBeenCalledWith(
      dteId,
      'SIGNED',
      'SENT',
      expect.anything(),
      expect.anything(),
    );
  });

  // ─── Orphan recovery: SIGNED with trackId ──────────
  it('should recover SIGNED DTE that already has trackId (orphan)', async () => {
    tenantDb.dte.findUniqueOrThrow.mockResolvedValue({
      ...baseDte,
      status: 'SIGNED',
      siiTrackId: 'orphan-track-42',
    });

    await processor.process(makeJob());

    // Should transition SIGNED → SENT
    expect(stateMachine.transition).toHaveBeenCalledWith(
      dteId,
      'SIGNED',
      'SENT',
      tenantDb,
      'Recovered: resuming from SIGNED with trackId',
    );

    // Should queue status check with existing trackId
    expect(statusQueue.add).toHaveBeenCalledWith(
      'dte.check-status',
      expect.objectContaining({ trackId: 'orphan-track-42' }),
      expect.anything(),
    );

    // Should NOT re-send to SII
    expect(siiSender.sendDte).not.toHaveBeenCalled();
  });

  // ─── onFailed handler ──────────────────────────────
  it('should transition to ERROR when max attempts exhausted on QUEUED DTE', async () => {
    const failedJob = {
      data: jobData,
      attemptsMade: 5,
      opts: { attempts: 5 },
    } as unknown as Job<any>;

    tenantDb.dte.findUnique.mockResolvedValue({
      ...baseDte,
      status: 'QUEUED',
    });

    await processor.onFailed(failedJob, new Error('Build XML failed'));

    expect(stateMachine.transition).toHaveBeenCalledWith(
      dteId,
      'QUEUED',
      'ERROR',
      tenantDb,
      'Error: Build XML failed',
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'dte.failed',
      expect.objectContaining({
        tenantId,
        dteId,
        error: 'Build XML failed',
      }),
    );
  });

  it('should NOT transition to ERROR when DTE is SIGNED (Phase 2 can retry)', async () => {
    const failedJob = {
      data: jobData,
      attemptsMade: 3,
      opts: { attempts: 5 },
    } as unknown as Job<any>;

    tenantDb.dte.findUnique.mockResolvedValue({
      ...baseDte,
      status: 'SIGNED',
    });

    await processor.onFailed(failedJob, new Error('SII unreachable'));

    expect(stateMachine.transition).not.toHaveBeenCalled();
  });
});
