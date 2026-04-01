import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const UNREAD_CACHE_KEY = (userId: string) => `notif:unread:${userId}`;
const GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export interface NotifyParams {
  type: string;
  title: string;
  body?: string;
  data: Record<string, unknown>;
  groupKey?: string;
  recipientId: string;
  tenantId: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: RealtimeGateway,
  ) {}

  async notify(params: NotifyParams): Promise<void> {
    const { type, title, body, data, groupKey, recipientId, tenantId } = params;

    try {
      let notification: { id: string; type: string; title: string; body: string | null; data: unknown; isRead: boolean; readAt: Date | null; groupKey: string | null; createdAt: Date; recipientId: string; tenantId: string };

      if (groupKey) {
        // Look for an existing notification with same groupKey within the 5-min window
        const windowStart = new Date(Date.now() - GROUP_WINDOW_MS);
        const existing = await this.prisma.notification.findFirst({
          where: {
            groupKey,
            recipientId,
            tenantId,
            createdAt: { gte: windowStart },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (existing) {
          // Update the existing grouped notification
          notification = await this.prisma.notification.update({
            where: { id: existing.id },
            data: { title, body, data, isRead: false, readAt: null },
          });
        } else {
          notification = await this.prisma.notification.create({
            data: { type, title, body, data, groupKey, recipientId, tenantId },
          });
          // Increment unread counter only for new notifications
          await this.redis.incr(UNREAD_CACHE_KEY(recipientId));
        }
      } else {
        notification = await this.prisma.notification.create({
          data: { type, title, body, data, groupKey: null, recipientId, tenantId },
        });
        await this.redis.incr(UNREAD_CACHE_KEY(recipientId));
      }

      // Get current unread count for the count event
      const unreadCount = await this.getUnreadCount(recipientId);

      // Emit WebSocket events to the recipient
      this.gateway.emitToUser(recipientId, 'notification:new', notification);
      this.gateway.emitToUser(recipientId, 'notification:count', { count: unreadCount });
    } catch (err) {
      this.logger.error(`Failed to create notification for user ${recipientId}`, err);
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = UNREAD_CACHE_KEY(userId);
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      return parseInt(cached, 10);
    }

    // Fallback to DB count
    const count = await this.prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });

    await this.redis.set(cacheKey, String(count), 'EX', 3600);
    return count;
  }

  async getNotifications(
    userId: string,
    tenantId: string,
    limit = 20,
    offset = 0,
  ) {
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { recipientId: userId, tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({
        where: { recipientId: userId, tenantId },
      }),
    ]);

    return { items, total, limit, offset };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientId: userId },
    });

    if (!notification || notification.isRead) return;

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });

    // Decrement Redis counter (floor at 0)
    const cacheKey = UNREAD_CACHE_KEY(userId);
    const current = await this.redis.get(cacheKey);
    if (current !== null) {
      const newCount = Math.max(0, parseInt(current, 10) - 1);
      await this.redis.set(cacheKey, String(newCount), 'EX', 3600);
    }
  }

  async markAllAsRead(userId: string, tenantId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, tenantId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    // Clear Redis counter
    await this.redis.set(UNREAD_CACHE_KEY(userId), '0', 'EX', 3600);
  }
}
