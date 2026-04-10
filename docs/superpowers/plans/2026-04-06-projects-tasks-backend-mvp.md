# Projects & Tasks — Backend MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete backend for Projects & Tasks MVP — Prisma schema, NestJS modules, CRUD endpoints, permissions, events, and notifications.

**Architecture:** Two NestJS modules (ProjectsModule, TasksModule) following existing patterns: Zod DTOs, `prisma.forTenant()` multi-tenancy, `ProjectAccessGuard` for resource-level permissions, EventEmitter2 for domain events → gateway broadcast + notifications.

**Tech Stack:** NestJS, Prisma, Zod, Socket.IO (existing), Redis (existing), EventEmitter2 (existing)

**Spec:** `docs/superpowers/specs/2026-04-06-projects-tasks-design.md`

**Worktree:** `/Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks`

---

## Task 1: Prisma Schema — Enums & Core Models

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (append at end, before closing)
- Modify: `apps/api/prisma/schema.prisma` (Tenant model ~line 81, User model ~line 137)

- [ ] **Step 1: Add enums to schema.prisma**

Append after the last enum (before the first model, or at the end of the enums section):

```prisma
// ─── Projects & Tasks ────────────────────────────────────

enum ProjectStatus {
  ACTIVE
  PAUSED
  COMPLETED
  ARCHIVED

  @@schema("public")
  @@map("project_status")
}

enum ProjectVisibility {
  PUBLIC
  PRIVATE

  @@schema("public")
  @@map("project_visibility")
}

enum ProjectMemberRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER

  @@schema("public")
  @@map("project_member_role")
}

enum TaskPriority {
  URGENT
  HIGH
  MEDIUM
  LOW
  NONE

  @@schema("public")
  @@map("task_priority")
}

enum TaskViewType {
  BOARD
  LIST
  CALENDAR
  TIMELINE

  @@schema("public")
  @@map("task_view_type")
}
```

- [ ] **Step 2: Add Project model**

```prisma
model Project {
  id          String            @id @default(uuid())
  name        String
  description String?
  key         String
  icon        String?
  color       String?
  status      ProjectStatus     @default(ACTIVE)
  visibility  ProjectVisibility @default(PUBLIC)
  startDate   DateTime?
  dueDate     DateTime?
  sortOrder   Int               @default(0)
  deletedAt   DateTime?
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  tenantId    String
  tenant      Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  createdById String
  createdBy   User @relation("ProjectsCreated", fields: [createdById], references: [id], onDelete: Restrict)

  members        ProjectMember[]
  tasks          Task[]
  taskViews      TaskView[]
  labels         Label[]
  taskStatuses   TaskStatusConfig[]
  sections       ProjectSection[]

  @@unique([tenantId, key])
  @@index([tenantId])
  @@index([tenantId, status])
  @@schema("public")
  @@map("projects")
}
```

- [ ] **Step 3: Add ProjectMember model**

```prisma
model ProjectMember {
  id        String            @id @default(uuid())
  role      ProjectMemberRole @default(MEMBER)
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  userId    String
  user      User @relation("ProjectMemberships", fields: [userId], references: [id], onDelete: Cascade)

  tenantId  String

  @@unique([projectId, userId])
  @@index([userId])
  @@index([tenantId])
  @@schema("public")
  @@map("project_members")
}
```

- [ ] **Step 4: Add ProjectSection model**

```prisma
model ProjectSection {
  id        String    @id @default(uuid())
  name      String
  sortOrder Int       @default(0)
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  tasks     Task[]
  tenantId  String

  @@index([projectId])
  @@index([tenantId])
  @@schema("public")
  @@map("project_sections")
}
```

- [ ] **Step 5: Add TaskStatusConfig model**

```prisma
model TaskStatusConfig {
  id        String   @id @default(uuid())
  name      String
  slug      String
  color     String?
  category  String   @default("active")
  sortOrder Int      @default(0)
  isDefault Boolean  @default(false)
  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  tasks     Task[]
  tenantId  String

  @@unique([projectId, slug])
  @@index([projectId])
  @@index([tenantId])
  @@schema("public")
  @@map("task_status_configs")
}
```

- [ ] **Step 6: Add Task model**

```prisma
model Task {
  id              String       @id @default(uuid())
  number          Int
  title           String
  description     String?
  descriptionJson Json?
  priority        TaskPriority @default(NONE)
  position        String
  startDate       DateTime?
  dueDate         DateTime?
  completedAt     DateTime?
  estimate        Decimal?     @db.Decimal(10, 2)
  estimateUnit    String?
  deletedAt       DateTime?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  projectId       String
  project         Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  statusId        String
  status          TaskStatusConfig @relation(fields: [statusId], references: [id], onDelete: Restrict)

  sectionId       String?
  section         ProjectSection? @relation(fields: [sectionId], references: [id], onDelete: SetNull)

  parentId        String?
  parent          Task?  @relation("TaskHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  subtasks        Task[] @relation("TaskHierarchy")

  createdById     String
  createdBy       User @relation("TasksCreated", fields: [createdById], references: [id], onDelete: Restrict)

  tenantId        String

  assignees       TaskAssignee[]
  labels          TaskLabel[]
  comments        TaskComment[]
  attachments     TaskAttachment[]
  dependencies    TaskDependency[] @relation("DependentTask")
  dependents      TaskDependency[] @relation("DependencyOf")
  subscribers     TaskSubscriber[]
  activities      TaskActivity[]

  @@unique([projectId, number])
  @@index([tenantId])
  @@index([projectId])
  @@index([projectId, statusId])
  @@index([parentId])
  @@index([tenantId, dueDate])
  @@schema("public")
  @@map("tasks")
}
```

- [ ] **Step 7: Add TaskAssignee and TaskSubscriber models**

```prisma
model TaskAssignee {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  taskId String
  task   Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  userId String
  user   User @relation("TaskAssignments", fields: [userId], references: [id], onDelete: Cascade)

  tenantId String

  @@unique([taskId, userId])
  @@index([userId])
  @@index([tenantId])
  @@schema("public")
  @@map("task_assignees")
}

model TaskSubscriber {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  taskId String
  task   Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  userId String
  user   User @relation("TaskSubscriptions", fields: [userId], references: [id], onDelete: Cascade)

  tenantId String

  @@unique([taskId, userId])
  @@index([userId])
  @@index([tenantId])
  @@schema("public")
  @@map("task_subscribers")
}
```

- [ ] **Step 8: Add TaskDependency model**

```prisma
model TaskDependency {
  id             String   @id @default(uuid())
  dependencyType String   @default("BLOCKS")
  createdAt      DateTime @default(now())

  taskId      String
  task        Task @relation("DependentTask", fields: [taskId], references: [id], onDelete: Cascade)

  dependsOnId String
  dependsOn   Task @relation("DependencyOf", fields: [dependsOnId], references: [id], onDelete: Cascade)

  tenantId String

  @@unique([taskId, dependsOnId])
  @@index([dependsOnId])
  @@index([tenantId])
  @@schema("public")
  @@map("task_dependencies")
}
```

- [ ] **Step 9: Add Label and TaskLabel models**

```prisma
model Label {
  id        String    @id @default(uuid())
  name      String
  color     String
  sortOrder Int       @default(0)
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  tasks     TaskLabel[]
  tenantId  String

  @@unique([projectId, name])
  @@index([tenantId])
  @@schema("public")
  @@map("labels")
}

model TaskLabel {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  taskId  String
  task    Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  labelId String
  label   Label @relation(fields: [labelId], references: [id], onDelete: Cascade)

  tenantId String

  @@unique([taskId, labelId])
  @@index([labelId])
  @@index([tenantId])
  @@schema("public")
  @@map("task_labels")
}
```

- [ ] **Step 10: Add TaskComment and TaskCommentReaction models**

```prisma
model TaskComment {
  id          String    @id @default(uuid())
  content     String
  contentJson Json?
  editedAt    DateTime?
  deletedAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  taskId   String
  task     Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  authorId String
  author   User @relation("TaskComments", fields: [authorId], references: [id], onDelete: Restrict)

  parentId String?
  parent   TaskComment?  @relation("CommentThread", fields: [parentId], references: [id], onDelete: SetNull)
  replies  TaskComment[] @relation("CommentThread")

  reactions TaskCommentReaction[]
  tenantId  String

  @@index([taskId, createdAt])
  @@index([tenantId])
  @@schema("public")
  @@map("task_comments")
}

model TaskCommentReaction {
  id    String @id @default(uuid())
  emoji String

  commentId String
  comment   TaskComment @relation(fields: [commentId], references: [id], onDelete: Cascade)

  userId String
  user   User @relation("TaskCommentReactions", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([commentId, userId, emoji])
  @@schema("public")
  @@map("task_comment_reactions")
}
```

- [ ] **Step 11: Add TaskActivity model**

```prisma
model TaskActivity {
  id        String   @id @default(uuid())
  action    String
  data      Json?
  createdAt DateTime @default(now())

  taskId  String
  task    Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  actorId String?
  actor   User? @relation("TaskActivities", fields: [actorId], references: [id], onDelete: SetNull)

  tenantId String

  @@index([taskId, createdAt])
  @@index([tenantId, createdAt])
  @@schema("public")
  @@map("task_activities")
}
```

- [ ] **Step 12: Add TaskAttachment model**

```prisma
model TaskAttachment {
  id        String   @id @default(uuid())
  name      String
  s3Key     String
  mimeType  String
  sizeBytes Int
  createdAt DateTime @default(now())

  taskId       String
  task         Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  uploadedById String
  uploadedBy   User @relation("TaskAttachments", fields: [uploadedById], references: [id], onDelete: Restrict)

  tenantId String

  @@index([taskId])
  @@index([tenantId])
  @@schema("public")
  @@map("task_attachments")
}
```

- [ ] **Step 13: Add TaskView model**

```prisma
model TaskView {
  id        String       @id @default(uuid())
  name      String
  type      TaskViewType
  config    Json         @default("{}")
  filters   Json         @default("{}")
  isDefault Boolean      @default(false)
  icon      String?
  sortOrder Int          @default(0)
  deletedAt DateTime?
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  projectId   String
  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdById String?
  createdBy   User? @relation("TaskViewsCreated", fields: [createdById], references: [id], onDelete: SetNull)

  tenantId String

  @@index([projectId])
  @@index([tenantId])
  @@schema("public")
  @@map("task_views")
}
```

- [ ] **Step 14: Add relations to Tenant model**

In the Tenant model (around line 81), add before the closing `}`:

```prisma
  projects             Project[]
```

- [ ] **Step 15: Add relations to User model**

In the User model (around line 137), add before the closing `}`:

```prisma
  projectsCreated       Project[]             @relation("ProjectsCreated")
  projectMemberships    ProjectMember[]       @relation("ProjectMemberships")
  tasksCreated          Task[]                @relation("TasksCreated")
  taskAssignments       TaskAssignee[]        @relation("TaskAssignments")
  taskSubscriptions     TaskSubscriber[]      @relation("TaskSubscriptions")
  taskComments          TaskComment[]         @relation("TaskComments")
  taskCommentReactions  TaskCommentReaction[] @relation("TaskCommentReactions")
  taskActivities        TaskActivity[]        @relation("TaskActivities")
  taskAttachments       TaskAttachment[]      @relation("TaskAttachments")
  taskViewsCreated      TaskView[]            @relation("TaskViewsCreated")
```

- [ ] **Step 16: Verify schema compiles**

Run: `cd apps/api && npx prisma validate`
Expected: "The schema at ... is valid"

- [ ] **Step 17: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add Projects & Tasks models — 15 models, 5 enums"
```

---

## Task 2: Soft-Delete, Permissions & Shared Types

**Files:**
- Modify: `apps/api/src/prisma/extensions/soft-delete.extension.ts` (line ~34, add to Set)
- Modify: `packages/shared/src/permissions/module-definitions.ts` (add module + ROUTE_MODULE_MAP)
- Modify: `apps/api/src/modules/roles/roles.service.ts` (line ~26-47, add to ALL_MODULE_KEYS)
- Modify: `packages/shared/src/realtime.ts` (add events to interfaces)
- Modify: `packages/shared/src/notification.ts` (add DomainEventType entries)

- [ ] **Step 1: Register soft-deletable models**

In `apps/api/src/prisma/extensions/soft-delete.extension.ts`, add these entries to the `SOFT_DELETABLE_MODELS` Set (after `'billingConcept'`):

```typescript
  'project',
  'projectSection',
  'taskStatusConfig',
  'task',
  'taskComment',
  'label',
  'taskView',
```

- [ ] **Step 2: Add 'projects' module definition**

In `packages/shared/src/permissions/module-definitions.ts`, add to the `MODULE_DEFINITIONS` array in the `core` section (after `documents`):

```typescript
  {
    key: 'projects',
    label: 'Proyectos',
    section: 'core',
    granularPermissions: [
      { key: 'create', label: 'Crear proyectos', minLevel: 'EDIT' },
      { key: 'delete', label: 'Eliminar proyectos', minLevel: 'MANAGE' },
      { key: 'manage-members', label: 'Gestionar miembros', minLevel: 'MANAGE' },
    ],
  },
```

- [ ] **Step 3: Add route mapping**

In the same file, add to `ROUTE_MODULE_MAP`:

```typescript
  '/projects': 'projects',
```

- [ ] **Step 4: Add to ALL_MODULE_KEYS in roles service**

In `apps/api/src/modules/roles/roles.service.ts`, find the `ALL_MODULE_KEYS` array (around line 26-47) and add `'projects'` in alphabetical order.

- [ ] **Step 5: Add WebSocket events to realtime.ts**

In `packages/shared/src/realtime.ts`, add to `ClientToServerEvents` (after `'channel:leave'`):

```typescript
  'project:join': (data: { projectId: string }) => void;
  'project:leave': (data: { projectId: string }) => void;
```

Add to `ServerToClientEvents` (after `'chat:deleted'`):

```typescript
  'task:created': (data: { projectId: string; task: Record<string, unknown>; sectionId: string | null; position: string }) => void;
  'task:changed': (data: { projectId: string; taskId: string; changes: Record<string, { from: unknown; to: unknown }>; version: number; updatedBy: PresenceUser }) => void;
  'task:moved': (data: { projectId: string; taskId: string; fromSectionId: string | null; toSectionId: string | null; position: string; movedBy: PresenceUser }) => void;
  'task:removed': (data: { projectId: string; taskId: string }) => void;
  'task:comment:new': (data: { projectId: string; taskId: string; comment: Record<string, unknown> }) => void;
  'section:changed': (data: { projectId: string; sectionId: string; changes: Record<string, unknown> }) => void;
```

- [ ] **Step 6: Add DomainEventType entries**

In `packages/shared/src/notification.ts`, add to the `DomainEventType` union (the existing entries `task.created`, `task.assigned`, `task.status_changed`, `task.commented`, `task.due_soon`, `project.member_added`, `project.member_removed` already exist). Add only new ones:

```typescript
  | 'task.completed'
  | 'task.mentioned'
  | 'task.overdue'
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/prisma/extensions/soft-delete.extension.ts packages/shared/src/permissions/module-definitions.ts apps/api/src/modules/roles/roles.service.ts packages/shared/src/realtime.ts packages/shared/src/notification.ts
git commit -m "feat(shared): register projects module — soft-delete, permissions, WS events, notification types"
```

---

## Task 3: Prisma Migration

**Files:**
- Generated: `apps/api/prisma/migrations/YYYYMMDDHHMMSS_add_projects_tasks/migration.sql`

- [ ] **Step 1: Generate migration**

Run: `cd apps/api && npx prisma migrate dev --name add_projects_tasks`
Expected: Migration created and applied successfully.

- [ ] **Step 2: Generate Prisma client**

Run: `cd apps/api && npx prisma generate`
Expected: "Generated Prisma Client"

- [ ] **Step 3: Verify build**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/migrations/
git commit -m "feat(migration): add projects and tasks tables"
```

---

## Task 4: ProjectAccessGuard

**Files:**
- Create: `apps/api/src/common/guards/project-access.guard.ts`
- Create: `apps/api/src/common/decorators/project-role.decorator.ts`

- [ ] **Step 1: Create project role decorator**

Create `apps/api/src/common/decorators/project-role.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const PROJECT_MIN_ROLE_KEY = 'project_min_role';
export type ProjectMinRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export const RequireProjectRole = (role: ProjectMinRole) =>
  SetMetadata(PROJECT_MIN_ROLE_KEY, role);
```

- [ ] **Step 2: Create ProjectAccessGuard**

Create `apps/api/src/common/guards/project-access.guard.ts`:

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PROJECT_MIN_ROLE_KEY, ProjectMinRole } from '../decorators/project-role.decorator';

const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    const tenantId = request.tenantId;

    const projectId =
      request.params?.projectId || request.params?.id || request.body?.projectId;

    if (!projectId || !userId) {
      throw new ForbiddenException('Missing project or user context');
    }

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId, deletedAt: null },
      select: { visibility: true },
    });

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });

    const requiredRole = this.reflector.getAllAndOverride<ProjectMinRole | undefined>(
      PROJECT_MIN_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No role requirement and public project: allow any tenant member
    if (!requiredRole && project.visibility === 'PUBLIC') {
      return true;
    }

    if (!member) {
      throw new ForbiddenException('No eres miembro de este proyecto');
    }

    if (requiredRole) {
      if (ROLE_HIERARCHY[member.role] < ROLE_HIERARCHY[requiredRole]) {
        throw new ForbiddenException('Permisos insuficientes en este proyecto');
      }
    }

    return true;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/common/guards/project-access.guard.ts apps/api/src/common/decorators/project-role.decorator.ts
git commit -m "feat(guards): add ProjectAccessGuard with role hierarchy"
```

---

## Task 5: Projects Module — DTOs

**Files:**
- Create: `apps/api/src/modules/projects/dto/index.ts`

- [ ] **Step 1: Create project DTOs**

Create `apps/api/src/modules/projects/dto/index.ts`:

```typescript
import { z } from 'zod';

// ─── Projects ────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  description: z.string().max(5000).optional(),
  key: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/, 'Solo letras mayúsculas y números'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  memberIds: z.array(z.string().uuid()).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  color: z.string().max(20).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const listProjectsSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'dueDate']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ─── Members ─────────────────────────────────────────────

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

export const updateMemberSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

// ─── Sections ────────────────────────────────────────────

export const createSectionSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateSectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
});

export const reorderSectionsSchema = z.object({
  sectionIds: z.array(z.string().uuid()).min(1),
});

// ─── Status Configs ──────────────────────────────────────

export const createStatusConfigSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/),
  color: z.string().max(20).optional(),
  category: z.enum(['backlog', 'active', 'done', 'cancelled']).default('active'),
});

export const updateStatusConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().max(20).nullable().optional(),
  category: z.enum(['backlog', 'active', 'done', 'cancelled']).optional(),
  sortOrder: z.number().int().optional(),
});

// ─── Labels ──────────────────────────────────────────────

export const createLabelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().max(20).default('#6B7280'),
});

export const updateLabelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().max(20).optional(),
});

// ─── Views ───────────────────────────────────────────────

export const createViewSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['BOARD', 'LIST', 'TIMELINE', 'CALENDAR']).default('BOARD'),
  config: z.record(z.unknown()).optional(),
  filters: z.record(z.unknown()).optional(),
});

export const updateViewSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.unknown()).optional(),
  filters: z.record(z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
});

// ─── Type Inference ──────────────────────────────────────

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type ListProjectsDto = z.infer<typeof listProjectsSchema>;
export type AddMemberDto = z.infer<typeof addMemberSchema>;
export type UpdateMemberDto = z.infer<typeof updateMemberSchema>;
export type CreateSectionDto = z.infer<typeof createSectionSchema>;
export type UpdateSectionDto = z.infer<typeof updateSectionSchema>;
export type CreateStatusConfigDto = z.infer<typeof createStatusConfigSchema>;
export type UpdateStatusConfigDto = z.infer<typeof updateStatusConfigSchema>;
export type CreateLabelDto = z.infer<typeof createLabelSchema>;
export type UpdateLabelDto = z.infer<typeof updateLabelSchema>;
export type CreateViewDto = z.infer<typeof createViewSchema>;
export type UpdateViewDto = z.infer<typeof updateViewSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/projects/dto/index.ts
git commit -m "feat(projects): add Zod DTOs for projects, members, sections, statuses, labels, views"
```

---

## Task 6: Projects Service

**Files:**
- Create: `apps/api/src/modules/projects/services/projects.service.ts`

- [ ] **Step 1: Create ProjectsService**

Create `apps/api/src/modules/projects/services/projects.service.ts`:

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ListProjectsDto,
} from '../dto';

const DEFAULT_STATUSES = [
  { name: 'Backlog', slug: 'backlog', category: 'backlog', color: '#6B7280', sortOrder: 0 },
  { name: 'Por hacer', slug: 'todo', category: 'active', color: '#3B82F6', sortOrder: 1, isDefault: true },
  { name: 'En progreso', slug: 'in-progress', category: 'active', color: '#F59E0B', sortOrder: 2 },
  { name: 'En revisión', slug: 'in-review', category: 'active', color: '#8B5CF6', sortOrder: 3 },
  { name: 'Hecho', slug: 'done', category: 'done', color: '#10B981', sortOrder: 4 },
  { name: 'Cancelado', slug: 'cancelled', category: 'cancelled', color: '#EF4444', sortOrder: 5 },
];

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateProjectDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const existing = await client.project.findUnique({
      where: { tenantId_key: { tenantId, key: dto.key } },
    });
    if (existing) {
      throw new ConflictException(`Ya existe un proyecto con la clave "${dto.key}"`);
    }

    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: dto.name,
          description: dto.description,
          key: dto.key,
          visibility: dto.visibility,
          color: dto.color,
          icon: dto.icon,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          tenantId,
          createdById: userId,
        },
      });

      // Create default statuses
      await tx.taskStatusConfig.createMany({
        data: DEFAULT_STATUSES.map((s) => ({
          ...s,
          projectId: created.id,
          tenantId,
        })),
      });

      // Add creator as OWNER
      await tx.projectMember.create({
        data: {
          projectId: created.id,
          userId,
          role: 'OWNER',
          tenantId,
        },
      });

      // Add initial members
      if (dto.memberIds?.length) {
        await tx.projectMember.createMany({
          data: dto.memberIds
            .filter((id) => id !== userId)
            .map((memberId) => ({
              projectId: created.id,
              userId: memberId,
              role: 'MEMBER' as const,
              tenantId,
            })),
          skipDuplicates: true,
        });
      }

      // Create default Board view
      await tx.taskView.create({
        data: {
          name: 'Board',
          type: 'BOARD',
          isDefault: true,
          projectId: created.id,
          tenantId,
        },
      });

      return created;
    });

    this.eventEmitter.emit('project.created', { tenantId, projectId: project.id, actorId: userId });

    return project;
  }

  async findAll(tenantId: string, userId: string, dto: ListProjectsDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const where: Record<string, unknown> = {};
    if (dto.status) where.status = dto.status;
    if (dto.search) where.name = { contains: dto.search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      client.project.findMany({
        where,
        orderBy: { [dto.sortBy]: dto.sortOrder },
        skip: (dto.page - 1) * dto.perPage,
        take: dto.perPage,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { tasks: true, members: true } },
        },
      }),
      client.project.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: dto.page,
        perPage: dto.perPage,
        totalPages: Math.ceil(total / dto.perPage),
      },
    };
  }

  async findOne(tenantId: string, projectId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const project = await client.project.findFirst({
      where: { id: projectId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        members: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        taskStatuses: { orderBy: { sortOrder: 'asc' } },
        sections: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        labels: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        taskViews: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { tasks: true } },
      },
    });

    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  async update(tenantId: string, projectId: string, userId: string, dto: UpdateProjectDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const existing = await client.project.findFirst({ where: { id: projectId } });
    if (!existing) throw new NotFoundException('Proyecto no encontrado');

    const updated = await client.project.update({
      where: { id: projectId },
      data: {
        ...dto,
        startDate: dto.startDate !== undefined ? (dto.startDate ? new Date(dto.startDate) : null) : undefined,
        dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : undefined,
      },
    });

    this.eventEmitter.emit('project.updated', {
      tenantId,
      projectId,
      actorId: userId,
      changes: Object.fromEntries(
        Object.keys(dto).map((key) => [key, { from: (existing as Record<string, unknown>)[key], to: (dto as Record<string, unknown>)[key] }]),
      ),
    });

    return updated;
  }

  async remove(tenantId: string, projectId: string, userId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const existing = await client.project.findFirst({ where: { id: projectId } });
    if (!existing) throw new NotFoundException('Proyecto no encontrado');

    await client.project.delete({ where: { id: projectId } });

    this.eventEmitter.emit('project.deleted', { tenantId, projectId, actorId: userId });
  }

  async duplicate(tenantId: string, projectId: string, userId: string) {
    const source = await this.findOne(tenantId, projectId);

    const newKey = `${source.key}2`;
    return this.create(tenantId, userId, {
      name: `${source.name} (copia)`,
      key: newKey,
      description: source.description ?? undefined,
      visibility: source.visibility,
      color: source.color ?? undefined,
      icon: source.icon ?? undefined,
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/projects/services/projects.service.ts
git commit -m "feat(projects): add ProjectsService with CRUD, default statuses, member seeding"
```

---

## Task 7: Projects Controller

**Files:**
- Create: `apps/api/src/modules/projects/controllers/projects.controller.ts`

- [ ] **Step 1: Create ProjectsController**

Create `apps/api/src/modules/projects/controllers/projects.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { ProjectAccessGuard } from '../../../common/guards/project-access.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { RequireProjectRole } from '../../../common/decorators/project-role.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ProjectsService } from '../services/projects.service';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsSchema,
  CreateProjectDto,
  UpdateProjectDto,
  ListProjectsDto,
} from '../dto';

@Controller('projects')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('projects', 'create')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createProjectSchema)) dto: CreateProjectDto,
  ) {
    return this.projectsService.create(tenantId, userId, dto);
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Query(new ZodValidationPipe(listProjectsSchema)) query: ListProjectsDto,
  ) {
    return this.projectsService.findAll(tenantId, userId, query);
  }

  @Get(':id')
  @UseGuards(ProjectAccessGuard)
  findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.projectsService.findOne(tenantId, id);
  }

  @Patch(':id')
  @UseGuards(ProjectAccessGuard)
  @RequireProjectRole('ADMIN')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(tenantId, id, userId, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard, ProjectAccessGuard)
  @RequirePermission('projects', 'delete')
  @RequireProjectRole('OWNER')
  remove(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.projectsService.remove(tenantId, id, userId);
  }

  @Post(':id/duplicate')
  @UseGuards(PermissionGuard, ProjectAccessGuard)
  @RequirePermission('projects', 'create')
  @RequireProjectRole('ADMIN')
  duplicate(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.projectsService.duplicate(tenantId, id, userId);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/projects/controllers/projects.controller.ts
git commit -m "feat(projects): add ProjectsController with CRUD endpoints"
```

---

## Task 8: Projects Module — Members, Sections, Statuses, Labels, Views Controllers & Services

This is a large task. Each sub-resource follows the same pattern as ProjectsService/Controller. Implement them as individual files.

**Files:**
- Create: `apps/api/src/modules/projects/services/project-members.service.ts`
- Create: `apps/api/src/modules/projects/controllers/project-members.controller.ts`
- Create: `apps/api/src/modules/projects/controllers/project-sections.controller.ts`
- Create: `apps/api/src/modules/projects/controllers/project-statuses.controller.ts`
- Create: `apps/api/src/modules/projects/controllers/project-labels.controller.ts`
- Create: `apps/api/src/modules/projects/controllers/project-views.controller.ts`

Each sub-resource controller follows the same pattern:
- Route: `/projects/:projectId/{sub-resource}`
- Guards: `JwtAuthGuard, TenantGuard, ProjectAccessGuard`
- CRUD operations delegated to ProjectsService (which handles all sub-resources for simplicity in MVP)

- [ ] **Step 1: Create ProjectMembersService**

Create `apps/api/src/modules/projects/services/project-members.service.ts`:

```typescript
import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { AddMemberDto, UpdateMemberDto } from '../dto';

@Injectable()
export class ProjectMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string, projectId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(tenantId: string, projectId: string, actorId: string, dto: AddMemberDto) {
    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });
    if (existing) throw new ConflictException('El usuario ya es miembro del proyecto');

    const member = await this.prisma.projectMember.create({
      data: { projectId, userId: dto.userId, role: dto.role, tenantId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    this.eventEmitter.emit('project.member_added', {
      tenantId, projectId, userId: dto.userId, role: dto.role, actorId,
    });

    return member;
  }

  async updateMember(tenantId: string, projectId: string, userId: string, actorId: string, dto: UpdateMemberDto) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');
    if (member.role === 'OWNER') throw new ForbiddenException('No se puede cambiar el rol del owner');

    return this.prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role: dto.role },
    });
  }

  async removeMember(tenantId: string, projectId: string, userId: string, actorId: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) throw new NotFoundException('Miembro no encontrado');
    if (member.role === 'OWNER') throw new ForbiddenException('No se puede remover al owner');

    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });

    this.eventEmitter.emit('project.member_removed', {
      tenantId, projectId, userId, actorId,
    });
  }
}
```

- [ ] **Step 2: Create ProjectMembersController**

Create `apps/api/src/modules/projects/controllers/project-members.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { ProjectAccessGuard } from '../../../common/guards/project-access.guard';
import { RequireProjectRole } from '../../../common/decorators/project-role.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ProjectMembersService } from '../services/project-members.service';
import { addMemberSchema, updateMemberSchema, AddMemberDto, UpdateMemberDto } from '../dto';

@Controller('projects/:projectId/members')
@UseGuards(JwtAuthGuard, TenantGuard, ProjectAccessGuard)
export class ProjectMembersController {
  constructor(private readonly membersService: ProjectMembersService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: string, @Param('projectId') projectId: string) {
    return this.membersService.findAll(tenantId, projectId);
  }

  @Post()
  @RequireProjectRole('ADMIN')
  add(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(addMemberSchema)) dto: AddMemberDto,
  ) {
    return this.membersService.addMember(tenantId, projectId, userId, dto);
  }

  @Patch(':userId')
  @RequireProjectRole('ADMIN')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') actorId: string,
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(updateMemberSchema)) dto: UpdateMemberDto,
  ) {
    return this.membersService.updateMember(tenantId, projectId, userId, actorId, dto);
  }

  @Delete(':userId')
  @RequireProjectRole('ADMIN')
  remove(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') actorId: string,
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.membersService.removeMember(tenantId, projectId, userId, actorId);
  }
}
```

- [ ] **Step 3: Create remaining sub-resource controllers**

Create `apps/api/src/modules/projects/controllers/project-sections.controller.ts`, `project-statuses.controller.ts`, `project-labels.controller.ts`, and `project-views.controller.ts` following the exact same pattern as ProjectMembersController. Each:

- Uses guards: `JwtAuthGuard, TenantGuard, ProjectAccessGuard`
- Route: `projects/:projectId/{sections|statuses|labels|views}`
- CRUD: GET all, POST create, PATCH /:id update, DELETE /:id
- Sections and Statuses also have POST `/reorder`
- Delegates to ProjectsService methods (add these methods to projects.service.ts following the findAll/create/update/remove pattern using `prisma.forTenant()`)

The service methods for sections, statuses, labels, and views follow the exact same pattern as members but operating on `projectSection`, `taskStatusConfig`, `label`, and `taskView` respectively. Validation: statuses cannot be deleted if they have tasks assigned.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/projects/
git commit -m "feat(projects): add members, sections, statuses, labels, views controllers & services"
```

---

## Task 9: Tasks Module — DTOs

**Files:**
- Create: `apps/api/src/modules/tasks/dto/index.ts`

- [ ] **Step 1: Create task DTOs**

Create `apps/api/src/modules/tasks/dto/index.ts`:

```typescript
import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(500),
  description: z.string().max(50000).optional(),
  projectId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
  statusId: z.string().uuid().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  parentId: z.string().uuid().optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).default('NONE'),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  estimate: z.number().positive().optional(),
  estimateUnit: z.enum(['POINTS', 'MINUTES', 'HOURS']).optional(),
  labelIds: z.array(z.string().uuid()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(50000).nullable().optional(),
  statusId: z.string().uuid().optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).optional(),
  sectionId: z.string().uuid().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimate: z.number().positive().nullable().optional(),
  estimateUnit: z.enum(['POINTS', 'MINUTES', 'HOURS']).nullable().optional(),
});

export const listTasksSchema = z.object({
  projectId: z.string().uuid().optional(),
  statusId: z.string().uuid().optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).optional(),
  assigneeId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  parentId: z.string().uuid().nullable().optional(),
  labelIds: z.string().optional(),
  search: z.string().max(200).optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(50),
  sortBy: z.enum(['position', 'createdAt', 'updatedAt', 'dueDate', 'priority', 'title']).default('position'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const myTasksSchema = z.object({
  status: z.string().optional(),
  dueWithinDays: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

export const moveTaskSchema = z.object({
  sectionId: z.string().uuid().nullable().optional(),
  position: z.string().min(1),
  statusId: z.string().uuid().optional(),
});

export const bulkUpdateTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(50),
  update: z.object({
    statusId: z.string().uuid().optional(),
    priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    sectionId: z.string().uuid().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
  }),
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  parentId: z.string().uuid().optional(),
  mentionedUserIds: z.array(z.string().uuid()).optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(10000),
});

export const createDependencySchema = z.object({
  dependsOnId: z.string().uuid(),
  dependencyType: z.enum(['BLOCKS', 'RELATES_TO', 'DUPLICATES']).default('BLOCKS'),
});

export const activityQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type CreateTaskDto = z.infer<typeof createTaskSchema>;
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
export type ListTasksDto = z.infer<typeof listTasksSchema>;
export type MyTasksDto = z.infer<typeof myTasksSchema>;
export type MoveTaskDto = z.infer<typeof moveTaskSchema>;
export type BulkUpdateTasksDto = z.infer<typeof bulkUpdateTasksSchema>;
export type CreateCommentDto = z.infer<typeof createCommentSchema>;
export type UpdateCommentDto = z.infer<typeof updateCommentSchema>;
export type CreateDependencyDto = z.infer<typeof createDependencySchema>;
export type ActivityQueryDto = z.infer<typeof activityQuerySchema>;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/tasks/dto/index.ts
git commit -m "feat(tasks): add Zod DTOs for tasks, comments, dependencies, activity"
```

---

## Task 10: Tasks Service

**Files:**
- Create: `apps/api/src/modules/tasks/services/tasks.service.ts`

- [ ] **Step 1: Create TasksService**

Create `apps/api/src/modules/tasks/services/tasks.service.ts`. This service handles CRUD for tasks including sequential number generation, fractional indexing, assignee management, label management, subscriber management, and dependency management. Key methods:

- `create()`: Generates sequential `number` per project using `MAX(number)` + 1 in a transaction. Sets initial `position` using `fraci`. Creates assignees, labels, and auto-subscribes creator.
- `findAll()`: Supports all filters from `listTasksSchema`. Includes assignees, labels, status, section, subtask count.
- `findOne()`: Full detail with assignees, labels, comments, attachments, dependencies, subscribers, activity.
- `update()`: Tracks changes and emits domain events. Sets `completedAt` when status category becomes `done`.
- `move()`: Updates sectionId and position. Emits `task.moved` event.
- `bulkUpdate()`: Updates multiple tasks in a transaction.
- `remove()`: Soft-delete.
- `addAssignee()` / `removeAssignee()`: Manage task assignees with events.
- `addLabel()` / `removeLabel()`: Manage task labels.
- `addSubscriber()` / `removeSubscriber()`: Manage watchers.
- `addDependency()` / `removeDependency()`: Manage task dependencies.

All mutations emit events via `EventEmitter2` with pattern `task.{action}` and payload `{ tenantId, projectId, taskId, actorId, ... }`.

Install `fraci` first: `cd apps/api && pnpm add fraci`

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/tasks/services/tasks.service.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(tasks): add TasksService with CRUD, fractional indexing, assignees, labels, deps"
```

---

## Task 11: Tasks Controller

**Files:**
- Create: `apps/api/src/modules/tasks/controllers/tasks.controller.ts`

- [ ] **Step 1: Create TasksController**

Following the exact pattern of ProjectsController. Route: `/tasks`. Guards: `JwtAuthGuard, TenantGuard`. Endpoints:

- `POST /` — create task (validates projectId access internally)
- `GET /` — list tasks with filters
- `GET /my` — my tasks cross-project
- `GET /:id` — task detail
- `PATCH /:id` — update task
- `DELETE /:id` — soft-delete
- `POST /:id/move` — move task
- `POST /bulk-update` — bulk update
- `POST /:id/assignees` — add assignee
- `DELETE /:id/assignees/:userId` — remove assignee
- `POST /:id/subscribers` — add subscriber
- `DELETE /:id/subscribers/:userId` — remove subscriber
- `POST /:id/labels` — add label
- `DELETE /:id/labels/:labelId` — remove label
- `POST /:id/dependencies` — add dependency
- `DELETE /:id/dependencies/:depId` — remove dependency

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/tasks/controllers/tasks.controller.ts
git commit -m "feat(tasks): add TasksController with all CRUD endpoints"
```

---

## Task 12: Task Comments & Activity

**Files:**
- Create: `apps/api/src/modules/tasks/services/task-comments.service.ts`
- Create: `apps/api/src/modules/tasks/controllers/task-comments.controller.ts`
- Create: `apps/api/src/modules/tasks/services/task-activity.service.ts`
- Create: `apps/api/src/modules/tasks/controllers/task-activity.controller.ts`

- [ ] **Step 1: Create TaskCommentsService**

CRUD for comments with thread support (parentId), reactions (add/remove emoji), and mention extraction. Emits `task.comment.created` events. Route: `/tasks/:taskId/comments`.

- [ ] **Step 2: Create TaskCommentsController**

Route: `/tasks/:taskId/comments`. Endpoints: GET, POST, PATCH /:id, DELETE /:id, POST /:id/reactions, DELETE /:id/reactions/:emoji.

- [ ] **Step 3: Create TaskActivityService**

Listens to all `task.*` events via `@OnEvent('task.*')` and persists activity records. Also provides `findByTask()` with cursor-based pagination.

- [ ] **Step 4: Create TaskActivityController**

Route: `/tasks/:taskId/activity`. Single endpoint: `GET /` with cursor + limit params.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/tasks/services/ apps/api/src/modules/tasks/controllers/
git commit -m "feat(tasks): add comments with reactions, activity feed with cursor pagination"
```

---

## Task 13: Task Notification Listener

**Files:**
- Create: `apps/api/src/modules/tasks/services/task-notification.listener.ts`

- [ ] **Step 1: Create TaskNotificationListener**

Listens to domain events and creates notifications via `NotificationService`:

- `@OnEvent('task.assigned')` → notify assignee
- `@OnEvent('task.status_changed')` → notify creator + assignees + subscribers
- `@OnEvent('task.comment.created')` → notify task participants
- `@OnEvent('task.completed')` → notify creator
- `@OnEvent('task.mentioned')` → notify mentioned users
- `@OnEvent('project.member_added')` → notify new member

Each handler checks that actor !== recipient (don't notify yourself).

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/tasks/services/task-notification.listener.ts
git commit -m "feat(tasks): add notification listener for task events"
```

---

## Task 14: Module Registration

**Files:**
- Create: `apps/api/src/modules/projects/projects.module.ts`
- Create: `apps/api/src/modules/tasks/tasks.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create ProjectsModule**

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectMembersController } from './controllers/project-members.controller';
import { ProjectSectionsController } from './controllers/project-sections.controller';
import { ProjectStatusesController } from './controllers/project-statuses.controller';
import { ProjectLabelsController } from './controllers/project-labels.controller';
import { ProjectViewsController } from './controllers/project-views.controller';
import { ProjectsService } from './services/projects.service';
import { ProjectMembersService } from './services/project-members.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ProjectsController,
    ProjectMembersController,
    ProjectSectionsController,
    ProjectStatusesController,
    ProjectLabelsController,
    ProjectViewsController,
  ],
  providers: [ProjectsService, ProjectMembersService],
  exports: [ProjectsService, ProjectMembersService],
})
export class ProjectsModule {}
```

- [ ] **Step 2: Create TasksModule**

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TasksController } from './controllers/tasks.controller';
import { TaskCommentsController } from './controllers/task-comments.controller';
import { TaskActivityController } from './controllers/task-activity.controller';
import { TasksService } from './services/tasks.service';
import { TaskCommentsService } from './services/task-comments.service';
import { TaskActivityService } from './services/task-activity.service';
import { TaskNotificationListener } from './services/task-notification.listener';

@Module({
  imports: [PrismaModule],
  controllers: [TasksController, TaskCommentsController, TaskActivityController],
  providers: [TasksService, TaskCommentsService, TaskActivityService, TaskNotificationListener],
  exports: [TasksService],
})
export class TasksModule {}
```

- [ ] **Step 3: Register in app.module.ts**

Add imports at top of `apps/api/src/app.module.ts`:
```typescript
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
```

Add to the `imports` array:
```typescript
ProjectsModule,
TasksModule,
```

- [ ] **Step 4: Verify build**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: No errors. Fix any that appear.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/projects/projects.module.ts apps/api/src/modules/tasks/tasks.module.ts apps/api/src/app.module.ts
git commit -m "feat(modules): register ProjectsModule and TasksModule in app"
```

---

## Task 15: WebSocket Gateway — Project Room Handlers

**Files:**
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`

- [ ] **Step 1: Add project:join and project:leave handlers**

In `realtime.gateway.ts`, add two new `@SubscribeMessage` handlers:

```typescript
@SubscribeMessage('project:join')
async handleProjectJoin(client: AuthenticatedSocket, data: { projectId: string }) {
  const room = `project:${client.data.tenantId}:${data.projectId}`;
  await client.join(room);
}

@SubscribeMessage('project:leave')
async handleProjectLeave(client: AuthenticatedSocket, data: { projectId: string }) {
  const room = `project:${client.data.tenantId}:${data.projectId}`;
  await client.leave(room);
}
```

- [ ] **Step 2: Add @OnEvent listeners for task domain events**

```typescript
@OnEvent('task.created')
handleTaskCreated(payload: { tenantId: string; projectId: string; task: Record<string, unknown>; sectionId: string | null; position: string }) {
  const room = `project:${payload.tenantId}:${payload.projectId}`;
  this.emitToRoom(room, 'task:created', payload);
}

@OnEvent('task.updated')
handleTaskUpdated(payload: { tenantId: string; projectId: string; taskId: string; changes: Record<string, unknown>; version: number; actorId: string }) {
  const room = `project:${payload.tenantId}:${payload.projectId}`;
  this.emitToRoom(room, 'task:changed', payload);
}

@OnEvent('task.moved')
handleTaskMoved(payload: { tenantId: string; projectId: string; taskId: string; fromSectionId: string | null; toSectionId: string | null; position: string; actorId: string }) {
  const room = `project:${payload.tenantId}:${payload.projectId}`;
  this.emitToRoom(room, 'task:moved', payload);
}

@OnEvent('task.deleted')
handleTaskDeleted(payload: { tenantId: string; projectId: string; taskId: string }) {
  const room = `project:${payload.tenantId}:${payload.projectId}`;
  this.emitToRoom(room, 'task:removed', payload);
}

@OnEvent('task.comment.created')
handleTaskComment(payload: { tenantId: string; projectId: string; taskId: string; comment: Record<string, unknown> }) {
  const room = `project:${payload.tenantId}:${payload.projectId}`;
  this.emitToRoom(room, 'task:comment:new', payload);
}

@OnEvent('section.changed')
handleSectionChanged(payload: { tenantId: string; projectId: string; sectionId: string; changes: Record<string, unknown> }) {
  const room = `project:${payload.tenantId}:${payload.projectId}`;
  this.emitToRoom(room, 'section:changed', payload);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/realtime/realtime.gateway.ts
git commit -m "feat(realtime): add project room handlers and task event broadcasting"
```

---

## Task 16: Due Soon Cron Job

**Files:**
- Create: `apps/api/src/modules/tasks/services/task-cron.service.ts`
- Modify: `apps/api/src/modules/tasks/tasks.module.ts` (add provider)

- [ ] **Step 1: Create TaskCronService**

```typescript
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class TaskCronService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('0 9 * * *')
  async checkDueSoon() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tasks = await this.prisma.rawClient.task.findMany({
      where: {
        dueDate: { gte: today, lte: tomorrow },
        completedAt: null,
        deletedAt: null,
      },
      include: {
        assignees: true,
        project: { select: { id: true, name: true, tenantId: true } },
      },
    });

    for (const task of tasks) {
      for (const assignee of task.assignees) {
        this.eventEmitter.emit('task.due_soon', {
          tenantId: task.project.tenantId,
          projectId: task.projectId,
          taskId: task.id,
          taskTitle: task.title,
          userId: assignee.userId,
        });
      }
    }
  }
}
```

- [ ] **Step 2: Register in TasksModule**

Add `TaskCronService` to the `providers` array in `tasks.module.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/tasks/services/task-cron.service.ts apps/api/src/modules/tasks/tasks.module.ts
git commit -m "feat(tasks): add daily cron for due-soon notifications"
```

---

## Task 17: Final Verification

- [ ] **Step 1: Build check**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Lint check**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 3: Prisma check**

Run: `cd apps/api && npx prisma validate`
Expected: Schema is valid.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A && git commit -m "fix: resolve lint and type errors in projects/tasks modules"
```
