import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';

/**
 * Daily cron job (08:00) that handles received DTE deadlines:
 *
 * 1. **Tacit acceptance**: DTEs past their 8-business-day deadline
 *    without a decision are marked as tacitly accepted per SII rules.
 *
 * 2. **Deadline alerts**: DTEs expiring within 2 business days trigger
 *    notifications so users can review them in time.
 */
@Injectable()
export class DeadlineCron {
  private readonly logger = new Logger(DeadlineCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('0 8 * * *')
  async processDeadlines() {
    this.logger.log('Running deadline check for received DTEs');

    const db = this.prisma as unknown as PrismaClient;
    const now = new Date();

    // 1. Tacit acceptance: past deadline, no decision made
    const expiredCount = await this.markTacitAcceptance(db, now);

    // 2. Alert: DTEs expiring within 2 business days
    const alertCount = await this.sendDeadlineAlerts(db, now);

    this.logger.log(
      `Deadline check complete: ${expiredCount} tacit acceptance(s), ${alertCount} alert(s) sent`,
    );
  }

  /**
   * Mark received DTEs past their deadline as tacitly accepted.
   * Per SII rules, if the receptor does not respond within 8 business days,
   * the DTE is considered accepted.
   */
  private async markTacitAcceptance(
    db: PrismaClient,
    now: Date,
  ): Promise<number> {
    // Cross-tenant read is acceptable for cron scanning
    const expired = await db.dte.findMany({
      where: {
        direction: 'RECEIVED',
        decidedAt: null,
        deadlineDate: { lt: now },
        status: { notIn: ['VOIDED', 'ERROR'] },
      },
      select: { id: true, tenantId: true, folio: true, emisorRut: true },
    });

    // Group by tenantId so writes use tenant-scoped clients
    const grouped = new Map<string, typeof expired>();
    for (const dte of expired) {
      const list = grouped.get(dte.tenantId) ?? [];
      list.push(dte);
      grouped.set(dte.tenantId, list);
    }

    for (const [tenantId, dtes] of grouped) {
      const tenantDb = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

      for (const dte of dtes) {
        try {
          await tenantDb.dte.update({
            where: { id: dte.id },
            data: {
              status: 'ACCEPTED',
              decidedAt: now,
            },
          });

          await tenantDb.dteExchange.updateMany({
            where: { dteId: dte.id, tenantId: dte.tenantId },
            data: { status: 'TACIT_ACCEPTANCE' },
          });

          await tenantDb.dteLog.create({
            data: {
              dteId: dte.id,
              action: 'ACCEPTED',
              message:
                'Aceptación tácita — plazo de 8 días hábiles vencido sin respuesta',
            },
          });

          this.eventEmitter.emit('dte.received.tacit-acceptance', {
            tenantId: dte.tenantId,
            dteId: dte.id,
            folio: dte.folio,
          });

          this.logger.log(
            `Tacit acceptance for DTE ${dte.id} (folio ${dte.folio} from ${dte.emisorRut})`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to mark tacit acceptance for DTE ${dte.id} (folio ${dte.folio}): ${error}`,
          );
        }
      }
    }

    return expired.length;
  }

  /**
   * Send alerts for DTEs approaching their deadline (within 2 business days).
   */
  private async sendDeadlineAlerts(
    db: PrismaClient,
    now: Date,
  ): Promise<number> {
    const twoDaysFromNow = this.addBusinessDays(now, 2);

    const approaching = await db.dte.findMany({
      where: {
        direction: 'RECEIVED',
        decidedAt: null,
        deadlineDate: {
          gte: now,
          lte: twoDaysFromNow,
        },
        status: { notIn: ['VOIDED', 'ERROR'] },
      },
      select: {
        id: true,
        tenantId: true,
        folio: true,
        emisorRut: true,
        emisorRazon: true,
        deadlineDate: true,
        dteType: true,
      },
    });

    for (const dte of approaching) {
      try {
        this.eventEmitter.emit('dte.received.deadline-approaching', {
          tenantId: dte.tenantId,
          dteId: dte.id,
          folio: dte.folio,
          emisorRut: dte.emisorRut,
          emisorRazon: dte.emisorRazon,
          deadlineDate: dte.deadlineDate,
          dteType: dte.dteType,
        });

        this.logger.log(
          `Deadline alert for DTE ${dte.id} (folio ${dte.folio}): expires ${dte.deadlineDate?.toISOString()}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send deadline alert for DTE ${dte.id} (folio ${dte.folio}): ${error}`,
        );
      }
    }

    return approaching.length;
  }

  /**
   * Add N business days to a date (skipping weekends).
   */
  private addBusinessDays(fromDate: Date, days: number): Date {
    const result = new Date(fromDate);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const dow = result.getDay();
      if (dow !== 0 && dow !== 6) {
        added++;
      }
    }
    return result;
  }
}
