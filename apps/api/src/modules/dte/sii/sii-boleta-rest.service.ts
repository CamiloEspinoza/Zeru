import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import {
  Certificado,
  SiiSession,
  splitRut,
  extractTagContent,
} from '@devlas/dte-sii';
import { DteEnvironment } from '@prisma/client';
import { SiiCircuitBreakerService } from './sii-circuit-breaker.service';
import { SiiRateLimiterService } from './sii-rate-limiter.service';
import {
  SII_ENVIRONMENTS,
  type SiiEnvironmentKey,
} from '../constants/sii-endpoints.constants';

// ─── Result interfaces ───────────────────────────

export interface BoletaTokenResult {
  token: string;
  timestamp: string;
}

export interface BoletaSendResult {
  trackId: string;
  timestamp: string;
}

export interface BoletaSendStatusResult {
  status: string;
  statusGlosa: string;
  accepted: number;
  rejected: number;
  raw: Record<string, unknown>;
}

export interface BoletaStatusResult {
  status: string;
  statusGlosa: string;
  raw: Record<string, unknown>;
}

// ─── Helpers ─────────────────────────────────────

function toAmbiente(env: DteEnvironment): 'certificacion' | 'produccion' {
  return env === 'CERTIFICATION' ? 'certificacion' : 'produccion';
}

function getBoletaBaseUrl(env: DteEnvironment): string {
  const key: SiiEnvironmentKey =
    env === 'CERTIFICATION' ? 'CERTIFICATION' : 'PRODUCTION';
  return SII_ENVIRONMENTS[key].BOLETA_BASE;
}

/**
 * Service for communicating with the SII Boleta REST API.
 *
 * Unlike facturas (which use SOAP/WSDL endpoints), boletas electronicas
 * (tipos 39 and 41) use a REST API at `apicert.sii.cl` / `api.sii.cl`.
 *
 * All requests are rate-limited (600/hour) and protected by the circuit breaker.
 */
@Injectable()
export class SiiBoletaRestService {
  private readonly logger = new Logger(SiiBoletaRestService.name);

  constructor(
    private readonly circuitBreaker: SiiCircuitBreakerService,
    private readonly rateLimiter: SiiRateLimiterService,
  ) {}

  /**
   * Authenticate with SII via the Boleta REST seed/token flow.
   *
   * 1. GET seed from `/boleta.electronica.semilla`
   * 2. Sign seed with the certificate
   * 3. POST signed seed to `/boleta.electronica.token` to obtain token
   */
  async getToken(
    cert: Certificado,
    environment: DteEnvironment,
  ): Promise<BoletaTokenResult> {
    const ambiente = toAmbiente(environment);

    this.logger.log(`Getting SII Boleta REST token (${ambiente})`);

    await this.rateLimiter.acquire();

    const token = await this.circuitBreaker.execute(async () => {
      const session = new SiiSession({
        ambiente,
        certificado: cert,
      });
      return session.getToken('rest');
    });

    this.logger.log('SII Boleta REST token obtained successfully');

    return {
      token,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Send a boleta envelope to the SII Boleta REST API.
   *
   * POST `/boleta.electronica.envio` — accepts an EnvioBOLETA XML with up to 50 boletas.
   * Returns a trackId for subsequent status checks.
   */
  async sendBoletas(
    envelopeXml: string,
    cert: Certificado,
    environment: DteEnvironment,
  ): Promise<BoletaSendResult> {
    const ambiente = toAmbiente(environment);
    const baseUrl = getBoletaBaseUrl(environment);

    this.logger.log(`Sending boleta envelope to SII REST API (${ambiente})`);

    await this.rateLimiter.acquire();

    const result = await this.circuitBreaker.execute(async () => {
      const { token } = await this.getTokenInternal(cert, ambiente);

      const url = `${baseUrl}/boleta.electronica.envio`;

      const agent = new https.Agent({
        key: cert.getPrivateKeyPEM(),
        cert: cert.getCertificatePEM(),
      });

      const response = await fetch(url, {
        method: 'POST',
        body: envelopeXml,
        headers: {
          'Content-Type': 'application/xml',
          Cookie: `TOKEN=${token}`,
        },
        // @ts-expect-error Node.js fetch supports agent via dispatcher
        dispatcher: agent,
      });

      const body = await response.text();

      if (!response.ok) {
        throw new Error(
          `SII Boleta REST envio failed with status ${response.status}: ${body}`,
        );
      }

      const trackId = extractTagContent(body, 'TRACKID');
      if (!trackId) {
        throw new Error(
          `SII response did not contain TRACKID: ${body}`,
        );
      }

      return trackId;
    });

    this.logger.log(`SII Boleta REST envio success: trackId=${result}`);

    return {
      trackId: result,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check the status of a previously sent boleta envelope.
   *
   * GET `/boleta.electronica.envio/{rut}-{dv}-{trackid}`
   */
  async checkSendStatus(
    trackId: string,
    rut: string,
    cert: Certificado,
    environment: DteEnvironment,
  ): Promise<BoletaSendStatusResult> {
    const ambiente = toAmbiente(environment);
    const baseUrl = getBoletaBaseUrl(environment);
    const { numero, dv } = splitRut(rut);

    this.logger.log(
      `Checking boleta send status: trackId=${trackId} (${ambiente})`,
    );

    await this.rateLimiter.acquire();

    const result = await this.circuitBreaker.execute(async () => {
      const { token } = await this.getTokenInternal(cert, ambiente);

      const url = `${baseUrl}/boleta.electronica.envio/${numero}-${dv}-${trackId}`;

      const agent = new https.Agent({
        key: cert.getPrivateKeyPEM(),
        cert: cert.getCertificatePEM(),
      });

      const response = await fetch(url, {
        headers: {
          Cookie: `TOKEN=${token}`,
        },
        // @ts-expect-error Node.js fetch supports agent via dispatcher
        dispatcher: agent,
      });

      const body = await response.text();

      if (!response.ok) {
        throw new Error(
          `SII Boleta status check failed with status ${response.status}: ${body}`,
        );
      }

      return body;
    });

    // Parse the XML response for status fields
    const estado = extractTagContent(result, 'ESTADO') || 'UNKNOWN';
    const glosa = extractTagContent(result, 'GLOSA') || '';
    const aceptados = parseInt(
      extractTagContent(result, 'ACEPTADOS') || '0',
      10,
    );
    const rechazados = parseInt(
      extractTagContent(result, 'RECHAZADOS') || '0',
      10,
    );

    return {
      status: estado,
      statusGlosa: glosa,
      accepted: aceptados,
      rejected: rechazados,
      raw: { responseXml: result },
    };
  }

  /**
   * Check the status of an individual boleta.
   *
   * GET `/boleta.electronica/{rut}-{dv}-{tipo}-{folio}/estado`
   */
  async checkBoletaStatus(
    rut: string,
    tipo: number,
    folio: number,
    cert: Certificado,
    environment: DteEnvironment,
  ): Promise<BoletaStatusResult> {
    const ambiente = toAmbiente(environment);
    const baseUrl = getBoletaBaseUrl(environment);
    const { numero, dv } = splitRut(rut);

    this.logger.log(
      `Checking boleta status: tipo=${tipo} folio=${folio} (${ambiente})`,
    );

    await this.rateLimiter.acquire();

    const result = await this.circuitBreaker.execute(async () => {
      const { token } = await this.getTokenInternal(cert, ambiente);

      const url = `${baseUrl}/boleta.electronica/${numero}-${dv}-${tipo}-${folio}/estado`;

      const agent = new https.Agent({
        key: cert.getPrivateKeyPEM(),
        cert: cert.getCertificatePEM(),
      });

      const response = await fetch(url, {
        headers: {
          Cookie: `TOKEN=${token}`,
        },
        // @ts-expect-error Node.js fetch supports agent via dispatcher
        dispatcher: agent,
      });

      const body = await response.text();

      if (!response.ok) {
        throw new Error(
          `SII Boleta individual status check failed with status ${response.status}: ${body}`,
        );
      }

      return body;
    });

    const estado = extractTagContent(result, 'ESTADO') || 'UNKNOWN';
    const glosa = extractTagContent(result, 'GLOSA') || '';

    return {
      status: estado,
      statusGlosa: glosa,
      raw: { responseXml: result },
    };
  }

  /**
   * Internal helper to get a REST token without consuming a rate limiter token
   * (since the caller already acquired one for the outer request).
   */
  private async getTokenInternal(
    cert: Certificado,
    ambiente: 'certificacion' | 'produccion',
  ): Promise<{ token: string }> {
    const session = new SiiSession({
      ambiente,
      certificado: cert,
    });
    const token = await session.getToken('rest');
    return { token };
  }
}
