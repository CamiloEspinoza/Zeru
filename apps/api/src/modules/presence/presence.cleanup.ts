import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PresenceService } from './presence.service';

@Injectable()
export class PresenceCleanup {
  private readonly logger = new Logger(PresenceCleanup.name);

  constructor(
    private readonly presenceService: PresenceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('*/15 * * * * *')
  async cleanupStalePresence(): Promise<void> {
    try {
      const tenantIds = await this.presenceService.getAllTenantIds();

      for (const tenantId of tenantIds) {
        // Clean up stale global presence
        const staleGlobal =
          await this.presenceService.removeStaleUsers(tenantId);

        if (staleGlobal.length > 0) {
          this.logger.debug(
            `Removed ${staleGlobal.length} stale global users for tenant ${tenantId}`,
          );
          const onlineUsers =
            await this.presenceService.getOnlineUsers(tenantId);
          this.eventEmitter.emit('presence.broadcast', {
            tenantId,
            event: 'presence:online',
            data: { users: onlineUsers },
          });
        }

        // Clean up stale per-view presence
        const viewPaths =
          await this.presenceService.getViewPaths(tenantId);

        for (const viewPath of viewPaths) {
          const staleView =
            await this.presenceService.removeStaleViewUsers(
              tenantId,
              viewPath,
            );

          if (staleView.length > 0) {
            this.logger.debug(
              `Removed ${staleView.length} stale view users from ${viewPath} for tenant ${tenantId}`,
            );
            const viewUsers = await this.presenceService.getViewUsers(
              tenantId,
              viewPath,
            );
            this.eventEmitter.emit('presence.broadcast-room', {
              room: `view:${tenantId}:${viewPath}`,
              event: 'presence:update',
              data: {
                viewPath,
                event: 'left',
                user: staleView[0],
                users: viewUsers,
              },
            });
          }
        }
      }
    } catch (err) {
      this.logger.error('Presence cleanup error', err);
    }
  }
}
