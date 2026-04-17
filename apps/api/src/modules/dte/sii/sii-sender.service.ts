import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnviadorSII, EnvioDTE, Certificado } from '@devlas/dte-sii';
import { DteEnvironment } from '@prisma/client';
import { SiiCircuitBreakerService } from './sii-circuit-breaker.service';
import { SiiRateLimiterService } from './sii-rate-limiter.service';

export interface SiiSendResult {
  trackId: string;
  timestamp: string;
  status: number;
}

/**
 * Thrown when a SOAP call to the SII exceeds the configured timeout.
 * The circuit breaker wraps this error so it counts toward the failure
 * threshold and triggers an open state on repeated timeouts.
 */
export class SiiTimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(
      `SII ${operation} timed out after ${timeoutMs}ms`,
    );
    this.name = 'SiiTimeoutError';
  }
}

const DEFAULT_SII_TIMEOUT_MS = 30_000;

@Injectable()
export class SiiSenderService {
  private readonly logger = new Logger(SiiSenderService.name);

  constructor(
    private readonly circuitBreaker: SiiCircuitBreakerService,
    private readonly rateLimiter: SiiRateLimiterService,
    private readonly configService: ConfigService,
  ) {}

  private getTimeoutMs(): number {
    const v = this.configService.get<number | string>('SII_TIMEOUT_MS');
    const parsed = typeof v === 'string' ? parseInt(v, 10) : v;
    return Number.isFinite(parsed) && (parsed as number) > 0
      ? (parsed as number)
      : DEFAULT_SII_TIMEOUT_MS;
  }

  private withTimeout<T>(p: Promise<T>, operation: string): Promise<T> {
    const timeoutMs = this.getTimeoutMs();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new SiiTimeoutError(operation, timeoutMs)),
        timeoutMs,
      );
      p.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  async sendDte(
    envelopeXml: string,
    cert: Certificado,
    emisorRut: string,
    environment: DteEnvironment,
  ): Promise<SiiSendResult> {
    // Enforce the 600 req/hour SII cap BEFORE touching the network.
    // Throws if the sliding window is full; caller's job will retry via BullMQ.
    await this.rateLimiter.acquire();

    const ambiente =
      environment === 'CERTIFICATION' ? 'certificacion' : 'produccion';

    this.logger.log(`Sending DTE envelope to SII (${ambiente})`);

    const result = await this.circuitBreaker.execute(async () => {
      const enviador = new EnviadorSII({
        certificado: cert,
        rutEmisor: emisorRut,
        ambiente,
      });
      return this.withTimeout(
        enviador.enviar(envelopeXml as unknown as EnvioDTE) as Promise<
          Record<string, any>
        >,
        'sendDte',
      );
    });

    // Guard against providers that return an undefined/empty trackId; without
    // this check `String(undefined) === "undefined"` would be persisted.
    if (!result?.trackId) {
      throw new Error('SII response missing trackId');
    }

    this.logger.log(
      `SII response: trackId=${result.trackId}, status=${result.status}`,
    );

    return {
      trackId: String(result.trackId),
      timestamp: new Date().toISOString(),
      status: result.status ?? 0,
    };
  }
}
