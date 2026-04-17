import { Injectable, Logger } from '@nestjs/common';
import { ConsumoFolio } from '@devlas/dte-sii';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient, DteEnvironment } from '@prisma/client';
import { DteConfigService } from './dte-config.service';
import { CertificateService } from '../certificate/certificate.service';
import { DTE_TYPE_TO_SII_CODE } from '../constants/dte-types.constants';

export interface RcofSummaryItem {
  tipoDte: number;
  emitidos: number;
  anulados: number;
  rangoDesde: number;
  rangoHasta: number;
  montoTotal: number;
}

/**
 * Minimal shape of a parsed DTE expected by `@devlas/dte-sii` ConsumoFolio.
 * The library reads these paths when aggregating the RCOF summary.
 */
interface ConsumoFolioDteParsed {
  Encabezado: {
    IdDoc: {
      Folio: number;
      FchEmis: string; // YYYY-MM-DD
    };
    Totales: {
      MntNeto?: number;
      IVA?: number;
      MntExe?: number;
      MntTotal: number;
    };
  };
}

@Injectable()
export class RcofService {
  private readonly logger = new Logger(RcofService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: DteConfigService,
    private readonly certService: CertificateService,
  ) {}

  /**
   * Generate the RCOF (Reporte de Consumo de Folios) for a given date and tenant.
   *
   * The RCOF is mandatory for every day that boletas are emitted.
   * It must be sent to the SII before 23:59 of that day.
   */
  async generate(
    tenantId: string,
    date: Date,
    secEnvio = 1,
  ): Promise<{ xml: string; summary: RcofSummaryItem[] }> {
    const config = await this.configService.get(tenantId);
    const cert = await this.certService.getPrimaryCert(tenantId);
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all boletas (39, 41) emitted on this date
    const boletas = await db.dte.findMany({
      where: {
        direction: 'EMITTED',
        dteType: { in: ['BOLETA_ELECTRONICA', 'BOLETA_EXENTA_ELECTRONICA'] },
        fechaEmision: { gte: startOfDay, lte: endOfDay },
        status: {
          in: [
            'SIGNED',
            'SENT',
            'ACCEPTED',
            'ACCEPTED_WITH_OBJECTION',
            'VOIDED',
          ],
        },
      },
      orderBy: { folio: 'asc' },
    });

    // Released folios: DTEs that reached terminal ERROR and whose folio
    // must be reported to the SII as `FoliosAnulados` in this RCOF so the
    // folio range stays consistent. We include every un-reported release
    // with `fechaEmision` up to the end of the reporting day.
    const releasedBoletas = await db.dte.findMany({
      where: {
        direction: 'EMITTED',
        dteType: { in: ['BOLETA_ELECTRONICA', 'BOLETA_EXENTA_ELECTRONICA'] },
        folioReleased: true,
        status: 'ERROR',
        fechaEmision: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { folio: 'asc' },
    });

    if (boletas.length === 0 && releasedBoletas.length === 0) {
      this.logger.log(
        `No boletas found for ${date.toISOString().split('T')[0]}, generating empty RCOF`,
      );
    }

    // Group by dteType for summary (include released folios as "anulados")
    const grouped = new Map<string, typeof boletas>();
    for (const b of [...boletas, ...releasedBoletas]) {
      const list = grouped.get(b.dteType) ?? [];
      list.push(b);
      grouped.set(b.dteType, list);
    }

    const summary: RcofSummaryItem[] = [];

    // Correct API: constructor only takes the certificate; carátula is set via setCaratula().
    const rcof = new ConsumoFolio(cert);

    for (const [dteType, dtes] of grouped) {
      const tipoDte = DTE_TYPE_TO_SII_CODE[dteType];
      // Both VOIDED boletas and folios released due to terminal ERROR are
      // reported as "anulados" to the SII (FoliosAnulados in the RCOF).
      const active = dtes.filter(
        (d) => d.status !== 'VOIDED' && d.status !== 'ERROR',
      );
      const voided = dtes.filter(
        (d) => d.status === 'VOIDED' || d.status === 'ERROR',
      );
      const folios = dtes.map((d) => d.folio).sort((a, b) => a - b);

      const item: RcofSummaryItem = {
        tipoDte,
        emitidos: active.length,
        anulados: voided.length,
        rangoDesde: folios[0] ?? 0,
        rangoHasta: folios[folios.length - 1] ?? 0,
        montoTotal: active.reduce((sum, d) => sum + d.montoTotal, 0),
      };

      summary.push(item);

      // Build DTE parsed shape expected by the library:
      // { Encabezado: { IdDoc: { Folio, FchEmis }, Totales: { MntNeto, IVA, MntExe, MntTotal } } }
      for (const dte of dtes) {
        const isExenta = tipoDte === 41;
        const tasa = Number(dte.tasaIva ?? 19) || 19;

        // Prefer authoritative DB values when present; otherwise derive from total.
        let mntNeto = dte.montoNeto ?? 0;
        let iva = dte.iva ?? 0;
        const mntExe = dte.montoExento ?? 0;
        const mntTotal = dte.montoTotal ?? 0;

        if (!isExenta && mntNeto === 0 && iva === 0 && mntTotal > 0) {
          // Derive neto/IVA from total using the DTE's tasa (default 19%).
          mntNeto = Math.round(mntTotal / (1 + tasa / 100));
          iva = mntTotal - mntNeto - mntExe;
          if (iva < 0) iva = 0;
        }

        const parsed: ConsumoFolioDteParsed = {
          Encabezado: {
            IdDoc: {
              Folio: dte.folio,
              FchEmis: dte.fechaEmision.toISOString().slice(0, 10),
            },
            Totales: {
              MntNeto: isExenta ? 0 : mntNeto,
              IVA: isExenta ? 0 : iva,
              MntExe: mntExe,
              MntTotal: mntTotal,
            },
          },
        };

        rcof.agregar(tipoDte, parsed);
      }
    }

    // Carátula requires RutEmisor, RutEnvia, FchResol, NroResol, SecEnvio.
    const fchResol = config.resolutionDate.toISOString().slice(0, 10);
    rcof.setCaratula({
      RutEmisor: config.rut,
      // RutEnvia is the cert holder's RUT (who signs/sends the envelope).
      RutEnvia: cert.rut ?? config.rut,
      FchResol: fchResol,
      NroResol: config.resolutionNum,
      SecEnvio: secEnvio,
    });

    const xml = rcof.generar();

    this.logger.log(
      `Generated RCOF for ${date.toISOString().split('T')[0]}: ${boletas.length} boletas, ${summary.length} type(s)`,
    );

    return { xml, summary };
  }

  /**
   * Persist the RCOF record in the database.
   */
  async save(
    tenantId: string,
    date: Date,
    environment: DteEnvironment,
    xml: string,
    summary: RcofSummaryItem[],
  ) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return db.dteRcof.upsert({
      where: {
        tenantId_date_environment: {
          tenantId,
          date: new Date(date.toISOString().split('T')[0]),
          environment,
        },
      },
      create: {
        tenantId,
        date: new Date(date.toISOString().split('T')[0]),
        environment,
        status: 'GENERATED',
        summary: summary as any,
        xmlContent: xml,
      },
      update: {
        status: 'GENERATED',
        summary: summary as any,
        xmlContent: xml,
      },
    });
  }
}
