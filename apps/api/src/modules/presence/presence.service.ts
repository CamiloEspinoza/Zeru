import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/services/redis.service';
import { PresenceUser } from '@zeru/shared';

const STALE_THRESHOLD_MS = 60_000;

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  constructor(private readonly redis: RedisService) {}

  // ─── Key helpers ─────────────────────────────────────────

  private tenantKey(tenantId: string) {
    return `presence:tenant:${tenantId}`;
  }

  private viewKey(tenantId: string, viewPath: string) {
    return `presence:tenant:${tenantId}:view:${viewPath}`;
  }

  private metaKey(userId: string) {
    return `presence:meta:${userId}`;
  }

  // ─── Deterministic color from userId ─────────────────────

  userColor(userId: string): string {
    const colors = [
      '#F87171', '#FB923C', '#FBBF24', '#34D399',
      '#60A5FA', '#818CF8', '#A78BFA', '#F472B6',
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash |= 0;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  // ─── User meta ────────────────────────────────────────────

  async setUserMeta(
    userId: string,
    name: string,
    avatar: string | null,
  ): Promise<void> {
    const key = this.metaKey(userId);
    await this.redis.hset(key, {
      name,
      avatar: avatar ?? '',
      color: this.userColor(userId),
    });
    // meta expires after 24 h of inactivity
    await this.redis.expire(key, 86_400);
  }

  async getUserMeta(userId: string): Promise<PresenceUser | null> {
    const key = this.metaKey(userId);
    const data = await this.redis.hgetall(key);
    if (!data?.name) return null;
    return {
      userId,
      name: data.name,
      avatar: data.avatar || null,
      color: data.color || this.userColor(userId),
    };
  }

  // ─── Global presence (tenant level) ──────────────────────

  async goOnline(tenantId: string, userId: string): Promise<void> {
    const score = Date.now();
    await this.redis.zadd(this.tenantKey(tenantId), score, userId);
  }

  async goOffline(tenantId: string, userId: string): Promise<void> {
    await this.redis.zrem(this.tenantKey(tenantId), userId);
  }

  async getOnlineUsers(tenantId: string): Promise<string[]> {
    const cutoff = Date.now() - STALE_THRESHOLD_MS;
    // Only users with score > cutoff are considered online
    return this.redis.zrangebyscore(
      this.tenantKey(tenantId),
      cutoff,
      '+inf',
    );
  }

  async heartbeat(tenantId: string, userId: string): Promise<void> {
    await this.redis.zadd(this.tenantKey(tenantId), Date.now(), userId);
  }

  // ─── Per-view presence ────────────────────────────────────

  async joinView(
    tenantId: string,
    userId: string,
    viewPath: string,
  ): Promise<void> {
    const score = Date.now();
    await this.redis.zadd(this.viewKey(tenantId, viewPath), score, userId);
    // view key TTL: 5 minutes of inactivity
    await this.redis.expire(this.viewKey(tenantId, viewPath), 300);
  }

  async leaveView(
    tenantId: string,
    userId: string,
    viewPath: string,
  ): Promise<void> {
    await this.redis.zrem(this.viewKey(tenantId, viewPath), userId);
  }

  async getViewUsers(
    tenantId: string,
    viewPath: string,
  ): Promise<PresenceUser[]> {
    const cutoff = Date.now() - STALE_THRESHOLD_MS;
    const userIds = await this.redis.zrangebyscore(
      this.viewKey(tenantId, viewPath),
      cutoff,
      '+inf',
    );
    const users = await Promise.all(userIds.map((id) => this.getUserMeta(id)));
    return users.filter((u): u is PresenceUser => u !== null);
  }

  async heartbeatView(
    tenantId: string,
    userId: string,
    viewPath: string,
  ): Promise<void> {
    await this.redis.zadd(
      this.viewKey(tenantId, viewPath),
      Date.now(),
      userId,
    );
    await this.redis.expire(this.viewKey(tenantId, viewPath), 300);
  }

  // ─── Cleanup helpers ──────────────────────────────────────

  async removeStaleUsers(tenantId: string): Promise<string[]> {
    const cutoff = Date.now() - STALE_THRESHOLD_MS;
    const stale = await this.redis.zrangebyscore(
      this.tenantKey(tenantId),
      '-inf',
      cutoff,
    );
    if (stale.length > 0) {
      await this.redis.zremrangebyscore(
        this.tenantKey(tenantId),
        '-inf',
        cutoff,
      );
    }
    return stale;
  }

  async removeStaleViewUsers(
    tenantId: string,
    viewPath: string,
  ): Promise<string[]> {
    const cutoff = Date.now() - STALE_THRESHOLD_MS;
    const key = this.viewKey(tenantId, viewPath);
    const stale = await this.redis.zrangebyscore(key, '-inf', cutoff);
    if (stale.length > 0) {
      await this.redis.zremrangebyscore(key, '-inf', cutoff);
    }
    return stale;
  }

  async removeUserFromAllViews(
    tenantId: string,
    userId: string,
  ): Promise<string[]> {
    const pattern = this.viewKey(tenantId, '*');
    const keys = await this.redis.keys(pattern);
    const affectedViews: string[] = [];

    for (const key of keys) {
      const score = await this.redis.zscore(key, userId);
      if (score !== null) {
        await this.redis.zrem(key, userId);
        // Extract viewPath from key: presence:tenant:{tenantId}:view:{viewPath}
        const prefix = `presence:tenant:${tenantId}:view:`;
        affectedViews.push(key.slice(prefix.length));
      }
    }

    return affectedViews;
  }

  // ─── Scan all tenant keys (for cleanup cron) ──────────────

  async getAllTenantIds(): Promise<string[]> {
    const keys = await this.redis.keys('presence:tenant:*');
    const tenantIds = new Set<string>();
    for (const key of keys) {
      // presence:tenant:{tenantId} or presence:tenant:{tenantId}:view:...
      const parts = key.split(':');
      // parts[0]=presence, parts[1]=tenant, parts[2]=tenantId
      if (parts[2]) tenantIds.add(parts[2]);
    }
    return [...tenantIds];
  }

  async getViewPaths(tenantId: string): Promise<string[]> {
    const pattern = this.viewKey(tenantId, '*');
    const keys = await this.redis.keys(pattern);
    const prefix = `presence:tenant:${tenantId}:view:`;
    return keys.map((k) => k.slice(prefix.length));
  }
}
