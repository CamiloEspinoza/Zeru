import { Injectable } from '@nestjs/common';
import { DTE, CAF, Certificado, EnvioDTE } from '@devlas/dte-sii';
import { DteType } from '@prisma/client';
import { DTE_TYPE_TO_SII_CODE } from '../constants/dte-types.constants';

export interface DteBuildInput {
  dteType: DteType;
  folio: number;
  fechaEmision: string;
  formaPago?: number;
  medioPago?: string;
  indServicio?: number;
  emisor: {
    rut: string;
    razonSocial: string;
    giro: string;
    actividadEco: number;
    direccion: string;
    comuna: string;
  };
  receptor: {
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
    precioUnitario: number;
    descuento?: number;
    exento?: boolean;
  }>;
  referencias?: Array<{
    tipoDocRef: number;
    folioRef: number;
    fechaRef: string;
    codRef?: number;
    razonRef?: string;
  }>;
}

export interface DteBuildResult {
  xml: string;
  tedXml: string;
  montoTotal: number;
}

@Injectable()
export class DteBuilderService {
  build(input: DteBuildInput, caf: CAF, cert: Certificado): DteBuildResult {
    const tipo = DTE_TYPE_TO_SII_CODE[input.dteType];

    const dteConfig: any = {
      tipo,
      folio: input.folio,
      fecha: input.fechaEmision,
      formaPago: input.formaPago,
      emisor: {
        rut: input.emisor.rut,
        razonSocial: input.emisor.razonSocial,
        giro: input.emisor.giro,
        acteco: input.emisor.actividadEco,
        direccion: input.emisor.direccion,
        comuna: input.emisor.comuna,
      },
      receptor: {
        rut: input.receptor.rut || '66666666-6',
        razonSocial: input.receptor.razonSocial || 'Consumidor Final',
        giro: input.receptor.giro,
        direccion: input.receptor.direccion,
        comuna: input.receptor.comuna,
      },
      items: input.items.map((item) => ({
        nombre: item.nombre,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        unidad: item.unidad,
        precioUnit: item.precioUnitario,
        descuento: item.descuento || 0,
        exento: item.exento || false,
      })),
    };

    if (input.referencias?.length) {
      dteConfig.referencias = input.referencias.map((ref) => ({
        tipoDocRef: ref.tipoDocRef,
        folioRef: ref.folioRef,
        fechaRef: ref.fechaRef,
        codRef: ref.codRef,
        razonRef: ref.razonRef,
      }));
    }

    const dte = new DTE(dteConfig);
    dte.generarXML().timbrar(caf).firmar(cert);

    return {
      xml: dte.getXML(),
      tedXml: '',
      montoTotal: dte.getMontoTotal(),
    };
  }

  buildEnvelope(
    dteXmls: string[],
    emisorRut: string,
    enviaRut: string,
    resolutionDate: string,
    resolutionNum: number,
    cert: Certificado,
  ): string {
    const envio = new EnvioDTE({
      rpiEmisor: emisorRut,
      rpiEnvia: enviaRut,
      fchResol: resolutionDate,
      nroResol: resolutionNum,
      certificado: cert,
    });

    for (const xml of dteXmls) {
      envio.agregar(xml);
    }

    return envio.generar();
  }
}
