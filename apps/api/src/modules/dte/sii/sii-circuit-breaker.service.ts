import { Injectable, Logger } from '@nestjs/common';
import {
  ConsecutiveBreaker,
  handleAll,
  circuitBreaker,
  BrokenCircuitError,
} from 'cockatiel';

@Injectable()
export class SiiCircuitBreakerService {
  private readonly logger = new Logger(SiiCircuitBreakerService.name);
  private readonly policy;
  private isOpen = false;

  constructor() {
    // Only circuit breaker — no retry layer here.
    // BullMQ handles retries at the job level, so adding retries here
    // would cause double retry stacking (e.g. 3 retries x 5 attempts = 15 calls).
    const breakerPolicy = circuitBreaker(handleAll, {
      halfOpenAfter: 30_000,
      breaker: new ConsecutiveBreaker(5),
    });

    breakerPolicy.onStateChange((state) => {
      this.isOpen = String(state) === 'open';
      this.logger.warn(`SII circuit breaker state changed to: ${String(state)}`);
    });

    this.policy = breakerPolicy;
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
