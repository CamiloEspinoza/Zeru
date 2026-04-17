import { Test } from '@nestjs/testing';
import { SiiCircuitBreakerService } from './sii-circuit-breaker.service';

describe('SiiCircuitBreakerService', () => {
  let service: SiiCircuitBreakerService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SiiCircuitBreakerService],
    }).compile();
    service = moduleRef.get(SiiCircuitBreakerService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const failing = () => Promise.reject(new Error('boom'));

  it('stays closed before the 5-failure threshold', async () => {
    for (let i = 0; i < 4; i++) {
      await expect(service.execute(failing)).rejects.toThrow('boom');
    }

    // After 4 failures (threshold is 5), the circuit is still closed: a
    // subsequent call must still reach the callback.
    const probe = jest.fn().mockResolvedValue('ok');
    await expect(service.execute(probe)).resolves.toBe('ok');
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('opens the circuit after 5 consecutive failures and blocks calls with a user-facing message', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(service.execute(failing)).rejects.toThrow('boom');
    }

    // The next call must NOT invoke the callback and must throw the
    // translated "SII no disponible" message — this is the behavioural
    // signal that the breaker is open.
    const callback = jest.fn(async () => 'should-not-run');
    await expect(service.execute(callback)).rejects.toThrow(/SII no disponible/);
    expect(callback).not.toHaveBeenCalled();
  });

  it('transitions away from Open after the 30s halfOpenAfter window', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });

    // Trip the breaker.
    for (let i = 0; i < 5; i++) {
      await expect(service.execute(failing)).rejects.toThrow('boom');
    }

    // While still Open, calls are rejected without running the callback.
    const blocked = jest.fn();
    await expect(service.execute(blocked)).rejects.toThrow(/SII no disponible/);
    expect(blocked).not.toHaveBeenCalled();

    // Advance past the halfOpenAfter (30s) window.
    jest.advanceTimersByTime(31_000);

    // A successful probe in half-open should now be allowed through and
    // close the circuit again.
    const ok = jest.fn().mockResolvedValue('ok');
    const result = await service.execute(ok);
    expect(result).toBe('ok');
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('returns the value from the callback when the circuit is closed', async () => {
    const value = await service.execute(async () => 42);
    expect(value).toBe(42);
    expect(service.getIsOpen()).toBe(false);
  });

  it('propagates non-BrokenCircuit errors from the callback unchanged', async () => {
    const err = new Error('upstream-5xx');
    await expect(service.execute(() => Promise.reject(err))).rejects.toBe(err);
  });
});
