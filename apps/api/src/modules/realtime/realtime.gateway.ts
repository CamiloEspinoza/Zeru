import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@zeru/shared';

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
      this.logger.log(`Client disconnected: ${client.data.userId}`);
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
