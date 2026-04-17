import { Injectable, Logger } from '@nestjs/common';
import {
  DTE,
  CAF,
  Certificado,
  EnvioBOLETA,
  buildEmisorBoleta,
  buildReceptorBoleta,
  type EmisorConfig,
  type ReceptorConfig,
} from '@devlas/dte-sii';
import { DteType } from '@prisma/client';
import { DTE_TYPE_TO_SII_CODE } from '../constants/dte-types.constants';

export interface BoletaBuildInput {
  dteType: DteType;
  folio: number;
  fechaEmision: string;
  indServicio?: number;
  emisor: {
    rut: string;
    razonSocial: string;
    giro: string;
    actividadEco: number;
    direccion: string;
    comuna: string;
    ciudad?: string;
  };
  /** Receptor is optional for boletas (consumidor final). */
  receptor?: {
    rut?: string;
    razonSocial?: string;
    giro?: string;
    direccion?: string;
    comuna?: string;
  };
  items: Array<{
    nombre: string;
    descripcion?: string;
    cantidad: number;
    unidad?: string;
    /** Price including IVA (bruto) for boletas. */
    precioUnitario: number;
    descuento?: number;
    exento?: boolean;
  }>;
}

export interface BoletaBuildResult {
  xml: string;
  tedXml: string;
  montoTotal: number;
}

export interface BoletaEnvelopeConfig {
  emisorRut: string;
  enviaRut: string;
  resolutionDate: string;
  resolutionNum: number;
}

const MAX_BOLETAS_PER_ENVELOPE = 50;

@Injectable()
export class BoletaBuilderService {
  private readonly logger = new Logger(BoletaBuilderService.name);

  /**
   * Build a single boleta XML (tipo 39 or 41).
   *
   * Key differences from factura:
   * - Uses `montoBruto` (IVA included) instead of `montoNeto`
   * - Receptor is optional (consumidor final by default)
   * - Uses boleta-specific emisor/receptor helpers from the library
   */
  build(input: BoletaBuildInput, caf: CAF, cert: Certificado): BoletaBuildResult {
    const tipo = DTE_TYPE_TO_SII_CODE[input.dteType];

    if (tipo !== 39 && tipo !== 41) {
      throw new Error(
        `BoletaBuilderService only supports tipo 39 and 41, got ${tipo}`,
      );
    }

    const emisor = buildEmisorBoleta({
      rut: input.emisor.rut,
      razonSocial: input.emisor.razonSocial,
      giro: input.emisor.giro,
      acteco: input.emisor.actividadEco,
      direccion: input.emisor.direccion,
      comuna: input.emisor.comuna,
      ciudad: input.emisor.ciudad,
    } as EmisorConfig);

    // For boletas the receptor is optional — defaults to consumidor final
    const receptor = buildReceptorBoleta(
      input.receptor
        ? ({
            rut: input.receptor.rut,
            razonSocial: input.receptor.razonSocial,
            giro: input.receptor.giro,
            direccion: input.receptor.direccion,
            comuna: input.receptor.comuna,
          } as Partial<ReceptorConfig>)
        : undefined,
    );

    const dteConfig: any = {
      tipo,
      folio: input.folio,
      fechaEmision: input.fechaEmision,
      indServicio: input.indServicio,
      emisor,
      receptor,
      // Boleta items use bruto pricing (IVA included)
      items: input.items.map((item) => ({
        nombre: item.nombre,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        unidad: item.unidad,
        precio: item.precioUnitario,
        descuentoPct: item.descuento || 0,
        exento: item.exento || false,
      })),
    };

    const dte = new DTE(dteConfig);
    dte.generarXML();
    dte.timbrar(caf);
    dte.firmar(cert);

    const xml = dte.getXML();

    // Extract the TED (Timbre Electronico del DTE) from the signed XML
    const tedMatch = xml.match(/<TED[\s\S]*?<\/TED>/);
    const tedXml = tedMatch ? tedMatch[0] : '';

    this.logger.debug(
      `Built boleta tipo=${tipo} folio=${input.folio} montoTotal=${dte.montoTotal}`,
    );

    return {
      xml,
      tedXml,
      montoTotal: dte.montoTotal,
    };
  }

  /**
   * Wrap boleta XMLs in an `EnvioBOLETA` envelope (max 50 per envelope).
   *
   * Unlike facturas that use `EnvioDTE`, boletas use the `EnvioBOLETA` wrapper
   * which produces the correct XML structure for the SII Boleta REST API.
   */
  buildEnvelope(
    boletaXmls: string[],
    config: BoletaEnvelopeConfig,
    cert: Certificado,
  ): string {
    if (boletaXmls.length === 0) {
      throw new Error('Cannot build envelope with zero boletas');
    }

    if (boletaXmls.length > MAX_BOLETAS_PER_ENVELOPE) {
      throw new Error(
        `Cannot exceed ${MAX_BOLETAS_PER_ENVELOPE} boletas per envelope, got ${boletaXmls.length}`,
      );
    }

    const envio = new EnvioBOLETA({
      rutEmisor: config.emisorRut,
      rutEnvia: config.enviaRut,
      fchResol: config.resolutionDate,
      nroResol: config.resolutionNum,
      certificado: cert,
    });

    for (const xml of boletaXmls) {
      envio.agregar(xml as any);
    }

    this.logger.debug(
      `Built EnvioBOLETA envelope with ${boletaXmls.length} boleta(s)`,
    );

    return envio.generar();
  }
}
