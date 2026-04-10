# Projects & Tasks — Frontend MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete frontend MVP for Projects & Tasks — routes, sidebar integration, project list, Kanban board, list view, task detail sheet, filters, and drag & drop.

**Architecture:** Next.js 16 App Router with `"use client"` pages, `api-client.ts` for fetching (no React Query), Zustand store for realtime state, `@dnd-kit` for drag & drop, shadcn/ui primitives, HugeIcons. Follows existing patterns from `org-intelligence/projects` for CRUD and from `notification-sync` for realtime.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, shadcn/ui, Zustand, HugeIcons, @dnd-kit, socket.io-client

**Spec:** `docs/superpowers/specs/2026-04-06-projects-tasks-design.md`

**Worktree:** `/Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks`

---

## File Structure

```
apps/web/
├── app/(dashboard)/projects/
│   ├── page.tsx                        # Grid de proyectos
│   ├── loading.tsx
│   ├── [projectId]/
│   │   ├── page.tsx                    # Redirect a /board
│   │   ├── layout.tsx                  # Header + tabs + filtros + sync
│   │   ├── board/page.tsx              # Kanban
│   │   ├── list/page.tsx               # Lista
│   │   └── settings/page.tsx           # Config (miembros, statuses, labels)
├── components/projects/
│   ├── create-project-dialog.tsx       # Dialog para crear proyecto
│   ├── project-card.tsx                # Card en grid de proyectos
│   ├── project-header.tsx              # Header con nombre, miembros, filtros
│   ├── view-switcher.tsx               # Tabs Board/Lista
│   ├── task-filter-bar.tsx             # Barra de filtros
│   ├── task-status-badge.tsx           # Badge con color de status custom
│   ├── task-priority-badge.tsx         # Badge de prioridad
│   ├── task-assignee-avatars.tsx       # Avatar stack de assignees
│   ├── create-task-dialog.tsx          # Dialog para crear tarea
│   ├── board/
│   │   ├── kanban-board.tsx            # Contenedor con DndContext
│   │   ├── kanban-column.tsx           # Columna por status
│   │   ├── kanban-card.tsx             # Tarjeta sortable
│   │   └── kanban-new-task-inline.tsx  # Input inline para crear
│   ├── list/
│   │   ├── task-list-view.tsx          # Tabla agrupada
│   │   └── task-list-row.tsx           # Fila con inline editing
│   ├── detail/
│   │   ├── task-detail-sheet.tsx       # Sheet lateral
│   │   ├── task-detail-header.tsx      # Título + status + actions
│   │   ├── task-detail-fields.tsx      # Grid de campos
│   │   ├── task-detail-description.tsx # Descripción editable
│   │   ├── task-detail-subtasks.tsx    # Lista de subtareas
│   │   ├── task-detail-comments.tsx    # Comentarios
│   │   └── task-detail-activity.tsx    # Activity log
│   └── settings/
│       ├── project-members-panel.tsx   # CRUD miembros
│       ├── project-statuses-panel.tsx  # CRUD statuses
│       └── project-labels-panel.tsx    # CRUD labels
├── hooks/
│   ├── use-project.ts                  # Fetch single project
│   ├── use-project-tasks.ts            # Fetch tasks of project
│   ├── use-task-mutations.ts           # Create/update/move/delete con optimistic
│   └── use-task-filters.ts             # Filtros sincronizados con URL
├── lib/api/
│   ├── projects.ts                     # Funciones tipadas para /projects
│   └── tasks.ts                        # Funciones tipadas para /tasks
├── stores/
│   └── project-store.ts                # Estado ephemeral del proyecto activo
└── types/
    └── projects.ts                     # Tipos compartidos Project, Task, etc.
```

---

## Task 1: Install Dependencies & Sidebar Integration

**Files:**
- Modify: `apps/web/package.json` (add @dnd-kit)
- Modify: `apps/web/components/layouts/nav-main.tsx` (insert Proyectos item)

- [ ] **Step 1: Install @dnd-kit packages**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks/apps/web && pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

Expected: Packages installed, `package.json` updated.

- [ ] **Step 2: Add Proyectos to sidebar**

Modify `apps/web/components/layouts/nav-main.tsx` to insert the Proyectos item in `appNavSections[0].items`. Find the existing Calendario line and add Proyectos right after it:

```typescript
// Find this line in the imports at top of file:
import {
  DashboardSquare01Icon,
  AiChat02Icon,
  Calendar02Icon,
  File02Icon,
  // ... other existing imports
} from "@hugeicons/core-free-icons";

// Add TaskDone01Icon to the imports:
import {
  DashboardSquare01Icon,
  AiChat02Icon,
  Calendar02Icon,
  TaskDone01Icon,
  File02Icon,
  // ... other existing imports
} from "@hugeicons/core-free-icons";
```

Then in `appNavSections[0].items`, add between Calendario and Documentos:

```typescript
{ title: "Calendario", href: "/calendar", icon: Calendar02Icon, moduleKey: "calendar" },
{ title: "Proyectos", href: "/projects", icon: TaskDone01Icon, moduleKey: "projects" },
{ title: "Documentos", href: "/documents", icon: File02Icon, moduleKey: "documents" },
```

- [ ] **Step 3: Verify lint passes**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/components/layouts/nav-main.tsx
git commit -m "feat(projects): add @dnd-kit and sidebar entry"
```

---

## Task 2: Shared Types

**Files:**
- Create: `apps/web/types/projects.ts`

- [ ] **Step 1: Create type definitions**

Create `apps/web/types/projects.ts`:

```typescript
export type ProjectStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type ProjectVisibility = "PUBLIC" | "PRIVATE";
export type ProjectMemberRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type TaskPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type TaskViewType = "BOARD" | "LIST" | "CALENDAR" | "TIMELINE";
export type StatusCategory = "backlog" | "active" | "done" | "cancelled";

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

export interface TaskStatusConfig {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  category: StatusCategory;
  sortOrder: number;
  isDefault: boolean;
}

export interface ProjectSection {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

export interface ProjectMember {
  id: string;
  role: ProjectMemberRole;
  userId: string;
  user: UserSummary;
  createdAt: string;
}

export interface TaskView {
  id: string;
  name: string;
  type: TaskViewType;
  config: Record<string, unknown>;
  filters: Record<string, unknown>;
  isDefault: boolean;
  icon: string | null;
  sortOrder: number;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  key: string;
  icon: string | null;
  color: string | null;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  startDate: string | null;
  dueDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdBy?: UserSummary;
  members?: ProjectMember[];
  taskStatuses?: TaskStatusConfig[];
  sections?: ProjectSection[];
  labels?: Label[];
  taskViews?: TaskView[];
  _count?: { tasks: number; members: number };
}

export interface Task {
  id: string;
  number: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  position: string;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  estimate: number | null;
  estimateUnit: string | null;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  statusId: string;
  sectionId: string | null;
  parentId: string | null;
  createdById: string;
  status?: TaskStatusConfig;
  section?: ProjectSection | null;
  assignees?: Array<{ userId: string; user: UserSummary }>;
  labels?: Array<{ labelId: string; label: Label }>;
  _count?: { subtasks: number; comments: number };
}

export interface TaskComment {
  id: string;
  content: string;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  taskId: string;
  authorId: string;
  author: UserSummary;
  parentId: string | null;
  reactions?: Array<{ emoji: string; userId: string }>;
  replies?: TaskComment[];
}

export interface TaskActivity {
  id: string;
  action: string;
  data: Record<string, unknown> | null;
  createdAt: string;
  taskId: string;
  actorId: string | null;
  actor?: UserSummary | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}
```

- [ ] **Step 2: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/types/projects.ts
git commit -m "feat(projects): add shared frontend types"
```

---

## Task 3: API Client Modules

**Files:**
- Create: `apps/web/lib/api/projects.ts`
- Create: `apps/web/lib/api/tasks.ts`

- [ ] **Step 1: Create projects API module**

Create `apps/web/lib/api/projects.ts`:

```typescript
import { api } from "@/lib/api-client";
import type {
  Project,
  ProjectMember,
  ProjectSection,
  TaskStatusConfig,
  Label,
  PaginatedResponse,
} from "@/types/projects";

export interface CreateProjectPayload {
  name: string;
  description?: string;
  key: string;
  visibility?: "PUBLIC" | "PRIVATE";
  color?: string;
  icon?: string;
  startDate?: string;
  dueDate?: string;
  memberIds?: string[];
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string | null;
  status?: "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
  visibility?: "PUBLIC" | "PRIVATE";
  color?: string | null;
  icon?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}

export interface ListProjectsQuery {
  status?: string;
  search?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

function buildQuery(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  if (entries.length === 0) return "";
  const usp = new URLSearchParams();
  for (const [key, value] of entries) {
    usp.set(key, String(value));
  }
  return `?${usp.toString()}`;
}

export const projectsApi = {
  list: (query: ListProjectsQuery = {}) =>
    api.get<PaginatedResponse<Project>>(`/projects${buildQuery(query)}`),

  getById: (id: string) => api.get<Project>(`/projects/${id}`),

  create: (payload: CreateProjectPayload) =>
    api.post<Project>("/projects", payload),

  update: (id: string, payload: UpdateProjectPayload) =>
    api.patch<Project>(`/projects/${id}`, payload),

  remove: (id: string) => api.delete<void>(`/projects/${id}`),

  duplicate: (id: string) => api.post<Project>(`/projects/${id}/duplicate`, {}),

  // Members
  listMembers: (projectId: string) =>
    api.get<ProjectMember[]>(`/projects/${projectId}/members`),

  addMember: (projectId: string, userId: string, role: "ADMIN" | "MEMBER" | "VIEWER") =>
    api.post<ProjectMember>(`/projects/${projectId}/members`, { userId, role }),

  updateMember: (projectId: string, userId: string, role: "ADMIN" | "MEMBER" | "VIEWER") =>
    api.patch<ProjectMember>(`/projects/${projectId}/members/${userId}`, { role }),

  removeMember: (projectId: string, userId: string) =>
    api.delete<void>(`/projects/${projectId}/members/${userId}`),

  // Sections
  listSections: (projectId: string) =>
    api.get<ProjectSection[]>(`/projects/${projectId}/sections`),

  createSection: (projectId: string, name: string) =>
    api.post<ProjectSection>(`/projects/${projectId}/sections`, { name }),

  updateSection: (projectId: string, sectionId: string, payload: { name?: string; sortOrder?: number }) =>
    api.patch<ProjectSection>(`/projects/${projectId}/sections/${sectionId}`, payload),

  deleteSection: (projectId: string, sectionId: string) =>
    api.delete<void>(`/projects/${projectId}/sections/${sectionId}`),

  reorderSections: (projectId: string, sectionIds: string[]) =>
    api.post<void>(`/projects/${projectId}/sections/reorder`, { sectionIds }),

  // Statuses
  listStatuses: (projectId: string) =>
    api.get<TaskStatusConfig[]>(`/projects/${projectId}/statuses`),

  createStatus: (projectId: string, payload: { name: string; slug: string; color?: string; category?: string }) =>
    api.post<TaskStatusConfig>(`/projects/${projectId}/statuses`, payload),

  updateStatus: (projectId: string, statusId: string, payload: { name?: string; color?: string | null; category?: string; sortOrder?: number }) =>
    api.patch<TaskStatusConfig>(`/projects/${projectId}/statuses/${statusId}`, payload),

  deleteStatus: (projectId: string, statusId: string) =>
    api.delete<void>(`/projects/${projectId}/statuses/${statusId}`),

  // Labels
  listLabels: (projectId: string) =>
    api.get<Label[]>(`/projects/${projectId}/labels`),

  createLabel: (projectId: string, name: string, color: string) =>
    api.post<Label>(`/projects/${projectId}/labels`, { name, color }),

  updateLabel: (projectId: string, labelId: string, payload: { name?: string; color?: string }) =>
    api.patch<Label>(`/projects/${projectId}/labels/${labelId}`, payload),

  deleteLabel: (projectId: string, labelId: string) =>
    api.delete<void>(`/projects/${projectId}/labels/${labelId}`),
};
```

- [ ] **Step 2: Create tasks API module**

Create `apps/web/lib/api/tasks.ts`:

```typescript
import { api } from "@/lib/api-client";
import type { Task, TaskComment, TaskActivity, PaginatedResponse } from "@/types/projects";

export interface CreateTaskPayload {
  title: string;
  description?: string;
  projectId: string;
  sectionId?: string;
  statusId?: string;
  assigneeIds?: string[];
  parentId?: string;
  priority?: "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  startDate?: string;
  dueDate?: string;
  estimate?: number;
  estimateUnit?: "POINTS" | "MINUTES" | "HOURS";
  labelIds?: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  statusId?: string;
  priority?: "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  sectionId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimate?: number | null;
  estimateUnit?: "POINTS" | "MINUTES" | "HOURS" | null;
}

export interface ListTasksQuery {
  projectId?: string;
  statusId?: string;
  priority?: string;
  assigneeId?: string;
  sectionId?: string;
  parentId?: string | null;
  labelIds?: string;
  search?: string;
  dueBefore?: string;
  dueAfter?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface MoveTaskPayload {
  sectionId?: string | null;
  position: string;
  statusId?: string;
}

function buildQuery(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  if (entries.length === 0) return "";
  const usp = new URLSearchParams();
  for (const [key, value] of entries) {
    usp.set(key, String(value));
  }
  return `?${usp.toString()}`;
}

export const tasksApi = {
  list: (query: ListTasksQuery = {}) =>
    api.get<PaginatedResponse<Task>>(`/tasks${buildQuery(query)}`),

  myTasks: (query: { status?: string; dueWithinDays?: number; page?: number; perPage?: number } = {}) =>
    api.get<PaginatedResponse<Task>>(`/tasks/my${buildQuery(query)}`),

  getById: (id: string) => api.get<Task>(`/tasks/${id}`),

  create: (payload: CreateTaskPayload) => api.post<Task>("/tasks", payload),

  update: (id: string, payload: UpdateTaskPayload) =>
    api.patch<Task>(`/tasks/${id}`, payload),

  remove: (id: string) => api.delete<void>(`/tasks/${id}`),

  move: (id: string, payload: MoveTaskPayload) =>
    api.post<Task>(`/tasks/${id}/move`, payload),

  bulkUpdate: (taskIds: string[], update: UpdateTaskPayload) =>
    api.post<void>("/tasks/bulk-update", { taskIds, update }),

  addAssignee: (taskId: string, userId: string) =>
    api.post<void>(`/tasks/${taskId}/assignees`, { userId }),

  removeAssignee: (taskId: string, userId: string) =>
    api.delete<void>(`/tasks/${taskId}/assignees/${userId}`),

  addLabel: (taskId: string, labelId: string) =>
    api.post<void>(`/tasks/${taskId}/labels`, { labelId }),

  removeLabel: (taskId: string, labelId: string) =>
    api.delete<void>(`/tasks/${taskId}/labels/${labelId}`),

  addDependency: (taskId: string, dependsOnId: string, dependencyType: string = "BLOCKS") =>
    api.post<void>(`/tasks/${taskId}/dependencies`, { dependsOnId, dependencyType }),

  removeDependency: (taskId: string, depId: string) =>
    api.delete<void>(`/tasks/${taskId}/dependencies/${depId}`),

  // Comments
  listComments: (taskId: string) =>
    api.get<TaskComment[]>(`/tasks/${taskId}/comments`),

  createComment: (taskId: string, content: string, parentId?: string, mentionedUserIds?: string[]) =>
    api.post<TaskComment>(`/tasks/${taskId}/comments`, { content, parentId, mentionedUserIds }),

  updateComment: (taskId: string, commentId: string, content: string) =>
    api.patch<TaskComment>(`/tasks/${taskId}/comments/${commentId}`, { content }),

  deleteComment: (taskId: string, commentId: string) =>
    api.delete<void>(`/tasks/${taskId}/comments/${commentId}`),

  addReaction: (taskId: string, commentId: string, emoji: string) =>
    api.post<void>(`/tasks/${taskId}/comments/${commentId}/reactions`, { emoji }),

  removeReaction: (taskId: string, commentId: string, emoji: string) =>
    api.delete<void>(`/tasks/${taskId}/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`),

  // Activity
  getActivity: (taskId: string, cursor?: string, limit: number = 30) =>
    api.get<{ data: TaskActivity[]; nextCursor: string | null }>(
      `/tasks/${taskId}/activity${buildQuery({ cursor, limit })}`,
    ),
};
```

- [ ] **Step 3: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/api/projects.ts apps/web/lib/api/tasks.ts
git commit -m "feat(projects): add typed API client modules for projects and tasks"
```

---

## Task 4: Fractional Position Utility

**Files:**
- Create: `apps/web/lib/fractional-position.ts`

- [ ] **Step 1: Create utility**

Create `apps/web/lib/fractional-position.ts`:

```typescript
/**
 * Simple lexicographic fractional indexing for task positioning.
 * Mirrors the backend's generatePosition logic in tasks.service.ts.
 *
 * Returns a string that sorts alphabetically BETWEEN `before` and `after`.
 * If either is null, generates a position at the start or end.
 */
const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const MID_CHAR = "n";

export function positionBetween(before: string | null, after: string | null): string {
  if (!before && !after) return "a";
  if (!before) return prevPosition(after!);
  if (!after) return nextPosition(before);
  return midpoint(before, after);
}

function nextPosition(current: string): string {
  const lastChar = current[current.length - 1];
  const idx = ALPHABET.indexOf(lastChar);
  if (idx === -1 || idx === ALPHABET.length - 1) {
    return current + "n";
  }
  return current.slice(0, -1) + ALPHABET[idx + 1];
}

function prevPosition(current: string): string {
  const lastChar = current[current.length - 1];
  const idx = ALPHABET.indexOf(lastChar);
  if (idx <= 0) {
    return "0" + current;
  }
  return current.slice(0, -1) + ALPHABET[idx - 1];
}

function midpoint(before: string, after: string): string {
  if (before >= after) return before + MID_CHAR;

  const maxLen = Math.max(before.length, after.length);
  const padBefore = before.padEnd(maxLen, "a");
  const padAfter = after.padEnd(maxLen, "z");

  for (let i = 0; i < maxLen; i++) {
    const beforeChar = padBefore[i];
    const afterChar = padAfter[i];
    if (beforeChar === afterChar) continue;

    const beforeIdx = ALPHABET.indexOf(beforeChar);
    const afterIdx = ALPHABET.indexOf(afterChar);
    if (afterIdx - beforeIdx > 1) {
      const midIdx = Math.floor((beforeIdx + afterIdx) / 2);
      return padBefore.slice(0, i) + ALPHABET[midIdx];
    }
    return padBefore.slice(0, i + 1) + MID_CHAR;
  }

  return before + MID_CHAR;
}
```

- [ ] **Step 2: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/fractional-position.ts
git commit -m "feat(projects): add fractional position utility for drag & drop"
```

---

## Task 5: Projects List Page

**Files:**
- Create: `apps/web/app/(dashboard)/projects/page.tsx`
- Create: `apps/web/app/(dashboard)/projects/loading.tsx`
- Create: `apps/web/components/projects/create-project-dialog.tsx`
- Create: `apps/web/components/projects/project-card.tsx`

- [ ] **Step 1: Create loading state**

Create `apps/web/app/(dashboard)/projects/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-6 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ProjectCard component**

Create `apps/web/components/projects/project-card.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { TaskDone01Icon, UserMultiple02Icon } from "@hugeicons/core-free-icons";
import type { Project } from "@/types/projects";

interface ProjectCardProps {
  project: Project;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  COMPLETED: "Completado",
  ARCHIVED: "Archivado",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "secondary",
  COMPLETED: "outline",
  ARCHIVED: "outline",
};

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => router.push(`/projects/${project.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">
              {project.icon && <span className="mr-2">{project.icon}</span>}
              {project.name}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{project.key}</p>
          </div>
          <Badge variant={STATUS_VARIANTS[project.status]}>
            {STATUS_LABELS[project.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {project.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {project.description}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <HugeiconsIcon icon={TaskDone01Icon} className="size-3.5" />
          <span>{project._count?.tasks ?? 0} tareas</span>
        </div>
        <div className="flex items-center gap-1">
          <HugeiconsIcon icon={UserMultiple02Icon} className="size-3.5" />
          <span>{project._count?.members ?? 0} miembros</span>
        </div>
      </CardFooter>
    </Card>
  );
}
```

- [ ] **Step 3: Create CreateProjectDialog component**

Create `apps/web/components/projects/create-project-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { projectsApi } from "@/lib/api/projects";

interface CreateProjectDialogProps {
  onCreated: () => void;
}

export function CreateProjectDialog({ onCreated }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");

  function reset() {
    setName("");
    setKey("");
    setDescription("");
    setVisibility("PUBLIC");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;
    setLoading(true);
    try {
      await projectsApi.create({
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description.trim() || undefined,
        visibility,
      });
      toast.success("Proyecto creado");
      setOpen(false);
      reset();
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear proyecto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">Nuevo proyecto</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Crear proyecto</DialogTitle>
            <DialogDescription>
              Crea un espacio de trabajo para organizar tareas y colaborar con tu equipo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lanzamiento Q2"
                required
                minLength={1}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key">Clave del proyecto</Label>
              <Input
                id="key"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="Q2LAUNCH"
                required
                minLength={1}
                maxLength={10}
                pattern="[A-Z0-9]+"
              />
              <p className="text-xs text-muted-foreground">
                Solo mayúsculas y números. Las tareas se numerarán como {key || "KEY"}-1, {key || "KEY"}-2, etc.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opcional"
                rows={3}
                maxLength={5000}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visibility">Visibilidad</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as "PUBLIC" | "PRIVATE")}>
                <SelectTrigger id="visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Público (todos los miembros)</SelectItem>
                  <SelectItem value="PRIVATE">Privado (solo invitados)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !key.trim()}>
              {loading ? "Creando..." : "Crear proyecto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Create projects list page**

Create `apps/web/app/(dashboard)/projects/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { projectsApi } from "@/lib/api/projects";
import { ProjectCard } from "@/components/projects/project-card";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import type { Project } from "@/types/projects";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await projectsApi.list({ search: debouncedSearch, perPage: 50 });
      setProjects(res.data);
    } catch (err) {
      console.error("Error al cargar proyectos:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            Organiza tareas, colabora y haz seguimiento al progreso
          </p>
        </div>
        <CreateProjectDialog onCreated={fetchProjects} />
      </div>

      <Input
        placeholder="Buscar proyectos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-6 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-base font-medium">No hay proyectos</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea tu primer proyecto para empezar a organizar tareas.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(dashboard\)/projects/ apps/web/components/projects/project-card.tsx apps/web/components/projects/create-project-dialog.tsx
git commit -m "feat(projects): add projects list page with create dialog"
```

---

## Task 6: Project Store & Data Hooks

**Files:**
- Create: `apps/web/stores/project-store.ts`
- Create: `apps/web/hooks/use-project.ts`
- Create: `apps/web/hooks/use-project-tasks.ts`

- [ ] **Step 1: Create project store**

Create `apps/web/stores/project-store.ts`:

```typescript
import { create } from "zustand";
import type { Task } from "@/types/projects";

interface ProjectState {
  // Tasks grouped by projectId
  tasksByProject: Map<string, Map<string, Task>>;
  // Currently open task (for detail sheet)
  openTaskId: string | null;

  setTasks: (projectId: string, tasks: Task[]) => void;
  upsertTask: (projectId: string, task: Task) => void;
  removeTask: (projectId: string, taskId: string) => void;
  patchTask: (projectId: string, taskId: string, patch: Partial<Task>) => void;
  getTasks: (projectId: string) => Task[];
  getTask: (projectId: string, taskId: string) => Task | null;

  setOpenTaskId: (taskId: string | null) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  tasksByProject: new Map(),
  openTaskId: null,

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
}));
```

- [ ] **Step 2: Create useProject hook**

Create `apps/web/hooks/use-project.ts`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { projectsApi } from "@/lib/api/projects";
import type { Project } from "@/types/projects";

export function useProject(projectId: string | null) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await projectsApi.getById(projectId);
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar proyecto");
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { project, loading, error, refetch };
}
```

- [ ] **Step 3: Create useProjectTasks hook**

Create `apps/web/hooks/use-project-tasks.ts`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { tasksApi } from "@/lib/api/tasks";
import { useProjectStore } from "@/stores/project-store";
import type { Task } from "@/types/projects";

export function useProjectTasks(projectId: string | null) {
  const setTasks = useProjectStore((s) => s.setTasks);
  const tasks = useProjectStore((s) => (projectId ? s.getTasks(projectId) : []));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await tasksApi.list({ projectId, perPage: 500 });
      setTasks(projectId, res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar tareas");
    } finally {
      setLoading(false);
    }
  }, [projectId, setTasks]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { tasks, loading, error, refetch };
}
```

- [ ] **Step 4: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/stores/project-store.ts apps/web/hooks/use-project.ts apps/web/hooks/use-project-tasks.ts
git commit -m "feat(projects): add project store and data hooks"
```

---

## Task 7: Project Detail Layout & Redirect

**Files:**
- Create: `apps/web/app/(dashboard)/projects/[projectId]/page.tsx`
- Create: `apps/web/app/(dashboard)/projects/[projectId]/layout.tsx`
- Create: `apps/web/components/projects/project-header.tsx`
- Create: `apps/web/components/projects/view-switcher.tsx`

- [ ] **Step 1: Create view-switcher component**

Create `apps/web/components/projects/view-switcher.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { DashboardSpeed02Icon, Menu01Icon, Settings02Icon } from "@hugeicons/core-free-icons";

interface ViewSwitcherProps {
  projectId: string;
}

export function ViewSwitcher({ projectId }: ViewSwitcherProps) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const views = [
    { href: `${base}/board`, label: "Board", icon: DashboardSpeed02Icon },
    { href: `${base}/list`, label: "Lista", icon: Menu01Icon },
    { href: `${base}/settings`, label: "Configuración", icon: Settings02Icon },
  ];

  return (
    <nav className="flex items-center gap-1 border-b">
      {views.map((view) => {
        const active = pathname === view.href;
        return (
          <Link
            key={view.href}
            href={view.href}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <HugeiconsIcon icon={view.icon} className="size-4" />
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Create project header component**

Create `apps/web/components/projects/project-header.tsx`:

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
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
    </div>
  );
}
```

- [ ] **Step 3: Create project layout**

Create `apps/web/app/(dashboard)/projects/[projectId]/layout.tsx`:

```tsx
"use client";

import { use } from "react";
import { useProject } from "@/hooks/use-project";
import { ProjectHeader } from "@/components/projects/project-header";
import { ViewSwitcher } from "@/components/projects/view-switcher";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { project, loading, error } = useProject(projectId);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-10 w-full max-w-md" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">
          {error ?? "Proyecto no encontrado"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ProjectHeader project={project} />
      <ViewSwitcher projectId={projectId} />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Create project index page (redirect)**

Create `apps/web/app/(dashboard)/projects/[projectId]/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default async function ProjectIndexPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/board`);
}
```

- [ ] **Step 5: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(dashboard\)/projects/\[projectId\]/ apps/web/components/projects/project-header.tsx apps/web/components/projects/view-switcher.tsx
git commit -m "feat(projects): add project detail layout with header and view switcher"
```

---

## Task 8: Task Shared Components (Badges & Avatars)

**Files:**
- Create: `apps/web/components/projects/task-status-badge.tsx`
- Create: `apps/web/components/projects/task-priority-badge.tsx`
- Create: `apps/web/components/projects/task-assignee-avatars.tsx`

- [ ] **Step 1: Create status badge**

Create `apps/web/components/projects/task-status-badge.tsx`:

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import type { TaskStatusConfig } from "@/types/projects";

interface TaskStatusBadgeProps {
  status: TaskStatusConfig;
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const color = status.color ?? "#6B7280";
  return (
    <Badge
      variant="outline"
      style={{
        borderColor: color,
        color: color,
        backgroundColor: `${color}15`,
      }}
      className="font-medium"
    >
      {status.name}
    </Badge>
  );
}
```

- [ ] **Step 2: Create priority badge**

Create `apps/web/components/projects/task-priority-badge.tsx`:

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import type { TaskPriority } from "@/types/projects";

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string } | null> = {
  URGENT: { label: "Urgente", color: "#DC2626" },
  HIGH: { label: "Alta", color: "#EA580C" },
  MEDIUM: { label: "Media", color: "#CA8A04" },
  LOW: { label: "Baja", color: "#2563EB" },
  NONE: null,
};

export function TaskPriorityBadge({ priority }: TaskPriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];
  if (!config) return null;
  return (
    <Badge
      variant="outline"
      style={{
        borderColor: config.color,
        color: config.color,
        backgroundColor: `${config.color}15`,
      }}
      className="text-xs"
    >
      {config.label}
    </Badge>
  );
}
```

- [ ] **Step 3: Create assignee avatars**

Create `apps/web/components/projects/task-assignee-avatars.tsx`:

```tsx
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UserSummary } from "@/types/projects";

interface TaskAssigneeAvatarsProps {
  assignees: Array<{ userId: string; user: UserSummary }>;
  max?: number;
  size?: "sm" | "md";
}

function initials(user: UserSummary): string {
  const first = user.firstName?.charAt(0) ?? "";
  const last = user.lastName?.charAt(0) ?? "";
  return (first + last).toUpperCase() || "?";
}

export function TaskAssigneeAvatars({ assignees, max = 3, size = "sm" }: TaskAssigneeAvatarsProps) {
  if (!assignees.length) return null;
  const visible = assignees.slice(0, max);
  const extra = assignees.length - max;
  const sizeClass = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((a) => (
        <Avatar
          key={a.userId}
          className={cn(sizeClass, "border-2 border-background")}
          title={`${a.user.firstName} ${a.user.lastName}`}
        >
          <AvatarFallback>{initials(a.user)}</AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <Avatar className={cn(sizeClass, "border-2 border-background")}>
          <AvatarFallback>+{extra}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/projects/task-status-badge.tsx apps/web/components/projects/task-priority-badge.tsx apps/web/components/projects/task-assignee-avatars.tsx
git commit -m "feat(projects): add task status, priority badges and assignee avatars"
```

---

## Task 9: Create Task Dialog

**Files:**
- Create: `apps/web/components/projects/create-task-dialog.tsx`

- [ ] **Step 1: Create dialog component**

Create `apps/web/components/projects/create-task-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tasksApi } from "@/lib/api/tasks";
import type { TaskPriority, TaskStatusConfig } from "@/types/projects";

interface CreateTaskDialogProps {
  projectId: string;
  statuses: TaskStatusConfig[];
  defaultStatusId?: string;
  onCreated: () => void;
  trigger?: React.ReactNode;
}

export function CreateTaskDialog({
  projectId,
  statuses,
  defaultStatusId,
  onCreated,
  trigger,
}: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState(defaultStatusId ?? "");
  const [priority, setPriority] = useState<TaskPriority>("NONE");

  function reset() {
    setTitle("");
    setDescription("");
    setStatusId(defaultStatusId ?? "");
    setPriority("NONE");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await tasksApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        projectId,
        statusId: statusId || undefined,
        priority,
      });
      toast.success("Tarea creada");
      setOpen(false);
      reset();
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear tarea");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm">Nueva tarea</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Crear tarea</DialogTitle>
            <DialogDescription>
              Añade una tarea al proyecto con título, descripción y prioridad.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Revisar propuesta comercial"
                required
                minLength={1}
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opcional"
                rows={3}
                maxLength={50000}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="status">Estado</Label>
                <Select value={statusId} onValueChange={setStatusId}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Por defecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="priority">Prioridad</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Sin prioridad</SelectItem>
                    <SelectItem value="LOW">Baja</SelectItem>
                    <SelectItem value="MEDIUM">Media</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading ? "Creando..." : "Crear tarea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/projects/create-task-dialog.tsx
git commit -m "feat(projects): add create task dialog"
```

---

## Task 10: Kanban Board — Static Rendering

**Files:**
- Create: `apps/web/app/(dashboard)/projects/[projectId]/board/page.tsx`
- Create: `apps/web/components/projects/board/kanban-board.tsx`
- Create: `apps/web/components/projects/board/kanban-column.tsx`
- Create: `apps/web/components/projects/board/kanban-card.tsx`

- [ ] **Step 1: Create KanbanCard**

Create `apps/web/components/projects/board/kanban-card.tsx`:

```tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { TaskPriorityBadge } from "@/components/projects/task-priority-badge";
import { TaskAssigneeAvatars } from "@/components/projects/task-assignee-avatars";
import type { Task } from "@/types/projects";

interface KanbanCardProps {
  task: Task;
  projectKey: string;
}

export function KanbanCard({ task, projectKey }: KanbanCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function handleClick() {
    const params = new URLSearchParams(searchParams);
    params.set("task", task.id);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        "cursor-pointer rounded-md border bg-card p-3 shadow-sm hover:shadow-md transition-shadow",
        isDragging && "cursor-grabbing",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium line-clamp-2 flex-1">{task.title}</h3>
        <TaskPriorityBadge priority={task.priority} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {projectKey}-{task.number}
        </span>
        {task.assignees && task.assignees.length > 0 && (
          <TaskAssigneeAvatars assignees={task.assignees} max={3} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create KanbanColumn**

Create `apps/web/components/projects/board/kanban-column.tsx`:

```tsx
"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanCard } from "./kanban-card";
import { CreateTaskDialog } from "../create-task-dialog";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import type { Task, TaskStatusConfig } from "@/types/projects";

interface KanbanColumnProps {
  status: TaskStatusConfig;
  statuses: TaskStatusConfig[];
  tasks: Task[];
  projectId: string;
  projectKey: string;
  onTaskCreated: () => void;
}

export function KanbanColumn({
  status,
  statuses,
  tasks,
  projectId,
  projectKey,
  onTaskCreated,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
    data: { type: "column", statusId: status.id },
  });

  const color = status.color ?? "#6B7280";

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/40">
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderTopColor: color, borderTopWidth: 3 }}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{status.name}</h3>
          <span className="text-xs text-muted-foreground">{tasks.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[100px] flex-1 flex-col gap-2 p-2 transition-colors ${
          isOver ? "bg-accent/40" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} projectKey={projectKey} />
          ))}
        </SortableContext>
        <CreateTaskDialog
          projectId={projectId}
          statuses={statuses}
          defaultStatusId={status.id}
          onCreated={onTaskCreated}
          trigger={
            <Button variant="ghost" size="sm" className="justify-start text-muted-foreground">
              <HugeiconsIcon icon={PlusSignIcon} className="mr-2 size-4" />
              Agregar tarea
            </Button>
          }
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create KanbanBoard container**

Create `apps/web/components/projects/board/kanban-board.tsx`:

```tsx
"use client";

import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { useProjectStore } from "@/stores/project-store";
import { tasksApi } from "@/lib/api/tasks";
import { positionBetween } from "@/lib/fractional-position";
import type { Task, TaskStatusConfig } from "@/types/projects";

interface KanbanBoardProps {
  projectId: string;
  projectKey: string;
  statuses: TaskStatusConfig[];
  tasks: Task[];
  onRefetch: () => void;
}

export function KanbanBoard({ projectId, projectKey, statuses, tasks, onRefetch }: KanbanBoardProps) {
  const patchTask = useProjectStore((s) => s.patchTask);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const tasksByStatus = new Map<string, Task[]>();
  for (const status of statuses) {
    tasksByStatus.set(
      status.id,
      tasks
        .filter((t) => t.statusId === status.id && !t.parentId)
        .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0)),
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Determine target status
    let targetStatusId: string | null = null;
    if (over.data.current?.type === "column") {
      targetStatusId = over.data.current.statusId as string;
    } else if (over.data.current?.type === "task") {
      const overTask = over.data.current.task as Task;
      targetStatusId = overTask.statusId;
    }

    if (!targetStatusId) return;

    const columnTasks = tasksByStatus.get(targetStatusId) ?? [];
    const overIndex = over.data.current?.type === "task"
      ? columnTasks.findIndex((t) => t.id === over.id)
      : columnTasks.length;

    const beforeTask = overIndex > 0 ? columnTasks[overIndex - 1] : null;
    const afterTask = overIndex >= 0 && overIndex < columnTasks.length ? columnTasks[overIndex] : null;

    // Skip if dropped on itself in same position
    if (beforeTask?.id === taskId || afterTask?.id === taskId) return;

    const newPosition = positionBetween(
      beforeTask?.position ?? null,
      afterTask?.position ?? null,
    );

    // Optimistic update
    const previousStatusId = task.statusId;
    const previousPosition = task.position;
    patchTask(projectId, taskId, { statusId: targetStatusId, position: newPosition });

    try {
      await tasksApi.move(taskId, {
        statusId: targetStatusId,
        position: newPosition,
      });
    } catch (err) {
      // Rollback
      patchTask(projectId, taskId, { statusId: previousStatusId, position: previousPosition });
      toast.error(err instanceof Error ? err.message : "No se pudo mover la tarea");
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-full gap-4 overflow-x-auto pb-4">
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            statuses={statuses}
            tasks={tasksByStatus.get(status.id) ?? []}
            projectId={projectId}
            projectKey={projectKey}
            onTaskCreated={onRefetch}
          />
        ))}
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 4: Create board page**

Create `apps/web/app/(dashboard)/projects/[projectId]/board/page.tsx`:

```tsx
"use client";

import { use } from "react";
import { useProject } from "@/hooks/use-project";
import { useProjectTasks } from "@/hooks/use-project-tasks";
import { KanbanBoard } from "@/components/projects/board/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";

export default function BoardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { project } = useProject(projectId);
  const { tasks, loading, refetch } = useProjectTasks(projectId);

  if (!project || loading) {
    return (
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const statuses = (project.taskStatuses ?? []).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <KanbanBoard
      projectId={projectId}
      projectKey={project.key}
      statuses={statuses}
      tasks={tasks}
      onRefetch={refetch}
    />
  );
}
```

- [ ] **Step 5: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(dashboard\)/projects/\[projectId\]/board/ apps/web/components/projects/board/
git commit -m "feat(projects): add Kanban board with drag & drop and optimistic updates"
```

---

## Task 11: List View

**Files:**
- Create: `apps/web/app/(dashboard)/projects/[projectId]/list/page.tsx`
- Create: `apps/web/components/projects/list/task-list-view.tsx`
- Create: `apps/web/components/projects/list/task-list-row.tsx`

- [ ] **Step 1: Create TaskListRow**

Create `apps/web/components/projects/list/task-list-row.tsx`:

```tsx
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import { TaskStatusBadge } from "@/components/projects/task-status-badge";
import { TaskPriorityBadge } from "@/components/projects/task-priority-badge";
import { TaskAssigneeAvatars } from "@/components/projects/task-assignee-avatars";
import type { Task, TaskStatusConfig } from "@/types/projects";

interface TaskListRowProps {
  task: Task;
  projectKey: string;
  statuses: TaskStatusConfig[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
  });
}

export function TaskListRow({ task, projectKey, statuses }: TaskListRowProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = statuses.find((s) => s.id === task.statusId);

  function handleClick() {
    const params = new URLSearchParams(searchParams);
    params.set("task", task.id);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <TableRow onClick={handleClick} className="cursor-pointer hover:bg-accent/40">
      <TableCell className="font-mono text-xs text-muted-foreground">
        {projectKey}-{task.number}
      </TableCell>
      <TableCell className="font-medium">{task.title}</TableCell>
      <TableCell>{status && <TaskStatusBadge status={status} />}</TableCell>
      <TableCell>
        <TaskPriorityBadge priority={task.priority} />
      </TableCell>
      <TableCell>
        {task.assignees && task.assignees.length > 0 ? (
          <TaskAssigneeAvatars assignees={task.assignees} max={3} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatDate(task.dueDate)}
      </TableCell>
    </TableRow>
  );
}
```

- [ ] **Step 2: Create TaskListView**

Create `apps/web/components/projects/list/task-list-view.tsx`:

```tsx
"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskListRow } from "./task-list-row";
import type { Task, TaskStatusConfig } from "@/types/projects";

interface TaskListViewProps {
  tasks: Task[];
  projectKey: string;
  statuses: TaskStatusConfig[];
}

export function TaskListView({ tasks, projectKey, statuses }: TaskListViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No hay tareas en este proyecto todavía.
        </p>
      </div>
    );
  }

  const rootTasks = tasks
    .filter((t) => !t.parentId)
    .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">ID</TableHead>
            <TableHead>Título</TableHead>
            <TableHead className="w-32">Estado</TableHead>
            <TableHead className="w-24">Prioridad</TableHead>
            <TableHead className="w-28">Asignados</TableHead>
            <TableHead className="w-24">Vence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rootTasks.map((task) => (
            <TaskListRow
              key={task.id}
              task={task}
              projectKey={projectKey}
              statuses={statuses}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Create list page**

Create `apps/web/app/(dashboard)/projects/[projectId]/list/page.tsx`:

```tsx
"use client";

import { use } from "react";
import { useProject } from "@/hooks/use-project";
import { useProjectTasks } from "@/hooks/use-project-tasks";
import { TaskListView } from "@/components/projects/list/task-list-view";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function ListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { project } = useProject(projectId);
  const { tasks, loading, refetch } = useProjectTasks(projectId);

  if (!project || loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const statuses = (project.taskStatuses ?? []).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateTaskDialog
          projectId={projectId}
          statuses={statuses}
          onCreated={refetch}
        />
      </div>
      <TaskListView tasks={tasks} projectKey={project.key} statuses={statuses} />
    </div>
  );
}
```

- [ ] **Step 4: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/projects/\[projectId\]/list/ apps/web/components/projects/list/
git commit -m "feat(projects): add list view with table"
```

---

## Task 12: Task Detail Sheet — Skeleton + Header

**Files:**
- Create: `apps/web/components/projects/detail/task-detail-sheet.tsx`
- Create: `apps/web/hooks/use-task-detail.ts`

- [ ] **Step 1: Create useTaskDetail hook**

Create `apps/web/hooks/use-task-detail.ts`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { tasksApi } from "@/lib/api/tasks";
import type { Task } from "@/types/projects";

export function useTaskDetail(taskId: string | null) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!taskId) {
      setTask(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await tasksApi.getById(taskId);
      setTask(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar tarea");
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { task, loading, error, refetch };
}
```

- [ ] **Step 2: Create TaskDetailSheet**

Create `apps/web/components/projects/detail/task-detail-sheet.tsx`:

```tsx
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useTaskDetail } from "@/hooks/use-task-detail";
import { TaskStatusBadge } from "@/components/projects/task-status-badge";
import { TaskPriorityBadge } from "@/components/projects/task-priority-badge";
import { TaskAssigneeAvatars } from "@/components/projects/task-assignee-avatars";

interface TaskDetailSheetProps {
  projectKey: string;
}

export function TaskDetailSheet({ projectKey }: TaskDetailSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskId = searchParams.get("task");
  const { task, loading } = useTaskDetail(taskId);

  function handleClose(open: boolean) {
    if (open) return;
    const params = new URLSearchParams(searchParams);
    params.delete("task");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Sheet open={!!taskId} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-[600px] overflow-y-auto">
        {loading && !task ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : task ? (
          <>
            <SheetHeader className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="font-mono">
                  {projectKey}-{task.number}
                </Badge>
                {task.status && <TaskStatusBadge status={task.status} />}
                <TaskPriorityBadge priority={task.priority} />
              </div>
              <SheetTitle className="text-xl">{task.title}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              {task.description && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Descripción</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {task.description}
                  </p>
                </div>
              )}
              {task.assignees && task.assignees.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Asignados</h3>
                  <TaskAssigneeAvatars assignees={task.assignees} max={10} size="md" />
                </div>
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Mount sheet in project layout**

Modify `apps/web/app/(dashboard)/projects/[projectId]/layout.tsx` to include the sheet. Find the return statement and add the sheet at the end:

```tsx
"use client";

import { use } from "react";
import { useProject } from "@/hooks/use-project";
import { ProjectHeader } from "@/components/projects/project-header";
import { ViewSwitcher } from "@/components/projects/view-switcher";
import { TaskDetailSheet } from "@/components/projects/detail/task-detail-sheet";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { project, loading, error } = useProject(projectId);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-10 w-full max-w-md" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">{error ?? "Proyecto no encontrado"}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ProjectHeader project={project} />
      <ViewSwitcher projectId={projectId} />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <TaskDetailSheet projectKey={project.key} />
    </div>
  );
}
```

- [ ] **Step 4: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/hooks/use-task-detail.ts apps/web/components/projects/detail/ apps/web/app/\(dashboard\)/projects/\[projectId\]/layout.tsx
git commit -m "feat(projects): add task detail sheet with URL param routing"
```

---

## Task 13: Task Detail — Comments Section

**Files:**
- Create: `apps/web/components/projects/detail/task-comments.tsx`

- [ ] **Step 1: Create TaskComments component**

Create `apps/web/components/projects/detail/task-comments.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { tasksApi } from "@/lib/api/tasks";
import type { TaskComment } from "@/types/projects";

interface TaskCommentsProps {
  taskId: string;
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

export function TaskComments({ taskId }: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tasksApi.listComments(taskId);
      setComments(data);
    } catch (err) {
      console.error("Error loading comments:", err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await tasksApi.createComment(taskId, content.trim());
      setContent("");
      await fetchComments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al publicar comentario");
    } finally {
      setSubmitting(false);
    }
  }

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
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
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

- [ ] **Step 2: Add TaskComments to TaskDetailSheet**

Modify `apps/web/components/projects/detail/task-detail-sheet.tsx`. Import TaskComments at top:

```tsx
import { TaskComments } from "./task-comments";
```

Then in the content area, after the assignees section, add:

```tsx
{task.id && (
  <div className="border-t pt-6">
    <TaskComments taskId={task.id} />
  </div>
)}
```

- [ ] **Step 3: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/projects/detail/
git commit -m "feat(projects): add comments section to task detail sheet"
```

---

## Task 14: Project Settings Page

**Files:**
- Create: `apps/web/app/(dashboard)/projects/[projectId]/settings/page.tsx`

- [ ] **Step 1: Create settings page**

Create `apps/web/app/(dashboard)/projects/[projectId]/settings/page.tsx`:

```tsx
"use client";

import { use } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useProject } from "@/hooks/use-project";
import { projectsApi } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";

export default function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const { project, loading, refetch } = useProject(projectId);

  async function handleDelete() {
    if (!confirm("¿Estás seguro de eliminar este proyecto? Esta acción no se puede deshacer.")) return;
    try {
      await projectsApi.remove(projectId);
      toast.success("Proyecto eliminado");
      router.push("/projects");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar proyecto");
    }
  }

  if (loading || !project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Miembros</CardTitle>
          <CardDescription>
            Personas con acceso a este proyecto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(project.members ?? []).map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {((member.user.firstName?.[0] ?? "") + (member.user.lastName?.[0] ?? "")).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {member.user.firstName} {member.user.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.user.email}</p>
                  </div>
                </div>
                <Badge variant="outline">{member.role}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estados personalizados</CardTitle>
          <CardDescription>
            Los estados se muestran como columnas en el board
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(project.taskStatuses ?? [])
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((status) => (
                <div
                  key={status.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="size-3 rounded-full"
                      style={{ backgroundColor: status.color ?? "#6B7280" }}
                    />
                    <span className="text-sm font-medium">{status.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {status.category}
                  </Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Zona de peligro</CardTitle>
          <CardDescription>
            Eliminar el proyecto archivará todas sus tareas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDelete}>
            <HugeiconsIcon icon={Delete02Icon} className="mr-2 size-4" />
            Eliminar proyecto
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/projects/\[projectId\]/settings/
git commit -m "feat(projects): add settings page with members, statuses and delete"
```

---

## Task 15: Realtime Sync for Board

**Files:**
- Create: `apps/web/components/projects/project-realtime-sync.tsx`

- [ ] **Step 1: Create ProjectRealtimeSync component**

Create `apps/web/components/projects/project-realtime-sync.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useProjectStore } from "@/stores/project-store";
import type { Task } from "@/types/projects";

interface ProjectRealtimeSyncProps {
  projectId: string;
}

export function ProjectRealtimeSync({ projectId }: ProjectRealtimeSyncProps) {
  const socket = useSocket();
  const upsertTask = useProjectStore((s) => s.upsertTask);
  const removeTask = useProjectStore((s) => s.removeTask);
  const patchTask = useProjectStore((s) => s.patchTask);

  useEffect(() => {
    if (!socket || !projectId) return;

    socket.emit("project:join", { projectId });

    const handleCreated = (data: { projectId: string; task?: Task }) => {
      if (data.projectId !== projectId || !data.task) return;
      upsertTask(projectId, data.task);
    };

    const handleChanged = (data: {
      projectId: string;
      taskId: string;
      changes?: Record<string, { from: unknown; to: unknown }>;
    }) => {
      if (data.projectId !== projectId || !data.changes) return;
      const patch: Partial<Task> = {};
      for (const [key, change] of Object.entries(data.changes)) {
        (patch as Record<string, unknown>)[key] = change.to;
      }
      patchTask(projectId, data.taskId, patch);
    };

    const handleMoved = (data: {
      projectId: string;
      taskId: string;
      toSectionId?: string | null;
      position?: string;
      statusId?: string;
    }) => {
      if (data.projectId !== projectId) return;
      patchTask(projectId, data.taskId, {
        sectionId: data.toSectionId ?? undefined,
        position: data.position,
        statusId: data.statusId,
      } as Partial<Task>);
    };

    const handleRemoved = (data: { projectId: string; taskId: string }) => {
      if (data.projectId !== projectId) return;
      removeTask(projectId, data.taskId);
    };

    socket.on("task:created", handleCreated);
    socket.on("task:changed", handleChanged);
    socket.on("task:moved", handleMoved);
    socket.on("task:removed", handleRemoved);

    return () => {
      socket.emit("project:leave", { projectId });
      socket.off("task:created", handleCreated);
      socket.off("task:changed", handleChanged);
      socket.off("task:moved", handleMoved);
      socket.off("task:removed", handleRemoved);
    };
  }, [socket, projectId, upsertTask, removeTask, patchTask]);

  return null;
}
```

- [ ] **Step 2: Mount in project layout**

Modify `apps/web/app/(dashboard)/projects/[projectId]/layout.tsx` to include `ProjectRealtimeSync`. Import and add before `TaskDetailSheet`:

```tsx
import { ProjectRealtimeSync } from "@/components/projects/project-realtime-sync";
```

```tsx
      <ProjectRealtimeSync projectId={projectId} />
      <TaskDetailSheet projectKey={project.key} />
```

- [ ] **Step 3: Verify lint**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/projects/project-realtime-sync.tsx apps/web/app/\(dashboard\)/projects/\[projectId\]/layout.tsx
git commit -m "feat(projects): add realtime sync for board via WebSocket"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Lint check**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm lint`
Expected: 0 errors.

- [ ] **Step 2: Type check**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks/apps/web && pnpm typecheck`
Expected: 0 errors. If `typecheck` script doesn't exist, use `npx tsc --noEmit`.

- [ ] **Step 3: Build check**

Run: `cd /Users/camiloespinoza/Zeru/.worktrees/feature/projects-tasks && pnpm --filter @zeru/web build`
Expected: Build succeeds. This validates the Next.js build graph.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve lint and type errors in projects frontend"
```

Only commit if there were actual fixes. If nothing was changed, skip this step.
