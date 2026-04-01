import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PresenceService } from '../presence/presence.service';
import { PresenceUser } from '@zeru/shared';

const LOCK_TTL_MS = 60_000;

export interface AcquireResult {
  acquired: true;
  lock: {
    entityType: string;
    entityId: string;
    fieldName: string;
    userId: string;
    socketId: string;
    expiresAt: Date;
  };
}

export interface DeniedResult {
  acquired: false;
  heldBy: PresenceUser | null;
}

@Injectable()
export class LockService {
  private readonly logger = new Logger(LockService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly gateway: RealtimeGateway,
    @Inject(forwardRef(() => PresenceService))
    private readonly presenceService: PresenceService,
  ) {}

  async acquire(
    entityType: string,
    entityId: string,
    fieldName: string,
    userId: string,
    tenantId: string,
    socketId: string,
  ): Promise<AcquireResult | DeniedResult> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);

    // Check for existing lock
    const existing = await this.prisma.resourceLock.findUnique({
      where: { entityType_entityId_fieldName: { entityType, entityId, fieldName } },
    });

    if (existing) {
      // If lock is expired, take over
      if (existing.expiresAt < now) {
        const lock = await this.prisma.resourceLock.update({
          where: { entityType_entityId_fieldName: { entityType, entityId, fieldName } },
          data: { userId, tenantId, socketId, acquiredAt: now, expiresAt, lastHeartbeat: now },
        });
        return { acquired: true, lock };
      }

      // If same user, refresh the lock
      if (existing.userId === userId) {
        const lock = await this.prisma.resourceLock.update({
          where: { entityType_entityId_fieldName: { entityType, entityId, fieldName } },
          data: { socketId, expiresAt, lastHeartbeat: now },
        });
        return { acquired: true, lock };
      }

      // Lock held by another user
      const heldBy = await this.presenceService.getUserMeta(existing.userId);
      return { acquired: false, heldBy };
    }

    // No existing lock — create one
    try {
      const lock = await this.prisma.resourceLock.create({
        data: { entityType, entityId, fieldName, userId, tenantId, socketId, expiresAt },
      });
      return { acquired: true, lock };
    } catch {
      // Race condition: another process created it first
      const conflict = await this.prisma.resourceLock.findUnique({
        where: { entityType_entityId_fieldName: { entityType, entityId, fieldName } },
      });
      const heldBy = conflict
        ? await this.presenceService.getUserMeta(conflict.userId)
        : null;
      return { acquired: false, heldBy };
    }
  }

  async release(
    entityType: string,
    entityId: string,
    fieldName: string,
    userId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.resourceLock.findUnique({
      where: { entityType_entityId_fieldName: { entityType, entityId, fieldName } },
    });

    if (!existing || existing.userId !== userId) return false;

    await this.prisma.resourceLock.delete({
      where: { entityType_entityId_fieldName: { entityType, entityId, fieldName } },
    });

    return true;
  }

  async heartbeat(
    entityType: string,
    entityId: string,
    fieldName: string,
    userId: string,
  ): Promise<boolean> {
    const now = new Date();
    const existing = await this.prisma.resourceLock.findUnique({
      where: { entityType_entityId_fieldName: { entityType, entityId, fieldName } },
    });

    if (!existing || existing.userId !== userId) return false;

    await this.prisma.resourceLock.update({
      where: { entityType_entityId_fieldName: { entityType, entityId, fieldName } },
      data: {
        expiresAt: new Date(now.getTime() + LOCK_TTL_MS),
        lastHeartbeat: now,
      },
    });

    return true;
  }

  async releaseBySocketId(socketId: string): Promise<{ entityType: string; entityId: string; fieldName: string; userId: string; tenantId: string }[]> {
    const locks = await this.prisma.resourceLock.findMany({
      where: { socketId },
    });

    if (locks.length === 0) return [];

    await this.prisma.resourceLock.deleteMany({ where: { socketId } });

    return locks.map((l) => ({
      entityType: l.entityType,
      entityId: l.entityId,
      fieldName: l.fieldName,
      userId: l.userId,
      tenantId: l.tenantId,
    }));
  }

  async forceRelease(
    entityType: string,
    entityId: string,
    fieldName: string,
  ): Promise<string | null> {
    const existing = await this.prisma.resourceLock.findUnique({
      where: { entityType_entityId_fieldName: { entityType, entityId, fieldName } },
    });

    if (!existing) return null;

    await this.prisma.resourceLock.delete({
      where: { entityType_entityId_fieldName: { entityType, entityId, fieldName } },
    });

    return existing.userId;
  }

  @Cron('*/30 * * * * *')
  async cleanExpiredLocks(): Promise<void> {
    const expired = await this.prisma.resourceLock.findMany({
      where: { expiresAt: { lt: new Date() } },
    });

    if (expired.length === 0) return;

    await this.prisma.resourceLock.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    this.logger.debug(`Cleaned ${expired.length} expired lock(s)`);

    // Broadcast field-unlocked for each expired lock
    for (const lock of expired) {
      this.gateway.emitToTenant(lock.tenantId, 'field:unlocked', {
        entityType: lock.entityType,
        entityId: lock.entityId,
        fieldName: lock.fieldName,
        userId: lock.userId,
        reason: 'expired',
      });
    }
  }
}
