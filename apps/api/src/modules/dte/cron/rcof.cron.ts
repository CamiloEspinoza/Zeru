import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { RcofService } from '../services/rcof.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Daily RCOF (Reporte de Consumo de Folios) cron.
 *
 * Runs at 23:00 CLT every day.
 * Generates and persists the RCOF for each tenant that emitted boletas today.
 * Actual sending to SII is handled separately (when SII Boleta REST is wired up).
 */
@Injectable()
export class RcofCron {
  private readonly logger = new Logger(RcofCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rcofService: RcofService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Run at 23:00 CLT (02:00 UTC next day in summer, 03:00 UTC in winter). */
  @Cron('0 3 * * *')
  async generateDailyRcofs() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.logger.log(
      `Starting daily RCOF generation for ${today.toISOString().split('T')[0]}`,
    );

    const db = this.prisma as unknown as PrismaClient;

    // Find all tenants that have DTE config with boleta capability
    const configs = await db.dteConfig.findMany({
      where: { isActive: true },
      select: { tenantId: true, environment: true },
    });

    let generated = 0;
    let skipped = 0;

    for (const config of configs) {
      try {
        const { xml, summary } = await this.rcofService.generate(
          config.tenantId,
          today,
        );

        // Only save if there were boletas
        const totalBoletas = summary.reduce(
          (sum, s) => sum + s.emitidos + s.anulados,
          0,
        );

        if (totalBoletas === 0) {
          skipped++;
          continue;
        }

        await this.rcofService.save(
          config.tenantId,
          today,
          config.environment,
          xml,
          summary,
        );

        this.eventEmitter.emit('dte.rcof.generated', {
          tenantId: config.tenantId,
          date: today.toISOString().split('T')[0],
          boletaCount: totalBoletas,
        });

        generated++;
      } catch (error) {
        this.logger.error(
          `Failed to generate RCOF for tenant ${config.tenantId}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Daily RCOF generation complete: ${generated} generated, ${skipped} skipped (no boletas)`,
    );
  }
}
