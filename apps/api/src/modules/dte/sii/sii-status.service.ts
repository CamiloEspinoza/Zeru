import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnviadorSII, Certificado } from '@devlas/dte-sii';
import { DteEnvironment } from '@prisma/client';
import { SiiCircuitBreakerService } from './sii-circuit-breaker.service';
import { SiiRateLimiterService } from './sii-rate-limiter.service';
import { SiiTimeoutError } from './sii-sender.service';

export interface SiiStatusResult {
  status: string;
  statusGlosa: string;
  accepted: number;
  rejected: number;
  objected: number;
  raw: Record<string, unknown>;
}

const DEFAULT_SII_TIMEOUT_MS = 30_000;

@Injectable()
export class SiiStatusService {
  private readonly logger = new Logger(SiiStatusService.name);

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

  async checkUploadStatus(
    trackId: string,
    emisorRut: string,
    cert: Certificado,
    environment: DteEnvironment,
  ): Promise<SiiStatusResult> {
    // Apply rate limiting to status consultations as well — each
    // consultarEstado call hits the same SII quota as a send.
    await this.rateLimiter.acquire();

    const ambiente =
      environment === 'CERTIFICATION' ? 'certificacion' : 'produccion';

    this.logger.log(`Checking SII status for trackId=${trackId}`);

    const result = await this.circuitBreaker.execute(async () => {
      const enviador = new EnviadorSII({
        certificado: cert,
        rutEmisor: emisorRut,
        ambiente,
      });
      return this.withTimeout(
        enviador.consultarEstado(trackId) as Promise<Record<string, any>>,
        'consultarEstado',
      );
    });

    return {
      status: result.estado || 'UNKNOWN',
      statusGlosa: result.glosa || '',
      accepted: result.aceptados || 0,
      rejected: result.rechazados || 0,
      objected: result.reparos || 0,
      raw: result,
    };
  }
}
