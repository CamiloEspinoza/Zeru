# Real-time Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WebSocket-based real-time presence (who's online, who's viewing each page) and team chat to Zeru.

**Architecture:** Monolito modular — all new modules live inside the existing NestJS API. Socket.IO with Redis adapter for transport, Zustand for frontend real-time state, React Query for server cache. Prisma middleware + AsyncLocalStorage for automatic audit logging.

**Tech Stack:** Socket.IO 4.8, `@nestjs/websockets` 11, `ioredis` 5, `zustand` 5, `@tanstack/react-query` 5, `@tanstack/react-virtual` 3, `@nestjs/event-emitter` 3, `@nestjs/bullmq` 11, `bullmq` 5

**Spec:** `docs/superpowers/specs/2026-03-31-realtime-collaboration-design.md`

**Working directory:** `.worktrees/realtime-collaboration` (branch `feature/realtime-collaboration`)

---

## Codebase Context (read this first)

These are the patterns already established in this codebase. Follow them exactly.

### Auth
- JWT payload: `{ sub: userId, email: string, tenantId: string, role: UserRole }`
- Guards: `@UseGuards(JwtAuthGuard, TenantGuard)` on every controller
- Decorators: `@CurrentUser()` returns user, `@CurrentTenant()` returns tenantId
- Strategy: `apps/api/src/modules/auth/strategies/jwt.strategy.ts`
- Guard files: `apps/api/src/common/guards/jwt-auth.guard.ts`, `tenant.guard.ts`

### Module pattern
```
modules/my-feature/
├── my-feature.module.ts
├── my-feature.service.ts
├── my-feature.controller.ts (if HTTP endpoints needed)
├── my-feature.gateway.ts (for WebSocket gateways)
└── dto/
    └── index.ts
```

### Prisma
- Service: `apps/api/src/prisma/prisma.service.ts` (global module)
- Schema: `apps/api/prisma/schema.prisma`
- Extensions: soft-delete (`deletedAt` pattern), tenant scoping (`forTenant()`)
- After schema changes: `pnpm --filter @zeru/api db:generate` then `pnpm --filter @zeru/api db:migrate`

### Validation
- Zod schemas in `dto/` files, applied via `@Body(new ZodValidationPipe(schema))`
- Pipe: `apps/api/src/common/pipes/zod-validation.pipe.ts`

### Frontend
- Next.js 16, App Router at `apps/web/app/`
- Dashboard layout: `apps/web/app/(dashboard)/layout.tsx` — wraps with AuthProvider → TenantProvider → OnboardingGuard → SidebarProvider
- API client: `apps/web/lib/api-client.ts` — custom fetch wrapper with token + `x-tenant-id` header
- Auth state: `apps/web/hooks/use-auth.ts` — token from localStorage
- UI: shadcn/ui components in `apps/web/components/ui/`
- Shared types: `packages/shared/src/` — exported from `packages/shared/src/index.ts`
- No Zustand or React Query currently — will be new dependencies

### Environment
- API port: `API_PORT` env var (default 3001, dev uses 3017)
- CORS: `CORS_ORIGIN` env var
- Redis (docker-compose.yml): `localhost:6380` in dev

---

## File Structure

### New files to create

**Backend (apps/api/src/):**
```
modules/realtime/
├── realtime.module.ts              — WebSocket gateway + Redis adapter config
├── realtime.gateway.ts             — Socket.IO gateway with JWT auth
├── realtime.adapter.ts             — Redis IO adapter for Socket.IO
├── dto/
│   └── index.ts                    — Zod schemas for WS events

modules/presence/
├── presence.module.ts              — Presence tracking
├── presence.service.ts             — Redis sorted set operations
├── presence.cleanup.ts             — Cron job for stale cleanup

modules/lock/
├── lock.module.ts                  — Field-level locking
├── lock.service.ts                 — Acquire/release/heartbeat/cleanup

modules/team-chat/
├── team-chat.module.ts             — Chat channels + messages
├── team-chat.service.ts            — Channel CRUD, message CRUD
├── team-chat.controller.ts         — REST endpoints (history, search, channels)
├── dto/
│   └── index.ts                    — Zod schemas

modules/notification/
├── notification.module.ts          — Event bus listener + delivery
├── notification.service.ts         — Fan-out logic
├── notification.controller.ts      — REST (list, mark read, preferences)
├── dto/
│   └── index.ts

modules/audit/
├── audit.module.ts                 — Prisma middleware + context
├── audit.service.ts                — Query audit logs
├── audit.middleware.ts             — Prisma $use middleware
├── request-context.ts              — AsyncLocalStorage wrapper

common/services/
├── redis.service.ts                — ioredis singleton
├── redis.module.ts                 — Global Redis module
```

**Frontend (apps/web/):**
```
providers/
├── socket-provider.tsx             — Socket.IO client connection
├── query-provider.tsx              — React Query provider

stores/
├── presence-store.ts               — Zustand: online users + view users
├── chat-store.ts                   — Zustand: messages, typing, unreads
├── realtime-store.ts               — Zustand: locks, notifications

components/realtime/
├── presence-sync.tsx               — Auto-sync route → presence
├── notification-sync.tsx           — Listen for notification events
├── avatar-stack.tsx                — Overlapping avatars for presence
├── online-indicator.tsx            — Green/gray dot
├── field-lock.tsx                  — Lock wrapper for editable fields
├── reconnection-banner.tsx         — Connection status banner

components/chat/
├── chat-sidebar.tsx                — Channel list
├── chat-channel.tsx                — Message list + input
├── chat-message.tsx                — Single message render
├── chat-thread.tsx                 — Thread panel
├── chat-input.tsx                  — Message composer
├── typing-indicator.tsx            — "X is typing..."

components/notifications/
├── notification-bell.tsx           — Bell icon + badge
├── notification-list.tsx           — Dropdown list

hooks/
├── use-socket.ts                   — Hook to access socket from context
├── use-presence.ts                 — Hook for presence data
```

**Shared (packages/shared/src/):**
```
realtime.ts                         — Event types, PresenceUser, lock types
chat.ts                             — Channel, ChatMessage, ChannelMember types
notification.ts                     — Notification, DomainEvent types
```

### Files to modify

```
apps/api/src/app.module.ts                  — Import new modules
apps/api/src/main.ts                        — Add Socket.IO adapter
apps/api/prisma/schema.prisma               — Add new models
apps/api/package.json                       — New dependencies
apps/web/package.json                       — New dependencies
apps/web/app/(dashboard)/layout.tsx         — Add SocketProvider, QueryProvider
apps/web/app/layout.tsx                     — (no change needed, providers go in dashboard)
packages/shared/src/index.ts                — Export new types
packages/shared/package.json                — (no changes, TS only)
nginx/nginx.conf                            — Add /socket.io/ location
```

---

## Phase 1: Infrastructure + Presence

### Task 1: Install backend dependencies

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install WebSocket and Redis packages**

```bash
cd apps/api
pnpm add @nestjs/websockets@^11 @nestjs/platform-socket.io@^11 socket.io@^4.8 @socket.io/redis-adapter@^8.3 ioredis@^5 @nestjs/event-emitter@^3 @nestjs/schedule@^6
```

- [ ] **Step 2: Install BullMQ packages (needed for notifications later, install now to avoid re-running)**

```bash
cd apps/api
pnpm add @nestjs/bullmq@^11 bullmq@^5
```

- [ ] **Step 3: Verify build succeeds**

```bash
pnpm --filter @zeru/api build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore: add websocket, redis adapter, and bullmq dependencies"
```

---

### Task 2: Install frontend dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install real-time and state management packages**

```bash
cd apps/web
pnpm add socket.io-client@^4.8 zustand@^5 @tanstack/react-query@^5 @tanstack/react-virtual@^3
```

- [ ] **Step 2: Verify build succeeds**

```bash
pnpm --filter @zeru/web build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: add socket.io-client, zustand, react-query, react-virtual"
```

---

### Task 3: Shared real-time types

**Files:**
- Create: `packages/shared/src/realtime.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create shared real-time types**

Create `packages/shared/src/realtime.ts`:

```typescript
// ─── Presence ────────────────────────────────────────────

export interface PresenceUser {
  userId: string;
  name: string;
  avatar: string | null;
  color: string;
}

export interface PresenceSnapshot {
  viewPath: string;
  users: PresenceUser[];
}

export interface PresenceUpdate {
  viewPath: string;
  event: 'joined' | 'left';
  user: PresenceUser;
  users: PresenceUser[];
}

export interface OnlineUsersUpdate {
  users: string[];
}

// ─── Locking ─────────────────────────────────────────────

export interface LockAcquirePayload {
  entityType: string;
  entityId: string;
  fieldName: string;
}

export interface LockDeniedPayload extends LockAcquirePayload {
  heldBy: PresenceUser;
}

export interface FieldLockedPayload extends LockAcquirePayload {
  user: PresenceUser;
}

export interface EntityUpdatedPayload {
  entityType: string;
  entityId: string;
  fieldName: string;
  value: unknown;
  version: number;
  updatedBy: PresenceUser | { actorType: 'SYSTEM' | 'AI' | 'WEBHOOK' };
}

export interface EntityConflictPayload {
  entityType: string;
  entityId: string;
  fieldName: string;
  currentValue: unknown;
  currentVersion: number;
}

export interface LockForceReleasedPayload extends LockAcquirePayload {
  reason: string;
}

// ─── WebSocket Event Maps ────────────────────────────────

export interface ClientToServerEvents {
  'presence:join': (data: { viewPath: string }) => void;
  'presence:leave': (data: { viewPath: string }) => void;
  'presence:heartbeat': () => void;
  'lock:acquire': (data: LockAcquirePayload) => void;
  'lock:release': (data: LockAcquirePayload) => void;
  'lock:heartbeat': (data: LockAcquirePayload) => void;
}

export interface ServerToClientEvents {
  'presence:snapshot': (data: PresenceSnapshot) => void;
  'presence:update': (data: PresenceUpdate) => void;
  'presence:online': (data: OnlineUsersUpdate) => void;
  'lock:acquired': (data: LockAcquirePayload) => void;
  'lock:denied': (data: LockDeniedPayload) => void;
  'lock:field-locked': (data: FieldLockedPayload) => void;
  'lock:field-unlocked': (data: LockAcquirePayload) => void;
  'lock:force-released': (data: LockForceReleasedPayload) => void;
  'entity:updated': (data: EntityUpdatedPayload) => void;
  'entity:conflict': (data: EntityConflictPayload) => void;
  'notification:new': (data: { id: string; type: string; title: string; body?: string; data: Record<string, unknown> }) => void;
  'notification:count': (data: { unread: number }) => void;
}
```

- [ ] **Step 2: Export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from './realtime';
```

- [ ] **Step 3: Verify shared package builds**

```bash
pnpm --filter @zeru/shared build
```

Expected: Build succeeds (or if it's TS-only with no build step, verify types resolve).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/realtime.ts packages/shared/src/index.ts
git commit -m "feat(shared): add real-time event types for presence and locking"
```

---

### Task 4: Redis module

**Files:**
- Create: `apps/api/src/common/services/redis.module.ts`
- Create: `apps/api/src/common/services/redis.service.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create RedisService**

Create `apps/api/src/common/services/redis.service.ts`:

```typescript
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
      maxRetriesPerRequest: null,
    });
  }

  async onModuleDestroy() {
    await this.quit();
  }
}
```

- [ ] **Step 2: Create RedisModule (global)**

Create `apps/api/src/common/services/redis.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

- [ ] **Step 3: Import RedisModule in AppModule**

In `apps/api/src/app.module.ts`, add to imports array:

```typescript
import { RedisModule } from './common/services/redis.module';

// In @Module imports:
RedisModule,
```

- [ ] **Step 4: Verify build**

```bash
pnpm --filter @zeru/api build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/services/redis.service.ts apps/api/src/common/services/redis.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): add global Redis module with ioredis"
```

---

### Task 5: Socket.IO Redis adapter

**Files:**
- Create: `apps/api/src/modules/realtime/realtime.adapter.ts`

- [ ] **Step 1: Create the Redis IO adapter**

Create `apps/api/src/modules/realtime/realtime.adapter.ts`:

```typescript
import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | undefined;

  constructor(
    app: INestApplication,
    private readonly config: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisHost = this.config.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.config.get<number>('REDIS_PORT', 6379);

    const pubClient = new Redis({ host: redisHost, port: redisPort });
    const subClient = pubClient.duplicate();

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.config.get('CORS_ORIGIN', 'http://localhost:3027'),
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/realtime/realtime.adapter.ts
git commit -m "feat(api): add Redis IO adapter for Socket.IO horizontal scaling"
```

---

### Task 6: WebSocket gateway with JWT auth

**Files:**
- Create: `apps/api/src/modules/realtime/realtime.gateway.ts`
- Create: `apps/api/src/modules/realtime/realtime.module.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the WebSocket gateway**

Create `apps/api/src/modules/realtime/realtime.gateway.ts`:

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
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
    } catch (error) {
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
```

- [ ] **Step 2: Create RealtimeModule**

Create `apps/api/src/modules/realtime/realtime.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
```

- [ ] **Step 3: Update main.ts to use Redis adapter**

In `apps/api/src/main.ts`, add the adapter setup **before** `app.listen()`:

```typescript
import { RedisIoAdapter } from './modules/realtime/realtime.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ... existing config (json limit, CORS, global prefix) ...

  // WebSocket adapter with Redis
  const config = app.get(ConfigService);
  const redisIoAdapter = new RedisIoAdapter(app, config);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(port);
}
```

- [ ] **Step 4: Import RealtimeModule in AppModule**

In `apps/api/src/app.module.ts`, add:

```typescript
import { RealtimeModule } from './modules/realtime/realtime.module';

// In @Module imports:
RealtimeModule,
```

- [ ] **Step 5: Verify build**

```bash
pnpm --filter @zeru/api build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/realtime/ apps/api/src/main.ts apps/api/src/app.module.ts
git commit -m "feat(api): add WebSocket gateway with JWT auth and Redis adapter"
```

---

### Task 7: Presence service (Redis sorted sets)

**Files:**
- Create: `apps/api/src/modules/presence/presence.service.ts`
- Create: `apps/api/src/modules/presence/presence.cleanup.ts`
- Create: `apps/api/src/modules/presence/presence.module.ts`
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create PresenceService**

Create `apps/api/src/modules/presence/presence.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/services/redis.service';
import { PresenceUser } from '@zeru/shared';

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly STALE_THRESHOLD_MS = 60_000;

  constructor(private readonly redis: RedisService) {}

  private globalKey(tenantId: string): string {
    return `presence:tenant:${tenantId}`;
  }

  private viewKey(tenantId: string, viewPath: string): string {
    return `presence:tenant:${tenantId}:view:${viewPath}`;
  }

  private metaKey(userId: string): string {
    return `presence:meta:${userId}`;
  }

  async setUserMeta(user: PresenceUser): Promise<void> {
    await this.redis.hset(this.metaKey(user.userId), {
      name: user.name,
      avatar: user.avatar ?? '',
      color: user.color,
    });
    await this.redis.expire(this.metaKey(user.userId), 86400);
  }

  async getUserMeta(userId: string): Promise<PresenceUser | null> {
    const meta = await this.redis.hgetall(this.metaKey(userId));
    if (!meta || !meta.name) return null;
    return {
      userId,
      name: meta.name,
      avatar: meta.avatar || null,
      color: meta.color,
    };
  }

  async goOnline(tenantId: string, userId: string): Promise<void> {
    await this.redis.zadd(this.globalKey(tenantId), Date.now(), userId);
  }

  async goOffline(tenantId: string, userId: string): Promise<void> {
    await this.redis.zrem(this.globalKey(tenantId), userId);
  }

  async getOnlineUsers(tenantId: string): Promise<string[]> {
    const cutoff = Date.now() - this.STALE_THRESHOLD_MS;
    return this.redis.zrangebyscore(this.globalKey(tenantId), cutoff, '+inf');
  }

  async joinView(
    tenantId: string,
    userId: string,
    viewPath: string,
  ): Promise<void> {
    await this.redis.zadd(
      this.viewKey(tenantId, viewPath),
      Date.now(),
      userId,
    );
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
    const cutoff = Date.now() - this.STALE_THRESHOLD_MS;
    const userIds = await this.redis.zrangebyscore(
      this.viewKey(tenantId, viewPath),
      cutoff,
      '+inf',
    );

    const users: PresenceUser[] = [];
    for (const userId of userIds) {
      const meta = await this.getUserMeta(userId);
      if (meta) users.push(meta);
    }
    return users;
  }

  async heartbeat(tenantId: string, userId: string): Promise<void> {
    await this.redis.zadd(this.globalKey(tenantId), Date.now(), userId);
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
  }

  async removeStaleUsers(tenantId: string): Promise<string[]> {
    const cutoff = Date.now() - this.STALE_THRESHOLD_MS;
    const globalKey = this.globalKey(tenantId);

    const staleUsers = await this.redis.zrangebyscore(
      globalKey,
      '-inf',
      cutoff,
    );

    if (staleUsers.length > 0) {
      await this.redis.zremrangebyscore(globalKey, '-inf', cutoff);
    }

    return staleUsers;
  }

  async removeStaleViewUsers(
    tenantId: string,
    viewPath: string,
  ): Promise<string[]> {
    const cutoff = Date.now() - this.STALE_THRESHOLD_MS;
    const key = this.viewKey(tenantId, viewPath);

    const staleUsers = await this.redis.zrangebyscore(key, '-inf', cutoff);

    if (staleUsers.length > 0) {
      await this.redis.zremrangebyscore(key, '-inf', cutoff);
    }

    return staleUsers;
  }

  async getAllViewKeys(tenantId: string): Promise<string[]> {
    return this.redis.keys(`presence:tenant:${tenantId}:view:*`);
  }

  async removeUserFromAllViews(
    tenantId: string,
    userId: string,
  ): Promise<string[]> {
    const viewKeys = await this.getAllViewKeys(tenantId);
    const removedFrom: string[] = [];

    for (const key of viewKeys) {
      const removed = await this.redis.zrem(key, userId);
      if (removed > 0) {
        const viewPath = key.replace(
          `presence:tenant:${tenantId}:view:`,
          '',
        );
        removedFrom.push(viewPath);
      }
    }

    return removedFrom;
  }

  userColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }
}
```

- [ ] **Step 2: Create PresenceCleanup cron**

Create `apps/api/src/modules/presence/presence.cleanup.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PresenceService } from './presence.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RedisService } from '../../common/services/redis.service';

@Injectable()
export class PresenceCleanup {
  private readonly logger = new Logger(PresenceCleanup.name);

  constructor(
    private readonly presence: PresenceService,
    private readonly gateway: RealtimeGateway,
    private readonly redis: RedisService,
  ) {}

  @Cron('*/15 * * * * *')
  async cleanStalePresence() {
    const tenantKeys = await this.redis.keys('presence:tenant:*');
    const tenantIds = new Set<string>();

    for (const key of tenantKeys) {
      const match = key.match(/^presence:tenant:([^:]+)$/);
      if (match) tenantIds.add(match[1]);
    }

    for (const tenantId of tenantIds) {
      const staleGlobal =
        await this.presence.removeStaleUsers(tenantId);

      if (staleGlobal.length > 0) {
        const onlineUsers =
          await this.presence.getOnlineUsers(tenantId);
        this.gateway.emitToTenant(tenantId, 'presence:online', {
          users: onlineUsers,
        });
      }

      const viewKeys = await this.presence.getAllViewKeys(tenantId);
      for (const viewKey of viewKeys) {
        const viewPath = viewKey.replace(
          `presence:tenant:${tenantId}:view:`,
          '',
        );
        const staleView = await this.presence.removeStaleViewUsers(
          tenantId,
          viewPath,
        );

        if (staleView.length > 0) {
          const viewUsers = await this.presence.getViewUsers(
            tenantId,
            viewPath,
          );
          this.gateway.emitToRoom(
            `tenant:${tenantId}:view:${viewPath}`,
            'presence:update',
            {
              viewPath,
              event: 'left',
              user: { userId: staleView[0], name: 'Unknown', avatar: null, color: '#999' },
              users: viewUsers,
            },
          );
        }
      }
    }
  }
}
```

- [ ] **Step 3: Create PresenceModule**

Create `apps/api/src/modules/presence/presence.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PresenceService } from './presence.service';
import { PresenceCleanup } from './presence.cleanup';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [ScheduleModule.forRoot(), RealtimeModule],
  providers: [PresenceService, PresenceCleanup],
  exports: [PresenceService],
})
export class PresenceModule {}
```

- [ ] **Step 4: Add presence event handlers to RealtimeGateway**

Add these methods to `apps/api/src/modules/realtime/realtime.gateway.ts`:

```typescript
import { PresenceService } from '../presence/presence.service';
import { forwardRef, Inject } from '@nestjs/common';

// Add to constructor:
@Inject(forwardRef(() => PresenceService))
private readonly presence: PresenceService,

// Add these methods to the class:

async handleConnection(client: AuthenticatedSocket) {
  // ... existing JWT validation code ...

  // After setting client.data, add:
  const userColor = this.presence.userColor(client.data.userId);
  await this.presence.setUserMeta({
    userId: client.data.userId,
    name: client.data.userName,
    avatar: client.data.userAvatar,
    color: userColor,
  });
  await this.presence.goOnline(client.data.tenantId, client.data.userId);

  const onlineUsers = await this.presence.getOnlineUsers(client.data.tenantId);
  this.emitToTenant(client.data.tenantId, 'presence:online', { users: onlineUsers });
}

async handleDisconnect(client: AuthenticatedSocket) {
  if (!client.data?.userId) return;

  const { userId, tenantId } = client.data;

  const removedViews = await this.presence.removeUserFromAllViews(tenantId, userId);
  await this.presence.goOffline(tenantId, userId);

  for (const viewPath of removedViews) {
    const viewUsers = await this.presence.getViewUsers(tenantId, viewPath);
    const userMeta = await this.presence.getUserMeta(userId);
    this.emitToRoom(`tenant:${tenantId}:view:${viewPath}`, 'presence:update', {
      viewPath,
      event: 'left',
      user: userMeta ?? { userId, name: 'Unknown', avatar: null, color: '#999' },
      users: viewUsers,
    });
  }

  const onlineUsers = await this.presence.getOnlineUsers(tenantId);
  this.emitToTenant(tenantId, 'presence:online', { users: onlineUsers });

  this.logger.log(`Client disconnected: ${userId}`);
}

@SubscribeMessage('presence:join')
async handlePresenceJoin(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: { viewPath: string },
) {
  const { userId, tenantId } = client.data;
  const room = `tenant:${tenantId}:view:${data.viewPath}`;

  await this.presence.joinView(tenantId, userId, data.viewPath);
  await client.join(room);

  const viewUsers = await this.presence.getViewUsers(tenantId, data.viewPath);
  const userMeta = await this.presence.getUserMeta(userId);

  client.emit('presence:snapshot', { viewPath: data.viewPath, users: viewUsers });

  if (userMeta) {
    client.to(room).emit('presence:update', {
      viewPath: data.viewPath,
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
  const { userId, tenantId } = client.data;
  const room = `tenant:${tenantId}:view:${data.viewPath}`;

  await this.presence.leaveView(tenantId, userId, data.viewPath);
  await client.leave(room);

  const viewUsers = await this.presence.getViewUsers(tenantId, data.viewPath);
  const userMeta = await this.presence.getUserMeta(userId);

  if (userMeta) {
    this.emitToRoom(room, 'presence:update', {
      viewPath: data.viewPath,
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
  const { userId, tenantId } = client.data;
  await this.presence.heartbeat(tenantId, userId);
}
```

Note: The `handleConnection` and `handleDisconnect` in this step **replace** the ones from Task 6. Merge them — keep the JWT validation from Task 6 and add the presence calls shown here after `client.data` is set.

- [ ] **Step 5: Update RealtimeModule to use forwardRef for circular dependency**

Update `apps/api/src/modules/realtime/realtime.module.ts`:

```typescript
import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => PresenceModule),
  ],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
```

- [ ] **Step 6: Import PresenceModule in AppModule**

In `apps/api/src/app.module.ts`, add:

```typescript
import { PresenceModule } from './modules/presence/presence.module';

// In @Module imports:
PresenceModule,
```

- [ ] **Step 7: Verify build**

```bash
pnpm --filter @zeru/api build
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/presence/ apps/api/src/modules/realtime/ apps/api/src/app.module.ts
git commit -m "feat(api): add presence system with Redis sorted sets and cron cleanup"
```

---

### Task 8: Audit module (Prisma middleware + AsyncLocalStorage)

**Files:**
- Create: `apps/api/src/modules/audit/request-context.ts`
- Create: `apps/api/src/modules/audit/audit.service.ts`
- Create: `apps/api/src/modules/audit/audit.middleware.ts`
- Create: `apps/api/src/modules/audit/audit.module.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Add AuditLog model to Prisma schema**

Add to `apps/api/prisma/schema.prisma`:

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  entityType String
  entityId   String
  action     String
  changes    Json?
  snapshot   Json?
  actorType  String
  actorId    String?
  source     String
  ipAddress  String?
  userAgent  String?
  socketId   String?
  tenantId   String
  createdAt  DateTime @default(now())

  @@index([entityType, entityId, createdAt])
  @@index([actorId, createdAt])
  @@index([tenantId, createdAt])
  @@index([tenantId, entityType, createdAt])
  @@map("audit_logs")
}
```

- [ ] **Step 2: Run migration**

```bash
cd apps/api
pnpm db:generate
pnpm db:migrate --name add_audit_log
```

- [ ] **Step 3: Create RequestContext (AsyncLocalStorage)**

Create `apps/api/src/modules/audit/request-context.ts`:

```typescript
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextData {
  actorType: 'USER' | 'SYSTEM' | 'AI' | 'WEBHOOK';
  actorId: string | null;
  tenantId: string;
  source: string;
  ipAddress?: string;
  userAgent?: string;
  socketId?: string;
}

const storage = new AsyncLocalStorage<RequestContextData>();

export const RequestContext = {
  run: <T>(data: RequestContextData, fn: () => T): T => {
    return storage.run(data, fn);
  },
  get: (): RequestContextData | undefined => {
    return storage.getStore();
  },
};
```

- [ ] **Step 4: Create AuditService**

Create `apps/api/src/modules/audit/audit.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContext, RequestContextData } from './request-context';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    entityType: string;
    entityId: string;
    action: string;
    changes?: Record<string, { from: unknown; to: unknown }>;
    snapshot?: Record<string, unknown>;
    context?: Partial<RequestContextData>;
  }) {
    const ctx = RequestContext.get();
    const merged = { ...ctx, ...params.context };

    await this.prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        changes: params.changes ?? undefined,
        snapshot: params.snapshot ?? undefined,
        actorType: merged?.actorType ?? 'SYSTEM',
        actorId: merged?.actorId ?? null,
        source: merged?.source ?? 'unknown',
        ipAddress: merged?.ipAddress ?? null,
        userAgent: merged?.userAgent ?? null,
        socketId: merged?.socketId ?? null,
        tenantId: merged?.tenantId ?? 'unknown',
      },
    });
  }

  async getEntityHistory(
    entityType: string,
    entityId: string,
    options?: { limit?: number; offset?: number },
  ) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }
}
```

- [ ] **Step 5: Create AuditMiddleware (NestJS HTTP middleware for RequestContext)**

Create `apps/api/src/modules/audit/audit.middleware.ts`:

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContext } from './request-context';

@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;
    const tenantId =
      (req as any).tenantId ||
      req.headers['x-tenant-id'] as string ||
      'unknown';

    RequestContext.run(
      {
        actorType: 'USER',
        actorId: user?.id ?? null,
        tenantId,
        source: 'web',
        ipAddress: req.ip ?? undefined,
        userAgent: req.headers['user-agent'] ?? undefined,
      },
      () => next(),
    );
  }
}
```

- [ ] **Step 6: Create AuditModule**

Create `apps/api/src/modules/audit/audit.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
```

- [ ] **Step 7: Import AuditModule and apply middleware in AppModule**

In `apps/api/src/app.module.ts`:

```typescript
import { AuditModule } from './modules/audit/audit.module';
import { AuditContextMiddleware } from './modules/audit/audit.middleware';

// In @Module imports:
AuditModule,

// In configure() method, add AFTER TenantResolverMiddleware:
consumer.apply(AuditContextMiddleware).forRoutes('*');
```

- [ ] **Step 8: Verify build and migration**

```bash
pnpm --filter @zeru/api build
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/audit/ apps/api/prisma/schema.prisma apps/api/prisma/migrations/ apps/api/src/app.module.ts
git commit -m "feat(api): add audit module with AsyncLocalStorage context and Prisma model"
```

---

### Task 9: Nginx WebSocket config

**Files:**
- Modify: `nginx/nginx.conf`

- [ ] **Step 1: Read current nginx config**

Read `nginx/nginx.conf` to understand the current structure.

- [ ] **Step 2: Add Socket.IO location block**

Add this block **before** the catch-all `/` location:

```nginx
location /socket.io/ {
    proxy_pass http://zeru_api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

- [ ] **Step 3: Commit**

```bash
git add nginx/nginx.conf
git commit -m "feat(infra): add nginx WebSocket proxy for Socket.IO"
```

---

### Task 10: Frontend — SocketProvider + useSocket hook

**Files:**
- Create: `apps/web/providers/socket-provider.tsx`
- Create: `apps/web/hooks/use-socket.ts`
- Modify: `apps/web/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create useSocket hook**

Create `apps/web/hooks/use-socket.ts`:

```typescript
"use client";

import { createContext, useContext } from "react";
import type { Socket } from "socket.io-client";

export const SocketContext = createContext<Socket | null>(null);

export function useSocket() {
  return useContext(SocketContext);
}
```

- [ ] **Step 2: Create SocketProvider**

Create `apps/web/providers/socket-provider.tsx`:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { SocketContext } from "@/hooks/use-socket";

const WS_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ?? "http://localhost:3017";

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const newSocket = io(WS_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("[WS] Connected:", newSocket.id);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("[WS] Disconnected:", reason);
    });

    newSocket.on("connect_error", (err) => {
      console.error("[WS] Connection error:", err.message);
    });

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}
```

- [ ] **Step 3: Add SocketProvider to dashboard layout**

In `apps/web/app/(dashboard)/layout.tsx`, wrap children with SocketProvider. Add it **inside** AuthProvider and TenantProvider (it needs auth token to connect):

```typescript
import { SocketProvider } from "@/providers/socket-provider";

// Inside the layout JSX, wrap the content:
<AuthProvider>
  <TenantProvider>
    <SocketProvider>
      {/* ... existing OnboardingGuard, SidebarProvider, etc. ... */}
    </SocketProvider>
  </TenantProvider>
</AuthProvider>
```

- [ ] **Step 4: Verify build**

```bash
pnpm --filter @zeru/web build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/providers/socket-provider.tsx apps/web/hooks/use-socket.ts apps/web/app/\(dashboard\)/layout.tsx
git commit -m "feat(web): add SocketProvider with auto-connect and reconnection"
```

---

### Task 11: Frontend — Zustand presence store

**Files:**
- Create: `apps/web/stores/presence-store.ts`

- [ ] **Step 1: Create presence store**

Create `apps/web/stores/presence-store.ts`:

```typescript
import { create } from "zustand";
import type { PresenceUser } from "@zeru/shared";

interface PresenceState {
  onlineUsers: string[];
  viewUsers: Map<string, PresenceUser[]>;

  setOnlineUsers: (users: string[]) => void;
  setViewUsers: (viewPath: string, users: PresenceUser[]) => void;
  clearViewUsers: (viewPath: string) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUsers: [],
  viewUsers: new Map(),

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  setViewUsers: (viewPath, users) =>
    set((state) => {
      const next = new Map(state.viewUsers);
      next.set(viewPath, users);
      return { viewUsers: next };
    }),

  clearViewUsers: (viewPath) =>
    set((state) => {
      const next = new Map(state.viewUsers);
      next.delete(viewPath);
      return { viewUsers: next };
    }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/stores/presence-store.ts
git commit -m "feat(web): add Zustand presence store for online and view users"
```

---

### Task 12: Frontend — PresenceSync + AvatarStack + OnlineIndicator

**Files:**
- Create: `apps/web/components/realtime/presence-sync.tsx`
- Create: `apps/web/components/realtime/avatar-stack.tsx`
- Create: `apps/web/components/realtime/online-indicator.tsx`
- Create: `apps/web/components/realtime/reconnection-banner.tsx`
- Modify: `apps/web/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create PresenceSync**

Create `apps/web/components/realtime/presence-sync.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSocket } from "@/hooks/use-socket";
import { usePresenceStore } from "@/stores/presence-store";
import type { PresenceSnapshot, PresenceUpdate, OnlineUsersUpdate } from "@zeru/shared";

export function PresenceSync() {
  const pathname = usePathname();
  const socket = useSocket();
  const { setOnlineUsers, setViewUsers } = usePresenceStore();

  // Listen for global online/offline events
  useEffect(() => {
    if (!socket) return;

    const handleOnline = (data: OnlineUsersUpdate) => {
      setOnlineUsers(data.users);
    };

    socket.on("presence:online", handleOnline);
    return () => {
      socket.off("presence:online", handleOnline);
    };
  }, [socket, setOnlineUsers]);

  // Join/leave views on route change
  useEffect(() => {
    if (!socket || !pathname) return;

    socket.emit("presence:join", { viewPath: pathname });

    const handleSnapshot = (data: PresenceSnapshot) => {
      if (data.viewPath === pathname) {
        setViewUsers(pathname, data.users);
      }
    };

    const handleUpdate = (data: PresenceUpdate) => {
      if (data.viewPath === pathname) {
        setViewUsers(pathname, data.users);
      }
    };

    socket.on("presence:snapshot", handleSnapshot);
    socket.on("presence:update", handleUpdate);

    return () => {
      socket.emit("presence:leave", { viewPath: pathname });
      socket.off("presence:snapshot", handleSnapshot);
      socket.off("presence:update", handleUpdate);
    };
  }, [socket, pathname, setViewUsers]);

  // Heartbeat every 30 seconds
  useEffect(() => {
    if (!socket) return;

    const interval = setInterval(() => {
      socket.emit("presence:heartbeat");
    }, 30_000);

    return () => clearInterval(interval);
  }, [socket]);

  return null;
}
```

- [ ] **Step 2: Create AvatarStack**

Create `apps/web/components/realtime/avatar-stack.tsx`:

```typescript
"use client";

import { usePresenceStore } from "@/stores/presence-store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PresenceUser } from "@zeru/shared";

const MAX_VISIBLE = 4;

function UserAvatar({ user, size = 32 }: { user: PresenceUser; size?: number }) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="rounded-full flex items-center justify-center text-white text-xs font-medium ring-2 ring-background"
          style={{
            width: size,
            height: size,
            backgroundColor: user.color,
          }}
        >
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="rounded-full w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>{user.name}</TooltipContent>
    </Tooltip>
  );
}

export function AvatarStack({ viewPath }: { viewPath: string }) {
  const viewUsers = usePresenceStore((s) => s.viewUsers.get(viewPath) ?? []);

  if (viewUsers.length === 0) return null;

  const visible = viewUsers.slice(0, MAX_VISIBLE);
  const overflow = viewUsers.length - MAX_VISIBLE;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((user) => (
        <UserAvatar key={user.userId} user={user} />
      ))}
      {overflow > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <div className="rounded-full flex items-center justify-center bg-muted text-muted-foreground text-xs font-medium ring-2 ring-background cursor-pointer w-8 h-8">
              +{overflow}
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            <div className="space-y-2">
              {viewUsers.slice(MAX_VISIBLE).map((user) => (
                <div key={user.userId} className="flex items-center gap-2 text-sm">
                  <UserAvatar user={user} size={24} />
                  <span>{user.name}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create OnlineIndicator**

Create `apps/web/components/realtime/online-indicator.tsx`:

```typescript
"use client";

import { usePresenceStore } from "@/stores/presence-store";
import { cn } from "@/lib/utils";

export function OnlineIndicator({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const isOnline = usePresenceStore((s) => s.onlineUsers.includes(userId));

  return (
    <span
      className={cn(
        "inline-block w-2.5 h-2.5 rounded-full",
        isOnline ? "bg-green-500" : "bg-gray-400",
        className,
      )}
    />
  );
}
```

- [ ] **Step 4: Create ReconnectionBanner**

Create `apps/web/components/realtime/reconnection-banner.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/use-socket";

type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

export function ReconnectionBanner() {
  const socket = useSocket();
  const [status, setStatus] = useState<ConnectionStatus>("connected");

  useEffect(() => {
    if (!socket) return;

    if (socket.connected) setStatus("connected");
    else setStatus("disconnected");

    const onConnect = () => setStatus("connected");
    const onDisconnect = () => setStatus("disconnected");
    const onReconnectAttempt = () => setStatus("reconnecting");

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
    };
  }, [socket]);

  if (status === "connected") return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 text-center text-sm py-1 font-medium",
        status === "disconnected" && "bg-yellow-500 text-yellow-950",
        status === "reconnecting" && "bg-yellow-500 text-yellow-950",
      )}
    >
      {status === "disconnected" && "Conexión perdida. Reconectando..."}
      {status === "reconnecting" && "Reconectando..."}
    </div>
  );
}
```

Add missing import at the top of the file:

```typescript
import { cn } from "@/lib/utils";
```

- [ ] **Step 5: Add PresenceSync and ReconnectionBanner to dashboard layout**

In `apps/web/app/(dashboard)/layout.tsx`, inside the `<SocketProvider>`:

```typescript
import { PresenceSync } from "@/components/realtime/presence-sync";
import { ReconnectionBanner } from "@/components/realtime/reconnection-banner";

// Inside SocketProvider:
<SocketProvider>
  <PresenceSync />
  <ReconnectionBanner />
  {/* ... existing content ... */}
</SocketProvider>
```

- [ ] **Step 6: Verify build**

```bash
pnpm --filter @zeru/web build
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/realtime/ apps/web/app/\(dashboard\)/layout.tsx
git commit -m "feat(web): add PresenceSync, AvatarStack, OnlineIndicator, and ReconnectionBanner"
```

---

### Task 13: Add environment variables

**Files:**
- Modify: `apps/api/.env` (or `.env.example`)
- Modify: `apps/web/.env` (or `.env.example`)

- [ ] **Step 1: Add Redis env vars to API**

Add to `apps/api/.env` (if it exists) or document in `.env.example`:

```
REDIS_HOST=localhost
REDIS_PORT=6380
```

Note: Port 6380 maps to Redis container's 6379 in docker-compose.yml.

- [ ] **Step 2: Verify NEXT_PUBLIC_API_URL is set for frontend**

The frontend SocketProvider derives the WebSocket URL from `NEXT_PUBLIC_API_URL` by stripping `/api`. Verify this env var exists. No new env var needed.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: add Redis environment variables"
```

---

## Phase 2: Team Chat

### Task 14: Chat Prisma models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add chat models to schema**

Add to `apps/api/prisma/schema.prisma`:

```prisma
enum ChannelType {
  PUBLIC
  PRIVATE
  DM
  GROUP_DM
}

model Channel {
  id           String      @id @default(uuid())
  name         String?
  slug         String?
  type         ChannelType
  topic        String?
  description  String?
  lastSequence BigInt      @default(0)
  isArchived   Boolean     @default(false)
  deletedAt    DateTime?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  tenantId    String
  tenant      Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  createdById String
  createdBy   User   @relation("ChannelCreator", fields: [createdById], references: [id])

  members  ChannelMember[]
  messages ChatMessage[]

  @@unique([tenantId, slug])
  @@index([tenantId])
  @@index([tenantId, type])
  @@map("channels")
}

model ChannelMember {
  id               String   @id @default(uuid())
  role             String   @default("MEMBER")
  lastReadSequence BigInt   @default(0)
  isMuted          Boolean  @default(false)
  joinedAt         DateTime @default(now())

  channelId String
  channel   Channel @relation(fields: [channelId], references: [id], onDelete: Cascade)

  userId String
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([channelId, userId])
  @@index([userId])
  @@map("channel_members")
}

model ChatMessage {
  id        String    @id @default(uuid())
  content   String
  sequence  BigInt
  editedAt  DateTime?
  deletedAt DateTime?
  createdAt DateTime  @default(now())

  channelId String
  channel   Channel @relation(fields: [channelId], references: [id], onDelete: Cascade)

  authorId String
  author   User @relation("ChatMessageAuthor", fields: [authorId], references: [id])

  threadParentId    String?
  threadParent      ChatMessage?  @relation("Thread", fields: [threadParentId], references: [id])
  threadReplies     ChatMessage[] @relation("Thread")
  threadReplyCount  Int           @default(0)
  lastThreadReplyAt DateTime?

  attachments ChatAttachment[]
  reactions   ChatReaction[]
  mentions    ChatMention[]

  @@index([channelId, sequence])
  @@index([channelId, createdAt])
  @@index([threadParentId])
  @@map("chat_messages")
}

model ChatAttachment {
  id        String @id @default(uuid())
  name      String
  s3Key     String
  mimeType  String
  sizeBytes Int
  createdAt DateTime @default(now())

  messageId String
  message   ChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([messageId])
  @@map("chat_attachments")
}

model ChatReaction {
  id    String @id @default(uuid())
  emoji String

  messageId String
  message   ChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)

  userId String
  user   User @relation("ChatReactionUser", fields: [userId], references: [id])

  @@unique([messageId, userId, emoji])
  @@map("chat_reactions")
}

model ChatMention {
  id String @id @default(uuid())

  messageId       String
  message         ChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)

  mentionedUserId String
  mentionedUser   User @relation("ChatMentionTarget", fields: [mentionedUserId], references: [id])

  @@index([mentionedUserId])
  @@map("chat_mentions")
}
```

- [ ] **Step 2: Add relations to User model**

Add these relations to the existing `User` model in the schema:

```prisma
  channelsCreated     Channel[]       @relation("ChannelCreator")
  channelMemberships  ChannelMember[]
  chatMessages        ChatMessage[]   @relation("ChatMessageAuthor")
  chatReactions       ChatReaction[]  @relation("ChatReactionUser")
  chatMentionsOf      ChatMention[]   @relation("ChatMentionTarget")
```

- [ ] **Step 3: Add Channel relation to Tenant model**

Add to existing `Tenant` model:

```prisma
  channels            Channel[]
```

- [ ] **Step 4: Run migration**

```bash
cd apps/api
pnpm db:generate
pnpm db:migrate --name add_team_chat_models
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(api): add team chat Prisma models (Channel, ChatMessage, reactions, threads)"
```

---

### Task 15: Shared chat types

**Files:**
- Create: `packages/shared/src/chat.ts`
- Create: `packages/shared/src/notification.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create shared chat types**

Create `packages/shared/src/chat.ts`:

```typescript
export type ChannelType = 'PUBLIC' | 'PRIVATE' | 'DM' | 'GROUP_DM';

export interface Channel {
  id: string;
  name: string | null;
  slug: string | null;
  type: ChannelType;
  topic: string | null;
  description: string | null;
  lastSequence: string; // BigInt serialized as string
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  createdById: string;
  memberCount?: number;
  unreadCount?: number;
}

export interface ChannelMember {
  id: string;
  role: string;
  lastReadSequence: string;
  isMuted: boolean;
  joinedAt: string;
  channelId: string;
  userId: string;
  user?: { id: string; firstName: string; lastName: string; email: string };
}

export interface ChatMessage {
  id: string;
  content: string;
  sequence: string;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  channelId: string;
  authorId: string;
  author?: { id: string; firstName: string; lastName: string; email: string };
  threadParentId: string | null;
  threadReplyCount: number;
  lastThreadReplyAt: string | null;
  reactions?: ChatReaction[];
  mentions?: ChatMention[];
}

export interface ChatReaction {
  id: string;
  emoji: string;
  messageId: string;
  userId: string;
}

export interface ChatMention {
  id: string;
  messageId: string;
  mentionedUserId: string;
}

// ─── Chat WebSocket Events ──────────────────────────────

export interface ChatSendPayload {
  channelId: string;
  content: string;
  threadParentId?: string;
  mentions?: string[];
}

export interface ChatMessageEvent {
  id: string;
  channelId: string;
  sequence: string;
  content: string;
  author: { id: string; firstName: string; lastName: string };
  createdAt: string;
  threadParentId: string | null;
}

export interface ChatTypingPayload {
  channelId: string;
}

export interface ChatTypingEvent {
  channelId: string;
  userId: string;
  userName: string;
}

export interface ChatReadPayload {
  channelId: string;
  sequence: string;
}

export interface ChatReactPayload {
  messageId: string;
  emoji: string;
}

export interface ChatReactedEvent {
  messageId: string;
  emoji: string;
  userId: string;
  action: 'added' | 'removed';
}

export interface ChatEditPayload {
  messageId: string;
  content: string;
}

export interface ChatEditedEvent {
  messageId: string;
  content: string;
  editedAt: string;
}

export interface ChatDeletedEvent {
  messageId: string;
}
```

- [ ] **Step 2: Create shared notification types**

Create `packages/shared/src/notification.ts`:

```typescript
export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export type DomainEventType =
  | 'chat.message.sent'
  | 'chat.mention'
  | 'chat.reaction'
  | 'task.created'
  | 'task.assigned'
  | 'task.status_changed'
  | 'task.commented'
  | 'task.due_soon'
  | 'lock.force_released'
  | 'project.member_added'
  | 'project.member_removed'
  | 'system.field_updated';
```

- [ ] **Step 3: Add chat events to shared ClientToServerEvents and ServerToClientEvents**

Update `packages/shared/src/realtime.ts` to add chat events to the event maps:

```typescript
// Add these imports at the top:
import type {
  ChatSendPayload,
  ChatMessageEvent,
  ChatTypingPayload,
  ChatTypingEvent,
  ChatReadPayload,
  ChatReactPayload,
  ChatReactedEvent,
  ChatEditPayload,
  ChatEditedEvent,
  ChatDeletedEvent,
} from './chat';

// Add to ClientToServerEvents:
  'chat:send': (data: ChatSendPayload) => void;
  'chat:typing': (data: ChatTypingPayload) => void;
  'chat:read': (data: ChatReadPayload) => void;
  'chat:react': (data: ChatReactPayload) => void;
  'chat:edit': (data: ChatEditPayload) => void;
  'chat:delete': (data: { messageId: string }) => void;
  'channel:join': (data: { channelId: string }) => void;
  'channel:leave': (data: { channelId: string }) => void;

// Add to ServerToClientEvents:
  'chat:message': (data: ChatMessageEvent) => void;
  'chat:typing': (data: ChatTypingEvent) => void;
  'chat:typing:stop': (data: ChatTypingEvent) => void;
  'chat:read': (data: { channelId: string; userId: string; sequence: string }) => void;
  'chat:reacted': (data: ChatReactedEvent) => void;
  'chat:edited': (data: ChatEditedEvent) => void;
  'chat:deleted': (data: ChatDeletedEvent) => void;
```

- [ ] **Step 4: Export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from './chat';
export * from './notification';
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/
git commit -m "feat(shared): add chat and notification types with WebSocket event contracts"
```

---

### Task 16: TeamChat service (channel + message CRUD)

**Files:**
- Create: `apps/api/src/modules/team-chat/team-chat.service.ts`
- Create: `apps/api/src/modules/team-chat/team-chat.controller.ts`
- Create: `apps/api/src/modules/team-chat/dto/index.ts`
- Create: `apps/api/src/modules/team-chat/team-chat.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

Create `apps/api/src/modules/team-chat/dto/index.ts`:

```typescript
import { z } from 'zod';

export const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['PUBLIC', 'PRIVATE']),
  topic: z.string().max(250).optional(),
  description: z.string().max(1000).optional(),
  memberIds: z.array(z.string().uuid()).optional(),
});

export const createDmSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(8),
});

export const messagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  direction: z.enum(['before', 'after']).default('before'),
});

export const searchMessagesSchema = z.object({
  query: z.string().min(1).max(200),
  channelId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export type CreateChannelDto = z.infer<typeof createChannelSchema>;
export type CreateDmDto = z.infer<typeof createDmSchema>;
export type MessagesQueryDto = z.infer<typeof messagesQuerySchema>;
export type SearchMessagesDto = z.infer<typeof searchMessagesSchema>;
```

- [ ] **Step 2: Create TeamChatService**

Create `apps/api/src/modules/team-chat/team-chat.service.ts`:

```typescript
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { AuditService } from '../audit/audit.service';
import { CreateChannelDto, CreateDmDto } from './dto';

@Injectable()
export class TeamChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  async createChannel(
    tenantId: string,
    userId: string,
    dto: CreateChannelDto,
  ) {
    const slug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const channel = await this.prisma.channel.create({
      data: {
        name: dto.name,
        slug,
        type: dto.type,
        topic: dto.topic,
        description: dto.description,
        tenantId,
        createdById: userId,
        members: {
          create: [
            { userId, role: 'ADMIN' },
            ...(dto.memberIds ?? [])
              .filter((id) => id !== userId)
              .map((id) => ({ userId: id, role: 'MEMBER' })),
          ],
        },
      },
      include: { members: { include: { user: true } } },
    });

    await this.audit.log({
      entityType: 'Channel',
      entityId: channel.id,
      action: 'CREATED',
    });

    return channel;
  }

  async createDm(tenantId: string, userId: string, dto: CreateDmDto) {
    const allUserIds = [...new Set([userId, ...dto.userIds])];
    const type = allUserIds.length === 2 ? 'DM' : 'GROUP_DM';

    // Check for existing DM between these users
    if (type === 'DM') {
      const existing = await this.prisma.channel.findFirst({
        where: {
          tenantId,
          type: 'DM',
          members: { every: { userId: { in: allUserIds } } },
          AND: [
            { members: { some: { userId: allUserIds[0] } } },
            { members: { some: { userId: allUserIds[1] } } },
          ],
        },
        include: { members: { include: { user: true } } },
      });
      if (existing) return existing;
    }

    return this.prisma.channel.create({
      data: {
        type,
        tenantId,
        createdById: userId,
        members: {
          create: allUserIds.map((id) => ({
            userId: id,
            role: 'MEMBER',
          })),
        },
      },
      include: { members: { include: { user: true } } },
    });
  }

  async getChannels(tenantId: string, userId: string) {
    return this.prisma.channel.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { type: 'PUBLIC' },
          { members: { some: { userId } } },
        ],
      },
      include: {
        members: {
          where: { userId },
          select: { lastReadSequence: true, isMuted: true },
        },
        _count: { select: { members: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getChannel(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      },
    });

    if (!channel) throw new NotFoundException('Channel not found');

    const isMember = channel.members.some((m) => m.userId === userId);
    if (!isMember && channel.type !== 'PUBLIC') {
      throw new ForbiddenException('Not a member of this channel');
    }

    return channel;
  }

  async sendMessage(
    channelId: string,
    userId: string,
    content: string,
    threadParentId?: string,
    mentionedUserIds?: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const channel = await tx.channel.update({
        where: { id: channelId },
        data: { lastSequence: { increment: 1 } },
        select: { lastSequence: true, tenantId: true },
      });

      const message = await tx.chatMessage.create({
        data: {
          content,
          sequence: channel.lastSequence,
          channelId,
          authorId: userId,
          threadParentId,
          mentions: mentionedUserIds?.length
            ? {
                create: mentionedUserIds.map((id) => ({
                  mentionedUserId: id,
                })),
              }
            : undefined,
        },
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true },
          },
          mentions: true,
        },
      });

      if (threadParentId) {
        await tx.chatMessage.update({
          where: { id: threadParentId },
          data: {
            threadReplyCount: { increment: 1 },
            lastThreadReplyAt: new Date(),
          },
        });
      }

      return message;
    });
  }

  async getMessages(
    channelId: string,
    cursor?: string,
    limit = 50,
    direction: 'before' | 'after' = 'before',
  ) {
    const where: any = {
      channelId,
      deletedAt: null,
      threadParentId: null,
    };

    if (cursor) {
      where.sequence = direction === 'before'
        ? { lt: BigInt(cursor) }
        : { gt: BigInt(cursor) };
    }

    const messages = await this.prisma.chatMessage.findMany({
      where,
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
        reactions: true,
        mentions: true,
      },
      orderBy: { sequence: direction === 'before' ? 'desc' : 'asc' },
      take: limit,
    });

    return direction === 'before' ? messages.reverse() : messages;
  }

  async markRead(channelId: string, userId: string, sequence: string) {
    await this.prisma.channelMember.updateMany({
      where: { channelId, userId },
      data: { lastReadSequence: BigInt(sequence) },
    });
  }

  async toggleReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<'added' | 'removed'> {
    const existing = await this.prisma.chatReaction.findUnique({
      where: {
        messageId_userId_emoji: { messageId, userId, emoji },
      },
    });

    if (existing) {
      await this.prisma.chatReaction.delete({
        where: { id: existing.id },
      });
      return 'removed';
    }

    await this.prisma.chatReaction.create({
      data: { messageId, userId, emoji },
    });
    return 'added';
  }

  async editMessage(messageId: string, userId: string, content: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });
    if (!message || message.authorId !== userId) {
      throw new ForbiddenException('Cannot edit this message');
    }

    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
    });
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });
    if (!message || message.authorId !== userId) {
      throw new ForbiddenException('Cannot delete this message');
    }

    await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
  }

  async setTyping(tenantId: string, channelId: string, userId: string) {
    const key = `typing:${tenantId}:${channelId}:${userId}`;
    await this.redis.set(key, '1', 'EX', 3);
  }

  async getTypingUsers(
    tenantId: string,
    channelId: string,
  ): Promise<string[]> {
    const keys = await this.redis.keys(
      `typing:${tenantId}:${channelId}:*`,
    );
    return keys.map((k) => k.split(':').pop()!);
  }
}
```

- [ ] **Step 3: Create TeamChatController (REST endpoints)**

Create `apps/api/src/modules/team-chat/team-chat.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TeamChatService } from './team-chat.service';
import {
  createChannelSchema,
  createDmSchema,
  messagesQuerySchema,
  CreateChannelDto,
  CreateDmDto,
  MessagesQueryDto,
} from './dto';

@Controller('chat')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TeamChatController {
  constructor(private readonly chatService: TeamChatService) {}

  @Post('channels')
  async createChannel(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(createChannelSchema)) dto: CreateChannelDto,
  ) {
    return this.chatService.createChannel(tenantId, user.id, dto);
  }

  @Post('dm')
  async createDm(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(createDmSchema)) dto: CreateDmDto,
  ) {
    return this.chatService.createDm(tenantId, user.id, dto);
  }

  @Get('channels')
  async getChannels(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.chatService.getChannels(tenantId, user.id);
  }

  @Get('channels/:id')
  async getChannel(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.chatService.getChannel(id, user.id);
  }

  @Get('channels/:id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(messagesQuerySchema)) query: MessagesQueryDto,
  ) {
    return this.chatService.getMessages(
      id,
      query.cursor,
      query.limit,
      query.direction,
    );
  }
}
```

- [ ] **Step 4: Create TeamChatModule**

Create `apps/api/src/modules/team-chat/team-chat.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TeamChatService } from './team-chat.service';
import { TeamChatController } from './team-chat.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  controllers: [TeamChatController],
  providers: [TeamChatService],
  exports: [TeamChatService],
})
export class TeamChatModule {}
```

- [ ] **Step 5: Import in AppModule**

```typescript
import { TeamChatModule } from './modules/team-chat/team-chat.module';

// In @Module imports:
TeamChatModule,
```

- [ ] **Step 6: Verify build**

```bash
pnpm --filter @zeru/api build
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/team-chat/ apps/api/src/app.module.ts
git commit -m "feat(api): add TeamChat module with channel CRUD, messaging, reactions, and typing"
```

---

### Task 17: Chat WebSocket event handlers

**Files:**
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`

- [ ] **Step 1: Add chat event handlers to RealtimeGateway**

Add imports and inject TeamChatService:

```typescript
import { TeamChatService } from '../team-chat/team-chat.service';

// Add to constructor:
@Inject(forwardRef(() => TeamChatService))
private readonly chat: TeamChatService,
```

Add these handlers:

```typescript
@SubscribeMessage('channel:join')
async handleChannelJoin(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: { channelId: string },
) {
  const { tenantId } = client.data;
  const room = `tenant:${tenantId}:channel:${data.channelId}`;
  await client.join(room);
}

@SubscribeMessage('channel:leave')
async handleChannelLeave(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: { channelId: string },
) {
  const { tenantId } = client.data;
  const room = `tenant:${tenantId}:channel:${data.channelId}`;
  await client.leave(room);
}

@SubscribeMessage('chat:send')
async handleChatSend(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: { channelId: string; content: string; threadParentId?: string; mentions?: string[] },
) {
  const { userId, tenantId } = client.data;

  const message = await this.chat.sendMessage(
    data.channelId,
    userId,
    data.content,
    data.threadParentId,
    data.mentions,
  );

  const room = `tenant:${tenantId}:channel:${data.channelId}`;
  this.emitToRoom(room, 'chat:message', {
    id: message.id,
    channelId: data.channelId,
    sequence: message.sequence.toString(),
    content: message.content,
    author: message.author,
    createdAt: message.createdAt.toISOString(),
    threadParentId: message.threadParentId,
  });
}

@SubscribeMessage('chat:typing')
async handleChatTyping(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: { channelId: string },
) {
  const { userId, tenantId, userName } = client.data;
  await this.chat.setTyping(tenantId, data.channelId, userId);

  const room = `tenant:${tenantId}:channel:${data.channelId}`;
  client.to(room).emit('chat:typing', {
    channelId: data.channelId,
    userId,
    userName,
  });
}

@SubscribeMessage('chat:read')
async handleChatRead(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: { channelId: string; sequence: string },
) {
  const { userId, tenantId } = client.data;
  await this.chat.markRead(data.channelId, userId, data.sequence);

  const room = `tenant:${tenantId}:channel:${data.channelId}`;
  this.emitToRoom(room, 'chat:read', {
    channelId: data.channelId,
    userId,
    sequence: data.sequence,
  });
}

@SubscribeMessage('chat:react')
async handleChatReact(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: { messageId: string; emoji: string },
) {
  const { userId, tenantId } = client.data;
  const action = await this.chat.toggleReaction(
    data.messageId,
    userId,
    data.emoji,
  );

  // Need channelId to broadcast — get from message
  const message = await this.prisma.chatMessage.findUnique({
    where: { id: data.messageId },
    select: { channelId: true },
  });

  if (message) {
    const room = `tenant:${tenantId}:channel:${message.channelId}`;
    this.emitToRoom(room, 'chat:reacted', {
      messageId: data.messageId,
      emoji: data.emoji,
      userId,
      action,
    });
  }
}

@SubscribeMessage('chat:edit')
async handleChatEdit(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: { messageId: string; content: string },
) {
  const { userId, tenantId } = client.data;
  const updated = await this.chat.editMessage(
    data.messageId,
    userId,
    data.content,
  );

  const room = `tenant:${tenantId}:channel:${updated.channelId}`;
  this.emitToRoom(room, 'chat:edited', {
    messageId: updated.id,
    content: updated.content,
    editedAt: updated.editedAt!.toISOString(),
  });
}

@SubscribeMessage('chat:delete')
async handleChatDelete(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: { messageId: string },
) {
  const { userId, tenantId } = client.data;

  const message = await this.prisma.chatMessage.findUnique({
    where: { id: data.messageId },
    select: { channelId: true },
  });

  await this.chat.deleteMessage(data.messageId, userId);

  if (message) {
    const room = `tenant:${tenantId}:channel:${message.channelId}`;
    this.emitToRoom(room, 'chat:deleted', {
      messageId: data.messageId,
    });
  }
}
```

- [ ] **Step 2: Update RealtimeModule imports**

Add TeamChatModule to RealtimeModule imports (with forwardRef if circular):

```typescript
import { TeamChatModule } from '../team-chat/team-chat.module';

// In imports array:
forwardRef(() => TeamChatModule),
```

- [ ] **Step 3: Verify build**

```bash
pnpm --filter @zeru/api build
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/realtime/
git commit -m "feat(api): add chat WebSocket event handlers (send, typing, read, react, edit, delete)"
```

---

### Task 18: Notification module

**Files:**
- Create: `apps/api/src/modules/notification/notification.service.ts`
- Create: `apps/api/src/modules/notification/notification.controller.ts`
- Create: `apps/api/src/modules/notification/notification.module.ts`
- Create: `apps/api/src/modules/notification/dto/index.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Add Notification models to Prisma schema**

Add to `apps/api/prisma/schema.prisma`:

```prisma
model Notification {
  id          String    @id @default(uuid())
  type        String
  title       String
  body        String?
  data        Json
  isRead      Boolean   @default(false)
  readAt      DateTime?
  groupKey    String?
  createdAt   DateTime  @default(now())

  recipientId String
  recipient   User @relation("NotificationRecipient", fields: [recipientId], references: [id], onDelete: Cascade)

  tenantId    String
  tenant      Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([recipientId, isRead, createdAt])
  @@index([recipientId, tenantId, createdAt])
  @@index([groupKey])
  @@map("notifications")
}

model NotificationPreference {
  id             String  @id @default(uuid())
  eventPattern   String
  inApp          Boolean @default(true)
  email          Boolean @default(false)
  push           Boolean @default(false)
  emailFrequency String  @default("INSTANT")

  userId String
  user   User @relation("NotificationPref", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, eventPattern])
  @@map("notification_preferences")
}
```

Add these relations to the `User` model:

```prisma
  notifications          Notification[]          @relation("NotificationRecipient")
  notificationPreferences NotificationPreference[] @relation("NotificationPref")
```

Add to `Tenant` model:

```prisma
  notifications   Notification[]
```

- [ ] **Step 2: Run migration**

```bash
cd apps/api
pnpm db:generate
pnpm db:migrate --name add_notification_models
```

- [ ] **Step 3: Create NotificationService**

Create `apps/api/src/modules/notification/notification.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: RealtimeGateway,
  ) {}

  async notify(params: {
    recipientId: string;
    tenantId: string;
    type: string;
    title: string;
    body?: string;
    data: Record<string, unknown>;
    groupKey?: string;
  }) {
    // Check for groupable recent notification
    if (params.groupKey) {
      const recent = await this.prisma.notification.findFirst({
        where: {
          recipientId: params.recipientId,
          groupKey: params.groupKey,
          isRead: false,
          createdAt: { gte: new Date(Date.now() - 5 * 60_000) },
        },
      });

      if (recent) {
        const updated = await this.prisma.notification.update({
          where: { id: recent.id },
          data: { title: params.title, body: params.body, data: params.data },
        });
        await this.pushToUser(params.recipientId);
        return updated;
      }
    }

    const notification = await this.prisma.notification.create({
      data: {
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data,
        groupKey: params.groupKey,
        recipientId: params.recipientId,
        tenantId: params.tenantId,
      },
    });

    await this.incrementUnread(params.recipientId);
    await this.pushToUser(params.recipientId);

    this.gateway.emitToUser(params.recipientId, 'notification:new', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
    });

    return notification;
  }

  private async incrementUnread(userId: string) {
    const key = `notif:unread:${userId}`;
    await this.redis.incr(key);
  }

  private async pushToUser(userId: string) {
    const count = await this.getUnreadCount(userId);
    this.gateway.emitToUser(userId, 'notification:count', { unread: count });
  }

  async getUnreadCount(userId: string): Promise<number> {
    const key = `notif:unread:${userId}`;
    const cached = await this.redis.get(key);
    if (cached !== null) return parseInt(cached, 10);

    const count = await this.prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });
    await this.redis.set(key, count.toString(), 'EX', 60);
    return count;
  }

  async getNotifications(
    userId: string,
    tenantId: string,
    limit = 20,
    offset = 0,
  ) {
    return this.prisma.notification.findMany({
      where: { recipientId: userId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { isRead: true, readAt: new Date() },
    });
    const key = `notif:unread:${userId}`;
    const current = await this.redis.get(key);
    if (current && parseInt(current, 10) > 0) {
      await this.redis.decr(key);
    }
  }

  async markAllAsRead(userId: string, tenantId: string) {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, tenantId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    await this.redis.del(`notif:unread:${userId}`);
    this.gateway.emitToUser(userId, 'notification:count', { unread: 0 });
  }
}
```

- [ ] **Step 4: Create NotificationController**

Create `apps/api/src/modules/notification/notification.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, TenantGuard)
export class NotificationController {
  constructor(private readonly notifService: NotificationService) {}

  @Get()
  async list(
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notifService.getNotifications(
      user.id,
      tenantId,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: any) {
    const count = await this.notifService.getUnreadCount(user.id);
    return { unread: count };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: any) {
    await this.notifService.markAsRead(id, user.id);
    return { ok: true };
  }

  @Post('mark-all-read')
  async markAllRead(
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ) {
    await this.notifService.markAllAsRead(user.id, tenantId);
    return { ok: true };
  }
}
```

- [ ] **Step 5: Create NotificationModule**

Create `apps/api/src/modules/notification/notification.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
```

- [ ] **Step 6: Import in AppModule**

```typescript
import { NotificationModule } from './modules/notification/notification.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

// In @Module imports:
EventEmitterModule.forRoot(),
NotificationModule,
```

- [ ] **Step 7: Verify build and run migration**

```bash
pnpm --filter @zeru/api build
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/notification/ apps/api/prisma/ apps/api/src/app.module.ts
git commit -m "feat(api): add notification module with event bus, grouping, and REST endpoints"
```

---

### Task 19: Lock module

**Files:**
- Create: `apps/api/src/modules/lock/lock.service.ts`
- Create: `apps/api/src/modules/lock/lock.module.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Add ResourceLock model**

Add to `apps/api/prisma/schema.prisma`:

```prisma
model ResourceLock {
  id            String   @id @default(uuid())
  entityType    String
  entityId      String
  fieldName     String
  userId        String
  tenantId      String
  socketId      String
  acquiredAt    DateTime @default(now())
  expiresAt     DateTime
  lastHeartbeat DateTime @default(now())

  @@unique([entityType, entityId, fieldName])
  @@index([socketId])
  @@index([expiresAt])
  @@map("resource_locks")
}
```

- [ ] **Step 2: Run migration**

```bash
cd apps/api
pnpm db:generate
pnpm db:migrate --name add_resource_lock
```

- [ ] **Step 3: Create LockService**

Create `apps/api/src/modules/lock/lock.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PresenceService } from '../presence/presence.service';

const LOCK_TTL_MS = 60_000;

@Injectable()
export class LockService {
  private readonly logger = new Logger(LockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
    private readonly presence: PresenceService,
  ) {}

  async acquire(
    entityType: string,
    entityId: string,
    fieldName: string,
    userId: string,
    tenantId: string,
    socketId: string,
  ): Promise<{ acquired: boolean; heldBy?: { userId: string; name: string; avatar: string | null; color: string } }> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);

    try {
      await this.prisma.resourceLock.create({
        data: {
          entityType,
          entityId,
          fieldName,
          userId,
          tenantId,
          socketId,
          acquiredAt: now,
          expiresAt,
          lastHeartbeat: now,
        },
      });
      return { acquired: true };
    } catch {
      // Unique constraint violation — lock exists
      const existing = await this.prisma.resourceLock.findUnique({
        where: {
          entityType_entityId_fieldName: { entityType, entityId, fieldName },
        },
      });

      if (!existing) return { acquired: false };

      // If expired, take over
      if (existing.expiresAt < now) {
        await this.prisma.resourceLock.update({
          where: { id: existing.id },
          data: { userId, socketId, acquiredAt: now, expiresAt, lastHeartbeat: now },
        });
        return { acquired: true };
      }

      // If same user, refresh
      if (existing.userId === userId) {
        await this.prisma.resourceLock.update({
          where: { id: existing.id },
          data: { expiresAt, lastHeartbeat: now, socketId },
        });
        return { acquired: true };
      }

      const meta = await this.presence.getUserMeta(existing.userId);
      return {
        acquired: false,
        heldBy: meta ?? {
          userId: existing.userId,
          name: 'Unknown',
          avatar: null,
          color: '#999',
        },
      };
    }
  }

  async release(
    entityType: string,
    entityId: string,
    fieldName: string,
    userId: string,
  ) {
    await this.prisma.resourceLock.deleteMany({
      where: { entityType, entityId, fieldName, userId },
    });
  }

  async heartbeat(
    entityType: string,
    entityId: string,
    fieldName: string,
    userId: string,
  ) {
    const expiresAt = new Date(Date.now() + LOCK_TTL_MS);
    await this.prisma.resourceLock.updateMany({
      where: { entityType, entityId, fieldName, userId },
      data: { expiresAt, lastHeartbeat: new Date() },
    });
  }

  async releaseBySocketId(socketId: string): Promise<
    Array<{ entityType: string; entityId: string; fieldName: string; tenantId: string }>
  > {
    const locks = await this.prisma.resourceLock.findMany({
      where: { socketId },
    });

    if (locks.length > 0) {
      await this.prisma.resourceLock.deleteMany({
        where: { socketId },
      });
    }

    return locks.map((l) => ({
      entityType: l.entityType,
      entityId: l.entityId,
      fieldName: l.fieldName,
      tenantId: l.tenantId,
    }));
  }

  async forceRelease(
    entityType: string,
    entityId: string,
    fieldName: string,
  ): Promise<string | null> {
    const lock = await this.prisma.resourceLock.findUnique({
      where: {
        entityType_entityId_fieldName: { entityType, entityId, fieldName },
      },
    });

    if (!lock) return null;

    await this.prisma.resourceLock.delete({ where: { id: lock.id } });
    return lock.userId;
  }

  @Cron('*/30 * * * * *')
  async cleanExpiredLocks() {
    const expired = await this.prisma.resourceLock.findMany({
      where: { expiresAt: { lt: new Date() } },
    });

    if (expired.length === 0) return;

    await this.prisma.resourceLock.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    for (const lock of expired) {
      this.gateway.emitToTenant(lock.tenantId, 'lock:field-unlocked', {
        entityType: lock.entityType,
        entityId: lock.entityId,
        fieldName: lock.fieldName,
      });
    }

    this.logger.log(`Cleaned ${expired.length} expired locks`);
  }
}
```

- [ ] **Step 4: Create LockModule**

Create `apps/api/src/modules/lock/lock.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { LockService } from './lock.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [RealtimeModule, PresenceModule],
  providers: [LockService],
  exports: [LockService],
})
export class LockModule {}
```

- [ ] **Step 5: Add lock event handlers to RealtimeGateway**

Add to `apps/api/src/modules/realtime/realtime.gateway.ts`:

```typescript
import { LockService } from '../lock/lock.service';

// Add to constructor:
@Inject(forwardRef(() => LockService))
private readonly lock: LockService,

// Add lock handlers:

@SubscribeMessage('lock:acquire')
async handleLockAcquire(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: { entityType: string; entityId: string; fieldName: string },
) {
  const { userId, tenantId } = client.data;
  const result = await this.lock.acquire(
    data.entityType, data.entityId, data.fieldName,
    userId, tenantId, client.id,
  );

  if (result.acquired) {
    client.emit('lock:acquired', data);
    const userMeta = await this.presence.getUserMeta(userId);
    if (userMeta) {
      this.emitToTenant(tenantId, 'lock:field-locked', { ...data, user: userMeta });
    }
  } else {
    client.emit('lock:denied', { ...data, heldBy: result.heldBy! });
  }
}

@SubscribeMessage('lock:release')
async handleLockRelease(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: { entityType: string; entityId: string; fieldName: string },
) {
  const { userId, tenantId } = client.data;
  await this.lock.release(data.entityType, data.entityId, data.fieldName, userId);
  this.emitToTenant(tenantId, 'lock:field-unlocked', data);
}

@SubscribeMessage('lock:heartbeat')
async handleLockHeartbeat(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: { entityType: string; entityId: string; fieldName: string },
) {
  const { userId } = client.data;
  await this.lock.heartbeat(data.entityType, data.entityId, data.fieldName, userId);
}

// Update handleDisconnect to also release locks:
// After removing presence, add:
const releasedLocks = await this.lock.releaseBySocketId(client.id);
for (const lockInfo of releasedLocks) {
  this.emitToTenant(lockInfo.tenantId, 'lock:field-unlocked', {
    entityType: lockInfo.entityType,
    entityId: lockInfo.entityId,
    fieldName: lockInfo.fieldName,
  });
}
```

- [ ] **Step 6: Update RealtimeModule imports**

```typescript
import { LockModule } from '../lock/lock.module';

// In imports:
forwardRef(() => LockModule),
```

- [ ] **Step 7: Import LockModule in AppModule**

```typescript
import { LockModule } from './modules/lock/lock.module';

// In @Module imports:
LockModule,
```

- [ ] **Step 8: Verify build**

```bash
pnpm --filter @zeru/api build
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/lock/ apps/api/src/modules/realtime/ apps/api/prisma/ apps/api/src/app.module.ts
git commit -m "feat(api): add lock module with pessimistic field locking, heartbeat, and auto-cleanup"
```

---

### Task 20: Frontend — Chat store and Notification store

**Files:**
- Create: `apps/web/stores/chat-store.ts`
- Create: `apps/web/stores/realtime-store.ts`

- [ ] **Step 1: Create chat store**

Create `apps/web/stores/chat-store.ts`:

```typescript
import { create } from "zustand";
import type { ChatMessage, Channel } from "@zeru/shared";

interface ChatState {
  channels: Channel[];
  activeChannelId: string | null;
  messages: Map<string, ChatMessage[]>;
  typingUsers: Map<string, Map<string, string>>; // channelId -> userId -> userName
  unreadCounts: Map<string, number>;

  setChannels: (channels: Channel[]) => void;
  setActiveChannel: (channelId: string | null) => void;
  addMessage: (channelId: string, message: ChatMessage) => void;
  setMessages: (channelId: string, messages: ChatMessage[]) => void;
  prependMessages: (channelId: string, messages: ChatMessage[]) => void;
  updateMessage: (channelId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (channelId: string, messageId: string) => void;
  setTyping: (channelId: string, userId: string, userName: string) => void;
  clearTyping: (channelId: string, userId: string) => void;
  setUnread: (channelId: string, count: number) => void;
  decrementUnread: (channelId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  channels: [],
  activeChannelId: null,
  messages: new Map(),
  typingUsers: new Map(),
  unreadCounts: new Map(),

  setChannels: (channels) => set({ channels }),
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),

  addMessage: (channelId, message) =>
    set((state) => {
      const next = new Map(state.messages);
      const existing = next.get(channelId) ?? [];
      next.set(channelId, [...existing, message]);
      return { messages: next };
    }),

  setMessages: (channelId, messages) =>
    set((state) => {
      const next = new Map(state.messages);
      next.set(channelId, messages);
      return { messages: next };
    }),

  prependMessages: (channelId, messages) =>
    set((state) => {
      const next = new Map(state.messages);
      const existing = next.get(channelId) ?? [];
      next.set(channelId, [...messages, ...existing]);
      return { messages: next };
    }),

  updateMessage: (channelId, messageId, updates) =>
    set((state) => {
      const next = new Map(state.messages);
      const existing = next.get(channelId) ?? [];
      next.set(
        channelId,
        existing.map((m) => (m.id === messageId ? { ...m, ...updates } : m)),
      );
      return { messages: next };
    }),

  removeMessage: (channelId, messageId) =>
    set((state) => {
      const next = new Map(state.messages);
      const existing = next.get(channelId) ?? [];
      next.set(
        channelId,
        existing.filter((m) => m.id !== messageId),
      );
      return { messages: next };
    }),

  setTyping: (channelId, userId, userName) =>
    set((state) => {
      const next = new Map(state.typingUsers);
      const channelTyping = new Map(next.get(channelId) ?? new Map());
      channelTyping.set(userId, userName);
      next.set(channelId, channelTyping);
      return { typingUsers: next };
    }),

  clearTyping: (channelId, userId) =>
    set((state) => {
      const next = new Map(state.typingUsers);
      const channelTyping = new Map(next.get(channelId) ?? new Map());
      channelTyping.delete(userId);
      next.set(channelId, channelTyping);
      return { typingUsers: next };
    }),

  setUnread: (channelId, count) =>
    set((state) => {
      const next = new Map(state.unreadCounts);
      next.set(channelId, count);
      return { unreadCounts: next };
    }),

  decrementUnread: (channelId) =>
    set((state) => {
      const next = new Map(state.unreadCounts);
      const current = next.get(channelId) ?? 0;
      next.set(channelId, Math.max(0, current - 1));
      return { unreadCounts: next };
    }),
}));
```

- [ ] **Step 2: Create realtime store (locks + notifications)**

Create `apps/web/stores/realtime-store.ts`:

```typescript
import { create } from "zustand";
import type { Notification } from "@zeru/shared";
import type { PresenceUser } from "@zeru/shared";

interface LockInfo {
  user: PresenceUser;
}

interface RealtimeState {
  locks: Map<string, LockInfo>; // key: entityType:entityId:fieldName
  notifications: Notification[];
  unreadNotifications: number;

  setLock: (key: string, info: LockInfo) => void;
  removeLock: (key: string) => void;
  addNotification: (notif: Notification) => void;
  setNotifications: (notifs: Notification[]) => void;
  setUnreadCount: (count: number) => void;
  markNotificationRead: (id: string) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  locks: new Map(),
  notifications: [],
  unreadNotifications: 0,

  setLock: (key, info) =>
    set((state) => {
      const next = new Map(state.locks);
      next.set(key, info);
      return { locks: next };
    }),

  removeLock: (key) =>
    set((state) => {
      const next = new Map(state.locks);
      next.delete(key);
      return { locks: next };
    }),

  addNotification: (notif) =>
    set((state) => ({
      notifications: [notif, ...state.notifications],
      unreadNotifications: state.unreadNotifications + 1,
    })),

  setNotifications: (notifs) => set({ notifications: notifs }),

  setUnreadCount: (count) => set({ unreadNotifications: count }),

  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
      unreadNotifications: Math.max(0, state.unreadNotifications - 1),
    })),
}));
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/stores/
git commit -m "feat(web): add Zustand stores for chat, locks, and notifications"
```

---

### Task 21: Frontend — NotificationSync + NotificationBell

**Files:**
- Create: `apps/web/components/realtime/notification-sync.tsx`
- Create: `apps/web/components/notifications/notification-bell.tsx`
- Create: `apps/web/components/notifications/notification-list.tsx`
- Modify: `apps/web/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create NotificationSync**

Create `apps/web/components/realtime/notification-sync.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useRealtimeStore } from "@/stores/realtime-store";

export function NotificationSync() {
  const socket = useSocket();
  const { addNotification, setUnreadCount } = useRealtimeStore();

  useEffect(() => {
    if (!socket) return;

    const handleNew = (data: {
      id: string;
      type: string;
      title: string;
      body?: string;
      data: Record<string, unknown>;
    }) => {
      addNotification({
        ...data,
        body: data.body ?? null,
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
      });
    };

    const handleCount = (data: { unread: number }) => {
      setUnreadCount(data.unread);
    };

    socket.on("notification:new", handleNew);
    socket.on("notification:count", handleCount);

    return () => {
      socket.off("notification:new", handleNew);
      socket.off("notification:count", handleCount);
    };
  }, [socket, addNotification, setUnreadCount]);

  return null;
}
```

- [ ] **Step 2: Create NotificationBell**

Create `apps/web/components/notifications/notification-bell.tsx`:

```typescript
"use client";

import { useRealtimeStore } from "@/stores/realtime-store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NotificationList } from "./notification-list";

export function NotificationBell() {
  const unread = useRealtimeStore((s) => s.unreadNotifications);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-md hover:bg-muted transition-colors">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <NotificationList />
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 3: Create NotificationList**

Create `apps/web/components/notifications/notification-list.tsx`:

```typescript
"use client";

import { useRealtimeStore } from "@/stores/realtime-store";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function NotificationList() {
  const { notifications, markNotificationRead } = useRealtimeStore();

  const handleMarkRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    markNotificationRead(id);
  };

  const handleMarkAllRead = async () => {
    await api.post("/notifications/mark-all-read");
    useRealtimeStore.getState().setUnreadCount(0);
  };

  return (
    <div className="max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm">Notificaciones</h3>
        <button
          onClick={handleMarkAllRead}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Marcar todo leído
        </button>
      </div>
      {notifications.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Sin notificaciones
        </div>
      ) : (
        <div className="divide-y">
          {notifications.slice(0, 20).map((notif) => (
            <button
              key={notif.id}
              onClick={() => !notif.isRead && handleMarkRead(notif.id)}
              className={cn(
                "w-full text-left p-3 hover:bg-muted transition-colors",
                !notif.isRead && "bg-blue-500/5",
              )}
            >
              <div className="flex items-start gap-2">
                {!notif.isRead && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{notif.title}</p>
                  {notif.body && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {notif.body}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRelativeTime(notif.createdAt)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
```

- [ ] **Step 4: Add NotificationSync to dashboard layout and NotificationBell to header**

In `apps/web/app/(dashboard)/layout.tsx`, inside `<SocketProvider>`:

```typescript
import { NotificationSync } from "@/components/realtime/notification-sync";

// Add alongside PresenceSync:
<PresenceSync />
<NotificationSync />
```

Add `<NotificationBell />` to the header area (next to breadcrumbs or user menu). Read the existing header structure in `layout.tsx` to determine exact placement.

- [ ] **Step 5: Verify build**

```bash
pnpm --filter @zeru/web build
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/realtime/notification-sync.tsx apps/web/components/notifications/ apps/web/app/\(dashboard\)/layout.tsx
git commit -m "feat(web): add notification sync, bell icon with badge, and notification list"
```

---

### Task 22: Integration smoke test

- [ ] **Step 1: Start all services**

```bash
# Terminal 1: Start Redis + PostgreSQL
docker compose up -d

# Terminal 2: Start API
cd apps/api
pnpm dev

# Terminal 3: Start Web
cd apps/web
pnpm dev
```

- [ ] **Step 2: Verify WebSocket connection**

Open browser dev tools → Network → WS tab. Navigate to any dashboard page. You should see a WebSocket connection to `/socket.io/`.

- [ ] **Step 3: Verify presence**

Open the same page in two different browser tabs (same user or different users). The AvatarStack should show the users viewing that page.

- [ ] **Step 4: Test presence cleanup**

Close one tab. Within 60 seconds, the avatar should disappear from the other tab's AvatarStack.

- [ ] **Step 5: Run lint**

```bash
pnpm lint
```

Fix any lint errors before committing.

- [ ] **Step 6: Final commit if needed**

```bash
git add -A
git commit -m "fix: resolve lint errors and integration issues"
```
