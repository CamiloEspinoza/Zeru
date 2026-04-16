import { Injectable, Logger } from '@nestjs/common';
import { EnviadorSII, Certificado } from '@devlas/dte-sii';
import { DteEnvironment } from '@prisma/client';
import { SiiCircuitBreakerService } from './sii-circuit-breaker.service';

export interface SiiStatusResult {
  status: string;
  statusGlosa: string;
  accepted: number;
  rejected: number;
  objected: number;
  raw: Record<string, unknown>;
}

@Injectable()
export class SiiStatusService {
  private readonly logger = new Logger(SiiStatusService.name);

  constructor(private readonly circuitBreaker: SiiCircuitBreakerService) {}

  async checkUploadStatus(
    trackId: string,
    emisorRut: string,
    cert: Certificado,
    environment: DteEnvironment,
  ): Promise<SiiStatusResult> {
    const ambiente =
      environment === 'CERTIFICATION' ? 'certificacion' : 'produccion';

    this.logger.log(`Checking SII status for trackId=${trackId}`);

    const result = await this.circuitBreaker.execute(async () => {
      const enviador = new EnviadorSII({
        certificado: cert,
        rutEmisor: emisorRut,
        ambiente,
      });
      return enviador.consultarEstado(trackId) as Promise<Record<string, any>>;
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
