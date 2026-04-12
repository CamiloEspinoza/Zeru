import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@zeru/shared';
import { PresenceService } from '../presence/presence.service';
import { TeamChatService } from '../team-chat/team-chat.service';
import { LockService } from '../lock/lock.service';

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
    private readonly presenceService: PresenceService,
    private readonly chatService: TeamChatService,
    private readonly lockService: LockService,
    private readonly config: ConfigService,
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
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          personProfiles: { select: { avatarS3Key: true } },
        },
      });

      if (!user) {
        this.logger.warn(`Connection rejected: user ${userId} not found`);
        client.disconnect(true);
        return;
      }

      const hasAvatar = !!user.personProfiles?.[0]?.avatarS3Key;
      const apiUrl = this.config.get<string>('API_URL', 'http://localhost:3017/api');

      client.data.userId = userId;
      client.data.tenantId = tenantId;
      client.data.email = payload.email;
      client.data.role = payload.role;
      client.data.userName = `${user.firstName} ${user.lastName}`;
      client.data.userAvatar = hasAvatar ? `${apiUrl}/avatars/${userId}?s=96` : null;

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

      // Release all locks held by this socket
      const releasedLocks = await this.lockService.releaseBySocketId(client.id);
      for (const lock of releasedLocks) {
        this.emitToTenant(lock.tenantId, 'field:unlocked', {
          entityType: lock.entityType,
          entityId: lock.entityId,
          fieldName: lock.fieldName,
          userId: lock.userId,
          reason: 'disconnect',
        });
      }

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

  // ─── Project Rooms ───────────────────────────────────────

  @SubscribeMessage('project:join')
  async handleProjectJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string },
  ) {
    if (!client.data?.userId) return;
    const room = `project:${client.data.tenantId}:${data.projectId}`;
    await client.join(room);
  }

  @SubscribeMessage('project:leave')
  async handleProjectLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string },
  ) {
    if (!client.data?.userId) return;
    const room = `project:${client.data.tenantId}:${data.projectId}`;
    await client.leave(room);
  }

  @SubscribeMessage('task:comment:typing')
  async handleCommentTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskId: string; projectId: string },
  ) {
    const { userId, tenantId, userName } = client.data;
    if (!userId || !tenantId) return;

    const room = `project:${tenantId}:${data.projectId}`;
    this.server.to(room).except(client.id).emit(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'task:comment:typing' as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        projectId: data.projectId,
        taskId: data.taskId,
        userId,
        userName,
      } as any,
    );
  }

  @SubscribeMessage('task:comment:typing:stop')
  async handleCommentTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskId: string; projectId: string },
  ) {
    const { userId, tenantId } = client.data;
    if (!userId || !tenantId) return;

    const room = `project:${tenantId}:${data.projectId}`;
    this.server.to(room).except(client.id).emit(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'task:comment:typing:stop' as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        projectId: data.projectId,
        taskId: data.taskId,
        userId,
      } as any,
    );
  }

  // ─── Task Event Broadcasting ─────────────────────────────

  @OnEvent('task.created')
  handleTaskCreated(payload: { tenantId: string; projectId: string; [key: string]: unknown }) {
    const room = `project:${payload.tenantId}:${payload.projectId}`;
    this.emitToRoom(room, 'task:created', payload);
  }

  @OnEvent('task.updated')
  handleTaskUpdated(payload: { tenantId: string; projectId: string; [key: string]: unknown }) {
    const room = `project:${payload.tenantId}:${payload.projectId}`;
    this.emitToRoom(room, 'task:changed', payload);
  }

  @OnEvent('task.moved')
  handleTaskMoved(payload: { tenantId: string; projectId: string; [key: string]: unknown }) {
    const room = `project:${payload.tenantId}:${payload.projectId}`;
    this.emitToRoom(room, 'task:moved', payload);
  }

  @OnEvent('task.deleted')
  handleTaskDeleted(payload: { tenantId: string; projectId: string; [key: string]: unknown }) {
    const room = `project:${payload.tenantId}:${payload.projectId}`;
    this.emitToRoom(room, 'task:removed', payload);
  }

  @OnEvent('task.comment.created')
  handleTaskComment(payload: { tenantId: string; projectId: string; [key: string]: unknown }) {
    const room = `project:${payload.tenantId}:${payload.projectId}`;
    this.emitToRoom(room, 'task:comment:new', payload);
  }

  @OnEvent('task.comment.updated')
  handleTaskCommentUpdated(payload: {
    tenantId: string;
    projectId: string;
    taskId: string;
    commentId: string;
    comment: Record<string, unknown>;
    actorId?: string;
  }) {
    const room = `project:${payload.tenantId}:${payload.projectId}`;
    this.emitToRoom(room, 'task:comment:updated', payload);
  }

  @OnEvent('task.comment.deleted')
  handleTaskCommentDeleted(payload: {
    tenantId: string;
    projectId: string;
    taskId: string;
    commentId: string;
    actorId?: string;
  }) {
    const room = `project:${payload.tenantId}:${payload.projectId}`;
    this.emitToRoom(room, 'task:comment:deleted', payload);
  }

  @OnEvent('task.comment.reaction.added')
  handleTaskCommentReactionAdded(payload: {
    tenantId: string;
    projectId: string;
    taskId: string;
    commentId: string;
    emoji: string;
    userId: string;
  }) {
    const room = `project:${payload.tenantId}:${payload.projectId}`;
    this.emitToRoom(room, 'task:comment:reaction:added', payload);
  }

  @OnEvent('task.comment.reaction.removed')
  handleTaskCommentReactionRemoved(payload: {
    tenantId: string;
    projectId: string;
    taskId: string;
    commentId: string;
    emoji: string;
    userId: string;
  }) {
    const room = `project:${payload.tenantId}:${payload.projectId}`;
    this.emitToRoom(room, 'task:comment:reaction:removed', payload);
  }

  @OnEvent('section.changed')
  handleSectionChanged(payload: { tenantId: string; projectId: string; [key: string]: unknown }) {
    const room = `project:${payload.tenantId}:${payload.projectId}`;
    this.emitToRoom(room, 'section:changed', payload);
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

  // ─── Lock event handlers ──────────────────────────────────

  @SubscribeMessage('lock:acquire')
  async handleLockAcquire(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { entityType: string; entityId: string; fieldName: string },
  ) {
    if (!client.data?.userId) return;
    const { userId, tenantId } = client.data;
    const { entityType, entityId, fieldName } = data;

    const result = await this.lockService.acquire(
      entityType,
      entityId,
      fieldName,
      userId,
      tenantId,
      client.id,
    );

    if (result.acquired) {
      client.emit('lock:acquired' as any, { entityType, entityId, fieldName, lock: result.lock } as any);
      this.emitToTenant(tenantId, 'field:locked', {
        entityType,
        entityId,
        fieldName,
        userId,
        socketId: client.id,
        expiresAt: result.lock.expiresAt,
      });
    } else {
      client.emit('lock:denied' as any, { entityType, entityId, fieldName, heldBy: result.heldBy } as any);
    }
  }

  @SubscribeMessage('lock:release')
  async handleLockRelease(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { entityType: string; entityId: string; fieldName: string },
  ) {
    if (!client.data?.userId) return;
    const { userId, tenantId } = client.data;
    const { entityType, entityId, fieldName } = data;

    const released = await this.lockService.release(
      entityType,
      entityId,
      fieldName,
      userId,
    );

    if (released) {
      this.emitToTenant(tenantId, 'field:unlocked', {
        entityType,
        entityId,
        fieldName,
        userId,
        reason: 'released',
      });
    }
  }

  @SubscribeMessage('lock:heartbeat')
  async handleLockHeartbeat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { entityType: string; entityId: string; fieldName: string },
  ) {
    if (!client.data?.userId) return;
    const { userId } = client.data;
    const { entityType, entityId, fieldName } = data;

    await this.lockService.heartbeat(entityType, entityId, fieldName, userId);
  }

  @OnEvent('lock.expired')
  handleLockExpired(payload: {
    tenantId: string;
    entityType: string;
    entityId: string;
    fieldName: string;
    userId: string;
  }) {
    this.emitToTenant(payload.tenantId, 'field:unlocked', {
      entityType: payload.entityType,
      entityId: payload.entityId,
      fieldName: payload.fieldName,
      userId: payload.userId,
      reason: 'expired',
    });
  }

  @OnEvent('presence.broadcast')
  handlePresenceBroadcast(payload: {
    tenantId: string;
    event: string;
    data: unknown;
  }) {
    this.emitToTenant(payload.tenantId, payload.event, payload.data);
  }

  @OnEvent('presence.broadcast-room')
  handlePresenceBroadcastRoom(payload: {
    room: string;
    event: string;
    data: unknown;
  }) {
    this.emitToRoom(payload.room, payload.event, payload.data);
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
