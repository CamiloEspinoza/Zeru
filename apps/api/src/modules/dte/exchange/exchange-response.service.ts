import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { Certificado, Signer } from '@devlas/dte-sii';
import { DteConfigService } from '../services/dte-config.service';
import { DTE_TYPE_TO_SII_CODE } from '../constants/dte-types.constants';

/**
 * EstadoRecepDTE codes per SII spec:
 * 0 = Documento recibido conforme
 * 1 = Error de schema del DTE
 * 2 = Error de firma del DTE
 * 3 = RUT receptor no corresponde
 * 99 = Rechazado
 */
export enum EstadoRecepDte {
  OK = 0,
  ERROR_SCHEMA = 1,
  ERROR_FIRMA = 2,
  RUT_NO_CORRESPONDE = 3,
  RECHAZADO = 99,
}

/**
 * EstadoDTE codes per SII spec:
 * 0 = Documento aceptado
 * 2 = Documento rechazado
 */
export enum EstadoDte {
  ACEPTADO = 0,
  RECHAZADO = 2,
}

const RECEP_DTE_GLOSA: Record<EstadoRecepDte, string> = {
  [EstadoRecepDte.OK]: 'Documento Recibido Conforme',
  [EstadoRecepDte.ERROR_SCHEMA]: 'Error de Schema del DTE',
  [EstadoRecepDte.ERROR_FIRMA]: 'Error de Firma del DTE',
  [EstadoRecepDte.RUT_NO_CORRESPONDE]: 'RUT Receptor No Corresponde',
  [EstadoRecepDte.RECHAZADO]: 'Rechazado',
};

const ESTADO_DTE_GLOSA: Record<EstadoDte, string> = {
  [EstadoDte.ACEPTADO]: 'Documento Aceptado',
  [EstadoDte.RECHAZADO]: 'Documento Rechazado',
};

/** Legal text required in EnvioRecibos per Ley 19.983 */
const DECLARACION_RECIBO =
  'El acuse de recibo que se declara en este acto, de acuerdo a lo dispuesto en la letra b) del Art. 4\u00B0, y la letra c) del Art. 5\u00B0 de la Ley 19.983, acredita que la entrega de mercader\u00EDas o servicio(s) prestado(s) ha(n) sido recibido(s).';

/**
 * Generates the 3 types of XML response documents required by SII's
 * DTE exchange protocol (Ley 19.983):
 *
 * 1. RecepcionDTE - Acuse de recibo comercial
 * 2. ResultadoDTE - Resultado de validacion
 * 3. EnvioRecibos - Envelope wrapping receipt confirmations
 *
 * NOTE: XML digital signature is NOT applied here.
 * Signing will be added in a later phase when certificate integration is complete.
 */
@Injectable()
export class ExchangeResponseService {
  private readonly logger = new Logger(ExchangeResponseService.name);

  constructor(
    private readonly configService: DteConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Generates RecepcionDTE XML acknowledging receipt of a DTE.
   *
   * @param tenantId - Tenant performing the reception
   * @param dteId - ID of the received DTE
   * @param estado - Reception status code (default: OK)
   * @returns XML string with RecepcionDTE envelope
   */
  async generateRecepcionDte(
    tenantId: string,
    dteId: string,
    cert: Certificado,
    estado: EstadoRecepDte = EstadoRecepDte.OK,
  ): Promise<string> {
    const { dte, config } = await this.loadDteAndConfig(tenantId, dteId);
    const tipoDte = DTE_TYPE_TO_SII_CODE[dte.dteType];

    this.logger.log(
      `Generating RecepcionDTE for DTE ${dteId} (tipo=${tipoDte}, folio=${dte.folio})`,
    );

    const glosa = RECEP_DTE_GLOSA[estado];
    const fechaEmision = formatDate(dte.fechaEmision);

    const xml = [
      '<?xml version="1.0" encoding="ISO-8859-1"?>',
      '<RespuestaDTE version="1.0">',
      '  <Resultado ID="Recepcion">',
      '    <Caratula version="1.0">',
      `      <RutResponde>${config.rut}</RutResponde>`,
      `      <RutRecibe>${dte.emisorRut}</RutRecibe>`,
      `      <IdRespuesta>1</IdRespuesta>`,
      `      <NroDetalles>1</NroDetalles>`,
      `      <NmbContacto>Sistema DTE</NmbContacto>`,
      `      <FonoContacto/>`,
      `      <MailContacto>${config.exchangeEmail || ''}</MailContacto>`,
      `      <TmstFirmaResp>${formatTimestamp(new Date())}</TmstFirmaResp>`,
      '    </Caratula>',
      '    <RecepcionDTE>',
      '      <DocumentoRecepcion>',
      `        <TipoDTE>${tipoDte}</TipoDTE>`,
      `        <Folio>${dte.folio}</Folio>`,
      `        <FchEmis>${fechaEmision}</FchEmis>`,
      `        <RUTEmisor>${dte.emisorRut}</RUTEmisor>`,
      `        <RUTRecep>${config.rut}</RUTRecep>`,
      `        <MntTotal>${dte.montoTotal}</MntTotal>`,
      `        <EstadoRecepDTE>${estado}</EstadoRecepDTE>`,
      `        <RecepDTEGlosa>${glosa}</RecepDTEGlosa>`,
      '      </DocumentoRecepcion>',
      '    </RecepcionDTE>',
      '  </Resultado>',
      '</RespuestaDTE>',
    ].join('\n');

    const signer = new Signer(cert);
    return signer.firmarDocumento(xml, 'Recepcion');
  }

  /**
   * Generates ResultadoDTE XML with the validation result for a DTE.
   *
   * @param tenantId - Tenant performing the validation
   * @param dteId - ID of the DTE being validated
   * @param accepted - Whether the DTE is accepted (true) or rejected (false)
   * @returns XML string with ResultadoDTE envelope
   */
  async generateResultadoDte(
    tenantId: string,
    dteId: string,
    accepted: boolean,
    cert: Certificado,
  ): Promise<string> {
    const { dte, config } = await this.loadDteAndConfig(tenantId, dteId);
    const tipoDte = DTE_TYPE_TO_SII_CODE[dte.dteType];

    const estado = accepted ? EstadoDte.ACEPTADO : EstadoDte.RECHAZADO;

    this.logger.log(
      `Generating ResultadoDTE for DTE ${dteId} (tipo=${tipoDte}, folio=${dte.folio}, accepted=${accepted})`,
    );

    const glosa = ESTADO_DTE_GLOSA[estado];
    const fechaEmision = formatDate(dte.fechaEmision);

    const xml = [
      '<?xml version="1.0" encoding="ISO-8859-1"?>',
      '<RespuestaDTE version="1.0">',
      '  <Resultado ID="Resultado">',
      '    <Caratula version="1.0">',
      `      <RutResponde>${config.rut}</RutResponde>`,
      `      <RutRecibe>${dte.emisorRut}</RutRecibe>`,
      `      <IdRespuesta>1</IdRespuesta>`,
      `      <NroDetalles>1</NroDetalles>`,
      `      <NmbContacto>Sistema DTE</NmbContacto>`,
      `      <FonoContacto/>`,
      `      <MailContacto>${config.exchangeEmail || ''}</MailContacto>`,
      `      <TmstFirmaResp>${formatTimestamp(new Date())}</TmstFirmaResp>`,
      '    </Caratula>',
      '    <ResultadoDTE>',
      '      <DocumentoResultado>',
      `        <TipoDTE>${tipoDte}</TipoDTE>`,
      `        <Folio>${dte.folio}</Folio>`,
      `        <FchEmis>${fechaEmision}</FchEmis>`,
      `        <RUTEmisor>${dte.emisorRut}</RUTEmisor>`,
      `        <RUTRecep>${config.rut}</RUTRecep>`,
      `        <MntTotal>${dte.montoTotal}</MntTotal>`,
      `        <CodEnvio>1</CodEnvio>`,
      `        <EstadoDTE>${estado}</EstadoDTE>`,
      `        <EstadoDTEGlosa>${glosa}</EstadoDTEGlosa>`,
      '      </DocumentoResultado>',
      '    </ResultadoDTE>',
      '  </Resultado>',
      '</RespuestaDTE>',
    ].join('\n');

    const signer = new Signer(cert);
    return signer.firmarDocumento(xml, 'Resultado');
  }

  /**
   * Generates EnvioRecibos XML wrapping the commercial receipt confirmation.
   * This is the "Acuse de Recibo Comercial" envelope per Ley 19.983.
   *
   * @param tenantId - Tenant issuing the receipt
   * @param dteId - ID of the DTE being receipted
   * @returns XML string with EnvioRecibos envelope
   */
  async generateEnvioRecibos(
    tenantId: string,
    dteId: string,
    cert: Certificado,
  ): Promise<string> {
    const { dte, config } = await this.loadDteAndConfig(tenantId, dteId);
    const tipoDte = DTE_TYPE_TO_SII_CODE[dte.dteType];
    const now = new Date();

    this.logger.log(
      `Generating EnvioRecibos for DTE ${dteId} (tipo=${tipoDte}, folio=${dte.folio})`,
    );

    const fechaEmision = formatDate(dte.fechaEmision);
    const timestamp = formatTimestamp(now);

    const xml = [
      '<?xml version="1.0" encoding="ISO-8859-1"?>',
      '<EnvioRecibos version="1.0">',
      '  <SetRecibos ID="SetRecibos">',
      '    <Caratula version="1.0">',
      `      <RutResponde>${config.rut}</RutResponde>`,
      `      <RutRecibe>${dte.emisorRut}</RutRecibe>`,
      `      <NmbContacto>Sistema DTE</NmbContacto>`,
      `      <TmstFirmaEnv>${timestamp}</TmstFirmaEnv>`,
      '    </Caratula>',
      '    <Recibo>',
      '      <DocumentoRecibo>',
      `        <TipoDoc>${tipoDte}</TipoDoc>`,
      `        <Folio>${dte.folio}</Folio>`,
      `        <FchEmis>${fechaEmision}</FchEmis>`,
      `        <RUTEmisor>${dte.emisorRut}</RUTEmisor>`,
      `        <RUTRecep>${config.rut}</RUTRecep>`,
      `        <MntTotal>${dte.montoTotal}</MntTotal>`,
      `        <Recinto>${config.direccion}</Recinto>`,
      `        <RutFirma>${config.rut}</RutFirma>`,
      `        <Declaracion>${DECLARACION_RECIBO}</Declaracion>`,
      `        <TmstFirmaRecibo>${timestamp}</TmstFirmaRecibo>`,
      '      </DocumentoRecibo>',
      '    </Recibo>',
      '  </SetRecibos>',
      '</EnvioRecibos>',
    ].join('\n');

    const signer = new Signer(cert);
    return signer.firmarSetDTE(xml, 'SetRecibos', 'EnvioRecibos');
  }

  /**
   * Loads the DTE record and tenant DTE config from the database.
   */
  private async loadDteAndConfig(tenantId: string, dteId: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const dte = await db.dte.findUnique({ where: { id: dteId } });
    if (!dte) {
      throw new NotFoundException(`DTE ${dteId} no encontrado`);
    }

    const config = await this.configService.get(tenantId);

    return { dte, config };
  }
}

/** Formats a Date as YYYY-MM-DD */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** Formats a Date as YYYY-MM-DDTHH:mm:ss */
function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, '');
}
