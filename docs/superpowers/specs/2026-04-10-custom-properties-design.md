# Custom Properties System — Design Spec

> **Date:** 2026-04-10
> **Status:** Draft
> **Branch:** `feature/custom-properties`

## 1. Overview

A Notion-style custom properties system for project boards (tableros) in Zeru. Board admins can define typed fields per project; every task in that project can hold values for those fields. Custom properties complement the native fields (status, priority, assignees, dueDate, startDate, labels, estimate) — they do not replace them.

**Goals:**
- Flexible per-project schema without changing the core `Task` table
- Eight property types: Text, Number, Select, Multi-select, Date, Person, Checkbox, URL
- Kanban cards show a configurable subset of properties (`isVisible`)
- Filter bar accepts any `isFilterable` property
- EAV storage with typed columns (not a JSON blob) so values are queryable

---

## 2. Data Architecture

### 2.1 New Enum

```prisma
enum PropertyType {
  TEXT
  NUMBER
  SELECT
  MULTI_SELECT
  DATE
  PERSON
  CHECKBOX
  URL

  @@schema("public")
  @@map("property_type")
}
```

### 2.2 ProjectPropertyDefinition

Defines a custom property for a project. Scoped to tenant + project.

```prisma
model ProjectPropertyDefinition {
  id          String       @id @default(uuid())
  name        String                          // Display label, e.g. "Budget"
  type        PropertyType
  /// For SELECT / MULTI_SELECT: JSON array of { id: string, label: string, color: string }
  options     Json?
  sortOrder   Int          @default(0)
  isRequired  Boolean      @default(false)
  isVisible   Boolean      @default(false)   // Show on kanban cards
  isFilterable Boolean     @default(true)    // Show in filter bar
  deletedAt   DateTime?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  tenantId String

  values TaskPropertyValue[]

  @@index([projectId])
  @@index([tenantId])
  @@map("project_property_definitions")
  @@schema("public")
}
```

### 2.3 TaskPropertyValue

Stores a single task's value for one custom property. Uses typed columns instead of a single JSON blob to allow direct SQL filtering.

```prisma
model TaskPropertyValue {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  taskId String
  task   Task   @relation(fields: [taskId], references: [id], onDelete: Cascade)

  propertyDefinitionId String
  propertyDefinition   ProjectPropertyDefinition @relation(
    fields: [propertyDefinitionId],
    references: [id],
    onDelete: Cascade
  )

  /// Populated according to the property's type
  textValue        String?
  numberValue      Float?
  dateValue        DateTime?
  booleanValue     Boolean?
  /// SELECT stores one id; MULTI_SELECT stores multiple ids (from options JSON)
  selectedOptionIds String[]
  /// PERSON stores the userId of a project member
  personUserId     String?
  personUser       User?    @relation("TaskPropertyPersonValues", fields: [personUserId], references: [id], onDelete: SetNull)

  tenantId String

  @@unique([taskId, propertyDefinitionId])
  @@index([propertyDefinitionId])
  @@index([tenantId])
  @@map("task_property_values")
  @@schema("public")
}
```

### 2.4 Additions to existing models

```prisma
// In model Project — add relation:
propertyDefinitions ProjectPropertyDefinition[]

// In model Task — add relation:
propertyValues TaskPropertyValue[]
```

---

## 3. API Endpoints

### 3.1 Property Definitions (managed in project settings)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects/:projectId/properties` | List all definitions (non-deleted), ordered by `sortOrder` |
| `POST` | `/projects/:projectId/properties` | Create a definition |
| `PATCH` | `/projects/:projectId/properties/:id` | Update name, options, flags |
| `DELETE` | `/projects/:projectId/properties/:id` | Soft-delete (sets `deletedAt`); cascades to `TaskPropertyValue` on hard delete |
| `POST` | `/projects/:projectId/properties/reorder` | Update `sortOrder` for multiple definitions in one call |

### 3.2 Task Property Values (inline editing in task drawer)

| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/tasks/:taskId/properties/:propertyId` | Upsert the value for a given property (creates or updates) |
| `DELETE` | `/tasks/:taskId/properties/:propertyId` | Clear a value (deletes the row) |

### 3.3 DTOs (Zod)

```ts
// ─── Definitions ────────────────────────────────────────────

const selectOptionSchema = z.object({
  id:    z.string().uuid(),
  label: z.string().min(1).max(80),
  color: z.string().max(20).default('#6B7280'),
});

export const createPropertyDefinitionSchema = z.object({
  name:         z.string().min(1).max(100),
  type:         z.enum(['TEXT','NUMBER','SELECT','MULTI_SELECT','DATE','PERSON','CHECKBOX','URL']),
  options:      z.array(selectOptionSchema).optional(),
  sortOrder:    z.number().int().optional(),
  isRequired:   z.boolean().default(false),
  isVisible:    z.boolean().default(false),
  isFilterable: z.boolean().default(true),
});

export const updatePropertyDefinitionSchema = z.object({
  name:         z.string().min(1).max(100).optional(),
  options:      z.array(selectOptionSchema).nullable().optional(),
  isRequired:   z.boolean().optional(),
  isVisible:    z.boolean().optional(),
  isFilterable: z.boolean().optional(),
});

export const reorderPropertyDefinitionsSchema = z.object({
  // ordered array of definition ids — new sortOrder = array index
  ids: z.array(z.string().uuid()).min(1),
});

// ─── Values ─────────────────────────────────────────────────

export const setPropertyValueSchema = z.object({
  textValue:         z.string().max(5000).nullable().optional(),
  numberValue:       z.number().nullable().optional(),
  dateValue:         z.string().datetime().nullable().optional(),
  booleanValue:      z.boolean().nullable().optional(),
  selectedOptionIds: z.array(z.string().uuid()).optional(),
  personUserId:      z.string().uuid().nullable().optional(),
});
```

### 3.4 Response shape — property definition

```ts
interface PropertyDefinitionResponse {
  id:           string;
  name:         string;
  type:         PropertyType;
  options:      Array<{ id: string; label: string; color: string }> | null;
  sortOrder:    number;
  isRequired:   boolean;
  isVisible:    boolean;
  isFilterable: boolean;
  createdAt:    string;
  updatedAt:    string;
}
```

### 3.5 Response shape — task property value

```ts
interface TaskPropertyValueResponse {
  id:                  string;
  propertyDefinitionId: string;
  textValue:           string | null;
  numberValue:         number | null;
  dateValue:           string | null;
  booleanValue:        boolean | null;
  selectedOptionIds:   string[];
  personUserId:        string | null;
  personUser:          { id: string; firstName: string; lastName: string } | null;
  updatedAt:           string;
}
```

### 3.6 Task list / detail responses

When fetching tasks (board, list, drawer), include:

```ts
// In Task response envelope — add:
propertyValues: TaskPropertyValueResponse[];
```

The board query should also include `project.propertyDefinitions` so the frontend has the definitions available for column rendering and filter construction without an extra round-trip.

---

## 4. Service Logic

### 4.1 Property Definition service (`ProjectPropertiesService`)

- **Create**: validate that SELECT/MULTI_SELECT have `options`; generate `id` (uuid) for each option server-side before persisting.
- **Update options**: merging logic — existing option ids are preserved (updating label/color); new objects without ids get a generated uuid; options removed from the array are deleted. Tasks that had a removed option in `selectedOptionIds` get that id filtered out via a bulk update.
- **Delete definition**: soft-delete the definition (`deletedAt = now()`). Hard delete is triggered by a nightly cleanup job after 30 days; Prisma cascade handles `TaskPropertyValue` rows automatically.
- **Reorder**: single transaction updating `sortOrder` for all ids in the array using their array index position.

### 4.2 Task property value service (`TaskPropertyValuesService`)

- **Upsert** (`PATCH /tasks/:taskId/properties/:propertyId`): call `prisma.taskPropertyValue.upsert` on the `(taskId, propertyDefinitionId)` unique key. Validate that the definition belongs to the same project as the task. For SELECT, validate that every `selectedOptionId` exists in the definition's `options`. For PERSON, validate that the user is a project member.
- **Clear** (`DELETE`): delete the row; return 204.
- **Validation enforcement**: if `isRequired = true`, the create-task flow should check for values (enforced on the API, not the DB constraint, to keep the schema flexible).

---

## 5. Frontend Types

```ts
// apps/web/types/projects.ts — additions

export type PropertyType =
  | 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT'
  | 'DATE' | 'PERSON' | 'CHECKBOX' | 'URL';

export interface PropertyOption {
  id:    string;
  label: string;
  color: string;
}

export interface ProjectPropertyDefinition {
  id:           string;
  name:         string;
  type:         PropertyType;
  options:      PropertyOption[] | null;
  sortOrder:    number;
  isRequired:   boolean;
  isVisible:    boolean;
  isFilterable: boolean;
  createdAt:    string;
  updatedAt:    string;
}

export interface TaskPropertyValue {
  id:                   string;
  propertyDefinitionId: string;
  textValue:            string | null;
  numberValue:          number | null;
  dateValue:            string | null;
  booleanValue:         boolean | null;
  selectedOptionIds:    string[];
  personUserId:         string | null;
  personUser:           UserSummary | null;
  updatedAt:            string;
}

// Extend Task:
export interface Task {
  // ...existing fields...
  propertyValues?: TaskPropertyValue[];
}

// Extend Project:
export interface Project {
  // ...existing fields...
  propertyDefinitions?: ProjectPropertyDefinition[];
}
```

---

## 6. UI Components

### 6.1 Property Definition Manager
**Location:** Project Settings → Properties tab

- Renders a sorted list of existing custom property definitions.
- Each row shows: drag handle, type icon, name, visibility toggle (`isVisible`), filterable toggle (`isFilterable`), edit button, delete button.
- **Add property** button opens an inline form: name field, type selector (icons + labels), options editor (for SELECT/MULTI_SELECT — add/remove/reorder options with color pickers), required toggle.
- Drag-and-drop reorder calls `POST /projects/:projectId/properties/reorder`.
- Editing an existing definition uses an in-place form (same UI, pre-populated). Changing the `type` of an existing definition is blocked (show an informational tooltip explaining why).

### 6.2 Property Value Renderer
**Location:** Task drawer sidebar, below native properties section

Renders a `<PropertyRow>` per definition, consisting of:
- Left column: property name (truncated, with type icon tooltip)
- Right column: `<PropertyValueEditor>` (see 6.3) or the read-only display value if the user lacks edit permission

Property rows with no value and `isRequired = false` are shown with a muted placeholder ("Empty"). Required properties with no value show a subtle amber highlight.

### 6.3 Property Value Editor (per type)

| Type | Editor component | Notes |
|------|-----------------|-------|
| TEXT | `<input type="text">` (auto-save on blur) | Max 5000 chars |
| NUMBER | `<input type="number">` (auto-save on blur) | Accepts integers and decimals |
| SELECT | Dropdown popover with colored option chips | Single selection; clear button |
| MULTI_SELECT | Multi-select popover with colored chips | Shows selected chips inline on the row |
| DATE | Date picker popover (using existing date picker component) | Displays formatted date |
| PERSON | Member selector popover (reuses existing assignee picker, restricted to project members) | Shows avatar + name |
| CHECKBOX | `<Checkbox>` toggle (immediate save on click) | — |
| URL | `<input type="url">` (validate URL format, auto-save on blur; renders as a link in read mode) | — |

All editors call `PATCH /tasks/:taskId/properties/:propertyId` on commit and `DELETE` when cleared.

### 6.4 Kanban Card Properties
**Location:** Task card on the board view

- Shows only definitions where `isVisible = true`, in `sortOrder`.
- Maximum 3 visible properties on the card to avoid overflow; remaining ones hidden with a `+N` chip.
- Each property renders a compact read-only chip:
  - TEXT: truncated string
  - NUMBER: value with optional unit suffix (future)
  - SELECT / MULTI_SELECT: colored option chip(s)
  - DATE: short formatted date, amber if overdue
  - PERSON: avatar only (with tooltip)
  - CHECKBOX: check icon (checked) or empty square (unchecked)
  - URL: link icon

### 6.5 Filter Bar — Custom Properties
**Location:** Board/List view filter bar, after native filter chips

- For each definition where `isFilterable = true`, a filter chip is available via the "Add filter" popover.
- Filter operators by type:

| Type | Operators |
|------|-----------|
| TEXT | contains, does not contain, is empty, is not empty |
| NUMBER | =, ≠, >, ≥, <, ≤, is empty, is not empty |
| SELECT | is, is not, is empty, is not empty |
| MULTI_SELECT | includes any of, includes all of, is empty, is not empty |
| DATE | is, is before, is after, is between, is empty, is not empty |
| PERSON | is, is not, is empty, is not empty |
| CHECKBOX | is checked, is not checked |
| URL | is empty, is not empty, contains |

- Active custom property filters are serialized into the view's `filters` JSON (same mechanism as existing native filters) using the key pattern `custom_<propertyDefinitionId>`.
- The backend filter resolver reads these keys and constructs Prisma `where` clauses against the `taskPropertyValues` relation using typed column comparisons.

---

## 7. Key Design Decisions

### EAV with typed columns
Instead of a single `value Json` column, `TaskPropertyValue` has separate typed columns (`textValue`, `numberValue`, `dateValue`, `booleanValue`, `selectedOptionIds`, `personUserId`). This allows direct Prisma/SQL filtering without JSON path operators and keeps queries readable. The trade-off is nullable columns for non-applicable types, which is acceptable given the small number of types.

### SELECT options on the definition, not a separate table
Option metadata (`id`, `label`, `color`) lives as a JSON array on `ProjectPropertyDefinition.options`. Tasks store only the selected option ids (`String[]`). This keeps the schema simple: option counts are small (typically < 20), and we avoid an extra join. The drawback — cascading option deletes must be handled in the service layer (filter stale ids from `selectedOptionIds`).

### Soft delete on definitions
Definitions use `deletedAt` rather than hard delete to preserve historical task data and allow accidental-delete recovery within the 30-day window. Soft-deleted definitions are excluded from all API responses but their values remain visible in audit/activity logs.

### Native fields unchanged
`status`, `priority`, `assignees`, `dueDate`, `startDate`, `labels`, and `estimate` remain as first-class columns on `Task`. Custom properties are additive. This avoids migrating existing data and keeps the core task model performant.

### Drawer layout order
Native properties render first (status, priority, assignees, dates, labels, estimate), then a visual divider, then custom properties in `sortOrder`. This gives custom properties a consistent, predictable location.

### isVisible cap at 3 on kanban cards
Showing more than 3 custom properties on a kanban card degrades readability. The system enforces this cap in the UI (additional properties are hidden). Admins can freely set `isVisible = true` on more than 3 definitions, but the card renderer only shows the first 3 by `sortOrder`.

### Changing property type is blocked
Once a definition is created, its `type` is immutable through the UI. A type change would orphan values (e.g., a `numberValue` row becomes meaningless after a type change to TEXT). The correct workflow is to delete and recreate the property, which is surfaced in the edit UI with a tooltip.

---

## 8. Migration Notes

Two new tables require a Prisma migration:

```
npx prisma migrate dev --name add_custom_properties
```

Migration adds:
1. `PropertyType` enum
2. `project_property_definitions` table
3. `task_property_values` table
4. Relation back-references on `projects` and `tasks` tables (no new columns needed — Prisma virtual fields)

No existing data is modified. Migration is non-breaking and can be deployed independently of UI changes.
