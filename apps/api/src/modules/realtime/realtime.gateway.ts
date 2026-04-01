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
import { TeamChatService } from '../team-chat/team-chat.service';

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
    @Inject(forwardRef(() => TeamChatService))
    private readonly chatService: TeamChatService,
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

  // ─── Chat event handlers ──────────────────────────────────

  @SubscribeMessage('channel:join')
  async handleChannelJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    if (!client.data?.userId) return;
    const { tenantId } = client.data;
    const { channelId } = data;
    await client.join(`tenant:${tenantId}:channel:${channelId}`);
  }

  @SubscribeMessage('channel:leave')
  async handleChannelLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    if (!client.data?.userId) return;
    const { tenantId } = client.data;
    const { channelId } = data;
    await client.leave(`tenant:${tenantId}:channel:${channelId}`);
  }

  @SubscribeMessage('chat:send')
  async handleChatSend(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      channelId: string;
      content: string;
      threadParentId?: string;
      mentionedUserIds?: string[];
    },
  ) {
    if (!client.data?.userId) return;
    const { userId, tenantId } = client.data;
    const { channelId, content, threadParentId, mentionedUserIds } = data;

    const message = await this.chatService.sendMessage(
      channelId,
      userId,
      content,
      threadParentId,
      mentionedUserIds,
    );

    const room = `tenant:${tenantId}:channel:${channelId}`;
    this.emitToRoom(room, 'chat:message', message);
  }

  @SubscribeMessage('chat:typing')
  async handleChatTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    if (!client.data?.userId) return;
    const { userId, tenantId, userName, userAvatar } = client.data;
    const { channelId } = data;

    await this.chatService.setTyping(tenantId, channelId, userId);

    const room = `tenant:${tenantId}:channel:${channelId}`;
    // Broadcast to room excluding sender
    this.server.to(room).except(client.id).emit(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'chat:typing' as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { channelId, userId, userName, userAvatar } as any,
    );
  }

  @SubscribeMessage('chat:read')
  async handleChatRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string; sequence: number },
  ) {
    if (!client.data?.userId) return;
    const { userId, tenantId } = client.data;
    const { channelId, sequence } = data;

    await this.chatService.markRead(channelId, userId, sequence);

    const room = `tenant:${tenantId}:channel:${channelId}`;
    this.emitToRoom(room, 'chat:read', { channelId, userId, sequence });
  }

  @SubscribeMessage('chat:react')
  async handleChatReact(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; channelId: string; emoji: string },
  ) {
    if (!client.data?.userId) return;
    const { userId, tenantId } = client.data;
    const { messageId, channelId, emoji } = data;

    const action = await this.chatService.toggleReaction(
      messageId,
      userId,
      emoji,
    );

    const room = `tenant:${tenantId}:channel:${channelId}`;
    this.emitToRoom(room, 'chat:reacted', {
      messageId,
      channelId,
      userId,
      emoji,
      action,
    });
  }

  @SubscribeMessage('chat:edit')
  async handleChatEdit(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { messageId: string; channelId: string; content: string },
  ) {
    if (!client.data?.userId) return;
    const { userId, tenantId } = client.data;
    const { messageId, channelId, content } = data;

    const message = await this.chatService.editMessage(
      messageId,
      userId,
      content,
    );

    const room = `tenant:${tenantId}:channel:${channelId}`;
    this.emitToRoom(room, 'chat:edited', message);
  }

  @SubscribeMessage('chat:delete')
  async handleChatDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; channelId: string },
  ) {
    if (!client.data?.userId) return;
    const { userId, tenantId } = client.data;
    const { messageId, channelId } = data;

    const result = await this.chatService.deleteMessage(messageId, userId);

    const room = `tenant:${tenantId}:channel:${channelId}`;
    this.emitToRoom(room, 'chat:deleted', result);
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
