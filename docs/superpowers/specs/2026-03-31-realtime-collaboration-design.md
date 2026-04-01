# Real-time Collaboration System — Design Spec

**Date:** 2026-03-31
**Branch:** `feature/realtime-collaboration`
**Worktree:** `.worktrees/realtime-collaboration`

---

## 1. Overview

Sistema de colaboración en tiempo real para Zeru, que permite a cientos de usuarios de la misma empresa trabajar simultáneamente. El sistema se construye como un monolito modular dentro del NestJS API existente.

### Scope (Fase 1 y 2)

- **Fase 1 — Presencia:** Infraestructura WebSocket, presencia global (online/offline) y por página (avatar stack)
- **Fase 2 — Chat:** Chat de equipo con canales, DMs, threads, typing indicators, reactions, búsqueda

### Fuera de scope (futuro)

- Task management system (Fase 3)
- Integración AI chat ↔ Team chat (Fase 4)
- Rich-text collaborative editing con CRDTs (Fase 5)

### Decisiones clave

| Decisión | Elección | Justificación |
|---|---|---|
| Infraestructura | Self-hosted | Control total, sin costos por conexión, Redis ya existe |
| Transporte | Socket.IO + `@nestjs/websockets` | Rooms, auto-reconnect, Redis adapter, ecosistema NestJS |
| Arquitectura | Monolito modular | Suficiente para ~10K conexiones, extraíble a microservicio después |
| Edición colaborativa | Pessimistic field-level locking | No necesita CRDTs/OT para campos discretos |
| Presencia | Redis sorted sets | Queries de rango eficientes, cleanup automático |
| Locks | PostgreSQL table | Transaccional con datos, sin 2-phase commit |
| Estado efímero | Redis SET con TTL | Typing indicators, presencia — no persiste |
| Frontend state | Zustand (real-time) + React Query (server) | Zustand accesible fuera de React, RQ para cache |
| Auditoría | Prisma middleware + AsyncLocalStorage | Automático, sin logging manual por servicio |

---

## 2. Architecture

```
                    ┌─────────────────────────┐
                    │     Traefik (TLS/wss)    │
                    └───────────┬──────────────┘
                                │
                    ┌───────────▼──────────────┐
                    │     Nginx (reverse proxy) │
                    │  /api/*      → NestJS     │
                    │  /socket.io/* → NestJS    │
                    │  /*           → Next.js   │
                    └─────┬─────────────┬──────┘
                          │             │
              ┌───────────▼───┐   ┌─────▼──────────┐
              │   NestJS API   │   │    Next.js      │
              │                │   │    (App Router)  │
              │ ┌────────────┐ │   │                  │
              │ │ HTTP Routes│ │   │ ┌──────────────┐ │
              │ │ (REST API) │ │   │ │SocketProvider│ │
              │ ├────────────┤ │   │ │(socket.io-   │ │
              │ │ SSE (AI)   │ │   │ │ client)      │ │
              │ ├────────────┤ │   │ └──────────────┘ │
              │ │ WS Gateway │ │   └──────────────────┘
              │ │ (Socket.IO)│ │
              │ └─────┬──────┘ │
              │       │        │
              │ ┌─────▼──────┐ │
              │ │ Modules:   │ │
              │ │ • Realtime │ │
              │ │ • Lock     │ │
              │ │ • TeamChat │ │
              │ │ • Notif    │ │
              │ │ • Audit    │ │
              │ └─────┬──────┘ │
              └───────┼────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
    ┌────▼────┐  ┌────▼────┐  ┌───▼────┐
    │PostgreSQL│  │  Redis  │  │ BullMQ │
    │(Prisma)  │  │(pub/sub │  │(async  │
    │          │  │presence │  │ jobs)  │
    │• Locks   │  │typing)  │  │        │
    │• Messages│  │         │  │        │
    │• Notifs  │  │         │  │        │
    │• Audit   │  │         │  │        │
    └─────────┘  └─────────┘  └────────┘
```

### NestJS Modules

| Module | Responsabilidad |
|---|---|
| `RealtimeModule` | WebSocket gateway, Socket.IO config, Redis adapter, JWT auth en handshake, room management |
| `PresenceModule` | Presencia global + por página, heartbeat, stale cleanup cron |
| `LockModule` | Field-level locking, heartbeat, expiry cleanup, force release |
| `TeamChatModule` | Channels, messages, threads, typing, reactions, search |
| `NotificationModule` | Event bus listener, fan-out, in-app + email + push delivery |
| `AuditModule` | Prisma middleware, AsyncLocalStorage context, audit log queries |

### Packages to install

**Backend (`apps/api`):**

```
@nestjs/websockets           ^11
@nestjs/platform-socket.io   ^11
@nestjs/event-emitter        ^3
@nestjs/bullmq               ^11
socket.io                    ^4.8
ioredis                      ^5
bullmq                       ^5
@socket.io/redis-adapter     ^8.3
fraci                        (fractional indexing for future task ordering)
```

**Frontend (`apps/web`):**

```
socket.io-client             ^4.8
zustand                      ^5
@tanstack/react-virtual      ^3
```

**Shared (`packages/shared`):**

```
(no new packages — only shared TypeScript types for events and DTOs)
```

### Nginx config change (required)

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

---

## 3. Presence System

### Two-level presence

| Level | Redis Key | Purpose | UI |
|---|---|---|---|
| Global (online/offline) | `presence:tenant:{tenantId}` | Quién está online en la app | Punto verde en avatares |
| Per-page | `presence:tenant:{tenantId}:view:{path}` | Quién está viendo la misma página | Avatar stack en header |

Both use Redis sorted sets with `score = last heartbeat timestamp (ms)`.

### User metadata cache

```
Redis Key:    presence:meta:{userId}
Type:         Hash
Fields:       name, avatar, color
```

Cached on connect. Used to render avatars without querying PostgreSQL.
Color is deterministic from userId hash (HSL).

### Heartbeat & cleanup

- **Client heartbeat:** every 30 seconds, emits `presence:heartbeat`
- **Server cleanup cron:** every 15 seconds, removes entries with score older than 60 seconds
- **On disconnect:** immediate `ZREM` from all views + global

### Socket.IO rooms

```
tenant:{tenantId}                    → tenant-wide broadcasts
tenant:{tenantId}:view:{path}        → per-page presence
user:{userId}                        → direct notifications
tenant:{tenantId}:channel:{id}       → chat channel
tenant:{tenantId}:thread:{id}        → chat thread
```

### Event contract

**Client → Server:**

| Event | Payload | Purpose |
|---|---|---|
| `presence:join` | `{ viewPath: string }` | Enter a view |
| `presence:leave` | `{ viewPath: string }` | Leave a view |
| `presence:heartbeat` | `{}` | Keep-alive |

**Server → Client:**

| Event | Payload | Purpose |
|---|---|---|
| `presence:snapshot` | `{ viewPath, users: PresenceUser[] }` | Initial state on join |
| `presence:update` | `{ viewPath, event: 'joined'|'left', user: PresenceUser, users: PresenceUser[] }` | Delta update |
| `presence:online` | `{ users: string[] }` | Global online users list |

### PresenceUser type

```typescript
interface PresenceUser {
  userId: string;
  name: string;
  avatar: string | null;
  color: string;  // deterministic from userId hash
}
```

### Avatar Stack UI

```
0 users:     (hidden)
1-4 users:   [A1] [A2] [A3] [A4]
5+ users:    [A1] [A2] [A3] [+2]

Hover avatar  → tooltip with name
Hover "+N"    → popover with full list
Colored ring  → deterministic per user
Pulse animation on join, fade-out on leave
```

---

## 4. Locking System

### Concept

Pessimistic field-level locking. When a user clicks to edit a field, they acquire an exclusive lock. Others see the field as locked with the editor's avatar.

### Prisma model

```prisma
model ResourceLock {
  id            String   @id @default(uuid())
  entityType    String
  entityId      String
  fieldName     String   // specific field or "*" for whole record
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

### Version column on entities

Every editable entity has `version Int @default(1)` that increments on every update. This prevents silent overwrites even if the lock mechanism fails.

### Lock acquisition

```sql
INSERT INTO resource_locks (id, entity_type, entity_id, field_name, user_id, tenant_id, socket_id, acquired_at, expires_at, last_heartbeat)
VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW() + INTERVAL '60 seconds', NOW())
ON CONFLICT (entity_type, entity_id, field_name) DO NOTHING
RETURNING *;
```

If no row returned → lock held by someone else → query existing lock for holder info.

### Heartbeat & expiry

- **Client heartbeat:** every 15 seconds while editing
- **Server updates:** `expiresAt = now() + 60s`
- **Cleanup cron:** every 30 seconds, deletes expired locks and broadcasts unlock

### System override (background processes always win)

When a background process (cron, AI tool, webhook) needs to modify a locked field:

1. Apply the change with `version++`
2. DELETE the existing lock
3. Broadcast `lock:force-released` to the user who was editing
4. Broadcast `entity:updated` to the room
5. The editing user sees: "Una actualización del sistema modificó este campo" with the new value and option to re-edit

No queuing, no waiting. System always wins.

### Failure scenarios

| Scenario | Behavior |
|---|---|
| Browser closes | `disconnect` → DELETE locks by `socketId` → broadcast unlock |
| Network drops | Heartbeat stops, lock expires in 60s → cron cleans → broadcast unlock |
| Lock expires mid-edit | On save: version check. Match → save OK. Mismatch → conflict dialog |
| Two users click simultaneously | `ON CONFLICT DO NOTHING` → first wins, second gets `lock:denied` |
| Admin force unlock | `DELETE /api/locks/:id` with ADMIN permission → broadcast unlock |

### Conflict dialog

```
┌──────────────────────────────────────┐
│  ⚠️ Conflicto de edición             │
│                                      │
│  Este campo fue modificado por       │
│  María mientras editabas.            │
│                                      │
│  Tu valor:     "Implementar login"   │
│  Valor actual: "Implementar OAuth"   │
│                                      │
│  [Mantener mío] [Aceptar actual]     │
└──────────────────────────────────────┘
```

### Event contract

**Client → Server:**

| Event | Payload |
|---|---|
| `lock:acquire` | `{ entityType, entityId, fieldName }` |
| `lock:release` | `{ entityType, entityId, fieldName }` |
| `lock:heartbeat` | `{ entityType, entityId, fieldName }` |

**Server → Client:**

| Event | Payload |
|---|---|
| `lock:acquired` | `{ entityType, entityId, fieldName }` |
| `lock:denied` | `{ entityType, entityId, fieldName, heldBy: PresenceUser }` |
| `lock:field-locked` | `{ entityType, entityId, fieldName, user: PresenceUser }` |
| `lock:field-unlocked` | `{ entityType, entityId, fieldName }` |
| `lock:force-released` | `{ entityType, entityId, fieldName, reason: string }` |
| `entity:updated` | `{ entityType, entityId, fieldName, value, version, updatedBy }` |
| `entity:conflict` | `{ entityType, entityId, fieldName, currentValue, currentVersion }` |

### Field UI states

```
Normal:         [  Campo editable  ]
Locked (other): [🔒 Campo editable  ] 👤 "Camilo está editando"
                (input disabled, border with user's color)
Locked (me):    [✏️  Editando...     ]
                (input active, highlight border)
```

---

## 5. Team Chat

### Channel types

| Type | Description |
|---|---|
| `PUBLIC` | Open channel, any tenant member can join |
| `PRIVATE` | Invite-only channel |
| `DM` | Direct message between 2 people |
| `GROUP_DM` | Group DM without channel name |

### Prisma models

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

  tenantId     String
  createdById  String

  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  members      ChannelMember[]
  messages     ChatMessage[]

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

  channelId        String
  userId           String

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

  channelId String
  authorId  String

  threadParentId    String?
  threadReplyCount  Int      @default(0)
  lastThreadReplyAt DateTime?

  createdAt DateTime @default(now())

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

  messageId String

  @@index([messageId])
  @@map("chat_attachments")
}

model ChatReaction {
  id    String @id @default(uuid())
  emoji String

  messageId String
  userId    String

  @@unique([messageId, userId, emoji])
  @@map("chat_reactions")
}

model ChatMention {
  id              String @id @default(uuid())
  messageId       String
  mentionedUserId String

  @@index([mentionedUserId])
  @@map("chat_mentions")
}
```

### Message ordering

Per-channel monotonically increasing `sequence` via:

```sql
UPDATE channels
SET last_sequence = last_sequence + 1
WHERE id = $channelId
RETURNING last_sequence;
```

### Unread count — O(1)

```
unread = channel.lastSequence - channelMember.lastReadSequence
```

### Typing indicators (ephemeral, Redis)

```
Redis Key:    typing:{tenantId}:{channelId}
Type:         SET with per-member 3s TTL
```

Client emits `chat:typing { channelId }` → server broadcasts to channel room (excluding sender).

UI: "Camilo está escribiendo..." / "Camilo y María están escribiendo..." / "Varias personas están escribiendo..."

### Threads

- `threadParentId = null` → top-level message
- Reply: `threadParentId = parent.id`
- Parent updates: `threadReplyCount++`, `lastThreadReplyAt`
- Thread room: `tenant:{id}:thread:{messageId}`
- UI: channel shows parent with "3 respuestas", click opens side panel

### Search (PostgreSQL FTS)

```sql
ALTER TABLE chat_messages
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('spanish', coalesce(content, ''))) STORED;

CREATE INDEX idx_chat_search ON chat_messages USING GIN (search_vector);
```

### Pagination (cursor-based)

```
GET /api/channels/:id/messages?cursor=<sequence>&limit=50&direction=before
```

### Reconnection

1. Socket.IO auto-reconnects
2. Client re-emits `channel:join` for each active channel
3. Client sends last known sequence per channel
4. Server responds with missed messages (if < 100)
5. If > 100 missed → client re-fetches via REST

### Event contract

**Client → Server:**

| Event | Payload |
|---|---|
| `chat:send` | `{ channelId, content, mentions?: string[], threadParentId?: string }` |
| `chat:typing` | `{ channelId }` |
| `chat:read` | `{ channelId, sequence }` |
| `chat:react` | `{ messageId, emoji }` |
| `chat:edit` | `{ messageId, content }` |
| `chat:delete` | `{ messageId }` |
| `channel:join` | `{ channelId }` |
| `channel:leave` | `{ channelId }` |

**Server → Client:**

| Event | Payload |
|---|---|
| `chat:message` | `{ id, channelId, sequence, content, author, createdAt, threadParentId? }` |
| `chat:typing` | `{ channelId, userId }` |
| `chat:typing:stop` | `{ channelId, userId }` |
| `chat:read` | `{ channelId, userId, sequence }` |
| `chat:reacted` | `{ messageId, emoji, userId, action: 'added'\|'removed' }` |
| `chat:edited` | `{ messageId, content, editedAt }` |
| `chat:deleted` | `{ messageId }` |

---

## 6. Notification System

### Architecture: Event Bus → Fan-out

All domain events flow through `@nestjs/event-emitter` (EventEmitter2). The `NotificationModule` listens and handles delivery.

### Domain events

```typescript
type DomainEvent =
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
  | 'system.field_updated'
```

### Prisma models

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

  recipientId String
  tenantId    String
  createdAt   DateTime  @default(now())

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

  @@unique([userId, eventPattern])
  @@map("notification_preferences")
}
```

### Fan-out logic

For each recipient:

1. Check `NotificationPreference` (match by `eventPattern`, e.g. `"task.*"` matches `"task.assigned"`)
2. `inApp` → INSERT `Notification` + emit via WebSocket `notification:new`
3. `email` → BullMQ queue based on `emailFrequency` (INSTANT / HOURLY / DAILY)
4. `push` → BullMQ push-notification queue

### Recipients per event

| Event | Recipients |
|---|---|
| `chat.message.sent` | Channel members (not muted, not author) |
| `chat.mention` | Mentioned user directly |
| `task.assigned` | The assignee |
| `task.status_changed` | Creator + assignee + watchers |
| `task.commented` | Thread participants |
| `task.due_soon` | The assignee (cron: 24h before due) |
| `lock.force_released` | The user whose lock was released |

### Badge count

```
Redis Key:    notif:unread:{userId}
Operations:   INCR on create, DECR on read, DEL on mark-all-read
Fallback:     COUNT(*) from PostgreSQL → SET in Redis
```

### Grouping

If a notification with the same `groupKey` exists for the same recipient within 5 minutes, update instead of creating:

```
groupKey examples:
  "chat:channel_123"         → "5 mensajes nuevos en #general"
  "task:task_456:comments"   → "3 nuevos comentarios en 'Deploy v2'"
```

### BullMQ queues

| Queue | Purpose |
|---|---|
| `notification-email` | Individual immediate emails via SES |
| `notification-digest` | Hourly/daily digest compilation |
| `notification-push` | Web Push API delivery |
| `task-reminders` | Cron: tasks due within 24h |

---

## 7. Audit System

### Principle

Every change to every entity is recorded automatically. Who, what, when, from where, what exactly changed.

### Prisma model

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  entityType String
  entityId   String
  action     String   // CREATED, UPDATED, DELETED, ARCHIVED

  changes    Json?    // { "status": { "from": "TODO", "to": "DONE" } }
  snapshot   Json?    // full entity state post-change (optional, for recovery)

  actorType  String   // USER, SYSTEM, AI, WEBHOOK
  actorId    String?
  source     String   // "web", "api", "cron", "webhook:jira", "ai:tool"
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

### Implementation: Prisma middleware + AsyncLocalStorage

```
Any mutation (HTTP, WebSocket, Cron, AI)
        │
        ▼
  NestJS middleware/guard sets RequestContext via AsyncLocalStorage:
    { actorType, actorId, tenantId, source, ipAddress, userAgent, socketId }
        │
        ▼
  Prisma Middleware (before operation)
    → snapshot previous state (for updates/deletes)
        │
  Prisma executes the operation
        │
  Prisma Middleware (after operation)
    → diff before vs after
    → INSERT AuditLog with changes + context from AsyncLocalStorage
        │
        ▼
  EventEmitter emits "audit.created"
    → NotificationModule can react
    → WebSocket can broadcast activity feed
```

### Context metadata by origin

| Origin | actorType | source | Extra metadata |
|---|---|---|---|
| HTTP request | `USER` | `"web"` or `"api"` | IP, User-Agent, endpoint |
| WebSocket event | `USER` | `"websocket"` | socketId, event name |
| Cron job | `SYSTEM` | `"cron:job-name"` | job ID |
| AI tool | `AI` | `"ai:tool-name"` | conversationId, model |
| External webhook | `WEBHOOK` | `"webhook:provider"` | webhook ID, headers |
| Admin action | `USER` | `"admin-panel"` | IP, admin userId |

### Retention

- Partitioned by month: `PARTITION BY RANGE (created_at)`
- Configurable retention per tenant (default: 1 year, enterprise: unlimited)
- Audit logs are never deleted by normal operations

---

## 8. Frontend Architecture

### Stack

| Layer | Tool | Responsibility |
|---|---|---|
| WebSocket connection | `socket.io-client` | Bidirectional transport |
| Real-time state | `zustand` | Presence, typing, locks, incoming messages |
| Server state | `@tanstack/react-query` | Initial fetch, cache, optimistic updates |
| Virtual scroll | `@tanstack/react-virtual` | Chat messages, long task lists |

### SocketProvider

Single provider at layout level. Creates ONE WebSocket connection per session. Reconnects automatically.

```
<SocketProvider>        ← layout.tsx (client boundary)
  <PresenceSync />      ← syncs current route with presence
  <NotificationSync />  ← listens notification:new, updates badge
  {children}
</SocketProvider>
```

### Zustand stores

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ usePresenceStore  │  │  useChatStore     │  │ useRealtimeStore  │
│                  │  │                  │  │                  │
│ • onlineUsers    │  │ • messages (map) │  │ • locks (map)    │
│ • viewUsers      │  │ • typingUsers    │  │ • notifications  │
│ • myViewPath     │  │ • unreadCounts   │  │ • unreadCount    │
│                  │  │ • activeChannel  │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
         ▲                    ▲                       ▲
         └────────────────────┼───────────────────────┘
                    WebSocket event handlers
                    (outside React tree, via getState())
```

### Data flow pattern

```
WebSocket event arrives
  → Zustand: update state immediately (0ms reactivity)
  → React Query: update cache (queryClient.setQueryData) for re-mount consistency
```

### PresenceSync component

Mounted once in layout. Detects route changes via `usePathname()` and emits `presence:join` / `presence:leave` automatically.

### Reusable components

| Component | Purpose |
|---|---|
| `<AvatarStack viewPath={path} />` | Shows who's on a page |
| `<OnlineIndicator userId={id} />` | Green/gray dot |
| `<FieldLock entityType entity entityId fieldName>` | Wraps input, handles lock lifecycle automatically |
| `<NotificationBell />` | Badge + popover with notification list |
| `<TypingIndicator channelId={id} />` | "Camilo está escribiendo..." |

### Reconnection UI

| WebSocket state | UI |
|---|---|
| `connected` | Normal operation |
| `disconnected` | Yellow banner: "Reconectando..." |
| `reconnecting` | Banner: "Reconectando... (intento N)" |
| `reconnected` | Green banner: "Conectado" (disappears in 2s) → re-sync presence, locks, fetch missed messages |
| `failed` | Red banner: "Sin conexión. [Reintentar]" |

### Virtual scroll for chat

- `@tanstack/react-virtual` with reverse infinite scroll
- Scroll up → cursor-based fetch (older messages)
- New message → auto-scroll if at bottom, otherwise show "↓ N mensajes nuevos"
- Overscan: 10 items above/below viewport

---

## 9. Infrastructure Changes Required

### Nginx

Add `/socket.io/` location block with WebSocket upgrade headers and 24h timeout.

### Redis

Already deployed (`redis:7-alpine`). No changes needed. Will use for:
- Socket.IO Redis adapter (pub/sub)
- Presence sorted sets
- Typing indicator TTLs
- Notification badge cache
- BullMQ job queues

### Docker

No new containers needed. NestJS API container gains WebSocket capability.

### Horizontal scaling (future)

When needed:
- Add `ip_hash` to Nginx upstream for sticky sessions
- Multiple NestJS instances share state via Redis adapter
- Estimated single-instance capacity: ~10,000 concurrent WebSocket connections

---

## 10. Security

### WebSocket authentication

- JWT validated during Socket.IO handshake in `handleConnection()`
- `tenantId` and `userId` extracted from JWT and stored on socket instance
- Every room join validated server-side against JWT tenantId

### Multi-tenant isolation

- All rooms prefixed with `tenant:{tenantId}`
- Server validates tenant membership on every room join
- Broadcasts always scoped to rooms, never global
- Client-provided tenantId is never trusted — always from decoded JWT

### Rate limiting

- WebSocket events rate-limited per socket (e.g., 10 messages/second)
- Reuse existing `@nestjs/throttler` patterns

---

## 11. Implementation Phases

### Phase 1: Presence (Foundation)

1. Install WebSocket packages
2. Configure Redis adapter
3. Create `RealtimeModule` with WebSocket gateway + JWT auth
4. Create `PresenceModule` with global + per-page presence
5. Update Nginx config for WebSocket
6. Create `AuditModule` with Prisma middleware + AsyncLocalStorage
7. Frontend: `SocketProvider`, `PresenceSync`, `AvatarStack`, `OnlineIndicator`

### Phase 2: Chat

1. Create `TeamChatModule` with channel CRUD + message handling
2. Create Prisma models (Channel, ChatMessage, etc.)
3. Add PostgreSQL FTS for message search
4. Create `NotificationModule` with event bus + fan-out
5. Create `LockModule` (needed for future task editing)
6. Configure BullMQ queues
7. Frontend: chat UI, typing indicators, threads, notifications

### Phase 3: Task Management (future)

### Phase 4: AI + Chat Integration (future)
