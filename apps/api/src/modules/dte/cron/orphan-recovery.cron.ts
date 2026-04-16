import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import {
  DTE_EMISSION_QUEUE,
  DTE_JOB_NAMES,
  DTE_QUEUE_CONFIG,
} from '../constants/queue.constants';

@Injectable()
export class OrphanRecoveryCron {
  private readonly logger = new Logger(OrphanRecoveryCron.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(DTE_EMISSION_QUEUE) private readonly emissionQueue: Queue,
  ) {}

  @Cron('*/15 * * * *')
  async recoverOrphanedDtes() {
    // Cross-tenant read is acceptable for cron scanning
    const db = this.prisma as unknown as PrismaClient;
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const orphans = await db.dte.findMany({
      where: {
        status: 'SIGNED',
        siiTrackId: null,
        updatedAt: { lt: fifteenMinutesAgo },
      },
      select: { id: true, tenantId: true, folio: true },
    });

    if (orphans.length === 0) return;

    this.logger.warn(
      `Found ${orphans.length} orphaned SIGNED DTEs, re-queuing for SII send`,
    );

    // Group by tenantId so writes use tenant-scoped clients
    const grouped = new Map<string, typeof orphans>();
    for (const orphan of orphans) {
      const list = grouped.get(orphan.tenantId) ?? [];
      list.push(orphan);
      grouped.set(orphan.tenantId, list);
    }

    for (const [tenantId, dtes] of grouped) {
      const tenantDb = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

      for (const orphan of dtes) {
        // Log recovery action using tenant-scoped client
        await tenantDb.dteLog.create({
          data: {
            dteId: orphan.id,
            action: 'QUEUED',
            message: 'Re-encolado por cron de recuperación de huérfanos',
          },
        });

        await this.emissionQueue.add(
          DTE_JOB_NAMES.EMIT,
          { dteId: orphan.id, tenantId },
          { ...DTE_QUEUE_CONFIG.EMISSION, jobId: `emit-${orphan.id}` },
        );

        this.logger.log(
          `Re-queued orphaned DTE ${orphan.id} (folio ${orphan.folio})`,
        );
      }
    }
  }
}
