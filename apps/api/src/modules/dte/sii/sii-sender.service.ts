import { Injectable, Logger } from '@nestjs/common';
import { EnviadorSII, Certificado } from '@devlas/dte-sii';
import { DteEnvironment } from '@prisma/client';
import { SiiCircuitBreakerService } from './sii-circuit-breaker.service';

export interface SiiSendResult {
  trackId: string;
  timestamp: string;
  status: number;
}

@Injectable()
export class SiiSenderService {
  private readonly logger = new Logger(SiiSenderService.name);

  constructor(private readonly circuitBreaker: SiiCircuitBreakerService) {}

  async sendDte(
    envelopeXml: string,
    cert: Certificado,
    environment: DteEnvironment,
  ): Promise<SiiSendResult> {
    const ambiente =
      environment === 'CERTIFICATION' ? 'certificacion' : 'produccion';

    this.logger.log(`Sending DTE envelope to SII (${ambiente})`);

    const result = await this.circuitBreaker.execute(async () => {
      const enviador = new EnviadorSII(cert, ambiente);
      return enviador.enviarDteSoap(envelopeXml);
    });

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
