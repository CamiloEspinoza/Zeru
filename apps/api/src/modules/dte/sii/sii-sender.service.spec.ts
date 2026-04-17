import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SiiSenderService, SiiTimeoutError } from './sii-sender.service';
import { SiiCircuitBreakerService } from './sii-circuit-breaker.service';
import { SiiRateLimiterService } from './sii-rate-limiter.service';

// Mock @devlas/dte-sii — the real module pulls in native deps. We only need
// to observe what the service constructs/calls. EnviadorSII is replaced by a
// factory whose instance methods are jest.fn() spies we can control per test.
const enviarMock = jest.fn();
const consultarEstadoMock = jest.fn();

jest.mock('@devlas/dte-sii', () => ({
  EnviadorSII: jest.fn().mockImplementation(() => ({
    enviar: (...args: unknown[]) => enviarMock(...args),
    consultarEstado: (...args: unknown[]) => consultarEstadoMock(...args),
  })),
}));

describe('SiiSenderService', () => {
  let service: SiiSenderService;
  let circuitBreaker: { execute: jest.Mock };
  let rateLimiter: { acquire: jest.Mock };
  let config: { get: jest.Mock };

  const fakeCert = {
    pfx: Buffer.from('fake'),
    password: 'pass',
  } as unknown as Parameters<SiiSenderService['sendDte']>[1];

  beforeEach(async () => {
    jest.clearAllMocks();

    circuitBreaker = {
      // Default: pass-through — just invoke the callback.
      execute: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    };
    rateLimiter = { acquire: jest.fn().mockResolvedValue(undefined) };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'SII_TIMEOUT_MS') return 30_000;
        return undefined;
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SiiSenderService,
        { provide: SiiCircuitBreakerService, useValue: circuitBreaker },
        { provide: SiiRateLimiterService, useValue: rateLimiter },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = moduleRef.get(SiiSenderService);
  });

  it('invokes rateLimiter.acquire() before the SOAP call', async () => {
    enviarMock.mockResolvedValue({ trackId: 'TRK-1', status: 0 });

    const callOrder: string[] = [];
    rateLimiter.acquire.mockImplementation(async () => {
      callOrder.push('acquire');
    });
    enviarMock.mockImplementation(async () => {
      callOrder.push('enviar');
      return { trackId: 'TRK-1', status: 0 };
    });

    await service.sendDte('<xml/>', fakeCert, '12345678-9', 'CERTIFICATION');

    expect(rateLimiter.acquire).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['acquire', 'enviar']);
  });

  it('wraps the SOAP call in circuitBreaker.execute', async () => {
    enviarMock.mockResolvedValue({ trackId: 'TRK-2', status: 0 });

    await service.sendDte('<xml/>', fakeCert, '12345678-9', 'PRODUCTION');

    expect(circuitBreaker.execute).toHaveBeenCalledTimes(1);
    expect(circuitBreaker.execute).toHaveBeenCalledWith(expect.any(Function));
  });

  it('throws SiiTimeoutError when the SOAP call exceeds SII_TIMEOUT_MS', async () => {
    // doNotFake microtask queues so awaited promises still resolve when we
    // advance the mocked timer.
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    config.get.mockReturnValue(1_000);
    // Never resolves — forces the timeout path.
    enviarMock.mockImplementation(() => new Promise(() => {}));

    const promise = service
      .sendDte('<xml/>', fakeCert, '12345678-9', 'CERTIFICATION')
      .catch((e) => e);

    // Let the service reach the setTimeout registration, then fire it.
    await Promise.resolve();
    jest.advanceTimersByTime(1_100);

    const err = await promise;
    expect(err).toBeInstanceOf(SiiTimeoutError);

    jest.useRealTimers();
  });

  it('throws when the SII response is missing trackId', async () => {
    enviarMock.mockResolvedValue({ status: 0 }); // no trackId

    await expect(
      service.sendDte('<xml/>', fakeCert, '12345678-9', 'CERTIFICATION'),
    ).rejects.toThrow('SII response missing trackId');
  });

  it('returns a normalized result on happy path', async () => {
    enviarMock.mockResolvedValue({ trackId: 999, status: 0 });

    const result = await service.sendDte(
      '<xml/>',
      fakeCert,
      '12345678-9',
      'CERTIFICATION',
    );

    expect(result.trackId).toBe('999');
    expect(result.status).toBe(0);
    expect(typeof result.timestamp).toBe('string');
  });
});
