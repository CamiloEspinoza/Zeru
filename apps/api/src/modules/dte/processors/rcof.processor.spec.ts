import { Test } from '@nestjs/testing';
import { RcofProcessor } from './rcof.processor';
import { PrismaService } from '../../../prisma/prisma.service';
import { RcofService } from '../services/rcof.service';
import { SiiBoletaRestService } from '../sii/sii-boleta-rest.service';
import { CertificateService } from '../certificate/certificate.service';
import { Job } from 'bullmq';

describe('RcofProcessor', () => {
  let processor: RcofProcessor;
  let prisma: any;
  let tenantDb: any;
  let rcofService: any;
  let siiBoletaRest: any;
  let certService: any;

  const tenantId = 'tenant-1';
  const date = '2026-04-16';
  const environment = 'CERTIFICATION';

  const mockCert = { rut: '12345678-9' };

  beforeEach(async () => {
    tenantDb = {
      dteRcof: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma = { forTenant: jest.fn().mockReturnValue(tenantDb) };

    rcofService = {
      generate: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
    };
    siiBoletaRest = {
      sendRcof: jest.fn(),
    };
    certService = { getPrimaryCert: jest.fn().mockResolvedValue(mockCert) };

    const mod = await Test.createTestingModule({
      providers: [
        RcofProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: RcofService, useValue: rcofService },
        { provide: SiiBoletaRestService, useValue: siiBoletaRest },
        { provide: CertificateService, useValue: certService },
      ],
    }).compile();

    processor = mod.get(RcofProcessor);
  });

  function makeJob(attemptsMade = 0): Job<any> {
    return {
      data: { tenantId, date, environment },
      attemptsMade,
      opts: { attempts: 5 },
    } as unknown as Job<any>;
  }

  it('generates, saves, sends to SII and marks DteRcof as SENT with trackId', async () => {
    rcofService.generate.mockResolvedValue({
      xml: '<ConsumoFolios/>',
      summary: [{ tipoDte: 39, emitidos: 10, anulados: 0 }],
    });
    siiBoletaRest.sendRcof.mockResolvedValue({
      trackId: 'rcof-track-1',
      raw: { ok: true },
    });

    await processor.process(makeJob());

    expect(rcofService.generate).toHaveBeenCalledWith(tenantId, expect.any(Date));
    expect(rcofService.save).toHaveBeenCalledWith(
      tenantId,
      expect.any(Date),
      environment,
      '<ConsumoFolios/>',
      expect.any(Array),
    );

    expect(siiBoletaRest.sendRcof).toHaveBeenCalledWith(
      '<ConsumoFolios/>',
      mockCert,
      environment,
    );

    expect(tenantDb.dteRcof.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, environment }),
        data: expect.objectContaining({
          status: 'SENT',
          siiTrackId: 'rcof-track-1',
        }),
      }),
    );
  });

  it('still sends even when there are no boletas for the day (empty RCOF)', async () => {
    rcofService.generate.mockResolvedValue({
      xml: '<ConsumoFolios empty="1"/>',
      summary: [],
    });
    siiBoletaRest.sendRcof.mockResolvedValue({
      trackId: 'rcof-empty',
      raw: {},
    });

    await processor.process(makeJob());

    expect(rcofService.save).toHaveBeenCalledWith(
      tenantId,
      expect.any(Date),
      environment,
      '<ConsumoFolios empty="1"/>',
      [],
    );
    expect(siiBoletaRest.sendRcof).toHaveBeenCalled();
    expect(tenantDb.dteRcof.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ siiTrackId: 'rcof-empty' }),
      }),
    );
  });

  it('propagates errors when SII send fails (does not mark as SENT)', async () => {
    rcofService.generate.mockResolvedValue({
      xml: '<ConsumoFolios/>',
      summary: [],
    });
    siiBoletaRest.sendRcof.mockRejectedValue(new Error('SII 503'));

    await expect(processor.process(makeJob())).rejects.toThrow('SII 503');

    // save still happened before the SII send
    expect(rcofService.save).toHaveBeenCalled();
    // but no SENT status update
    expect(tenantDb.dteRcof.updateMany).not.toHaveBeenCalled();
  });

  it('onFailed at max attempts marks DteRcof as ERROR', async () => {
    const failedJob = makeJob(5);

    await processor.onFailed(failedJob, new Error('SII down'));

    expect(tenantDb.dteRcof.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, environment }),
        data: { status: 'ERROR' },
      }),
    );
  });

  it('onFailed before max attempts does not mutate DteRcof', async () => {
    const failingJob = makeJob(2);

    await processor.onFailed(failingJob, new Error('transient'));

    expect(tenantDb.dteRcof.updateMany).not.toHaveBeenCalled();
  });
});
