# Projects & Tasks System — Design Spec

> **Date:** 2026-04-06
> **Status:** Draft — Consensus from 5 research agents
> **Branch:** `feature/projects-tasks`

## 1. Visión General

Sistema de gestión de proyectos y tareas integrado en Zeru, similar a Asana/Notion pero diferenciado por la integración con el Knowledge Graph organizacional y las capacidades de AI existentes.

**Diferenciadores clave:**
- AI que conoce la organización (roles, procesos, dependencias) para sugerir asignados y descomponer tareas
- Vinculación con Org Intelligence: problemas detectados → tareas automáticas
- Búsqueda semántica de tareas (embeddings)
- Infraestructura de tiempo real madura ya existente (70-80% reutilizable)

---

## 2. Arquitectura de Datos

### 2.1 Enums

```prisma
enum ProjectStatus {
  ACTIVE
  PAUSED
  COMPLETED
  ARCHIVED
  @@schema("public")
  @@map("project_status")
}

enum ProjectVisibility {
  PUBLIC      // Visible a todos los miembros del tenant
  PRIVATE     // Solo miembros explícitos del proyecto
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

enum CustomFieldType {
  TEXT
  NUMBER
  DATE
  SELECT
  MULTI_SELECT
  CHECKBOX
  URL
  PERSON
  @@schema("public")
  @@map("custom_field_type")
}
```

### 2.2 Modelos (17 modelos nuevos)

#### Project

```prisma
model Project {
  id          String            @id @default(uuid())
  name        String
  description String?
  key         String            // Identificador corto para refs (ej: "ZERU", "MKT")
  icon        String?           // Emoji o ícono
  color       String?           // Hex color
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

  defaultViewId String?

  members        ProjectMember[]
  tasks          Task[]
  taskViews      TaskView[]
  labels         Label[]
  taskStatuses   TaskStatusConfig[]
  sections       ProjectSection[]
  customFields   CustomFieldDefinition[]  // Implementar en v1.1

  @@unique([tenantId, key])
  @@index([tenantId])
  @@index([tenantId, status])
  @@schema("public")
  @@map("projects")
}
```

#### ProjectMember

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

#### ProjectSection

```prisma
model ProjectSection {
  id        String   @id @default(uuid())
  name      String
  sortOrder Int      @default(0)
  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

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

#### TaskStatusConfig (estados personalizables por proyecto)

```prisma
model TaskStatusConfig {
  id        String  @id @default(uuid())
  name      String
  slug      String
  color     String?
  category  String  @default("active")  // backlog | active | done | cancelled
  sortOrder Int     @default(0)
  isDefault Boolean @default(false)
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

**Nota:** Cada proyecto se crea con statuses por defecto: Backlog(backlog), To Do(active), In Progress(active), In Review(active), Done(done), Cancelled(cancelled). El usuario puede renombrar, recolorar, agregar o eliminar.

#### Task

```prisma
model Task {
  id              String       @id @default(uuid())
  number          Int          // Secuencial por proyecto → "PROJ-123"
  title           String
  description     String?
  descriptionJson Json?        // Rich text (TipTap/ProseMirror JSON)
  priority        TaskPriority @default(NONE)
  position        String       // Fractional index para O(1) reorder
  startDate       DateTime?
  dueDate         DateTime?
  completedAt     DateTime?
  estimate        Decimal?     @db.Decimal(10, 2)
  estimateUnit    String?      // POINTS | MINUTES | HOURS
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
  customValues    TaskCustomFieldValue[]  // v1.1
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

#### TaskAssignee (multi-assignee)

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
```

#### TaskSubscriber (watchers)

```prisma
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

#### TaskDependency

```prisma
model TaskDependency {
  id             String   @id @default(uuid())
  dependencyType String   @default("BLOCKS")  // BLOCKS | RELATES_TO | DUPLICATES
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

#### Label & TaskLabel

```prisma
model Label {
  id        String   @id @default(uuid())
  name      String
  color     String
  sortOrder Int      @default(0)
  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

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

#### TaskComment (con hilos y reacciones)

```prisma
model TaskComment {
  id          String    @id @default(uuid())
  content     String
  contentJson Json?     // Rich text
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

#### TaskActivity (activity feed)

```prisma
model TaskActivity {
  id        String   @id @default(uuid())
  action    String   // status_changed, assigned, unassigned, priority_changed, etc.
  data      Json?    // { from: "TODO", to: "IN_PROGRESS" }
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

#### TaskAttachment

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

#### TaskView (vistas guardadas)

```prisma
model TaskView {
  id        String       @id @default(uuid())
  name      String
  type      TaskViewType
  config    Json         @default("{}")   // groupBy, swimlanes, columns, etc.
  filters   Json         @default("{}")   // status, assignee, labels, etc.
  isDefault Boolean      @default(false)
  icon      String?
  sortOrder Int          @default(0)
  deletedAt DateTime?
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  projectId   String
  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdById String?   // null = vista compartida; userId = vista personal
  createdBy   User? @relation("TaskViewsCreated", fields: [createdById], references: [id], onDelete: SetNull)

  tenantId String

  @@index([projectId])
  @@index([tenantId])
  @@schema("public")
  @@map("task_views")
}
```

#### Custom Fields (v1.1)

```prisma
model CustomFieldDefinition {
  id         String          @id @default(uuid())
  name       String
  fieldType  CustomFieldType
  options    Json?           // Para SELECT/MULTI_SELECT
  isRequired Boolean         @default(false)
  sortOrder  Int             @default(0)
  deletedAt  DateTime?
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt

  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  values    TaskCustomFieldValue[]
  tenantId  String

  @@unique([projectId, name])
  @@index([tenantId])
  @@schema("public")
  @@map("custom_field_definitions")
}

model TaskCustomFieldValue {
  id           String    @id @default(uuid())
  textValue    String?
  numberValue  Decimal?  @db.Decimal(18, 4)
  dateValue    DateTime?
  booleanValue Boolean?
  jsonValue    Json?     // Para SELECT/MULTI_SELECT
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  taskId  String
  task    Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  fieldId String
  field   CustomFieldDefinition @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  tenantId String

  @@unique([taskId, fieldId])
  @@index([tenantId])
  @@schema("public")
  @@map("task_custom_field_values")
}
```

---

## 3. Arquitectura API (Backend)

### 3.1 Estructura de Módulos

#### MVP

```
modules/projects/
  projects.module.ts
  controllers/
    projects.controller.ts
    project-members.controller.ts
    project-views.controller.ts
    project-sections.controller.ts
    project-labels.controller.ts
    project-statuses.controller.ts
  services/
    projects.service.ts
    project-members.service.ts
    project-views.service.ts
  dto/
    index.ts

modules/tasks/
  tasks.module.ts
  controllers/
    tasks.controller.ts
    task-comments.controller.ts
    task-activity.controller.ts
  services/
    tasks.service.ts
    task-comments.service.ts
    task-activity.service.ts
    task-notification.listener.ts
  dto/
    index.ts
```

#### v1.1 (archivos nuevos)

```
modules/tasks/
  controllers/
    task-custom-fields.controller.ts    # CRUD de custom fields y valores
  services/
    task-automation.service.ts          # Rules engine
    task-automation.listener.ts         # @OnEvent listeners para reglas
    task-ai.service.ts                  # Task decomposition, AI assignee, summaries
    task-search.service.ts              # Búsqueda semántica con embeddings
    task-template.service.ts            # Templates desde proyectos anteriores

modules/projects/
  controllers/
    project-automations.controller.ts   # CRUD de reglas de automatización
    project-templates.controller.ts     # Templates
```

#### v2.0 (archivos nuevos)

```
modules/public-api/
  v1-projects.controller.ts             # API pública de proyectos
  v1-tasks.controller.ts                # API pública de tareas

modules/integrations/
  github/
    github-integration.module.ts
    github-webhook.controller.ts        # Recibir webhooks de GitHub
    github-sync.service.ts              # Sync PRs/issues ↔ tareas
  slack/
    slack-integration.module.ts
    slack-bot.controller.ts             # Events API
    slack-task.service.ts               # Crear tareas desde Slack
  calendar/
    calendar-sync.service.ts            # Sync deadlines con Google/Outlook

modules/tasks/
  services/
    task-coach.service.ts               # AI coach de productividad (cron semanal)
    task-nlp.service.ts                 # Natural language task creation
```

### 3.2 Endpoints

#### MVP

**Projects** (`/api/projects`)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/` | Crear proyecto (con statuses y secciones por defecto) |
| GET | `/` | Listar proyectos del tenant |
| GET | `/:id` | Detalle de proyecto |
| PATCH | `/:id` | Actualizar proyecto |
| DELETE | `/:id` | Soft-delete proyecto |
| POST | `/:id/archive` | Archivar/desarchivar |
| POST | `/:id/duplicate` | Duplicar proyecto con estructura |

**Project Members** (`/api/projects/:projectId/members`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Listar miembros |
| POST | `/` | Agregar miembro |
| PATCH | `/:userId` | Cambiar rol |
| DELETE | `/:userId` | Remover miembro |

**Project Sections** (`/api/projects/:projectId/sections`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Listar secciones |
| POST | `/` | Crear sección |
| PATCH | `/:id` | Actualizar sección (nombre, orden) |
| DELETE | `/:id` | Eliminar sección |
| POST | `/reorder` | Reordenar secciones |

**Project Statuses** (`/api/projects/:projectId/statuses`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Listar status configs del proyecto |
| POST | `/` | Crear status personalizado |
| PATCH | `/:id` | Actualizar status (nombre, color, orden) |
| DELETE | `/:id` | Eliminar status (solo si no tiene tareas) |
| POST | `/reorder` | Reordenar statuses |

**Project Labels** (`/api/projects/:projectId/labels`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Listar labels |
| POST | `/` | Crear label |
| PATCH | `/:id` | Actualizar label |
| DELETE | `/:id` | Eliminar label |

**Project Views** (`/api/projects/:projectId/views`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Listar vistas |
| POST | `/` | Crear vista |
| PATCH | `/:id` | Actualizar vista |
| DELETE | `/:id` | Eliminar vista |

**Tasks** (`/api/tasks`)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/` | Crear tarea (genera number secuencial) |
| GET | `/` | Listar tareas con filtros avanzados |
| GET | `/my` | Mis tareas (cross-project) |
| GET | `/:id` | Detalle de tarea |
| PATCH | `/:id` | Actualizar tarea |
| DELETE | `/:id` | Soft-delete |
| POST | `/:id/move` | Mover tarea (sección, posición, proyecto) |
| POST | `/bulk-update` | Bulk update (max 50) |
| POST | `/:id/assignees` | Agregar assignee |
| DELETE | `/:id/assignees/:userId` | Remover assignee |
| POST | `/:id/subscribers` | Agregar watcher |
| DELETE | `/:id/subscribers/:userId` | Remover watcher |
| POST | `/:id/labels` | Agregar label |
| DELETE | `/:id/labels/:labelId` | Remover label |
| POST | `/:id/dependencies` | Agregar dependencia |
| DELETE | `/:id/dependencies/:depId` | Remover dependencia |
| POST | `/:id/attachments` | Subir adjunto (multipart) |
| DELETE | `/:id/attachments/:attId` | Eliminar adjunto |

**Task Comments** (`/api/tasks/:taskId/comments`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Listar comentarios |
| POST | `/` | Crear comentario (con mentions) |
| PATCH | `/:id` | Editar comentario |
| DELETE | `/:id` | Eliminar comentario |
| POST | `/:id/reactions` | Agregar reacción |
| DELETE | `/:id/reactions/:emoji` | Remover reacción |

**Task Activity** (`/api/tasks/:taskId/activity`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Activity feed (cursor-based pagination) |

#### v1.1 (endpoints nuevos)

**Custom Fields** (`/api/projects/:projectId/custom-fields`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Listar definiciones de campos custom |
| POST | `/` | Crear campo custom |
| PATCH | `/:id` | Actualizar definición (nombre, opciones, required) |
| DELETE | `/:id` | Eliminar campo custom |

**Task Custom Field Values** (`/api/tasks/:taskId/custom-fields`)

| Method | Route | Description |
|--------|-------|-------------|
| PATCH | `/` | Batch update de valores custom `[{ fieldId, value }]` |

**Automations** (`/api/projects/:projectId/automations`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Listar reglas de automatización |
| POST | `/` | Crear regla |
| PATCH | `/:id` | Actualizar regla |
| DELETE | `/:id` | Eliminar regla |
| POST | `/:id/toggle` | Activar/desactivar regla |

**AI Features** (`/api/tasks`)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/:id/ai/decompose` | Generar subtareas con AI desde descripción |
| GET | `/:id/ai/suggest-assignee` | Sugerir assignee basado en knowledge graph |
| GET | `/search/semantic` | Búsqueda semántica de tareas (embeddings) |

**AI Features** (`/api/projects`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/:id/ai/summary` | Resumen inteligente de progreso del proyecto |
| GET | `/:id/ai/risk-analysis` | Análisis predictivo de delays por tarea |

**Templates** (`/api/project-templates`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Listar templates disponibles |
| POST | `/from-project/:projectId` | Crear template desde proyecto existente |
| POST | `/:id/apply` | Crear proyecto desde template |
| GET | `/:id/ai/adapt` | Adaptar template al nuevo contexto con AI |

**Chat AI Tools** (no son endpoints REST, son tools del ToolExecutor existente):
- `list_project_tasks`: Listar tareas de un proyecto
- `create_task`: Crear tarea desde chat
- `update_task_status`: Cambiar status de tarea
- `get_project_summary`: Resumen del proyecto

#### v2.0 (endpoints nuevos)

**Public API** (`/api/v1/projects`, `/api/v1/tasks`)

| Method | Route | Description | Scope |
|--------|-------|-------------|-------|
| GET | `/v1/projects` | Listar proyectos | `projects:read` |
| GET | `/v1/projects/:id` | Detalle de proyecto | `projects:read` |
| POST | `/v1/projects` | Crear proyecto | `projects:write` |
| GET | `/v1/tasks` | Listar tareas (con filtros) | `tasks:read` |
| GET | `/v1/tasks/:id` | Detalle de tarea | `tasks:read` |
| POST | `/v1/tasks` | Crear tarea | `tasks:write` |
| PATCH | `/v1/tasks/:id` | Actualizar tarea | `tasks:write` |

**Webhook Subscriptions** (`/api/webhook-subscriptions`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Listar suscripciones |
| POST | `/` | Crear suscripción (url, events[], secret) |
| PATCH | `/:id` | Actualizar suscripción |
| DELETE | `/:id` | Eliminar suscripción |
| POST | `/:id/test` | Enviar evento de prueba |

**GitHub Integration** (`/api/integrations/github`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/connect` | Iniciar OAuth flow |
| GET | `/callback` | OAuth callback |
| GET | `/repos` | Listar repos conectados |
| POST | `/repos/:repo/link` | Vincular repo a proyecto |
| POST | `/webhook` | Recibir webhooks de GitHub |

**Slack Integration** (`/api/integrations/slack`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/connect` | Iniciar OAuth flow |
| GET | `/callback` | OAuth callback |
| POST | `/events` | Slack Events API |
| POST | `/commands` | Slash commands (/zeru-task) |

**Calendar Sync** (`/api/integrations/calendar`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/connect` | Iniciar OAuth (Google/Microsoft) |
| GET | `/callback` | OAuth callback |
| POST | `/sync` | Forzar sync manual |
| PATCH | `/settings` | Configurar qué sincronizar |

### 3.3 DTOs (Zod Schemas)

Todos los DTOs usan Zod siguiendo el patrón existente del proyecto.

#### MVP

- `createProjectSchema`: name (required), description?, visibility, color?, icon?, startDate?, dueDate?, memberIds?, sections?
- `updateProjectSchema`: Todos opcionales
- `listProjectsSchema`: status?, search?, page, perPage, sortBy, sortOrder
- `createTaskSchema`: title (required), projectId, sectionId?, assigneeIds?, parentId?, priority, startDate?, dueDate?, estimate?, labelIds?
- `updateTaskSchema`: Todos opcionales
- `listTasksSchema`: projectId?, statusId?, priority?, assigneeId?, sectionId?, parentId?, labelIds?, search?, dueBefore?, dueAfter?, page, perPage, sortBy, sortOrder
- `moveTaskSchema`: sectionId?, position (fractional index string), projectId? (para mover entre proyectos)
- `bulkUpdateTasksSchema`: taskIds (max 50), update: { statusId?, priority?, assigneeId?, sectionId?, dueDate? }
- `createCommentSchema`: content, parentId?, mentionedUserIds?
- `activityQuerySchema`: cursor?, limit (default 30)
- `createStatusConfigSchema`: name, slug, color?, category (backlog|active|done|cancelled), sortOrder?
- `createLabelSchema`: name, color
- `createSectionSchema`: name, color?
- `createViewSchema`: name, type (BOARD|LIST|TIMELINE|CALENDAR), config?, filters?

#### v1.1 (schemas nuevos)

- `createCustomFieldSchema`: name, fieldType, options? (para SELECT), isRequired?, sortOrder?
- `updateCustomFieldValuesSchema`: `[{ fieldId, textValue?, numberValue?, dateValue?, booleanValue?, jsonValue? }]`
- `createAutomationSchema`: name, trigger (evento), conditions (Json), actions `[{ type, params }]`, isActive
- `decomposeTaskSchema`: context? (instrucciones adicionales para la AI)
- `semanticSearchSchema`: query (string), projectId?, limit (default 20)
- `createTemplateSchema`: name, description?
- `applyTemplateSchema`: name, key, memberIds?

#### v2.0 (schemas nuevos)

- `createWebhookSubscriptionSchema`: url, events[] (task.created, task.updated, etc.), secret
- `linkGithubRepoSchema`: repoFullName, projectId
- `calendarSyncSettingsSchema`: provider (google|microsoft), syncDeadlines (boolean), createBlocks (boolean)

### 3.4 Permisos (2 capas)

#### MVP

**Capa 1 — Module-level:** Agregar a `module-definitions.ts`:
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
}
```

**Capa 2 — Resource-level:** `ProjectAccessGuard` verifica `ProjectMember.role`:
- **OWNER**: Todo. Único que puede eliminar o transferir.
- **ADMIN**: Editar proyecto, gestionar miembros, CRUD completo de tareas.
- **MEMBER**: Crear tareas, editar tareas propias/asignadas, comentar.
- **VIEWER**: Solo lectura.

Para proyectos PUBLIC: cualquier miembro del tenant puede VIEW.

#### v1.1

- Agregar granular permission `{ key: 'manage-automations', label: 'Gestionar automatizaciones', minLevel: 'MANAGE' }`
- AI features disponibles para MEMBER+ (create/edit access)
- Custom fields: definir requiere ADMIN+, llenar valores requiere MEMBER+

#### v2.0

- Agregar scopes a API keys: `projects:read`, `projects:write`, `tasks:read`, `tasks:write`
- Integration settings requieren OWNER del proyecto o ADMIN del tenant
- Webhook subscriptions requieren MANAGE a nivel de módulo

### 3.5 Eventos de Dominio → Notificaciones

#### MVP

`TaskNotificationListener` escucha eventos via `@OnEvent()`:

| Evento | Destinatarios | Notificación |
|--------|---------------|-------------|
| `task.assigned` | Assignee | "Te asignaron una tarea" |
| `task.status_changed` | Creator + assignees + subscribers | "Tarea marcada como X" |
| `task.comment.created` | Participantes del hilo | "Nuevo comentario en tarea" |
| `task.completed` | Creator (si distinto) | "Tarea completada" |
| `task.due_soon` (cron 9am) | Assignees | "Tarea vence mañana" |
| `task.mentioned` | Mencionado | "@tu en tarea X" |
| `project.member.added` | Nuevo miembro | "Te agregaron al proyecto" |

#### v1.1

| Evento | Destinatarios | Notificación |
|--------|---------------|-------------|
| `task.overdue` (cron 10am) | Assignees + subscribers | "Tarea vencida sin completar" |
| `task.dependency.unblocked` | Assignees de tarea desbloqueada | "Tarea X ya no está bloqueada" |
| `automation.triggered` | Configurable por regla | "Automatización ejecutada: ..." |
| `project.ai.risk_detected` | Project OWNER + ADMIN | "AI detectó riesgo de delay en X tareas" |

#### v2.0

| Evento | Destinatarios | Notificación |
|--------|---------------|-------------|
| `integration.github.pr_merged` | Task assignees | "PR #123 mergeado → tarea marcada como Done" |
| `integration.slack.task_created` | Task creator | "Tarea creada desde Slack" |
| `webhook.delivery.failed` | Webhook owner | "Webhook delivery falló 3 veces" |
| `coach.weekly_report` | Todos los miembros del proyecto | "Reporte semanal de productividad" |

---

## 4. Arquitectura Frontend

### 4.1 Rutas

#### MVP

```
app/(dashboard)/
  projects/
    page.tsx                        # Grid/lista de proyectos
    [projectId]/
      page.tsx                      # Redirect a vista por defecto (board)
      layout.tsx                    # Header + tabs + realtime sync
      board/page.tsx                # Kanban
      list/page.tsx                 # Lista/tabla
      settings/page.tsx             # Config del proyecto (miembros, statuses, labels)
```

#### v1.1

```
app/(dashboard)/
  projects/
    [projectId]/
      timeline/page.tsx             # Gantt/Timeline
      calendar/page.tsx             # Calendario
      settings/
        automations/page.tsx        # Reglas de automatización
        custom-fields/page.tsx      # Campos personalizados
    templates/page.tsx              # Galería de templates
```

#### v2.0

```
app/(dashboard)/
  projects/
    [projectId]/
      settings/
        integrations/page.tsx       # GitHub, Slack, Calendar connections
        webhooks/page.tsx           # Webhook subscriptions
        api/page.tsx                # API keys y documentación
      analytics/page.tsx            # Dashboard de productividad (AI coach)
```

### 4.2 Sidebar Integration

En `nav-main.tsx`, agregar item en la sección principal (sin etiqueta), **después de Calendario y antes de Documentos**:

```
  Inicio
  Asistente
  Calendario
  Proyectos  ← NUEVO
  Documentos
```

```typescript
{ title: "Proyectos", href: "/projects", icon: TaskListIcon, moduleKey: "projects" }
```

### 4.3 Vistas

#### MVP: Board (Kanban)
- `KanbanBoard` → `KanbanColumn` → `KanbanCard`
- `@dnd-kit/core` + `@dnd-kit/sortable` para drag & drop
- Columnas = TaskStatusConfig del proyecto, agrupadas por `category`
- Drag entre columnas = cambiar statusId + position
- Inline task creation (input en footer de columna)
- Card muestra: título, priority badge, assignee avatar, labels, subtask count, due date

#### MVP: Lista
- Tabla con agrupación por status/sección, colapsable
- Inline editing (click-to-edit en título, assignee, due date, priority)
- `@tanstack/react-virtual` para listas largas (ya instalado)
- Columnas configurables: título, status, priority, assignee, due date, labels, estimate
- Drag & drop para reordenar dentro de grupo

#### v1.1: Timeline/Gantt
- Custom con CSS Grid + SVG para flechas de dependencias
- Panel izquierdo (lista de tareas) + derecho (barras temporales) con `react-resizable-panels`
- Zoom: día/semana/mes
- Drag horizontal de barras (cambiar startDate/dueDate)
- Resize de barras (cambiar duración)
- Flechas SVG entre tareas dependientes

#### v1.1: Calendario
- Reutilizar componentes existentes de `components/calendar/` (MonthView, WeekView)
- `TaskEventChip` variante del EventChip existente
- Click en día → crear tarea con dueDate pre-llenado
- Drag tareas entre días para cambiar due date

### 4.4 Task Detail (Sheet)

#### MVP
- `Sheet` de shadcn (side="right", 600px)
- Activado con `?task=[taskId]` en URL (permite back button para cerrar)
- Secciones:
  - Header: título editable inline + status dropdown + priority dropdown + actions menu (duplicate, archive, delete)
  - Field grid: assignees (multi-select con avatar), due date, priority, labels (multi-select badges), section, estimate
  - Descripción: textarea con markdown básico
  - Subtareas: checkbox list + título inline + progress bar (X de Y completadas) + botón "+ Agregar subtarea"
  - Comentarios: lista con avatar + timestamp + hilos (reply) + reacciones emoji
  - Activity log: timeline de cambios (creado, movido, asignado, etc.)
- Lock por campo via sistema de locks existente
- Realtime: suscripción a `entity:updated` para cambios de otros usuarios

#### v1.1 (adiciones al sheet)
- Custom fields section: campos dinámicos renderizados según fieldType
- AI decompose button: botón "Descomponer con AI" que genera subtareas
- AI suggested assignee: sugerencia con contexto del knowledge graph
- Dependencias: sección visual con links a tareas bloqueantes/bloqueadas
- Rich text editor (TipTap) para descripción con formato

#### v2.0 (adiciones al sheet)
- GitHub links: PRs e issues vinculados con status badges
- External links section: enlaces a Slack messages, calendar events
- AI insights: predicción de delay, complejidad estimada

### 4.5 Filtros

#### MVP
- `TaskFilterBar` horizontal sobre las vistas
- Filtros: status (multi), assignee (multi con avatar), priority (multi), due date (range: overdue, today, this week, no date), labels (multi), section
- Serializados en URL search params (patrón existente en accounting/journal)
- `useDebouncedSearch` para búsqueda de texto (ILIKE en título)
- Chips de filtros activos (removibles)

#### v1.1
- Búsqueda semántica (toggle "Búsqueda inteligente" que usa embeddings en vez de ILIKE)
- Filtro por custom fields (dinámico según campos definidos)
- Filtro por dependencias (tareas bloqueadas, tareas sin bloqueo)
- Saved filters: guardar combinación de filtros como vista rápida

#### v2.0
- Filtro cross-project ("Todas mis tareas" con filtros globales)
- Filtro por integración (tareas con PR vinculado, tareas de Slack)

### 4.6 Drag & Drop

#### MVP
- **Librería:** `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` (a instalar)
- **Posicionamiento:** Fractional indexing con `fraci` (a instalar) — O(1) moves, sin reindexar
- **Escenarios:**
  - Board: mover tarjetas entre columnas (cambiar status) y reordenar dentro de columna
  - Lista: reordenar tareas dentro de sección, mover entre secciones
  - Subtareas: reordenar en el detail panel
- **Optimistic updates:** Actualizar UI inmediatamente → POST al server → rollback si error
- **Sync:** Otros usuarios reciben `task:moved` via WebSocket

#### v1.1
- Timeline: drag horizontal de barras (cambiar fechas)
- Timeline: resize de barras (cambiar duración)
- Calendar: drag tareas entre días
- Sidebar: reordenar proyectos (sortOrder)

### 4.7 Componentes Nuevos

#### MVP

```
components/projects/
  board/
    kanban-board.tsx                # Contenedor con scroll horizontal
    kanban-column.tsx               # Columna por status
    kanban-card.tsx                 # Tarjeta de tarea compacta
    kanban-column-header.tsx        # Título, count, menu, botón "+ Tarea"
    kanban-new-task-inline.tsx      # Input inline para crear tarea rápida
  list/
    task-list-view.tsx              # Tabla con agrupación
    task-list-row.tsx               # Fila expandible con inline editing
    task-list-group-header.tsx      # Cabecera de grupo colapsable
    inline-editor.tsx               # Click-to-edit genérico
  detail/
    task-detail-sheet.tsx           # Sheet principal
    task-detail-header.tsx          # Título + status + actions
    task-field-grid.tsx             # Grid de campos (assignee, date, priority, etc.)
    task-description.tsx            # Textarea con markdown
    task-subtasks.tsx               # Lista de subtareas con checkbox
    task-comments.tsx               # Comentarios con hilos
    task-comment-reactions.tsx      # Reacciones emoji en comentarios
    task-activity-log.tsx           # Timeline de cambios
  shared/
    task-filter-bar.tsx             # Barra de filtros horizontal
    task-filter-chip.tsx            # Chip de filtro removible
    task-priority-badge.tsx         # Badge de prioridad con color
    task-status-badge.tsx           # Badge de status con color custom
    task-assignee-avatar.tsx        # Avatar(s) de assignees
    view-switcher.tsx               # Tabs para cambiar entre board/list/etc.
    project-header.tsx              # Header del proyecto (nombre, miembros, filtros)
    create-task-dialog.tsx          # Dialog para crear tarea completa
    create-project-dialog.tsx       # Dialog para crear proyecto
    project-card.tsx                # Card de proyecto en la grid
    project-settings-panel.tsx      # Panel de configuración (miembros, statuses, labels)
```

#### v1.1 (componentes nuevos)

```
components/projects/
  timeline/
    timeline-view.tsx               # Container con eje temporal
    timeline-header.tsx             # Barra de fechas (día/semana/mes)
    timeline-row.tsx                # Fila por tarea
    timeline-bar.tsx                # Barra visual arrastrable
    timeline-dependency-arrow.tsx   # SVG arrow entre tareas dependientes
  calendar/
    task-calendar-view.tsx          # Vista calendario de tareas
    task-event-chip.tsx             # Chip de tarea en calendario
  detail/
    task-custom-fields.tsx          # Campos custom dinámicos
    task-dependencies.tsx           # Sección de dependencias
    task-rich-description.tsx       # TipTap editor (reemplaza textarea)
  shared/
    ai-decompose-button.tsx         # Botón "Descomponer con AI"
    ai-assignee-suggestion.tsx      # Sugerencia de assignee con contexto
    project-summary-card.tsx        # Card con resumen AI del proyecto
    automation-rule-editor.tsx      # Editor visual de reglas
    custom-field-renderer.tsx       # Renderer dinámico por fieldType
    template-gallery.tsx            # Galería de templates de proyecto
    semantic-search-toggle.tsx      # Toggle búsqueda inteligente
```

#### v2.0 (componentes nuevos)

```
components/projects/
  integrations/
    github-link-card.tsx            # PR/issue vinculado con status
    slack-message-card.tsx          # Mensaje de Slack vinculado
    calendar-event-card.tsx         # Evento de calendario vinculado
    integration-connect-card.tsx    # Card para conectar integración
    webhook-subscription-form.tsx   # Form para configurar webhooks
  analytics/
    productivity-dashboard.tsx      # Dashboard AI coach
    team-workload-chart.tsx         # Gráfico de carga por miembro
    velocity-chart.tsx              # Velocidad del equipo over time
    risk-heatmap.tsx                # Heatmap de tareas en riesgo
  shared/
    cross-project-task-list.tsx     # "Todas mis tareas" cross-project
    natural-language-input.tsx      # Input con NLP para crear tareas
```

### 4.8 State Management

Siguiendo patrones existentes:

#### MVP
- **Zustand store** (`stores/project-store.ts`): Para estado RT ephemeral (locks, typing, presencia en el proyecto)
- **API calls via `api.get/post/patch/delete`**: Para operaciones CRUD (patrón existente)
- **Hooks custom**:
  - `useProjectTasks`: fetch + cache de tareas por proyecto
  - `useTaskMutations`: create/update/delete/move con optimistic updates
  - `useTaskFilters`: filtrado client-side + URL sync
  - `useProjectRealtimeSync`: suscripción a room del proyecto + reconciliación de eventos

#### v1.1
- **Hooks nuevos**:
  - `useSemanticSearch`: búsqueda con embeddings + fallback a ILIKE
  - `useTaskAI`: decompose, suggest assignee, project summary
  - `useAutomations`: CRUD de reglas

#### v2.0
- **Hooks nuevos**:
  - `useIntegrations`: estado de conexiones GitHub/Slack/Calendar
  - `useProductivityMetrics`: datos para dashboard analytics

### 4.9 Convenciones a seguir

1. Todos los pages son `"use client"`
2. API calls via `api-client.ts` (no fetch directo)
3. Formularios con `useState` manual (no React Hook Form)
4. Feedback con `sonner` (toast.error/success)
5. Skeleton loading para loading states
6. Iconos de HugeIcons exclusivamente
7. Labels en español, código en inglés
8. Permission guards con `<Can module="projects" action="...">`

### 4.10 Responsive Design

#### MVP
| Viewport | Board | Lista | Detail Panel |
|----------|-------|-------|-------------|
| Desktop (>=1280) | Multi-columna horizontal | Tabla completa | Sheet 600px |
| Tablet (768-1279) | Scroll horizontal, columnas 280px | Tabla simplificada | Sheet full width |
| Mobile (<768) | Una columna a la vez (tabs de status) | Cards stacked | Dialog full screen |

#### v1.1
| Viewport | Timeline | Calendario |
|----------|----------|-----------|
| Desktop (>=1280) | Gantt completo + panel izquierdo | Month/Week view |
| Tablet (768-1279) | Solo barra temporal (sin panel izq) | Week view only |
| Mobile (<768) | No disponible (redirige a lista) | Agenda view (lista por día) |

---

## 5. Tiempo Real

### 5.1 Room Strategy

```
project:{tenantId}:{projectId}                    → Miembros del proyecto
project:{tenantId}:{projectId}:task:{taskId}      → Detalle de tarea abierto
```

Authorization: al hacer `project:join`, el gateway verifica que el usuario es miembro del proyecto (o que el proyecto es PUBLIC y el usuario pertenece al tenant).

### 5.2 WebSocket Events

#### MVP

**Client → Server:**
```typescript
'project:join':  { projectId: string }
'project:leave': { projectId: string }
```

**Server → Client:**
```typescript
// Tarea creada — otros usuarios ven la nueva tarea aparecer en el board/lista
'task:created': { projectId, task: TaskSummary, sectionId, position }

// Tarea actualizada — cualquier campo individual (status, priority, title, assignees, etc.)
'task:changed': { projectId, taskId, changes: Record<string, { from, to }>, version, updatedBy: PresenceUser }

// Tarea movida — drag & drop de otro usuario (sección y/o posición)
'task:moved': { projectId, taskId, fromSectionId, toSectionId, position, movedBy: PresenceUser }

// Tarea eliminada
'task:removed': { projectId, taskId }

// Nuevo comentario en tarea (solo si el usuario tiene el detail sheet abierto)
'task:comment': { projectId, taskId, comment: CommentSummary }

// Sección cambiada (renombrada, reordenada)
'section:changed': { projectId, sectionId, changes: Record<string, unknown> }
```

#### v1.1 (eventos nuevos)

```typescript
// Activity feed item en tiempo real
'project:activity': { projectId, activity: ActivityItem }

// Automatización ejecutada (feedback visual)
'automation:triggered': { projectId, ruleName, taskId, action, result }

// Typing indicator en comentarios (similar al chat existente)
'task:comment:typing': { taskId, user: PresenceUser }
'task:comment:typing:stop': { taskId, userId: string }

// Dependencia resuelta (tarea desbloqueada)
'task:unblocked': { projectId, taskId, unblockedBy: string }
```

#### v2.0 (eventos nuevos)

```typescript
// Integración externa actualizó una tarea
'task:external-update': { projectId, taskId, source: 'github'|'slack'|'calendar', data: unknown }

// Webhook delivery status
'webhook:delivered': { subscriptionId, eventType, statusCode }
'webhook:failed': { subscriptionId, eventType, error: string }
```

### 5.3 Flujo de Eventos

#### MVP

```
Service emite EventEmitter2 ('task.created', payload)
    → RealtimeGateway @OnEvent('task.created')
        → emitToRoom('project:{tenantId}:{projectId}', 'task:created', data)
    → TaskNotificationListener @OnEvent('task.created')
        → NotificationService.notify() → emitToUser() via 'notification:new'
    → TaskActivityService @OnEvent('task.*')
        → Persiste en task_activities
```

#### v1.1

```
Service emite EventEmitter2 ('task.status_changed', payload)
    → (flujo MVP: gateway + notification + activity)
    → TaskAutomationListener @OnEvent('task.status_changed')
        → Evalúa reglas activas del proyecto
        → Si match: ejecuta acción (ej: auto-assign, move, notify)
        → Emite 'automation:triggered' al room del proyecto
```

#### v2.0

```
GitHub Webhook Controller recibe PR merged
    → GitHubSyncService procesa evento
        → Busca tarea vinculada → actualiza status a DONE
        → Emite 'task.updated' (flujo estándar)
        → Emite 'task:external-update' al room del proyecto
    → WebhookDeliveryService
        → Envía POST a URLs suscritas con HMAC-SHA256
        → Emite 'webhook:delivered' o 'webhook:failed'
```

### 5.4 Presencia

#### MVP

Reutiliza el sistema existente sin código nuevo:
- `viewPath: "/projects/{projectId}"` → quién está en el proyecto
- `viewPath: "/projects/{projectId}/task/{taskId}"` → quién está viendo una tarea
- `AvatarStack` en header del proyecto (componente ya existe)
- `OnlineIndicator` junto a assignee avatars en el board

#### v1.1

- Presencia granular: mostrar quién está editando qué campo (via locks existentes)
- Indicador "escribiendo..." en comentarios (reutiliza patrón de chat typing)

#### v2.0

- Cursor awareness en Timeline: ver dónde está haciendo hover/drag otro usuario
- Presencia cross-project en sidebar: dot indicator en proyectos con usuarios activos

### 5.5 Locking

#### MVP

Reutiliza `LockService` existente:
- `entityType: 'Task'`, `fieldName: 'description'|'title'|'dueDate'` etc.
- Lock pessimista: un editor a la vez
- Frontend muestra "Camilo está editando..." con avatar cuando hay lock
- Auto-release al perder focus o cerrar el sheet
- Heartbeat cada 30s para mantener el lock

#### v1.1

- Locking en custom fields: `entityType: 'Task'`, `fieldName: 'custom:{fieldId}'`
- Locking en automations editor para evitar edición simultánea de reglas

#### v2.0

- **Upgrade a CRDT (Yjs)** para descripción rich-text:
  - TipTap + Yjs provider custom sobre Socket.IO
  - Edición simultánea sin locks (multiple cursors)
  - Awareness protocol para mostrar cursor y selección de otros usuarios
  - Offline buffer: operaciones se acumulan y sincronizan al reconectar

### 5.6 Optimistic Updates

#### MVP

Patrón estándar para todas las mutaciones:
1. Actualizar UI inmediatamente (mover card, cambiar badge, etc.)
2. Enviar al server (`api.patch`, `api.post`)
3. Si error → rollback al estado anterior + `toast.error("No se pudo mover la tarea")`
4. Otros usuarios reciben cambio via WebSocket → actualizan su UI
5. Si el cambio vino del mismo usuario (mismo `userId`), ignorar el evento WS (ya tiene el optimistic)

**Fractional indexing para drag & drop:**
```
// Mover tarea entre "a" (position: "a5") y "b" (position: "a8")
// Nueva position: "a6" — UPDATE de 1 solo registro, sin tocar otras filas
```

#### v1.1

- Optimistic updates para custom field values
- Optimistic para dependency add/remove (flechas SVG en timeline)
- Batching: acumular cambios rápidos (ej: mover 3 tareas seguidas) y enviar en lote

#### v2.0

- Offline queue: si no hay conexión, acumular operaciones en memoria y sincronizar al reconectar
- Conflict resolution: si dos usuarios mueven la misma tarea, el server decide y ambos reciben el estado final

### 5.7 Reconexión

#### MVP

Estrategia simple: al reconectar, re-fetch completo de las tareas del proyecto activo.
```typescript
socket.on('connect', () => {
  if (activeProjectId) {
    socket.emit('project:join', { projectId: activeProjectId });
    refetchProjectTasks(activeProjectId);
  }
});
```

#### v1.1

Reconexión inteligente con delta sync:
```typescript
socket.on('connect', () => {
  socket.emit('project:rejoin', {
    projectId: activeProjectId,
    lastKnownVersions: getLocalTaskVersions()  // { taskId: version }
  });
});

socket.on('project:sync', (data: {
  updatedTasks: TaskSummary[];
  deletedTaskIds: string[];
  newTasks: TaskSummary[];
}) => {
  // Merge con cache local — solo actualiza lo que cambió
  applyDelta(data);
});
```

#### v2.0

- Offline detection con service worker
- IndexedDB para persistir estado localmente
- Queue de operaciones pendientes con retry automático
- Visual indicator: "3 cambios pendientes de sincronizar"

---

## 6. AI & Diferenciación

### 6.1 MVP (Día 1)

**F1: AI Task Decomposition**
- Input: título + descripción de tarea padre + contexto del knowledge graph
- Output: Array de subtareas con título, descripción, estimación, assignee sugerido
- Model: gpt-4.1-mini | Feature: "task-decomposition"

**F2: Vinculación con Org Intelligence**
- Relación opcional `orgProjectId` en Project
- Improvements del diagnóstico → tareas con un click
- Problemas detectados → labels/tags automáticos

**F3: AI-Suggested Assignee**
- Buscar en OrgEntity tipo ROLE con relaciones EXECUTES hacia actividades similares
- Cruzar con PersonProfile para personas reales
- Model: gpt-4.1-mini | Feature: "ai-assignee-suggestion"

**F4: Búsqueda Semántica**
- Agregar columna `embedding vector(1536)` al modelo Task (v1.1 real, MVP solo full-text)
- Reutilizar BackgroundQueueService para embedding generation
- Model: text-embedding-3-small | Feature: "task-embedding"

### 6.2 v1.1 (Semana 2)

- **F5**: Resumen inteligente de progreso (project summary card)
- **F6**: Análisis predictivo de delays (score de riesgo por tarea)
- **F7**: Automatizaciones (rules engine: "cuando X → Y", sin AI)
- **F8**: Templates inteligentes desde proyectos anteriores
- **F9**: Chat AI con contexto de proyecto (tools: list_tasks, create_task, update_task)

### 6.3 v2.0 (Futuro)

- F10: Integración GitHub (PRs/issues ↔ tareas)
- F11: Integración Slack (notificaciones + crear tareas desde mensajes)
- F12: Integración Calendar (sync deadlines)
- F13: API Pública (v1-projects, v1-tasks controllers)
- F14: AI Coach de productividad
- F15: Natural language task creation

### 6.4 AI Cost Tracking (OBLIGATORIO)

Toda interacción AI DEBE usar `AiUsageService.logUsage()`:
```typescript
await this.aiUsageService.logUsage({
  provider: 'OPENAI',
  model: 'gpt-4.1-mini',
  feature: 'task-decomposition', // Nuevo feature string
  inputTokens, outputTokens,
  tenantId, userId,
});
```

Features nuevos: `task-decomposition`, `task-embedding`, `project-summary`, `delay-prediction`, `ai-assignee-suggestion`, `template-suggestion`.

---

## 7. Nuevas Dependencias

### MVP

| Package | Uso |
|---------|-----|
| `@dnd-kit/core` | Drag & drop core |
| `@dnd-kit/sortable` | Sortable containers (Kanban, Lista) |
| `@dnd-kit/utilities` | CSS utilities para drag |
| `fraci` | Fractional indexing para posiciones O(1) |

### v1.1

| Package | Uso |
|---------|-----|
| `@tiptap/react` | Rich text editor para descripción de tareas |
| `@tiptap/starter-kit` | Extensions básicos (bold, italic, lists, etc.) |
| `@tiptap/extension-mention` | @mentions en comentarios y descripciones |

### v2.0

| Package | Uso |
|---------|-----|
| `yjs` | CRDT para edición colaborativa |
| `y-protocols` | Awareness protocol (cursores de otros usuarios) |
| `@tiptap/extension-collaboration` | Integración TipTap + Yjs |

**Reutilizar existentes (ya instalados):** `@tanstack/react-virtual`, `react-resizable-panels`, `sonner`, `cmdk`, todos los shadcn/ui components, Socket.IO, Redis, EventEmitter2, Zod, `@hugeicons/react`.

---

## 8. Relaciones User/Tenant (actualizaciones)

### User (nuevas relaciones)
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

### Tenant (nueva relación)
```prisma
projects Project[]
```

### Soft-delete registry
Agregar: `'project'`, `'task'`, `'taskComment'`, `'projectSection'`, `'label'`, `'taskView'`, `'customFieldDefinition'`

---

## 9. Resumen de Modelos

| # | Modelo | Tabla | Fase |
|---|--------|-------|------|
| 1 | Project | projects | MVP |
| 2 | ProjectMember | project_members | MVP |
| 3 | ProjectSection | project_sections | MVP |
| 4 | TaskStatusConfig | task_status_configs | MVP |
| 5 | Task | tasks | MVP |
| 6 | TaskAssignee | task_assignees | MVP |
| 7 | TaskSubscriber | task_subscribers | MVP |
| 8 | TaskDependency | task_dependencies | MVP |
| 9 | Label | labels | MVP |
| 10 | TaskLabel | task_labels | MVP |
| 11 | TaskComment | task_comments | MVP |
| 12 | TaskCommentReaction | task_comment_reactions | MVP |
| 13 | TaskActivity | task_activities | MVP |
| 14 | TaskAttachment | task_attachments | MVP |
| 15 | TaskView | task_views | MVP |
| 16 | CustomFieldDefinition | custom_field_definitions | v1.1 |
| 17 | TaskCustomFieldValue | task_custom_field_values | v1.1 |

**Total: 17 modelos, 6 enums nuevos.**
