import { Injectable, Logger } from '@nestjs/common';
import { DteEnvironment } from '@prisma/client';
import { SiiCircuitBreakerService } from './sii-circuit-breaker.service';
import { CertificateService } from '../certificate/certificate.service';
import { SII_ENVIRONMENTS } from '../constants/sii-endpoints.constants';
import { DteConfigService } from '../services/dte-config.service';
import { mtlsFetch } from './sii-mtls-fetcher';

/**
 * SII RegistroReclamoDTE actions:
 * - ACD: Acuse de recibo de DTE (acknowledge receipt)
 * - RCD: Reclamar contenido del DTE (claim content issues)
 * - ERM: Reclamo por falta de envio de mercaderias (goods not sent)
 * - RFP: Reclamo por falta parcial de mercaderias (partial goods)
 * - RFT: Reclamo por falta total de mercaderias (no goods at all)
 */
export type ReclamoAction = 'ACD' | 'RCD' | 'ERM' | 'RFP' | 'RFT';

export interface ReclamoResult {
  success: boolean;
  codResp: number;
  descResp: string;
}

export interface DteReclamoStatus {
  tipoDoc: number;
  folio: number;
  actions: Array<{
    action: string;
    date: string;
    responsible: string;
  }>;
}

const RECLAMO_ACTIONS: Record<ReclamoAction, string> = {
  ACD: 'Acuse de Recibo',
  RCD: 'Reclamo al Contenido del Documento',
  ERM: 'Reclamo por Falta de Envio de Mercaderias',
  RFP: 'Reclamo por Falta Parcial de Mercaderias',
  RFT: 'Reclamo por Falta Total de Mercaderias',
};

/**
 * Wraps the SII RegistroReclamoDTE SOAP web service.
 *
 * Allows companies to formally accept, reject, or claim DTEs via SII
 * as part of the DTE exchange protocol.
 *
 * Uses mTLS with the tenant's digital certificate for authentication.
 */
@Injectable()
export class SiiReclamoService {
  private readonly logger = new Logger(SiiReclamoService.name);

  constructor(
    private readonly circuitBreaker: SiiCircuitBreakerService,
    private readonly certificateService: CertificateService,
    private readonly configService: DteConfigService,
  ) {}

  /**
   * Registers a reclamo (claim/acceptance) action for a DTE in the SII.
   *
   * @param tenantId - Tenant performing the action
   * @param emisorRut - RUT of the DTE emisor (format: "76123456-7")
   * @param tipoDte - SII document type code (e.g. 33, 34, 56, 61)
   * @param folio - Document folio number
   * @param action - The reclamo action to register
   * @returns Result with success status, response code, and description
   */
  async registrarReclamo(
    tenantId: string,
    emisorRut: string,
    tipoDte: number,
    folio: number,
    action: ReclamoAction,
  ): Promise<ReclamoResult> {
    const cert = await this.certificateService.getPrimaryCert(tenantId);
    const environment = await this.resolveEnvironment(tenantId);
    const url = this.getEndpointUrl(environment);
    const rutSanitized = sanitizeRut(emisorRut);

    this.logger.log(
      `Registering reclamo ${action} (${RECLAMO_ACTIONS[action]}) for DTE tipo=${tipoDte} folio=${folio} emisor=${rutSanitized}`,
    );

    const soapBody = buildRegistrarReclamoSoapEnvelope(
      rutSanitized,
      tipoDte,
      folio,
      action,
    );

    const result = await this.circuitBreaker.execute(async () => {
      const response = await mtlsFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: '',
        },
        body: soapBody,
        cert,
      });

      if (!response.ok) {
        throw new Error(
          `SII reclamo request failed with HTTP ${response.status}: ${response.statusText}`,
        );
      }

      return response.text();
    });

    return parseRegistrarReclamoResponse(result);
  }

  /**
   * Queries the current reclamo/acceptance status of a DTE in the SII.
   *
   * @param tenantId - Tenant performing the query
   * @param emisorRut - RUT of the DTE emisor (format: "76123456-7")
   * @param tipoDte - SII document type code
   * @param folio - Document folio number
   * @returns Current status with all registered actions
   */
  async consultarEstado(
    tenantId: string,
    emisorRut: string,
    tipoDte: number,
    folio: number,
  ): Promise<DteReclamoStatus> {
    const cert = await this.certificateService.getPrimaryCert(tenantId);
    const environment = await this.resolveEnvironment(tenantId);
    const url = this.getEndpointUrl(environment);
    const rutSanitized = sanitizeRut(emisorRut);

    this.logger.log(
      `Querying reclamo status for DTE tipo=${tipoDte} folio=${folio} emisor=${rutSanitized}`,
    );

    const soapBody = buildConsultarEstadoSoapEnvelope(
      rutSanitized,
      tipoDte,
      folio,
    );

    const result = await this.circuitBreaker.execute(async () => {
      const response = await mtlsFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: '',
        },
        body: soapBody,
        cert,
      });

      if (!response.ok) {
        throw new Error(
          `SII reclamo query failed with HTTP ${response.status}: ${response.statusText}`,
        );
      }

      return response.text();
    });

    return parseConsultarEstadoResponse(result, tipoDte, folio);
  }

  /**
   * Resolves the DTE environment for the tenant from configuration.
   */
  private async resolveEnvironment(
    tenantId: string,
  ): Promise<DteEnvironment> {
    const config = await this.configService.get(tenantId);
    return config.environment;
  }

  /**
   * Returns the RECLAMO endpoint URL based on the environment.
   */
  private getEndpointUrl(environment: DteEnvironment): string {
    const envKey = environment === 'CERTIFICATION' ? 'CERTIFICATION' : 'PRODUCTION';
    return SII_ENVIRONMENTS[envKey].RECLAMO;
  }
}

// ────────────────────────────────────────────────────────────────
// SOAP Envelope Builders
// ────────────────────────────────────────────────────────────────

/**
 * Builds the SOAP envelope for the ingresarAccionDocumento operation.
 */
function buildRegistrarReclamoSoapEnvelope(
  rutEmisor: string,
  tipoDte: number,
  folio: number,
  action: ReclamoAction,
): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.registroreclamodte.diii.sii.cl/">',
    '  <soapenv:Header/>',
    '  <soapenv:Body>',
    '    <ws:ingresarAccionDocumento>',
    `      <rutEmisor>${escapeXml(rutEmisor)}</rutEmisor>`,
    `      <tipoDoc>${escapeXml(String(tipoDte))}</tipoDoc>`,
    `      <folio>${escapeXml(String(folio))}</folio>`,
    `      <accion>${escapeXml(action)}</accion>`,
    '    </ws:ingresarAccionDocumento>',
    '  </soapenv:Body>',
    '</soapenv:Envelope>',
  ].join('\n');
}

/**
 * Builds the SOAP envelope for the consultarDocDteCedworker operation.
 */
function buildConsultarEstadoSoapEnvelope(
  rutEmisor: string,
  tipoDte: number,
  folio: number,
): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.registroreclamodte.diii.sii.cl/">',
    '  <soapenv:Header/>',
    '  <soapenv:Body>',
    '    <ws:consultarDocDteCedible>',
    `      <rutEmisor>${escapeXml(rutEmisor)}</rutEmisor>`,
    `      <tipoDoc>${escapeXml(String(tipoDte))}</tipoDoc>`,
    `      <folio>${escapeXml(String(folio))}</folio>`,
    '    </ws:consultarDocDteCedible>',
    '  </soapenv:Body>',
    '</soapenv:Envelope>',
  ].join('\n');
}

// ────────────────────────────────────────────────────────────────
// SOAP Response Parsers
// ────────────────────────────────────────────────────────────────

/**
 * Parses the SOAP response from ingresarAccionDocumento.
 *
 * Expected response structure contains:
 * - codResp: numeric response code (0 = success)
 * - descResp: textual description of the response
 */
function parseRegistrarReclamoResponse(xml: string): ReclamoResult {
  // Extract codResp from SOAP response
  const codRespMatch = xml.match(/<codResp>(\d+)<\/codResp>/);
  const descRespMatch = xml.match(/<descResp>([^<]*)<\/descResp>/);

  const codResp = codRespMatch ? parseInt(codRespMatch[1], 10) : -1;
  const descResp = descRespMatch
    ? descRespMatch[1]
    : 'Respuesta no reconocida del SII';

  return {
    success: codResp === 0,
    codResp,
    descResp,
  };
}

/**
 * Parses the SOAP response from consultarDocDteCedible.
 *
 * The response contains a list of actions performed on the DTE,
 * each with the action type, date, and responsible RUT.
 */
function parseConsultarEstadoResponse(
  xml: string,
  tipoDte: number,
  folio: number,
): DteReclamoStatus {
  const actions: DteReclamoStatus['actions'] = [];

  // Parse each listaEventosDoc entry from the SOAP response
  const eventRegex =
    /<listaEventosDoc>([\s\S]*?)<\/listaEventosDoc>/g;
  let match: RegExpExecArray | null;

  while ((match = eventRegex.exec(xml)) !== null) {
    const eventXml = match[1];

    const actionMatch = eventXml.match(
      /<codEvento>([^<]*)<\/codEvento>/,
    );
    const dateMatch = eventXml.match(
      /<fechaEvento>([^<]*)<\/fechaEvento>/,
    );
    const responsibleMatch = eventXml.match(
      /<rutResponsable>([^<]*)<\/rutResponsable>/,
    );

    if (actionMatch) {
      actions.push({
        action: actionMatch[1],
        date: dateMatch ? dateMatch[1] : '',
        responsible: responsibleMatch ? responsibleMatch[1] : '',
      });
    }
  }

  return {
    tipoDoc: tipoDte,
    folio,
    actions,
  };
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Escapes special XML characters to prevent XML injection in SOAP envelopes.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Sanitizes a RUT to the format expected by SII: no dots, with dash.
 * Input: "76.123.456-7" or "76123456-7"
 * Output: "76123456-7"
 */
function sanitizeRut(rut: string): string {
  return rut.replace(/\./g, '');
}
