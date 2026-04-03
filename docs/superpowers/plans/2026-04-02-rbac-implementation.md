# RBAC Roles & Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded UserRole enum with dynamic tenant-configurable roles. Add module-level permissions with granular overrides. Filter sidebar and protect endpoints by role.

**Architecture:** New Role/RoleModuleAccess/RolePermissionOverride tables. Permission logic in `@zeru/shared`. Backend PermissionGuard reads role from JWT. Frontend usePermissions hook filters sidebar and gates features via `<Can>` component.

**Tech Stack:** Prisma migration with data migration script, NestJS guards/decorators, React hooks, `@zeru/shared` permission helpers

**Spec:** `docs/superpowers/specs/2026-04-01-rbac-roles-permissions-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `apps/api/prisma/schema.prisma` | Modify | Add Role, RoleModuleAccess, RolePermissionOverride, AccessLevel enum; change UserTenant |
| `packages/shared/src/permissions/module-definitions.ts` | Create | Module definitions with granular permissions |
| `packages/shared/src/permissions/helpers.ts` | Create | canAccessModule(), hasPermission() functions |
| `packages/shared/src/permissions/index.ts` | Create | Barrel export |
| `packages/shared/src/types/user.ts` | Modify | Update UserRole → role slug, add permission types |
| `packages/shared/src/index.ts` | Modify | Export permissions |
| `apps/api/src/common/decorators/require-permission.decorator.ts` | Create | @RequirePermission(module, action) |
| `apps/api/src/common/guards/permission.guard.ts` | Create | PermissionGuard |
| `apps/api/src/modules/auth/auth.service.ts` | Modify | JWT payload: role → roleId, add my-permissions |
| `apps/api/src/modules/auth/auth.controller.ts` | Modify | Add GET /auth/my-permissions endpoint |
| `apps/api/src/modules/roles/roles.service.ts` | Create | CRUD + seed roles |
| `apps/api/src/modules/roles/roles.module.ts` | Create | RolesModule |
| `apps/api/src/modules/roles/roles.controller.ts` | Create | Roles API endpoints |
| `apps/web/hooks/use-permissions.ts` | Create | usePermissions hook |
| `apps/web/components/shared/can.tsx` | Create | `<Can>` gating component |
| `apps/web/components/layouts/nav-main.tsx` | Modify | Add moduleKey + filter by permissions |

---

### Task 1: Schema Migration + Seed Script

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add AccessLevel enum and new models**

Add to schema.prisma (before the User model):

```prisma
enum AccessLevel {
  NONE
  VIEW
  EDIT
  MANAGE
}

model Role {
  id          String    @id @default(uuid())
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  slug        String
  description String?
  isSystem    Boolean   @default(false)
  isDefault   Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  moduleAccess  RoleModuleAccess[]
  overrides     RolePermissionOverride[]
  members       UserTenant[]

  @@unique([tenantId, slug])
  @@index([tenantId])
  @@map("roles")
}

model RoleModuleAccess {
  id          String      @id @default(uuid())
  roleId      String
  role        Role        @relation(fields: [roleId], references: [id], onDelete: Cascade)
  moduleKey   String
  accessLevel AccessLevel @default(NONE)

  @@unique([roleId, moduleKey])
  @@index([roleId])
  @@map("role_module_access")
}

model RolePermissionOverride {
  id         String  @id @default(uuid())
  roleId     String
  role       Role    @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission String
  granted    Boolean

  @@unique([roleId, permission])
  @@index([roleId])
  @@map("role_permission_overrides")
}
```

Add `roles Role[]` relation to the Tenant model.

- [ ] **Step 2: Change UserTenant to use roleId**

In the UserTenant model, change:
```prisma
// REMOVE: role UserRole @default(OWNER)
// ADD:
roleId    String?
role      Role?     @relation(fields: [roleId], references: [id])
```

Note: `roleId` is nullable temporarily to allow the migration to run. After data migration, it becomes required.

Keep the `UserRole` enum for now — we'll remove it after data migration.

- [ ] **Step 3: Create migration (schema only, no data yet)**

```bash
cd apps/api && npx prisma migrate dev --name add_rbac_roles --create-only
```

- [ ] **Step 4: Add data migration SQL to the migration file**

Append to the generated migration SQL:

```sql
-- Seed default roles for each existing tenant
INSERT INTO roles (id, "tenantId", name, slug, description, "isSystem", "isDefault", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(), t.id, 'Propietario', 'owner', 'Acceso total al sistema', true, false, NOW(), NOW()
FROM tenants t;

INSERT INTO roles (id, "tenantId", name, slug, description, "isSystem", "isDefault", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(), t.id, 'Administrador', 'admin', 'Gestión operativa completa', true, false, NOW(), NOW()
FROM tenants t;

INSERT INTO roles (id, "tenantId", name, slug, description, "isSystem", "isDefault", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(), t.id, 'Gerente de Finanzas', 'finance-manager', 'Ciclo financiero completo', true, false, NOW(), NOW()
FROM tenants t;

INSERT INTO roles (id, "tenantId", name, slug, description, "isSystem", "isDefault", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(), t.id, 'Contador', 'accountant', 'Contabilidad y reportes financieros', true, false, NOW(), NOW()
FROM tenants t;

INSERT INTO roles (id, "tenantId", name, slug, description, "isSystem", "isDefault", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(), t.id, 'Observador', 'viewer', 'Solo lectura', true, true, NOW(), NOW()
FROM tenants t;

-- Seed module access for owner and admin roles (all modules MANAGE)
INSERT INTO role_module_access (id, "roleId", "moduleKey", "accessLevel")
SELECT gen_random_uuid(), r.id, m.key, 'MANAGE'
FROM roles r
CROSS JOIN (VALUES
  ('dashboard'),('assistant'),('calendar'),('documents'),
  ('clients'),('collections'),('invoicing'),('accounting'),
  ('directory'),('orgchart'),('org-intelligence'),
  ('lab-reception'),('lab-processing'),('lab-reports'),('lab-coding'),
  ('linkedin'),('integrations'),('reports'),('admin'),('settings')
) AS m(key)
WHERE r.slug IN ('owner', 'admin');

-- Migrate existing UserTenant.role enum to roleId
UPDATE user_tenants ut
SET "roleId" = r.id
FROM roles r
WHERE r."tenantId" = ut."tenantId"
AND r.slug = LOWER(ut.role::text);
```

- [ ] **Step 5: Apply migration**

```bash
cd apps/api && npx prisma migrate dev
```

- [ ] **Step 6: Generate client**

```bash
cd apps/api && npx prisma generate
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/ && git commit -m "feat: add RBAC schema with Role, ModuleAccess, PermissionOverride tables"
```

---

### Task 2: Shared Permission Types and Helpers

**Files:**
- Create: `packages/shared/src/permissions/module-definitions.ts`
- Create: `packages/shared/src/permissions/helpers.ts`
- Create: `packages/shared/src/permissions/index.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create module-definitions.ts**

Create `packages/shared/src/permissions/module-definitions.ts` with the full `MODULE_DEFINITIONS` array and types (`AccessLevel`, `SidebarSection`, `GranularPermission`, `ModuleDefinition`) as defined in the spec section 4. Also add `ROUTE_MODULE_MAP` from spec section 8.4.

- [ ] **Step 2: Create helpers.ts**

Create `packages/shared/src/permissions/helpers.ts` with `canAccessModule()` and `hasPermission()` functions as defined in spec section 5.

- [ ] **Step 3: Create index.ts barrel**

```typescript
export * from './module-definitions';
export * from './helpers';
```

- [ ] **Step 4: Export from shared index**

In `packages/shared/src/index.ts`, add:
```typescript
export * from './permissions';
```

- [ ] **Step 5: Build shared**

```bash
cd packages/shared && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/ && git commit -m "feat: add permission module definitions and helpers to shared"
```

---

### Task 3: Backend — Decorator, Guard, and my-permissions Endpoint

**Files:**
- Create: `apps/api/src/common/decorators/require-permission.decorator.ts`
- Create: `apps/api/src/common/guards/permission.guard.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts` — add getMyPermissions method
- Modify: `apps/api/src/modules/auth/auth.controller.ts` — add GET /auth/my-permissions
- Modify: `apps/api/src/app.module.ts` — register PermissionGuard globally

- [ ] **Step 1: Create RequirePermission decorator**

```typescript
// apps/api/src/common/decorators/require-permission.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';

export interface RequiredPermission {
  module: string;
  action: string;
}

export const RequirePermission = (module: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { module, action });
```

- [ ] **Step 2: Create PermissionGuard**

Create `apps/api/src/common/guards/permission.guard.ts`. The guard:
1. Reads `required_permission` metadata via Reflector
2. If no metadata, allows access (backward compatible)
3. Gets `userId` and `tenantId` from `request.user` (JWT)
4. Queries UserTenant → Role → moduleAccess + overrides (cached in Map with 5 min TTL)
5. Calls `hasPermission()` from `@zeru/shared`
6. Throws ForbiddenException if denied

- [ ] **Step 3: Add getMyPermissions to AuthService**

Add method that returns the current user's role with moduleAccess and overrides for the active tenant.

- [ ] **Step 4: Add GET /auth/my-permissions endpoint**

In auth.controller.ts, add:
```typescript
@Get('my-permissions')
@UseGuards(JwtAuthGuard, TenantGuard)
async getMyPermissions(@CurrentUser('userId') userId: string, @CurrentTenant() tenantId: string) {
  return this.authService.getMyPermissions(userId, tenantId);
}
```

- [ ] **Step 5: Update JWT payload**

In auth.service.ts, where the JWT is created (login, switchTenant), add `roleId` to the payload alongside the existing `role` field for backward compatibility.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ && git commit -m "feat: add PermissionGuard, RequirePermission decorator, and my-permissions endpoint"
```

---

### Task 4: Frontend — usePermissions Hook, Can Component, Sidebar Filtering

**Files:**
- Create: `apps/web/hooks/use-permissions.ts`
- Create: `apps/web/components/shared/can.tsx`
- Modify: `apps/web/components/layouts/nav-main.tsx`

- [ ] **Step 1: Create usePermissions hook**

```typescript
// apps/web/hooks/use-permissions.ts
```
- Fetches `GET /auth/my-permissions` on mount
- Caches result in state
- Exposes `can(module, action)` and `canAccess(module)` using shared helpers
- Re-fetches on tenant change
- Returns `loading` state

- [ ] **Step 2: Create Can component**

```typescript
// apps/web/components/shared/can.tsx
```
- Takes `module`, `action`, `children`, optional `fallback`
- Uses `usePermissions().can(module, action)`
- Renders children if allowed, fallback if not (default: null)

- [ ] **Step 3: Add moduleKey to nav items and filter sidebar**

In `nav-main.tsx`:
- Add `moduleKey?: string` to `NavItem` interface
- Add `moduleKey` to each nav item in `appNavSections` (mapping to module definitions)
- In `NavMain` component, use `usePermissions()` to filter items and sections
- Items without `moduleKey` are always visible (core tools)
- Sections with no visible items are hidden

- [ ] **Step 4: Commit**

```bash
git add apps/web/ && git commit -m "feat: add usePermissions hook, Can component, and sidebar permission filtering"
```

---

### Task 5: Roles API (CRUD + Seed on Tenant Creation)

**Files:**
- Create: `apps/api/src/modules/roles/roles.service.ts`
- Create: `apps/api/src/modules/roles/roles.module.ts`
- Create: `apps/api/src/modules/roles/roles.controller.ts`
- Modify: `apps/api/src/modules/tenants/tenants.service.ts` — seed roles on tenant creation
- Modify: `apps/api/src/app.module.ts` — import RolesModule

- [ ] **Step 1: Create RolesService**

CRUD methods: `findAll(tenantId)`, `findOne(tenantId, id)`, `create(tenantId, dto)`, `update(tenantId, id, dto)`, `delete(tenantId, id)`. Plus `seedDefaultRoles(tenantId)` that creates the 5 standard roles with their module access.

- [ ] **Step 2: Create RolesController**

Endpoints:
- `GET /roles` — list roles for tenant
- `GET /roles/:id` — get role with moduleAccess and overrides
- `POST /roles` — create custom role
- `PATCH /roles/:id` — update role (name, moduleAccess, overrides)
- `DELETE /roles/:id` — delete role (not isSystem)

- [ ] **Step 3: Create RolesModule and register**

- [ ] **Step 4: Seed roles on tenant creation**

In `tenants.service.ts`, after creating a tenant, call `rolesService.seedDefaultRoles(tenantId)`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ && git commit -m "feat: add Roles CRUD API and seed on tenant creation"
```

---

### Task 6: Update User Management to Use Roles

**Files:**
- Modify: `apps/api/src/modules/users/users.service.ts` — use roleId instead of enum
- Modify: `apps/web/app/(dashboard)/settings/users/page.tsx` — role dropdown uses roles from API
- Modify: `packages/shared/src/types/user.ts` — update types

- [ ] **Step 1: Update shared types**

In `packages/shared/src/types/user.ts`, keep `UserRole` type for backward compat but add:
```typescript
export interface RoleInfo {
  id: string;
  name: string;
  slug: string;
}
```

Update `UserInTenant` to include `role: RoleInfo`.

- [ ] **Step 2: Update users.service.ts**

When creating users, assign the default role (isDefault=true) for the tenant instead of hardcoded VIEWER enum.

- [ ] **Step 3: Update settings/users page**

Fetch roles from `GET /roles` and use as options in the role dropdown instead of hardcoded enum values.

- [ ] **Step 4: Commit**

```bash
git add apps/ packages/shared/ && git commit -m "feat: update user management to use dynamic roles"
```

---

### Task 7: Lint and Verify

- [ ] **Step 1: pnpm lint** — fix any errors
- [ ] **Step 2: cd apps/api && npx nest build** — verify API builds
- [ ] **Step 3: cd packages/shared && pnpm build** — verify shared builds
- [ ] **Step 4: Final commit if needed**
