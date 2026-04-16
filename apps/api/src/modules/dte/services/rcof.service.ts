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
  ): Promise<{ xml: string; summary: RcofSummaryItem[] }> {
    const config = await this.configService.get(tenantId);
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

    if (boletas.length === 0) {
      this.logger.log(
        `No boletas found for ${date.toISOString().split('T')[0]}, generating empty RCOF`,
      );
    }

    // Group by dteType for summary
    const grouped = new Map<string, typeof boletas>();
    for (const b of boletas) {
      const list = grouped.get(b.dteType) ?? [];
      list.push(b);
      grouped.set(b.dteType, list);
    }

    const summary: RcofSummaryItem[] = [];

    const rcof = new ConsumoFolio({
      rutEmisor: config.rut,
      fchResol: config.resolutionDate.toISOString().split('T')[0],
      nroResol: config.resolutionNum,
      fecha: date.toISOString().split('T')[0],
    });

    for (const [dteType, dtes] of grouped) {
      const tipoDte = DTE_TYPE_TO_SII_CODE[dteType];
      const active = dtes.filter((d) => d.status !== 'VOIDED');
      const voided = dtes.filter((d) => d.status === 'VOIDED');
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

      // Add each boleta to the RCOF generator
      for (const dte of dtes) {
        rcof.agregar({
          TipoDTE: tipoDte,
          Folio: dte.folio,
          MntTotal: dte.montoTotal,
          Anulado: dte.status === 'VOIDED' ? 1 : undefined,
        } as any);
      }
    }

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
