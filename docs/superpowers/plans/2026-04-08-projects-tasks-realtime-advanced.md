# Projects & Tasks — Realtime Advanced Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add advanced realtime collaboration features — project presence, field-level locking with visual indicators, autosave on title/description, live activity feed, delta sync on reconnect, live comments, typing indicators, and live section events — to the Projects & Tasks module.

**Architecture:** Builds on existing PresenceService (Redis ZSETs), LockService (PostgreSQL ResourceLock + cron cleanup), EventEmitter2 → RealtimeGateway → project rooms pattern. Adds `version` column to Task for delta sync, wires TaskComment edit/delete events, creates frontend sync components (LockSync, CommentsSync, ActivitySync) that follow the existing `PresenceSync` / `NotificationSync` template. All realtime consumption goes through Zustand stores.

**Tech Stack:** NestJS, Prisma, Socket.IO, Redis, React 19, Zustand, @hugeicons/react, socket.io-client

**Spec:** `docs/superpowers/specs/2026-04-06-projects-tasks-design.md` (section 5)

**Worktree:** `/Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks`

---

## File Structure

### Backend
```
apps/api/
├── prisma/schema.prisma                           # Add Task.version field
├── prisma/migrations/YYYYMMDDHHMMSS_add_task_version/
│   └── migration.sql                              # New migration
├── src/modules/tasks/
│   ├── services/
│   │   ├── tasks.service.ts                       # Modify: increment version on update/move
│   │   ├── task-comments.service.ts               # Modify: emit events on update/remove/react
│   │   └── task-delta-sync.service.ts             # NEW: delta sync endpoint backend
│   ├── controllers/
│   │   ├── tasks.controller.ts                    # Modify: add GET /tasks/sync
│   │   └── task-comments.controller.ts            # Already exists
│   ├── dto/
│   │   └── index.ts                               # Add deltaSyncSchema
│   └── tasks.module.ts                            # Register TaskDeltaSyncService
└── src/modules/realtime/
    └── realtime.gateway.ts                        # Add comment:typing, typing:stop, task room subscriptions
```

### Shared
```
packages/shared/src/realtime.ts                    # Add new event types
```

### Frontend
```
apps/web/
├── stores/
│   ├── project-store.ts                           # Add: locks, commentsByTask, activityByTask, typingByTask
│   └── presence-store.ts                          # No changes (already supports per-view)
├── hooks/
│   ├── use-field-lock.ts                          # NEW: acquire/release lock with heartbeat
│   ├── use-autosave-field.ts                      # NEW: debounced autosave with lock integration
│   └── use-task-activity.ts                       # NEW: fetch + realtime updates of activity
├── components/projects/
│   ├── project-realtime-sync.tsx                  # Modify: re-join on reconnect, typing, comment events
│   ├── project-presence-avatars.tsx               # NEW: avatar stack scoped to project room
│   ├── task-presence-avatars.tsx                  # NEW: avatar stack for task detail sheet
│   ├── field-lock-indicator.tsx                   # NEW: "Camilo está editando..." badge
│   ├── detail/
│   │   ├── task-detail-sheet.tsx                  # Modify: wire field locks + autosave
│   │   ├── task-detail-title.tsx                  # NEW: inline editable title with lock
│   │   ├── task-detail-description.tsx            # NEW: textarea with lock + autosave
│   │   ├── task-activity-feed.tsx                 # NEW: live activity timeline
│   │   ├── task-comments.tsx                      # Modify: subscribe to live events + typing
│   │   └── task-comment-typing.tsx                # NEW: "X está escribiendo..." bubble
│   └── project-header.tsx                         # Modify: add ProjectPresenceAvatars
```

---

## Task 1: Add Task.version Field and Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (Task model)
- Create: `apps/api/prisma/migrations/<timestamp>_add_task_version/migration.sql`

- [ ] **Step 1: Add version field to Task model**

In `apps/api/prisma/schema.prisma`, find the `Task` model (around line 2286) and add after `estimateUnit`:

```prisma
  version         Int          @default(1)
```

The full field section should now be:
```prisma
  estimate        Decimal?     @db.Decimal(10, 2)
  estimateUnit    String?
  version         Int          @default(1)
  deletedAt       DateTime?
```

- [ ] **Step 2: Generate migration**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks/apps/api && npx prisma migrate dev --name add_task_version --create-only`

If shadow DB fails (same issue as before), use `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` to generate the SQL manually and apply it via `psql`. Then run `npx prisma migrate resolve --applied <migration_name>`.

Expected: Migration file created at `apps/api/prisma/migrations/<timestamp>_add_task_version/migration.sql` with content:
```sql
ALTER TABLE "public"."tasks" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
```

- [ ] **Step 3: Apply migration**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks/apps/api && npx prisma migrate dev`
Expected: "Database is now in sync with your Prisma schema."

Then: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks/apps/api && npx prisma generate`
Expected: "Generated Prisma Client"

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(schema): add version field to Task for delta sync"
```

---

## Task 2: Increment Version in TasksService Mutations

**Files:**
- Modify: `apps/api/src/modules/tasks/services/tasks.service.ts`

- [ ] **Step 1: Read TasksService**

Read `apps/api/src/modules/tasks/services/tasks.service.ts` to understand the `update`, `move`, and `bulkUpdate` method signatures.

- [ ] **Step 2: Increment version in update()**

In the `update` method, find the line that calls `client.task.update({...})` and modify the data payload to include `version: { increment: 1 }`. Example:

```typescript
const updated = await client.task.update({
  where: { id: taskId, tenantId },
  data: {
    ...patchData,
    version: { increment: 1 },
  },
  include: /* existing includes */,
});
```

Then in the event emission, include `version: updated.version`:

```typescript
this.eventEmitter.emit('task.updated', {
  tenantId,
  projectId: updated.projectId,
  taskId: updated.id,
  changes,
  version: updated.version,
  actorId: userId,
});
```

- [ ] **Step 3: Increment version in move()**

In the `move` method, apply the same `version: { increment: 1 }` to the update data, and include `version: updated.version` in the emitted `task.moved` event payload.

- [ ] **Step 4: Increment version in bulkUpdate()**

In the bulk update loop, after each per-task update, include `version: { increment: 1 }` and emit the updated version.

- [ ] **Step 5: Verify build**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks/apps/api && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/tasks/services/tasks.service.ts
git commit -m "feat(tasks): increment version on update/move/bulkUpdate"
```

---

## Task 3: Delta Sync Endpoint

**Files:**
- Create: `apps/api/src/modules/tasks/services/task-delta-sync.service.ts`
- Modify: `apps/api/src/modules/tasks/controllers/tasks.controller.ts`
- Modify: `apps/api/src/modules/tasks/dto/index.ts`
- Modify: `apps/api/src/modules/tasks/tasks.module.ts`

- [ ] **Step 1: Add DTO**

In `apps/api/src/modules/tasks/dto/index.ts`, add:

```typescript
export const deltaSyncSchema = z.object({
  projectId: z.string().uuid(),
  versions: z.record(z.string().uuid(), z.number().int().nonnegative()),
});

export type DeltaSyncDto = z.infer<typeof deltaSyncSchema>;
```

- [ ] **Step 2: Create TaskDeltaSyncService**

Create `apps/api/src/modules/tasks/services/task-delta-sync.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DeltaSyncDto } from '../dto';

interface DeltaSyncResult {
  updated: unknown[];
  deleted: string[];
  added: unknown[];
}

@Injectable()
export class TaskDeltaSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(
    tenantId: string,
    userId: string,
    dto: DeltaSyncDto,
  ): Promise<DeltaSyncResult> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Load all current tasks for the project (including deleted via rawClient to detect deletions)
    const currentTasks = await client.task.findMany({
      where: { projectId: dto.projectId, deletedAt: null },
      include: {
        status: true,
        section: true,
        assignees: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        labels: { include: { label: true } },
        _count: { select: { subtasks: true, comments: true } },
      },
    });

    const currentIds = new Set(currentTasks.map((t) => t.id));
    const clientIds = new Set(Object.keys(dto.versions));

    // Deleted = in client but not in current
    const deleted = Array.from(clientIds).filter((id) => !currentIds.has(id));

    // Added = in current but not in client
    const added = currentTasks.filter((t) => !clientIds.has(t.id));

    // Updated = in both, current version > client version
    const updated = currentTasks.filter(
      (t) => clientIds.has(t.id) && t.version > (dto.versions[t.id] ?? 0),
    );

    return { updated, deleted, added };
  }
}
```

- [ ] **Step 3: Register service in TasksModule**

In `apps/api/src/modules/tasks/tasks.module.ts`, add `TaskDeltaSyncService` to the `providers` array and import it at top.

- [ ] **Step 4: Add endpoint to TasksController**

In `apps/api/src/modules/tasks/controllers/tasks.controller.ts`, import `TaskDeltaSyncService` and `deltaSyncSchema`, inject the service in the constructor, and add a new endpoint:

```typescript
@Post('sync')
@SkipTaskAccessGuard()
sync(
  @CurrentTenant() tenantId: string,
  @CurrentUser('userId') userId: string,
  @Body(new ZodValidationPipe(deltaSyncSchema)) dto: DeltaSyncDto,
) {
  return this.taskDeltaSyncService.sync(tenantId, userId, dto);
}
```

Note: We skip TaskAccessGuard because the service-level check uses `prisma.forTenant` which isolates by tenant. The projectId is validated by the schema (uuid). For stronger security, also add a check inside `TaskDeltaSyncService.sync` that verifies the user is a member of the project before returning data.

- [ ] **Step 5: Add project membership check in service**

Modify `TaskDeltaSyncService.sync` to first check that the user has access to the project:

```typescript
const project = await client.project.findFirst({
  where: { id: dto.projectId, tenantId, deletedAt: null },
  select: { visibility: true },
});
if (!project) {
  throw new NotFoundException('Proyecto no encontrado');
}
if (project.visibility === 'PRIVATE') {
  const member = await client.projectMember.findUnique({
    where: { projectId_userId: { projectId: dto.projectId, userId } },
  });
  if (!member) {
    throw new ForbiddenException('No eres miembro de este proyecto');
  }
}
```

Add imports for `NotFoundException` and `ForbiddenException` from `@nestjs/common`.

- [ ] **Step 6: Verify build**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks/apps/api && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Run lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/tasks/
git commit -m "feat(tasks): add delta sync endpoint for reconnection recovery"
```

---

## Task 4: Emit Events on Comment Update/Delete/Reactions

**Files:**
- Modify: `apps/api/src/modules/tasks/services/task-comments.service.ts`
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`
- Modify: `packages/shared/src/realtime.ts`

- [ ] **Step 1: Add events to shared types**

In `packages/shared/src/realtime.ts`, add to `ServerToClientEvents` (after `'task:comment:new'`):

```typescript
'task:comment:updated': (data: { projectId: string; taskId: string; commentId: string; comment: Record<string, unknown>; actorId?: string }) => void;
'task:comment:deleted': (data: { projectId: string; taskId: string; commentId: string; actorId?: string }) => void;
'task:comment:reaction:added': (data: { projectId: string; taskId: string; commentId: string; emoji: string; userId: string }) => void;
'task:comment:reaction:removed': (data: { projectId: string; taskId: string; commentId: string; emoji: string; userId: string }) => void;
```

Also add typing indicator events (for Task 10 later, but declaring now):

```typescript
'task:comment:typing': (data: { projectId: string; taskId: string; userId: string; userName: string }) => void;
'task:comment:typing:stop': (data: { projectId: string; taskId: string; userId: string }) => void;
```

And to `ClientToServerEvents`:

```typescript
'task:comment:typing': (data: { taskId: string; projectId: string }) => void;
'task:comment:typing:stop': (data: { taskId: string; projectId: string }) => void;
```

- [ ] **Step 2: Emit events from TaskCommentsService**

In `apps/api/src/modules/tasks/services/task-comments.service.ts`, find the `update`, `remove`, `addReaction`, and `removeReaction` methods. After each successful mutation, emit the corresponding event via `eventEmitter.emit`.

For `update`:
```typescript
// After successful update
this.eventEmitter.emit('task.comment.updated', {
  tenantId,
  taskId: comment.taskId,
  projectId: task.projectId,
  commentId: comment.id,
  comment: updated,
  actorId: userId,
});
```

Note: `task` needs to be loaded to get `projectId`. If not already available, add a preliminary `client.task.findUnique({ where: { id: comment.taskId }, select: { projectId: true } })`.

For `remove`:
```typescript
this.eventEmitter.emit('task.comment.deleted', {
  tenantId,
  taskId: comment.taskId,
  projectId: task.projectId,
  commentId: comment.id,
  actorId: userId,
});
```

For `addReaction`:
```typescript
this.eventEmitter.emit('task.comment.reaction.added', {
  tenantId,
  taskId: comment.taskId,
  projectId: task.projectId,
  commentId: comment.id,
  emoji: dto.emoji,
  userId,
});
```

For `removeReaction`: same pattern with action `'task.comment.reaction.removed'`.

- [ ] **Step 3: Add listeners in RealtimeGateway**

In `apps/api/src/modules/realtime/realtime.gateway.ts`, add 4 new `@OnEvent` handlers (after the existing `task.comment.created` handler):

```typescript
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
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm --filter @zeru/shared build && cd apps/api && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/tasks/services/task-comments.service.ts apps/api/src/modules/realtime/realtime.gateway.ts packages/shared/src/realtime.ts
git commit -m "feat(comments): emit realtime events on update/delete/reactions"
```

---

## Task 5: Gateway Handler for Typing Indicators

**Files:**
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`

- [ ] **Step 1: Add typing handlers**

In `apps/api/src/modules/realtime/realtime.gateway.ts`, add two new `@SubscribeMessage` handlers (after the existing `project:leave` handler):

```typescript
@SubscribeMessage('task:comment:typing')
async handleCommentTyping(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { taskId: string; projectId: string },
) {
  const { userId, tenantId, userName } = client.data;
  if (!userId || !tenantId) return;

  const room = `project:${tenantId}:${data.projectId}`;
  this.server.to(room).except(client.id).emit('task:comment:typing' as any, {
    projectId: data.projectId,
    taskId: data.taskId,
    userId,
    userName,
  } as any);
}

@SubscribeMessage('task:comment:typing:stop')
async handleCommentTypingStop(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { taskId: string; projectId: string },
) {
  const { userId, tenantId } = client.data;
  if (!userId || !tenantId) return;

  const room = `project:${tenantId}:${data.projectId}`;
  this.server.to(room).except(client.id).emit('task:comment:typing:stop' as any, {
    projectId: data.projectId,
    taskId: data.taskId,
    userId,
  } as any);
}
```

The `as any` casts are consistent with the existing chat typing pattern in this file (lines 353-372).

Make sure `ConnectedSocket`, `MessageBody`, and `Socket` are already imported at the top of the file — they should be from the existing handlers.

- [ ] **Step 2: Verify build**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks/apps/api && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/realtime/realtime.gateway.ts
git commit -m "feat(realtime): add task comment typing indicator handlers"
```

---

## Task 6: Extend Project Store for Locks, Comments, Activity, Typing

**Files:**
- Modify: `apps/web/stores/project-store.ts`

- [ ] **Step 1: Add new state slices**

In `apps/web/stores/project-store.ts`, extend the `ProjectState` interface and implementation. The complete updated file:

```typescript
import { create } from "zustand";
import type { Task, TaskComment, TaskActivity, UserSummary } from "@/types/projects";

export interface FieldLock {
  entityType: string;
  entityId: string;
  fieldName: string;
  user: UserSummary & { color?: string };
}

export interface TypingUser {
  userId: string;
  userName: string;
  startedAt: number;
}

interface ProjectState {
  // Tasks grouped by projectId
  tasksByProject: Map<string, Map<string, Task>>;
  // Currently open task (for detail sheet)
  openTaskId: string | null;
  // Comments by taskId
  commentsByTask: Map<string, TaskComment[]>;
  // Activity by taskId
  activityByTask: Map<string, TaskActivity[]>;
  // Typing indicators by taskId
  typingByTask: Map<string, Map<string, TypingUser>>;
  // Field locks keyed by `${entityType}:${entityId}:${fieldName}`
  locks: Map<string, FieldLock>;

  // Task actions
  setTasks: (projectId: string, tasks: Task[]) => void;
  upsertTask: (projectId: string, task: Task) => void;
  removeTask: (projectId: string, taskId: string) => void;
  patchTask: (projectId: string, taskId: string, patch: Partial<Task>) => void;
  getTasks: (projectId: string) => Task[];
  getTask: (projectId: string, taskId: string) => Task | null;

  setOpenTaskId: (taskId: string | null) => void;

  // Comment actions
  setComments: (taskId: string, comments: TaskComment[]) => void;
  addComment: (taskId: string, comment: TaskComment) => void;
  updateComment: (taskId: string, commentId: string, patch: Partial<TaskComment>) => void;
  removeComment: (taskId: string, commentId: string) => void;
  addCommentReaction: (taskId: string, commentId: string, emoji: string, userId: string) => void;
  removeCommentReaction: (taskId: string, commentId: string, emoji: string, userId: string) => void;

  // Activity actions
  setActivity: (taskId: string, items: TaskActivity[]) => void;
  prependActivity: (taskId: string, item: TaskActivity) => void;

  // Typing actions
  setTypingUser: (taskId: string, user: TypingUser) => void;
  clearTypingUser: (taskId: string, userId: string) => void;

  // Lock actions
  setLock: (lock: FieldLock) => void;
  removeLock: (entityType: string, entityId: string, fieldName: string) => void;
  getLock: (entityType: string, entityId: string, fieldName: string) => FieldLock | null;
}

function lockKey(entityType: string, entityId: string, fieldName: string): string {
  return `${entityType}:${entityId}:${fieldName}`;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  tasksByProject: new Map(),
  openTaskId: null,
  commentsByTask: new Map(),
  activityByTask: new Map(),
  typingByTask: new Map(),
  locks: new Map(),

  setTasks: (projectId, tasks) =>
    set((state) => {
      const next = new Map(state.tasksByProject);
      const taskMap = new Map<string, Task>();
      for (const task of tasks) taskMap.set(task.id, task);
      next.set(projectId, taskMap);
      return { tasksByProject: next };
    }),

  upsertTask: (projectId, task) =>
    set((state) => {
      const next = new Map(state.tasksByProject);
      const taskMap = new Map(next.get(projectId) ?? []);
      taskMap.set(task.id, task);
      next.set(projectId, taskMap);
      return { tasksByProject: next };
    }),

  removeTask: (projectId, taskId) =>
    set((state) => {
      const next = new Map(state.tasksByProject);
      const taskMap = new Map(next.get(projectId) ?? []);
      taskMap.delete(taskId);
      next.set(projectId, taskMap);
      return { tasksByProject: next };
    }),

  patchTask: (projectId, taskId, patch) =>
    set((state) => {
      const next = new Map(state.tasksByProject);
      const taskMap = new Map(next.get(projectId) ?? []);
      const existing = taskMap.get(taskId);
      if (!existing) return state;
      taskMap.set(taskId, { ...existing, ...patch });
      next.set(projectId, taskMap);
      return { tasksByProject: next };
    }),

  getTasks: (projectId) => {
    const taskMap = get().tasksByProject.get(projectId);
    if (!taskMap) return [];
    return Array.from(taskMap.values()).sort((a, b) =>
      a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
    );
  },

  getTask: (projectId, taskId) => {
    return get().tasksByProject.get(projectId)?.get(taskId) ?? null;
  },

  setOpenTaskId: (taskId) => set({ openTaskId: taskId }),

  setComments: (taskId, comments) =>
    set((state) => {
      const next = new Map(state.commentsByTask);
      next.set(taskId, comments);
      return { commentsByTask: next };
    }),

  addComment: (taskId, comment) =>
    set((state) => {
      const next = new Map(state.commentsByTask);
      const existing = next.get(taskId) ?? [];
      if (existing.some((c) => c.id === comment.id)) return state;
      next.set(taskId, [...existing, comment]);
      return { commentsByTask: next };
    }),

  updateComment: (taskId, commentId, patch) =>
    set((state) => {
      const next = new Map(state.commentsByTask);
      const existing = next.get(taskId) ?? [];
      next.set(
        taskId,
        existing.map((c) => (c.id === commentId ? { ...c, ...patch } : c)),
      );
      return { commentsByTask: next };
    }),

  removeComment: (taskId, commentId) =>
    set((state) => {
      const next = new Map(state.commentsByTask);
      const existing = next.get(taskId) ?? [];
      next.set(
        taskId,
        existing.filter((c) => c.id !== commentId),
      );
      return { commentsByTask: next };
    }),

  addCommentReaction: (taskId, commentId, emoji, userId) =>
    set((state) => {
      const next = new Map(state.commentsByTask);
      const existing = next.get(taskId) ?? [];
      next.set(
        taskId,
        existing.map((c) => {
          if (c.id !== commentId) return c;
          const reactions = c.reactions ?? [];
          if (reactions.some((r) => r.emoji === emoji && r.userId === userId)) return c;
          return { ...c, reactions: [...reactions, { emoji, userId }] };
        }),
      );
      return { commentsByTask: next };
    }),

  removeCommentReaction: (taskId, commentId, emoji, userId) =>
    set((state) => {
      const next = new Map(state.commentsByTask);
      const existing = next.get(taskId) ?? [];
      next.set(
        taskId,
        existing.map((c) => {
          if (c.id !== commentId) return c;
          const reactions = (c.reactions ?? []).filter(
            (r) => !(r.emoji === emoji && r.userId === userId),
          );
          return { ...c, reactions };
        }),
      );
      return { commentsByTask: next };
    }),

  setActivity: (taskId, items) =>
    set((state) => {
      const next = new Map(state.activityByTask);
      next.set(taskId, items);
      return { activityByTask: next };
    }),

  prependActivity: (taskId, item) =>
    set((state) => {
      const next = new Map(state.activityByTask);
      const existing = next.get(taskId) ?? [];
      if (existing.some((a) => a.id === item.id)) return state;
      next.set(taskId, [item, ...existing]);
      return { activityByTask: next };
    }),

  setTypingUser: (taskId, user) =>
    set((state) => {
      const next = new Map(state.typingByTask);
      const existing = new Map(next.get(taskId) ?? []);
      existing.set(user.userId, user);
      next.set(taskId, existing);
      return { typingByTask: next };
    }),

  clearTypingUser: (taskId, userId) =>
    set((state) => {
      const next = new Map(state.typingByTask);
      const existing = new Map(next.get(taskId) ?? []);
      existing.delete(userId);
      next.set(taskId, existing);
      return { typingByTask: next };
    }),

  setLock: (lock) =>
    set((state) => {
      const next = new Map(state.locks);
      next.set(lockKey(lock.entityType, lock.entityId, lock.fieldName), lock);
      return { locks: next };
    }),

  removeLock: (entityType, entityId, fieldName) =>
    set((state) => {
      const next = new Map(state.locks);
      next.delete(lockKey(entityType, entityId, fieldName));
      return { locks: next };
    }),

  getLock: (entityType, entityId, fieldName) => {
    return get().locks.get(lockKey(entityType, entityId, fieldName)) ?? null;
  },
}));
```

- [ ] **Step 2: Verify lint and build**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/stores/project-store.ts
git commit -m "feat(projects): extend store with comments, activity, typing, and locks"
```

---

## Task 7: Project Presence Avatars

**Files:**
- Create: `apps/web/components/projects/project-presence-avatars.tsx`
- Modify: `apps/web/components/projects/project-header.tsx`

- [ ] **Step 1: Create ProjectPresenceAvatars**

Create `apps/web/components/projects/project-presence-avatars.tsx`:

```tsx
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePresenceStore } from "@/stores/presence-store";
import type { PresenceUser } from "@zeru/shared";

interface ProjectPresenceAvatarsProps {
  projectId: string;
  max?: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

export function ProjectPresenceAvatars({ projectId, max = 4 }: ProjectPresenceAvatarsProps) {
  const viewPath = `/projects/${projectId}`;
  const users = usePresenceStore((s) => s.viewUsers.get(viewPath) ?? []);

  if (users.length === 0) return null;

  const visible = users.slice(0, max);
  const extra = users.length - max;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((user: PresenceUser) => (
        <Tooltip key={user.userId}>
          <TooltipTrigger asChild>
            <Avatar className={cn("size-7 border-2 border-background")}>
              <AvatarFallback
                className="text-[10px] font-medium text-white"
                style={{ backgroundColor: user.color }}
              >
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>{user.name}</TooltipContent>
        </Tooltip>
      ))}
      {extra > 0 && (
        <Avatar className="size-7 border-2 border-background">
          <AvatarFallback className="text-[10px]">+{extra}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add to ProjectHeader**

Modify `apps/web/components/projects/project-header.tsx` to include the avatars. The updated file:

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { ProjectPresenceAvatars } from "@/components/projects/project-presence-avatars";
import type { Project } from "@/types/projects";

interface ProjectHeaderProps {
  project: Project;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  COMPLETED: "Completado",
  ARCHIVED: "Archivado",
};

export function ProjectHeader({ project }: ProjectHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {project.icon && <span className="text-xl">{project.icon}</span>}
          <h1 className="text-xl font-semibold truncate">{project.name}</h1>
          <Badge variant="outline" className="text-xs">
            {project.key}
          </Badge>
          <Badge variant="secondary">{STATUS_LABELS[project.status]}</Badge>
        </div>
        {project.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {project.description}
          </p>
        )}
      </div>
      <ProjectPresenceAvatars projectId={project.id} />
    </div>
  );
}
```

Note: Presence sync already handles `/projects/{projectId}` because `PresenceSync` uses `usePathname()`. When the user navigates to `/projects/abc/board`, the viewPath is `/projects/abc/board`, not `/projects/abc`. For the presence to populate correctly we need to use the current pathname. Change the viewPath lookup to use the current pathname matching any `/projects/{projectId}/*` route.

Update the avatars component:

```tsx
import { usePathname } from "next/navigation";
// ...
const pathname = usePathname();
const users = usePresenceStore((s) => s.viewUsers.get(pathname ?? `/projects/${projectId}`) ?? []);
```

- [ ] **Step 3: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/projects/project-presence-avatars.tsx apps/web/components/projects/project-header.tsx
git commit -m "feat(projects): add project presence avatars to header"
```

---

## Task 8: Task Presence Avatars in Detail Sheet

**Files:**
- Create: `apps/web/components/projects/task-presence-avatars.tsx`
- Modify: `apps/web/components/projects/detail/task-detail-sheet.tsx`

The existing `PresenceSync` already handles presence by pathname. But when the task detail sheet opens via `?task=ID`, the pathname doesn't change — only search params do. We need dedicated task-level presence.

- [ ] **Step 1: Create task presence sync hook**

Create `apps/web/hooks/use-task-presence.ts`:

```typescript
"use client";

import { useEffect } from "react";
import { useSocket } from "@/hooks/use-socket";
import { usePresenceStore } from "@/stores/presence-store";
import type { PresenceSnapshot, PresenceUpdate } from "@zeru/shared";

export function useTaskPresence(projectId: string | null, taskId: string | null) {
  const socket = useSocket();
  const setViewUsers = usePresenceStore((s) => s.setViewUsers);

  useEffect(() => {
    if (!socket || !projectId || !taskId) return;

    const viewPath = `/projects/${projectId}/task/${taskId}`;
    socket.emit("presence:join", { viewPath });

    const handleSnapshot = (data: PresenceSnapshot) => {
      if (data.viewPath === viewPath) setViewUsers(viewPath, data.users);
    };
    const handleUpdate = (data: PresenceUpdate) => {
      if (data.viewPath === viewPath) setViewUsers(viewPath, data.users);
    };

    socket.on("presence:snapshot", handleSnapshot);
    socket.on("presence:update", handleUpdate);

    return () => {
      socket.emit("presence:leave", { viewPath });
      socket.off("presence:snapshot", handleSnapshot);
      socket.off("presence:update", handleUpdate);
    };
  }, [socket, projectId, taskId, setViewUsers]);
}
```

- [ ] **Step 2: Create TaskPresenceAvatars**

Create `apps/web/components/projects/task-presence-avatars.tsx`:

```tsx
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePresenceStore } from "@/stores/presence-store";
import type { PresenceUser } from "@zeru/shared";

interface TaskPresenceAvatarsProps {
  projectId: string;
  taskId: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

export function TaskPresenceAvatars({ projectId, taskId }: TaskPresenceAvatarsProps) {
  const viewPath = `/projects/${projectId}/task/${taskId}`;
  const users = usePresenceStore((s) => s.viewUsers.get(viewPath) ?? []);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Viendo:</span>
      <div className="flex items-center -space-x-1">
        {users.slice(0, 5).map((user: PresenceUser) => (
          <Tooltip key={user.userId}>
            <TooltipTrigger asChild>
              <Avatar className="size-5 border-2 border-background">
                <AvatarFallback
                  className="text-[8px] font-medium text-white"
                  style={{ backgroundColor: user.color }}
                >
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{user.name}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into TaskDetailSheet**

Modify `apps/web/components/projects/detail/task-detail-sheet.tsx`:

1. Import the hook and component:
```tsx
import { useTaskPresence } from "@/hooks/use-task-presence";
import { TaskPresenceAvatars } from "@/components/projects/task-presence-avatars";
```

2. Call the hook after getting `task`:
```tsx
useTaskPresence(task?.projectId ?? null, taskId);
```

3. Add the avatars in the sheet header, below the badges:
```tsx
{displayTask?.projectId && taskId && (
  <TaskPresenceAvatars projectId={displayTask.projectId} taskId={taskId} />
)}
```

- [ ] **Step 4: Verify lint and build**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm --filter @zeru/web build`
Expected: Success.

- [ ] **Step 5: Commit**

```bash
git add apps/web/hooks/use-task-presence.ts apps/web/components/projects/task-presence-avatars.tsx apps/web/components/projects/detail/task-detail-sheet.tsx
git commit -m "feat(projects): add task-level presence in detail sheet"
```

---

## Task 9: Field Lock Hook + Indicator Component

**Files:**
- Create: `apps/web/hooks/use-field-lock.ts`
- Create: `apps/web/components/projects/field-lock-indicator.tsx`
- Create: `apps/web/components/realtime/lock-sync.tsx`
- Modify: `apps/web/app/(dashboard)/projects/[projectId]/layout.tsx`

- [ ] **Step 1: Create LockSync component**

This component listens to `field:locked` / `field:unlocked` events from the gateway and updates the Zustand store. Note: the gateway currently emits these without the `lock:` prefix.

Create `apps/web/components/realtime/lock-sync.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useProjectStore, type FieldLock } from "@/stores/project-store";

interface LockEventPayload {
  entityType: string;
  entityId: string;
  fieldName: string;
  userId: string;
  socketId?: string;
  expiresAt?: string;
  user?: {
    userId: string;
    name: string;
    avatar: string | null;
    color: string;
  };
}

export function LockSync() {
  const socket = useSocket();
  const setLock = useProjectStore((s) => s.setLock);
  const removeLock = useProjectStore((s) => s.removeLock);

  useEffect(() => {
    if (!socket) return;

    const handleLocked = (data: LockEventPayload) => {
      if (!data.user) return;
      const lock: FieldLock = {
        entityType: data.entityType,
        entityId: data.entityId,
        fieldName: data.fieldName,
        user: {
          id: data.user.userId,
          firstName: data.user.name.split(" ")[0] ?? data.user.name,
          lastName: data.user.name.split(" ").slice(1).join(" ") || "",
          color: data.user.color,
        } as FieldLock["user"],
      };
      setLock(lock);
    };

    const handleUnlocked = (data: LockEventPayload) => {
      removeLock(data.entityType, data.entityId, data.fieldName);
    };

    // Gateway emits these without the `lock:` prefix
    socket.on("field:locked" as "lock:field-locked", handleLocked as (data: unknown) => void);
    socket.on("field:unlocked" as "lock:field-unlocked", handleUnlocked as (data: unknown) => void);

    return () => {
      socket.off("field:locked" as "lock:field-locked", handleLocked as (data: unknown) => void);
      socket.off("field:unlocked" as "lock:field-unlocked", handleUnlocked as (data: unknown) => void);
    };
  }, [socket, setLock, removeLock]);

  return null;
}
```

- [ ] **Step 2: Create useFieldLock hook**

Create `apps/web/hooks/use-field-lock.ts`:

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useProjectStore } from "@/stores/project-store";

interface UseFieldLockOptions {
  entityType: string;
  entityId: string;
  fieldName: string;
  enabled?: boolean;
}

interface UseFieldLockResult {
  acquire: () => Promise<boolean>;
  release: () => Promise<void>;
  isLockedByMe: boolean;
  isLockedByOther: boolean;
  lockedByName: string | null;
}

export function useFieldLock({
  entityType,
  entityId,
  fieldName,
  enabled = true,
}: UseFieldLockOptions): UseFieldLockResult {
  const socket = useSocket();
  const [isLockedByMe, setIsLockedByMe] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lock = useProjectStore((s) =>
    entityId ? s.locks.get(`${entityType}:${entityId}:${fieldName}`) ?? null : null,
  );

  const myUserId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;

  const isLockedByOther = !!lock && lock.user.id !== myUserId;
  const lockedByName = isLockedByOther
    ? `${lock.user.firstName} ${lock.user.lastName}`.trim()
    : null;

  const acquire = useCallback(async (): Promise<boolean> => {
    if (!socket || !enabled) return false;
    return new Promise((resolve) => {
      const onAcquired = (data: { entityType: string; entityId: string; fieldName: string }) => {
        if (
          data.entityType === entityType &&
          data.entityId === entityId &&
          data.fieldName === fieldName
        ) {
          cleanup();
          setIsLockedByMe(true);
          resolve(true);
        }
      };
      const onDenied = (data: { entityType: string; entityId: string; fieldName: string }) => {
        if (
          data.entityType === entityType &&
          data.entityId === entityId &&
          data.fieldName === fieldName
        ) {
          cleanup();
          resolve(false);
        }
      };
      const cleanup = () => {
        socket.off("lock:acquired", onAcquired);
        socket.off("lock:denied", onDenied as (data: unknown) => void);
      };
      socket.on("lock:acquired", onAcquired);
      socket.on("lock:denied", onDenied as (data: unknown) => void);
      socket.emit("lock:acquire", { entityType, entityId, fieldName });

      // Timeout safety net
      setTimeout(() => {
        cleanup();
        resolve(false);
      }, 5000);
    });
  }, [socket, enabled, entityType, entityId, fieldName]);

  const release = useCallback(async (): Promise<void> => {
    if (!socket || !enabled) return;
    socket.emit("lock:release", { entityType, entityId, fieldName });
    setIsLockedByMe(false);
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, [socket, enabled, entityType, entityId, fieldName]);

  // Heartbeat while we hold the lock
  useEffect(() => {
    if (!isLockedByMe || !socket) return;

    heartbeatRef.current = setInterval(() => {
      socket.emit("lock:heartbeat", { entityType, entityId, fieldName });
    }, 30_000);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [isLockedByMe, socket, entityType, entityId, fieldName]);

  // Release on unmount
  useEffect(() => {
    return () => {
      if (isLockedByMe && socket) {
        socket.emit("lock:release", { entityType, entityId, fieldName });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    acquire,
    release,
    isLockedByMe,
    isLockedByOther,
    lockedByName,
  };
}
```

Note on userId: the hook reads `localStorage.getItem("userId")`. If the app stores userId differently, adjust accordingly. Check `apps/web/lib/api-client.ts` or auth handling for the correct key.

- [ ] **Step 3: Create FieldLockIndicator**

Create `apps/web/components/projects/field-lock-indicator.tsx`:

```tsx
"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { SquareLockPasswordIcon } from "@hugeicons/core-free-icons";

interface FieldLockIndicatorProps {
  lockedByName: string | null;
}

export function FieldLockIndicator({ lockedByName }: FieldLockIndicatorProps) {
  if (!lockedByName) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <HugeiconsIcon icon={SquareLockPasswordIcon} className="size-3.5" />
      <span>{lockedByName} está editando...</span>
    </div>
  );
}
```

- [ ] **Step 4: Mount LockSync in project layout**

Modify `apps/web/app/(dashboard)/projects/[projectId]/layout.tsx` to include `LockSync`. Import at top:

```tsx
import { LockSync } from "@/components/realtime/lock-sync";
```

Add before `TaskDetailSheet`:
```tsx
<LockSync />
```

- [ ] **Step 5: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/hooks/use-field-lock.ts apps/web/components/projects/field-lock-indicator.tsx apps/web/components/realtime/lock-sync.tsx apps/web/app/\(dashboard\)/projects/\[projectId\]/layout.tsx
git commit -m "feat(realtime): add field lock hook and visual indicator"
```

---

## Task 10: Autosave Hook with Lock Integration

**Files:**
- Create: `apps/web/hooks/use-autosave-field.ts`

- [ ] **Step 1: Create useAutosaveField**

Create `apps/web/hooks/use-autosave-field.ts`:

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useFieldLock } from "@/hooks/use-field-lock";

interface UseAutosaveFieldOptions<T> {
  entityType: string;
  entityId: string;
  fieldName: string;
  initialValue: T;
  save: (value: T) => Promise<void>;
  debounceMs?: number;
}

interface UseAutosaveFieldResult<T> {
  value: T;
  setValue: (value: T) => void;
  isDirty: boolean;
  isSaving: boolean;
  isLockedByOther: boolean;
  lockedByName: string | null;
  onFocus: () => void;
  onBlur: () => void;
}

export function useAutosaveField<T>({
  entityType,
  entityId,
  fieldName,
  initialValue,
  save,
  debounceMs = 800,
}: UseAutosaveFieldOptions<T>): UseAutosaveFieldResult<T> {
  const [value, setValueState] = useState<T>(initialValue);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef<T>(initialValue);

  const { acquire, release, isLockedByOther, lockedByName } = useFieldLock({
    entityType,
    entityId,
    fieldName,
  });

  // Keep latest value in ref for timers
  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  // Sync external changes (from realtime) when not dirty
  useEffect(() => {
    if (!isDirty) {
      setValueState(initialValue);
      latestValueRef.current = initialValue;
    }
  }, [initialValue, isDirty]);

  const setValue = useCallback(
    (next: T) => {
      setValueState(next);
      setIsDirty(true);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          await save(latestValueRef.current);
          setIsDirty(false);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Error al guardar");
        } finally {
          setIsSaving(false);
        }
      }, debounceMs);
    },
    [save, debounceMs],
  );

  const onFocus = useCallback(() => {
    void acquire();
  }, [acquire]);

  const onBlur = useCallback(() => {
    // Flush pending save before releasing lock
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      if (isDirty) {
        setIsSaving(true);
        save(latestValueRef.current)
          .then(() => setIsDirty(false))
          .catch((err) =>
            toast.error(err instanceof Error ? err.message : "Error al guardar"),
          )
          .finally(() => {
            setIsSaving(false);
            void release();
          });
        return;
      }
    }
    void release();
  }, [save, release, isDirty]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return {
    value,
    setValue,
    isDirty,
    isSaving,
    isLockedByOther,
    lockedByName,
    onFocus,
    onBlur,
  };
}
```

- [ ] **Step 2: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/hooks/use-autosave-field.ts
git commit -m "feat(projects): add autosave field hook with lock integration"
```

---

## Task 11: Editable Title and Description in Task Detail Sheet

**Files:**
- Create: `apps/web/components/projects/detail/task-detail-title.tsx`
- Create: `apps/web/components/projects/detail/task-detail-description.tsx`
- Modify: `apps/web/components/projects/detail/task-detail-sheet.tsx`

- [ ] **Step 1: Create TaskDetailTitle**

Create `apps/web/components/projects/detail/task-detail-title.tsx`:

```tsx
"use client";

import { useAutosaveField } from "@/hooks/use-autosave-field";
import { FieldLockIndicator } from "@/components/projects/field-lock-indicator";
import { tasksApi } from "@/lib/api/tasks";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TaskDetailTitleProps {
  taskId: string;
  initialTitle: string;
}

export function TaskDetailTitle({ taskId, initialTitle }: TaskDetailTitleProps) {
  const { value, setValue, isSaving, isLockedByOther, lockedByName, onFocus, onBlur } =
    useAutosaveField<string>({
      entityType: "Task",
      entityId: taskId,
      fieldName: "title",
      initialValue: initialTitle,
      save: async (v) => {
        await tasksApi.update(taskId, { title: v });
      },
    });

  return (
    <div className="space-y-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={isLockedByOther}
        placeholder="Título de la tarea"
        className={cn(
          "border-transparent text-xl font-semibold shadow-none focus-visible:border-input",
          isLockedByOther && "opacity-60",
        )}
      />
      <div className="flex items-center gap-3 px-3">
        <FieldLockIndicator lockedByName={lockedByName} />
        {isSaving && <span className="text-xs text-muted-foreground">Guardando...</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create TaskDetailDescription**

Create `apps/web/components/projects/detail/task-detail-description.tsx`:

```tsx
"use client";

import { useAutosaveField } from "@/hooks/use-autosave-field";
import { FieldLockIndicator } from "@/components/projects/field-lock-indicator";
import { tasksApi } from "@/lib/api/tasks";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface TaskDetailDescriptionProps {
  taskId: string;
  initialDescription: string | null;
}

export function TaskDetailDescription({
  taskId,
  initialDescription,
}: TaskDetailDescriptionProps) {
  const { value, setValue, isSaving, isLockedByOther, lockedByName, onFocus, onBlur } =
    useAutosaveField<string>({
      entityType: "Task",
      entityId: taskId,
      fieldName: "description",
      initialValue: initialDescription ?? "",
      save: async (v) => {
        await tasksApi.update(taskId, { description: v.trim() ? v : null });
      },
    });

  return (
    <div className="space-y-1">
      <h3 className="mb-2 text-sm font-medium">Descripción</h3>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={isLockedByOther}
        placeholder="Añade una descripción..."
        rows={5}
        maxLength={50000}
        className={cn(isLockedByOther && "opacity-60")}
      />
      <div className="flex items-center gap-3">
        <FieldLockIndicator lockedByName={lockedByName} />
        {isSaving && <span className="text-xs text-muted-foreground">Guardando...</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into TaskDetailSheet**

Modify `apps/web/components/projects/detail/task-detail-sheet.tsx`:

1. Import the new components:
```tsx
import { TaskDetailTitle } from "./task-detail-title";
import { TaskDetailDescription } from "./task-detail-description";
```

2. Replace the static title (`<SheetTitle className="text-xl">{task.title}</SheetTitle>`) with:
```tsx
<TaskDetailTitle taskId={task.id} initialTitle={task.title} />
```

Remove the `<SheetTitle>` wrapper if present since the Input is now the title.

3. Replace the description section (`{task.description && ( <div>...</div> )}`) with:
```tsx
<TaskDetailDescription
  taskId={task.id}
  initialDescription={task.description}
/>
```

Note: Use `displayTask` instead of `task` if that pattern is already in place from previous fixes.

- [ ] **Step 4: Verify lint and build**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm --filter @zeru/web build`
Expected: Success.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/projects/detail/
git commit -m "feat(projects): add editable title and description with autosave in task sheet"
```

---

## Task 12: Live Activity Feed Hook + Component

**Files:**
- Create: `apps/web/hooks/use-task-activity.ts`
- Create: `apps/web/components/projects/detail/task-activity-feed.tsx`
- Modify: `apps/web/components/projects/detail/task-detail-sheet.tsx`

- [ ] **Step 1: Create useTaskActivity hook**

Create `apps/web/hooks/use-task-activity.ts`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { tasksApi } from "@/lib/api/tasks";
import { useProjectStore } from "@/stores/project-store";
import type { TaskActivity } from "@/types/projects";

export function useTaskActivity(taskId: string | null) {
  const setActivity = useProjectStore((s) => s.setActivity);
  const activity = useProjectStore((s) =>
    taskId ? s.activityByTask.get(taskId) ?? null : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await tasksApi.getActivity(taskId, undefined, 50);
      setActivity(taskId, res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar actividad");
    } finally {
      setLoading(false);
    }
  }, [taskId, setActivity]);

  useEffect(() => {
    let cancelled = false;
    if (!taskId) return;
    setLoading(true);
    setError(null);
    tasksApi
      .getActivity(taskId, undefined, 50)
      .then((res) => {
        if (cancelled) return;
        setActivity(taskId, res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error al cargar actividad");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, setActivity]);

  return { activity: activity ?? [], loading, error, refetch };
}
```

- [ ] **Step 2: Create TaskActivityFeed component**

Create `apps/web/components/projects/detail/task-activity-feed.tsx`:

```tsx
"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useTaskActivity } from "@/hooks/use-task-activity";
import type { TaskActivity } from "@/types/projects";

interface TaskActivityFeedProps {
  taskId: string;
}

const ACTION_LABELS: Record<string, string> = {
  "task.created": "creó la tarea",
  "task.updated": "actualizó la tarea",
  "task.status_changed": "cambió el estado",
  "task.moved": "movió la tarea",
  "task.assigned": "asignó la tarea",
  "task.comment.created": "comentó",
  "task.deleted": "eliminó la tarea",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function actorName(activity: TaskActivity): string {
  if (!activity.actor) return "Sistema";
  return `${activity.actor.firstName} ${activity.actor.lastName}`.trim();
}

export function TaskActivityFeed({ taskId }: TaskActivityFeedProps) {
  const { activity, loading } = useTaskActivity(taskId);

  if (loading && activity.length === 0) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (activity.length === 0) {
    return <p className="text-xs text-muted-foreground">Aún no hay actividad.</p>;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Actividad</h3>
      <ul className="space-y-2">
        {activity.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-xs">
            <div className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            <div className="min-w-0 flex-1">
              <p>
                <span className="font-medium">{actorName(item)}</span>{" "}
                <span className="text-muted-foreground">
                  {ACTION_LABELS[item.action] ?? item.action}
                </span>
              </p>
              <p className="text-muted-foreground">{timeAgo(item.createdAt)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Add to TaskDetailSheet**

Modify `apps/web/components/projects/detail/task-detail-sheet.tsx` to import and render the activity feed. Add inside the content section (after comments or below the description):

```tsx
import { TaskActivityFeed } from "./task-activity-feed";
// ...
{task.id && (
  <div className="border-t pt-6">
    <TaskActivityFeed taskId={task.id} />
  </div>
)}
```

- [ ] **Step 4: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/hooks/use-task-activity.ts apps/web/components/projects/detail/task-activity-feed.tsx apps/web/components/projects/detail/task-detail-sheet.tsx
git commit -m "feat(projects): add task activity feed to detail sheet"
```

---

## Task 13: Live Comments Sync + Typing Indicator

**Files:**
- Modify: `apps/web/components/projects/detail/task-comments.tsx`
- Create: `apps/web/components/projects/detail/task-comment-typing.tsx`
- Modify: `apps/web/components/projects/project-realtime-sync.tsx`

- [ ] **Step 1: Create typing bubble component**

Create `apps/web/components/projects/detail/task-comment-typing.tsx`:

```tsx
"use client";

import { useProjectStore } from "@/stores/project-store";

interface TaskCommentTypingProps {
  taskId: string;
}

export function TaskCommentTyping({ taskId }: TaskCommentTypingProps) {
  const typingMap = useProjectStore((s) => s.typingByTask.get(taskId));

  if (!typingMap || typingMap.size === 0) return null;

  const names = Array.from(typingMap.values()).map((u) => u.userName);
  const text =
    names.length === 1
      ? `${names[0]} está escribiendo...`
      : `${names.slice(0, -1).join(", ")} y ${names.at(-1)} están escribiendo...`;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <div className="flex gap-0.5">
        <span className="size-1 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
        <span className="size-1 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
        <span className="size-1 animate-bounce rounded-full bg-muted-foreground/60" />
      </div>
      <span>{text}</span>
    </div>
  );
}
```

- [ ] **Step 2: Extend project realtime sync with comment and typing events**

Modify `apps/web/components/projects/project-realtime-sync.tsx` to subscribe to comment events and typing indicators. Add these handlers inside the existing effect:

```tsx
import type { TaskComment, TaskActivity } from "@/types/projects";
// ... existing imports

// Inside the useEffect, alongside the task handlers:

const handleCommentNew = (data: {
  projectId: string;
  taskId: string;
  comment?: TaskComment;
}) => {
  if (data.projectId !== projectId || !data.comment) return;
  useProjectStore.getState().addComment(data.taskId, data.comment);
};

const handleCommentUpdated = (data: {
  projectId: string;
  taskId: string;
  commentId: string;
  comment: Partial<TaskComment>;
}) => {
  if (data.projectId !== projectId) return;
  useProjectStore.getState().updateComment(data.taskId, data.commentId, data.comment);
};

const handleCommentDeleted = (data: {
  projectId: string;
  taskId: string;
  commentId: string;
}) => {
  if (data.projectId !== projectId) return;
  useProjectStore.getState().removeComment(data.taskId, data.commentId);
};

const handleReactionAdded = (data: {
  projectId: string;
  taskId: string;
  commentId: string;
  emoji: string;
  userId: string;
}) => {
  if (data.projectId !== projectId) return;
  useProjectStore
    .getState()
    .addCommentReaction(data.taskId, data.commentId, data.emoji, data.userId);
};

const handleReactionRemoved = (data: {
  projectId: string;
  taskId: string;
  commentId: string;
  emoji: string;
  userId: string;
}) => {
  if (data.projectId !== projectId) return;
  useProjectStore
    .getState()
    .removeCommentReaction(data.taskId, data.commentId, data.emoji, data.userId);
};

const handleCommentTyping = (data: {
  projectId: string;
  taskId: string;
  userId: string;
  userName: string;
}) => {
  if (data.projectId !== projectId) return;
  useProjectStore.getState().setTypingUser(data.taskId, {
    userId: data.userId,
    userName: data.userName,
    startedAt: Date.now(),
  });
  // Auto-clear after 3 seconds if no new typing event
  setTimeout(() => {
    const current = useProjectStore.getState().typingByTask.get(data.taskId)?.get(data.userId);
    if (current && Date.now() - current.startedAt >= 2900) {
      useProjectStore.getState().clearTypingUser(data.taskId, data.userId);
    }
  }, 3000);
};

const handleCommentTypingStop = (data: {
  projectId: string;
  taskId: string;
  userId: string;
}) => {
  if (data.projectId !== projectId) return;
  useProjectStore.getState().clearTypingUser(data.taskId, data.userId);
};

// Subscribe (cast types where shared types don't match)
socket.on("task:comment:new", handleCommentNew as (data: unknown) => void);
socket.on("task:comment:updated", handleCommentUpdated as (data: unknown) => void);
socket.on("task:comment:deleted", handleCommentDeleted as (data: unknown) => void);
socket.on("task:comment:reaction:added", handleReactionAdded as (data: unknown) => void);
socket.on("task:comment:reaction:removed", handleReactionRemoved as (data: unknown) => void);
socket.on("task:comment:typing", handleCommentTyping as (data: unknown) => void);
socket.on("task:comment:typing:stop", handleCommentTypingStop as (data: unknown) => void);

// And in cleanup:
socket.off("task:comment:new", handleCommentNew as (data: unknown) => void);
socket.off("task:comment:updated", handleCommentUpdated as (data: unknown) => void);
socket.off("task:comment:deleted", handleCommentDeleted as (data: unknown) => void);
socket.off("task:comment:reaction:added", handleReactionAdded as (data: unknown) => void);
socket.off("task:comment:reaction:removed", handleReactionRemoved as (data: unknown) => void);
socket.off("task:comment:typing", handleCommentTyping as (data: unknown) => void);
socket.off("task:comment:typing:stop", handleCommentTypingStop as (data: unknown) => void);
```

- [ ] **Step 3: Update task-comments.tsx to use store and emit typing**

Modify `apps/web/components/projects/detail/task-comments.tsx` to:
1. Read comments from the Zustand store instead of local state
2. Emit typing events as the user types
3. Render the typing indicator component

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useSocket } from "@/hooks/use-socket";
import { useProjectStore } from "@/stores/project-store";
import { tasksApi } from "@/lib/api/tasks";
import { TaskCommentTyping } from "./task-comment-typing";

interface TaskCommentsProps {
  taskId: string;
  projectId: string;
}

function initials(firstName: string, lastName: string): string {
  return ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || "?";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export function TaskComments({ taskId, projectId }: TaskCommentsProps) {
  const socket = useSocket();
  const setComments = useProjectStore((s) => s.setComments);
  const comments = useProjectStore((s) => s.commentsByTask.get(taskId) ?? []);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tasksApi.listComments(taskId);
      setComments(taskId, data);
    } catch (err) {
      console.error("Error loading comments:", err);
    } finally {
      setLoading(false);
    }
  }, [taskId, setComments]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    tasksApi
      .listComments(taskId)
      .then((data) => {
        if (cancelled) return;
        setComments(taskId, data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error loading comments:", err);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, setComments]);

  function emitTyping() {
    if (!socket) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("task:comment:typing", { taskId, projectId });
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("task:comment:typing:stop", { taskId, projectId });
    }, 2500);
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    emitTyping();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await tasksApi.createComment(taskId, content.trim());
      setContent("");
      if (socket && isTypingRef.current) {
        isTypingRef.current = false;
        socket.emit("task:comment:typing:stop", { taskId, projectId });
      }
      await fetchComments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al publicar comentario");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (socket && isTypingRef.current) {
        socket.emit("task:comment:typing:stop", { taskId, projectId });
      }
    };
  }, [socket, taskId, projectId]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Comentarios</h3>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aún no hay comentarios.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">
                  {initials(comment.author.firstName, comment.author.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {comment.author.firstName} {comment.author.lastName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(comment.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm whitespace-pre-wrap">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <TaskCommentTyping taskId={taskId} />
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Escribe un comentario..."
          rows={3}
          maxLength={10000}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={submitting || !content.trim()}>
            {submitting ? "Enviando..." : "Comentar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Pass projectId to TaskComments in TaskDetailSheet**

Modify `apps/web/components/projects/detail/task-detail-sheet.tsx` to pass `projectId`:

```tsx
{task.id && task.projectId && (
  <div className="border-t pt-6">
    <TaskComments taskId={task.id} projectId={task.projectId} />
  </div>
)}
```

- [ ] **Step 5: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/projects/detail/task-comments.tsx apps/web/components/projects/detail/task-comment-typing.tsx apps/web/components/projects/project-realtime-sync.tsx
git commit -m "feat(projects): add live comments sync and typing indicators"
```

---

## Task 14: Section Events Live Update

**Files:**
- Modify: `apps/web/components/projects/project-realtime-sync.tsx`
- Modify: `apps/web/hooks/use-project.ts`

- [ ] **Step 1: Handle section:changed in realtime sync**

The project layout uses `useProject` which fetches the project (including `taskStatuses` and `sections`). When `section:changed` fires, we need to refetch the project to get fresh data.

Modify `apps/web/components/projects/project-realtime-sync.tsx` to accept an `onSectionChanged` callback and call it from the handler:

```tsx
interface ProjectRealtimeSyncProps {
  projectId: string;
  onSectionChanged?: () => void;
}

export function ProjectRealtimeSync({
  projectId,
  onSectionChanged,
}: ProjectRealtimeSyncProps) {
  // ... existing code

  // Inside the useEffect, add:
  const handleSectionChanged = (data: {
    projectId: string;
  }) => {
    if (data.projectId !== projectId) return;
    onSectionChanged?.();
  };
  socket.on("section:changed", handleSectionChanged as (data: unknown) => void);

  // And in cleanup:
  socket.off("section:changed", handleSectionChanged as (data: unknown) => void);
}
```

- [ ] **Step 2: Use refetch in project layout**

Modify `apps/web/app/(dashboard)/projects/[projectId]/layout.tsx` to pass the refetch callback:

```tsx
const { project, loading, error, refetch } = useProject(projectId);

// ...

<ProjectRealtimeSync
  projectId={projectId}
  onSectionChanged={refetch}
/>
```

- [ ] **Step 3: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/projects/project-realtime-sync.tsx apps/web/app/\(dashboard\)/projects/\[projectId\]/layout.tsx
git commit -m "feat(projects): refetch project on section:changed events"
```

---

## Task 15: Delta Sync on Reconnection

**Files:**
- Modify: `apps/web/lib/api/tasks.ts`
- Modify: `apps/web/components/projects/project-realtime-sync.tsx`

- [ ] **Step 1: Add delta sync to tasks API**

Modify `apps/web/lib/api/tasks.ts` to add the sync method. Add at the end of the `tasksApi` object:

```typescript
syncDelta: (projectId: string, versions: Record<string, number>) =>
  api.post<{
    updated: Task[];
    deleted: string[];
    added: Task[];
  }>("/tasks/sync", { projectId, versions }),
```

- [ ] **Step 2: Call delta sync on socket reconnect**

Modify `apps/web/components/projects/project-realtime-sync.tsx` to call `syncDelta` when the socket reconnects. Inside the existing `handleConnect` handler (from the FE-FIX-6 fix), after re-emitting `project:join`:

```tsx
const handleConnect = () => {
  socket.emit("project:join", { projectId });

  // Delta sync: send current task versions, receive updates
  const state = useProjectStore.getState();
  const taskMap = state.tasksByProject.get(projectId);
  if (!taskMap || taskMap.size === 0) return;

  const versions: Record<string, number> = {};
  for (const [id, task] of taskMap) {
    versions[id] = (task as Task & { version?: number }).version ?? 1;
  }

  tasksApi
    .syncDelta(projectId, versions)
    .then((delta) => {
      for (const added of delta.added) upsertTask(projectId, added);
      for (const updated of delta.updated) upsertTask(projectId, updated);
      for (const deleted of delta.deleted) removeTask(projectId, deleted);
    })
    .catch((err) => {
      console.error("Delta sync failed:", err);
    });
};
```

Import `tasksApi` at the top of the file:
```tsx
import { tasksApi } from "@/lib/api/tasks";
import type { Task } from "@/types/projects";
```

Also update the `Task` type in `apps/web/types/projects.ts` to include the `version` field:

```typescript
export interface Task {
  // ... existing fields
  version: number;
  // ... rest
}
```

- [ ] **Step 3: Verify lint and build**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm --filter @zeru/web build`
Expected: Success.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/api/tasks.ts apps/web/types/projects.ts apps/web/components/projects/project-realtime-sync.tsx
git commit -m "feat(projects): add delta sync on socket reconnect"
```

---

## Task 16: Presence Re-join on Reconnect

**Files:**
- Modify: `apps/web/components/realtime/presence-sync.tsx`

- [ ] **Step 1: Add reconnect handler to PresenceSync**

Modify `apps/web/components/realtime/presence-sync.tsx` to re-emit `presence:join` on reconnect. Inside the pathname effect, add a `connect` handler:

```tsx
useEffect(() => {
  if (!socket || !pathname) return;
  socket.emit("presence:join", { viewPath: pathname });

  const handleConnect = () => {
    socket.emit("presence:join", { viewPath: pathname });
  };
  socket.on("connect", handleConnect);

  const handleSnapshot = (data: PresenceSnapshot) => {
    if (data.viewPath === pathname) setViewUsers(pathname, data.users);
  };
  const handleUpdate = (data: PresenceUpdate) => {
    if (data.viewPath === pathname) setViewUsers(pathname, data.users);
  };
  socket.on("presence:snapshot", handleSnapshot);
  socket.on("presence:update", handleUpdate);

  return () => {
    socket.emit("presence:leave", { viewPath: pathname });
    socket.off("connect", handleConnect);
    socket.off("presence:snapshot", handleSnapshot);
    socket.off("presence:update", handleUpdate);
  };
}, [socket, pathname, setViewUsers]);
```

Also add the same pattern to `apps/web/hooks/use-task-presence.ts` for consistency.

- [ ] **Step 2: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/realtime/presence-sync.tsx apps/web/hooks/use-task-presence.ts
git commit -m "fix(presence): re-join view on socket reconnect"
```

---

## Task 17: Final Verification

- [ ] **Step 1: Full lint check**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors across all packages.

- [ ] **Step 2: Full build check**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm build`
Expected: All packages build successfully.

- [ ] **Step 3: Prisma validate**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks/apps/api && npx prisma validate`
Expected: Schema is valid.

- [ ] **Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "fix: resolve lint and type errors in realtime integration"
```

Only commit if there were actual fixes. Skip if nothing changed.
