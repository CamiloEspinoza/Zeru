import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@zeru/shared';
import { PresenceService } from '../presence/presence.service';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    tenantId: string;
    email: string;
    role: string;
    userName: string;
    userAvatar: string | null;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server<ClientToServerEvents, ServerToClientEvents>;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PresenceService))
    private readonly presenceService: PresenceService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Connection rejected: no token`);
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;
      const tenantId = payload.tenantId;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, email: true },
      });

      if (!user) {
        this.logger.warn(`Connection rejected: user ${userId} not found`);
        client.disconnect(true);
        return;
      }

      client.data.userId = userId;
      client.data.tenantId = tenantId;
      client.data.email = payload.email;
      client.data.role = payload.role;
      client.data.userName = `${user.firstName} ${user.lastName}`;
      client.data.userAvatar = null;

      await client.join(`tenant:${tenantId}`);
      await client.join(`user:${userId}`);

      // Presence: cache user meta and mark online
      await this.presenceService.setUserMeta(
        userId,
        client.data.userName,
        client.data.userAvatar,
      );
      await this.presenceService.goOnline(tenantId, userId);

      // Broadcast updated online users list to the tenant
      const onlineUsers =
        await this.presenceService.getOnlineUsers(tenantId);
      this.emitToTenant(tenantId, 'presence:online', {
        users: onlineUsers,
      });

      this.logger.log(
        `Client connected: ${userId} (tenant: ${tenantId})`,
      );
    } catch {
      this.logger.warn(`Connection rejected: invalid token`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.data?.userId) {
      const { userId, tenantId } = client.data;
      this.logger.log(`Client disconnected: ${userId}`);

      // Remove from all views
      const affectedViews =
        await this.presenceService.removeUserFromAllViews(tenantId, userId);

      // Broadcast view updates for all views the user left
      for (const viewPath of affectedViews) {
        const viewUsers = await this.presenceService.getViewUsers(
          tenantId,
          viewPath,
        );
        this.emitToRoom(`view:${tenantId}:${viewPath}`, 'presence:update', {
          viewPath,
          event: 'left',
          user: { userId, name: client.data.userName, avatar: client.data.userAvatar, color: this.presenceService.userColor(userId) },
          users: viewUsers,
        });
      }

      // Mark offline and broadcast updated online list
      await this.presenceService.goOffline(tenantId, userId);
      const onlineUsers =
        await this.presenceService.getOnlineUsers(tenantId);
      this.emitToTenant(tenantId, 'presence:online', {
        users: onlineUsers,
      });
    }
  }

  @SubscribeMessage('presence:join')
  async handlePresenceJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { viewPath: string },
  ) {
    if (!client.data?.userId) return;
    const { userId, tenantId } = client.data;
    const { viewPath } = data;

    await this.presenceService.joinView(tenantId, userId, viewPath);
    await client.join(`view:${tenantId}:${viewPath}`);

    const viewUsers = await this.presenceService.getViewUsers(
      tenantId,
      viewPath,
    );

    // Send snapshot to the joining client
    client.emit('presence:snapshot', { viewPath, users: viewUsers });

    // Broadcast update to everyone else in the view
    const userMeta = await this.presenceService.getUserMeta(userId);
    if (userMeta) {
      this.emitToRoom(`view:${tenantId}:${viewPath}`, 'presence:update', {
        viewPath,
        event: 'joined',
        user: userMeta,
        users: viewUsers,
      });
    }
  }

  @SubscribeMessage('presence:leave')
  async handlePresenceLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { viewPath: string },
  ) {
    if (!client.data?.userId) return;
    const { userId, tenantId } = client.data;
    const { viewPath } = data;

    await this.presenceService.leaveView(tenantId, userId, viewPath);
    await client.leave(`view:${tenantId}:${viewPath}`);

    const viewUsers = await this.presenceService.getViewUsers(
      tenantId,
      viewPath,
    );

    const userMeta = await this.presenceService.getUserMeta(userId);
    if (userMeta) {
      this.emitToRoom(`view:${tenantId}:${viewPath}`, 'presence:update', {
        viewPath,
        event: 'left',
        user: userMeta,
        users: viewUsers,
      });
    }
  }

  @SubscribeMessage('presence:heartbeat')
  async handlePresenceHeartbeat(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.data?.userId) return;
    const { userId, tenantId } = client.data;

    await this.presenceService.heartbeat(tenantId, userId);

    // Also refresh any views the user is in
    const viewPaths = await this.presenceService.getViewPaths(tenantId);
    for (const viewPath of viewPaths) {
      const viewKey = `view:${tenantId}:${viewPath}`;
      const rooms = client.rooms;
      if (rooms.has(viewKey)) {
        await this.presenceService.heartbeatView(tenantId, userId, viewPath);
      }
    }
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event as any, data as any);
  }

  emitToTenant(tenantId: string, event: string, data: unknown) {
    this.server.to(`tenant:${tenantId}`).emit(event as any, data as any);
  }

  emitToRoom(room: string, event: string, data: unknown) {
    this.server.to(room).emit(event as any, data as any);
  }
}
