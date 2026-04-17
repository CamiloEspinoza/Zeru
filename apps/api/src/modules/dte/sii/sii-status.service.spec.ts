import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SiiStatusService } from './sii-status.service';
import { SiiCircuitBreakerService } from './sii-circuit-breaker.service';
import { SiiRateLimiterService } from './sii-rate-limiter.service';
import { SiiTimeoutError } from './sii-sender.service';

// Same EnviadorSII mock pattern as the sender spec — we observe consultarEstado.
const consultarEstadoMock = jest.fn();

jest.mock('@devlas/dte-sii', () => ({
  EnviadorSII: jest.fn().mockImplementation(() => ({
    consultarEstado: (...args: unknown[]) => consultarEstadoMock(...args),
  })),
}));

describe('SiiStatusService', () => {
  let service: SiiStatusService;
  let circuitBreaker: { execute: jest.Mock };
  let rateLimiter: { acquire: jest.Mock };
  let config: { get: jest.Mock };

  const fakeCert = {
    pfx: Buffer.from('fake'),
    password: 'pass',
  } as unknown as Parameters<SiiStatusService['checkUploadStatus']>[2];

  beforeEach(async () => {
    jest.clearAllMocks();

    circuitBreaker = {
      execute: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    };
    rateLimiter = { acquire: jest.fn().mockResolvedValue(undefined) };
    config = {
      get: jest.fn((key: string) =>
        key === 'SII_TIMEOUT_MS' ? 30_000 : undefined,
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SiiStatusService,
        { provide: SiiCircuitBreakerService, useValue: circuitBreaker },
        { provide: SiiRateLimiterService, useValue: rateLimiter },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = moduleRef.get(SiiStatusService);
  });

  it('invokes rateLimiter.acquire() before the SOAP call', async () => {
    consultarEstadoMock.mockResolvedValue({ estado: 'EPR' });

    const callOrder: string[] = [];
    rateLimiter.acquire.mockImplementation(async () => {
      callOrder.push('acquire');
    });
    consultarEstadoMock.mockImplementation(async () => {
      callOrder.push('consultar');
      return { estado: 'EPR' };
    });

    await service.checkUploadStatus(
      'TRK-1',
      '12345678-9',
      fakeCert,
      'CERTIFICATION',
    );

    expect(rateLimiter.acquire).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['acquire', 'consultar']);
  });

  it('maps a successful SII response (EPR) into the normalized status shape', async () => {
    consultarEstadoMock.mockResolvedValue({
      estado: 'EPR',
      glosa: 'Envio procesado',
      aceptados: 3,
      rechazados: 0,
      reparos: 0,
    });

    const result = await service.checkUploadStatus(
      'TRK-1',
      '12345678-9',
      fakeCert,
      'CERTIFICATION',
    );

    expect(result.status).toBe('EPR');
    expect(result.statusGlosa).toBe('Envio procesado');
    expect(result.accepted).toBe(3);
    expect(result.rejected).toBe(0);
    expect(result.objected).toBe(0);
    expect(result.raw).toMatchObject({ estado: 'EPR' });
  });

  it('surfaces rejection counts (RCH) from the SII response', async () => {
    consultarEstadoMock.mockResolvedValue({
      estado: 'RCH',
      glosa: 'Rechazado',
      aceptados: 0,
      rechazados: 2,
      reparos: 0,
    });

    const result = await service.checkUploadStatus(
      'TRK-1',
      '12345678-9',
      fakeCert,
      'PRODUCTION',
    );

    expect(result.status).toBe('RCH');
    expect(result.rejected).toBe(2);
    expect(result.accepted).toBe(0);
  });

  it('surfaces objection counts (RSC / accepted-with-objection)', async () => {
    consultarEstadoMock.mockResolvedValue({
      estado: 'RSC',
      glosa: 'Reparos',
      aceptados: 1,
      rechazados: 0,
      reparos: 1,
    });

    const result = await service.checkUploadStatus(
      'TRK-1',
      '12345678-9',
      fakeCert,
      'CERTIFICATION',
    );

    expect(result.status).toBe('RSC');
    expect(result.objected).toBe(1);
    expect(result.accepted).toBe(1);
  });

  it('defaults missing fields to UNKNOWN / 0', async () => {
    consultarEstadoMock.mockResolvedValue({}); // empty payload

    const result = await service.checkUploadStatus(
      'TRK-1',
      '12345678-9',
      fakeCert,
      'CERTIFICATION',
    );

    expect(result.status).toBe('UNKNOWN');
    expect(result.statusGlosa).toBe('');
    expect(result.accepted).toBe(0);
    expect(result.rejected).toBe(0);
    expect(result.objected).toBe(0);
  });

  it('throws SiiTimeoutError when consultarEstado exceeds SII_TIMEOUT_MS', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    config.get.mockReturnValue(1_000);
    consultarEstadoMock.mockImplementation(() => new Promise(() => {}));

    const promise = service
      .checkUploadStatus('TRK-1', '12345678-9', fakeCert, 'CERTIFICATION')
      .catch((e) => e);

    await Promise.resolve();
    jest.advanceTimersByTime(1_100);

    const err = await promise;
    expect(err).toBeInstanceOf(SiiTimeoutError);

    jest.useRealTimers();
  });
});
