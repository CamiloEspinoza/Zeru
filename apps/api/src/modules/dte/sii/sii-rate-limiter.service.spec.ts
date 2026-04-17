import { Test } from '@nestjs/testing';
import { SiiRateLimiterService } from './sii-rate-limiter.service';

describe('SiiRateLimiterService', () => {
  let service: SiiRateLimiterService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SiiRateLimiterService],
    }).compile();
    service = moduleRef.get(SiiRateLimiterService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves immediately for the first 600 acquires in a sliding window', async () => {
    for (let i = 0; i < 600; i++) {
      await expect(service.acquire()).resolves.toBeUndefined();
    }
    expect(service.getUsedTokens()).toBe(600);
    expect(service.getRemainingTokens()).toBe(0);
  });

  it('rejects the 601st acquire within the same window with a retry hint', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-16T00:00:00Z'));

    for (let i = 0; i < 600; i++) {
      await service.acquire();
    }
    await expect(service.acquire()).rejects.toThrow(
      /Limite de tasa SII alcanzado/,
    );
  });

  it('restores the budget after the sliding window expires (+1h fake timers)', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-16T00:00:00Z'));

    for (let i = 0; i < 600; i++) {
      await service.acquire();
    }
    expect(service.getRemainingTokens()).toBe(0);

    // Advance past the 1-hour window so all timestamps fall out.
    jest.setSystemTime(new Date('2026-04-16T01:00:01Z'));

    expect(service.getRemainingTokens()).toBe(600);
    await expect(service.acquire()).resolves.toBeUndefined();
  });

  it('reports usage via getUsedTokens / getRemainingTokens', async () => {
    await service.acquire();
    await service.acquire();
    await service.acquire();

    expect(service.getUsedTokens()).toBe(3);
    expect(service.getRemainingTokens()).toBe(597);
  });
});
