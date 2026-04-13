import { Injectable, Logger } from '@nestjs/common';
import {
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  retry,
  circuitBreaker,
  wrap,
  BrokenCircuitError,
} from 'cockatiel';

@Injectable()
export class SiiCircuitBreakerService {
  private readonly logger = new Logger(SiiCircuitBreakerService.name);
  private readonly policy;
  private isOpen = false;

  constructor() {
    const retryPolicy = retry(handleAll, {
      maxAttempts: 3,
      backoff: new ExponentialBackoff({
        initialDelay: 1000,
        maxDelay: 30_000,
      }),
    });

    const breakerPolicy = circuitBreaker(handleAll, {
      halfOpenAfter: 30_000,
      breaker: new ConsecutiveBreaker(5),
    });

    breakerPolicy.onStateChange((state) => {
      this.isOpen = state === 'open';
      this.logger.warn(`SII circuit breaker state changed to: ${state}`);
    });

    this.policy = wrap(retryPolicy, breakerPolicy);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.policy.execute(fn);
    } catch (error) {
      if (error instanceof BrokenCircuitError) {
        this.logger.error(
          'SII circuit breaker is OPEN — SII appears to be down',
        );
        throw new Error(
          'SII no disponible. Los documentos se enviarán automáticamente cuando se restablezca la conexión.',
        );
      }
      throw error;
    }
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }
}
