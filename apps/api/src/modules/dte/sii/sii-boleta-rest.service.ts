import { Injectable, Logger } from '@nestjs/common';
import { Agent, fetch as undiciFetch } from 'undici';
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

export interface RcofSendResult {
  trackId: string;
  timestamp: string;
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

// ─── Token cache ─────────────────────────────────
// SII REST tokens have an observed lifetime of ~60min; we refresh proactively.
const TOKEN_TTL_MS = 55 * 60 * 1000;

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Service for communicating with the SII Boleta REST API.
 *
 * Unlike facturas (which use SOAP/WSDL endpoints), boletas electronicas
 * (tipos 39 and 41) use a REST API at `apicert.sii.cl` / `api.sii.cl`.
 *
 * All requests are rate-limited (600/hour) and protected by the circuit breaker.
 *
 * mTLS: Node's global `fetch` (undici) ignores `https.Agent`. We build an
 * `undici.Agent` with `connect: { key, cert }` and pass it as the `dispatcher`
 * so the client certificate is actually presented to the SII.
 */
@Injectable()
export class SiiBoletaRestService {
  private readonly logger = new Logger(SiiBoletaRestService.name);

  // Per-tenant/env token cache (scope = `${tenantOrRut}:${ambiente}`).
  private readonly tokenCache = new Map<string, CachedToken>();

  constructor(
    private readonly circuitBreaker: SiiCircuitBreakerService,
    private readonly rateLimiter: SiiRateLimiterService,
  ) {}

  /**
   * Build an undici dispatcher that presents the tenant's client certificate
   * for mTLS. Node's global `fetch` ignores the legacy `https.Agent`, so we
   * must use `undici.Agent.connect`.
   */
  private buildMtlsDispatcher(cert: Certificado): Agent {
    return new Agent({
      connect: {
        key: cert.getPrivateKeyPem(),
        cert: cert.getCertificatePem(),
        rejectUnauthorized: true,
      },
    });
  }

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
      return this.fetchFreshToken(cert, ambiente);
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
      const dispatcher = this.buildMtlsDispatcher(cert);

      const response = await undiciFetch(url, {
        method: 'POST',
        body: envelopeXml,
        headers: {
          'Content-Type': 'application/xml',
          Cookie: `TOKEN=${token}`,
        },
        dispatcher,
      });

      const body = await response.text();

      if (!response.ok) {
        throw new Error(
          `SII Boleta REST envio failed with status ${response.status}: ${body}`,
        );
      }

      const trackId = extractTagContent(body, 'TRACKID');
      if (!trackId) {
        throw new Error(`SII response did not contain TRACKID: ${body}`);
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
   * Send an RCOF (Reporte de Consumo de Folios) envelope to the SII Boleta REST API.
   *
   * POST `/rcof/envio` — accepts a signed ConsumoFolios XML for the given date.
   * Returns a trackId for subsequent status checks.
   */
  async sendRcof(
    xml: string,
    cert: Certificado,
    environment: DteEnvironment,
  ): Promise<RcofSendResult> {
    const ambiente = toAmbiente(environment);
    const baseUrl = getBoletaBaseUrl(environment);

    this.logger.log(`Sending RCOF to SII REST API (${ambiente})`);

    await this.rateLimiter.acquire();

    const result = await this.circuitBreaker.execute(async () => {
      const { token } = await this.getTokenInternal(cert, ambiente);

      const url = `${baseUrl}/rcof/envio`;
      const dispatcher = this.buildMtlsDispatcher(cert);

      const response = await undiciFetch(url, {
        method: 'POST',
        body: xml,
        headers: {
          'Content-Type': 'application/xml',
          Cookie: `TOKEN=${token}`,
        },
        dispatcher,
      });

      const body = await response.text();

      if (!response.ok) {
        throw new Error(
          `SII RCOF envio failed with status ${response.status}: ${body}`,
        );
      }

      const trackId =
        extractTagContent(body, 'TRACKID') ||
        extractTagContent(body, 'trackid') ||
        '';

      if (!trackId) {
        throw new Error(`SII RCOF response did not contain TRACKID: ${body}`);
      }

      return { trackId, body };
    });

    this.logger.log(`SII RCOF envio success: trackId=${result.trackId}`);

    return {
      trackId: result.trackId,
      timestamp: new Date().toISOString(),
      raw: { responseXml: result.body },
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
      const dispatcher = this.buildMtlsDispatcher(cert);

      const response = await undiciFetch(url, {
        headers: {
          Cookie: `TOKEN=${token}`,
        },
        dispatcher,
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
      const dispatcher = this.buildMtlsDispatcher(cert);

      const response = await undiciFetch(url, {
        headers: {
          Cookie: `TOKEN=${token}`,
        },
        dispatcher,
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
   * Fetch a fresh token via SiiSession (seed → sign → token) bypassing cache.
   */
  private async fetchFreshToken(
    cert: Certificado,
    ambiente: 'certificacion' | 'produccion',
  ): Promise<string> {
    const session = new SiiSession({ ambiente, certificado: cert });
    return session.getToken('rest');
  }

  /**
   * Internal helper to get a REST token (cached per tenant/env with ~55min TTL)
   * without consuming a rate-limiter token (callers already acquired one).
   */
  private async getTokenInternal(
    cert: Certificado,
    ambiente: 'certificacion' | 'produccion',
  ): Promise<{ token: string }> {
    const scope = `${cert.rut ?? 'unknown'}:${ambiente}`;
    const cached = this.tokenCache.get(scope);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return { token: cached.token };
    }

    const token = await this.fetchFreshToken(cert, ambiente);
    this.tokenCache.set(scope, {
      token,
      expiresAt: now + TOKEN_TTL_MS,
    });
    return { token };
  }
}
