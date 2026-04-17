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

/**
 * Grace period during which a DTE that has a recent SII_SEND_ATTEMPTED log
 * entry will NOT be re-queued. This avoids double-sending when a worker is
 * mid-flight on a slow SOAP call that hasn't yet persisted the trackId.
 */
const SEND_ATTEMPT_GRACE_MS = 5 * 60 * 1000;
const SEND_ATTEMPT_MARKER = 'SII_SEND_ATTEMPTED';

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
      `Found ${orphans.length} orphaned SIGNED DTEs, evaluating for re-send`,
    );

    // Group by tenantId so writes use tenant-scoped clients
    const grouped = new Map<string, typeof orphans>();
    for (const orphan of orphans) {
      const list = grouped.get(orphan.tenantId) ?? [];
      list.push(orphan);
      grouped.set(orphan.tenantId, list);
    }

    const graceCutoff = new Date(Date.now() - SEND_ATTEMPT_GRACE_MS);

    for (const [tenantId, dtes] of grouped) {
      const tenantDb = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

      for (const orphan of dtes) {
        try {
          // Check for a recent SII_SEND_ATTEMPTED marker. If sendDte was
          // invoked <5min ago we assume the original worker is still in
          // flight (slow SOAP) and skip this cycle to prevent duplicates.
          const lastAttempt = await tenantDb.dteLog.findFirst({
            where: {
              dteId: orphan.id,
              action: 'SENT_TO_SII',
              message: { startsWith: SEND_ATTEMPT_MARKER },
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          });

          if (lastAttempt && lastAttempt.createdAt > graceCutoff) {
            this.logger.log(
              `Skipping orphan DTE ${orphan.id} (folio ${orphan.folio}): ` +
                `SII send attempted at ${lastAttempt.createdAt.toISOString()} ` +
                `(<${SEND_ATTEMPT_GRACE_MS / 1000}s ago)`,
            );
            continue;
          }

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
        } catch (error) {
          this.logger.error(
            `Failed to re-queue orphaned DTE ${orphan.id} (folio ${orphan.folio}): ${error}`,
          );
        }
      }
    }
  }
}
