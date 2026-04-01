# Sistema de Roles y Permisos (RBAC) para Zeru

**Fecha:** 2026-04-01
**Estado:** Aprobado
**Contexto:** Zeru es un ERP modular multi-tenant. Cada tenant puede activar módulos verticales (Laboratorio, Ecommerce, etc.) además de los módulos horizontales estándar (Contabilidad, Cobranzas, Facturación). Los roles y permisos deben ser configurables por cada tenant.

---

## 1. Problema

Actualmente todos los usuarios ven todos los módulos y pueden ejecutar todas las acciones. Los 4 roles existentes (`OWNER`, `ADMIN`, `ACCOUNTANT`, `VIEWER`) están definidos como enum en Prisma y viajan en el JWT, pero no se verifican en ningún endpoint ni se usan para filtrar la UI.

## 2. Decisiones de diseño

1. **Roles dinámicos por tenant** en vez de enum hardcodeado. Cada tenant puede crear, editar y eliminar roles propios.
2. **Permisos por módulo con override granular** (Opción C): una matriz simple de acceso por módulo (`NONE/VIEW/EDIT/MANAGE`) como base, con overrides para permisos específicos dentro de cada módulo.
3. **Definición de módulos y permisos granulares en código** (`packages/shared`), compartida entre frontend y backend.
4. **Roles estándar ERP como seed**, no roles de vertical (esos los define cada tenant cuando active el módulo).
5. **UX de 3 niveles**: ocultar secciones sin acceso, ocultar items sin acceso, deshabilitar acciones sin permiso (con tooltip explicativo).
6. **Sin dependencias externas** (CASL, etc.) en esta etapa.

## 3. Modelo de datos

### 3.1 Migración: Enum → Tabla

El enum `UserRole` de Prisma se reemplaza por una tabla `Role`. La relación `UserTenant.role` (enum) se reemplaza por `UserTenant.roleId` (FK → Role).

### 3.2 Nuevas tablas

```prisma
model Role {
  id          String    @id @default(uuid())
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id])
  name        String    // "Contador", "Gerente de Finanzas"
  slug        String    // "accountant", "finance-manager"
  description String?
  isSystem    Boolean   @default(false)  // no se puede eliminar
  isDefault   Boolean   @default(false)  // se asigna a nuevos usuarios
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  moduleAccess  RoleModuleAccess[]
  overrides     RolePermissionOverride[]
  members       UserTenant[]

  @@unique([tenantId, slug])
}

model RoleModuleAccess {
  id          String      @id @default(uuid())
  roleId      String
  role        Role        @relation(fields: [roleId], references: [id], onDelete: Cascade)
  moduleKey   String      // "accounting", "collections", "invoicing", etc.
  accessLevel AccessLevel @default(NONE)

  @@unique([roleId, moduleKey])
}

model RolePermissionOverride {
  id         String  @id @default(uuid())
  roleId     String
  role       Role    @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission String  // "accounting:close-period", "invoicing:emit-dte"
  granted    Boolean // true = forzar acceso, false = denegar

  @@unique([roleId, permission])
}

enum AccessLevel {
  NONE
  VIEW
  EDIT
  MANAGE
}
```

### 3.3 Cambio en UserTenant

```prisma
model UserTenant {
  id        String   @id @default(uuid())
  // ANTES: role UserRole @default(OWNER)
  // DESPUÉS:
  roleId    String
  role      Role     @relation(fields: [roleId], references: [id])
  isActive  Boolean  @default(true)
  userId    String
  tenantId  String

  @@unique([userId, tenantId])
}
```

### 3.4 Eliminación del enum UserRole

El enum `UserRole` se elimina de Prisma. Las referencias en `packages/shared/src/types/user.ts` se actualizan para usar el slug del rol en vez del enum.

## 4. Definición de módulos y permisos granulares

Vive en `packages/shared` como constantes. Cada módulo declara sus permisos granulares y el nivel de acceso mínimo que los incluye automáticamente.

```typescript
// packages/shared/src/permissions/module-definitions.ts

export type AccessLevel = 'NONE' | 'VIEW' | 'EDIT' | 'MANAGE';

export type SidebarSection = 'core' | 'business' | 'people' | 'laboratory' | 'marketing' | 'system';

export interface GranularPermission {
  key: string;           // "close-period"
  label: string;         // "Cerrar período"
  description?: string;
  minLevel: AccessLevel; // nivel mínimo que lo incluye automáticamente
}

export interface ModuleDefinition {
  key: string;           // "accounting"
  label: string;         // "Contabilidad"
  section: SidebarSection;
  granularPermissions: GranularPermission[];
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  // ── Core ──
  { key: 'dashboard',   label: 'Inicio',       section: 'core', granularPermissions: [] },
  { key: 'assistant',   label: 'Asistente IA',  section: 'core', granularPermissions: [] },
  { key: 'calendar',    label: 'Calendario',    section: 'core', granularPermissions: [] },
  { key: 'documents',   label: 'Documentos',    section: 'core', granularPermissions: [] },

  // ── Negocio ──
  {
    key: 'clients', label: 'Clientes', section: 'business',
    granularPermissions: [
      { key: 'create',          label: 'Crear clientes',              minLevel: 'EDIT' },
      { key: 'edit',            label: 'Editar clientes',             minLevel: 'EDIT' },
      { key: 'delete',          label: 'Eliminar clientes',           minLevel: 'MANAGE' },
      { key: 'manage-profile',  label: 'Configurar perfil cobranza',  minLevel: 'MANAGE' },
      { key: 'manage-contracts', label: 'Gestionar contratos',        minLevel: 'MANAGE' },
    ],
  },
  {
    key: 'collections', label: 'Cobranzas', section: 'business',
    granularPermissions: [
      { key: 'create-liquidation',  label: 'Crear liquidación',   minLevel: 'EDIT' },
      { key: 'approve-liquidation', label: 'Aprobar liquidación',  minLevel: 'MANAGE' },
      { key: 'void-liquidation',    label: 'Anular liquidación',   minLevel: 'MANAGE' },
      { key: 'register-payment',    label: 'Registrar pago',       minLevel: 'EDIT' },
      { key: 'export',              label: 'Exportar datos',       minLevel: 'VIEW' },
    ],
  },
  {
    key: 'invoicing', label: 'Facturación', section: 'business',
    granularPermissions: [
      { key: 'emit-dte',   label: 'Emitir DTE',          minLevel: 'MANAGE' },
      { key: 'void-dte',   label: 'Anular DTE',          minLevel: 'MANAGE' },
      { key: 'manage-caf', label: 'Configurar folios CAF', minLevel: 'MANAGE' },
    ],
  },
  {
    key: 'accounting', label: 'Contabilidad', section: 'business',
    granularPermissions: [
      { key: 'create-entry',   label: 'Crear asientos',    minLevel: 'EDIT' },
      { key: 'edit-entry',     label: 'Editar asientos',   minLevel: 'EDIT' },
      { key: 'reverse-entry',  label: 'Reversar asientos', minLevel: 'MANAGE' },
      { key: 'close-period',   label: 'Cerrar período',    minLevel: 'MANAGE' },
      { key: 'reopen-period',  label: 'Reabrir período',   minLevel: 'MANAGE' },
    ],
  },

  // ── Personas ──
  { key: 'directory',        label: 'Directorio',          section: 'people', granularPermissions: [] },
  { key: 'orgchart',         label: 'Organigrama',         section: 'people', granularPermissions: [] },
  {
    key: 'org-intelligence', label: 'Inteligencia Org.', section: 'people',
    granularPermissions: [
      { key: 'create-project',   label: 'Crear proyectos',      minLevel: 'EDIT' },
      { key: 'conduct-interview', label: 'Realizar entrevistas', minLevel: 'EDIT' },
      { key: 'export',           label: 'Exportar diagnóstico',  minLevel: 'MANAGE' },
    ],
  },

  // ── Laboratorio ──
  {
    key: 'lab-reception', label: 'Recepción', section: 'laboratory',
    granularPermissions: [
      { key: 'register-sample', label: 'Registrar muestras',  minLevel: 'EDIT' },
      { key: 'print-labels',    label: 'Imprimir etiquetas',  minLevel: 'VIEW' },
      { key: 'delete-order',    label: 'Eliminar órdenes',    minLevel: 'MANAGE' },
    ],
  },
  {
    key: 'lab-processing', label: 'Procesamiento', section: 'laboratory',
    granularPermissions: [
      { key: 'update-status',  label: 'Actualizar estado muestra', minLevel: 'EDIT' },
      { key: 'enter-results',  label: 'Ingresar resultados',       minLevel: 'EDIT' },
    ],
  },
  {
    key: 'lab-reports', label: 'Informes', section: 'laboratory',
    granularPermissions: [
      { key: 'create-draft',   label: 'Crear borrador',    minLevel: 'EDIT' },
      { key: 'sign-report',    label: 'Firmar informe',    minLevel: 'MANAGE' },
      { key: 'reject-report',  label: 'Rechazar informe',  minLevel: 'MANAGE' },
      { key: 'export-report',  label: 'Exportar informes', minLevel: 'VIEW' },
    ],
  },
  {
    key: 'lab-coding', label: 'Codificación', section: 'laboratory',
    granularPermissions: [
      { key: 'assign-code',    label: 'Asignar códigos',       minLevel: 'EDIT' },
      { key: 'manage-rules',   label: 'Gestionar reglas',      minLevel: 'MANAGE' },
      { key: 'validate-batch', label: 'Validar codificación',  minLevel: 'MANAGE' },
    ],
  },

  // ── Marketing ──
  {
    key: 'linkedin', label: 'LinkedIn', section: 'marketing',
    granularPermissions: [
      { key: 'create-post', label: 'Crear posts',    minLevel: 'EDIT' },
      { key: 'publish',     label: 'Publicar posts',  minLevel: 'MANAGE' },
      { key: 'configure',   label: 'Configuración',   minLevel: 'MANAGE' },
    ],
  },

  // ── Sistema ──
  { key: 'integrations', label: 'Integraciones', section: 'system', granularPermissions: [] },
  { key: 'reports',      label: 'Reportes',      section: 'system', granularPermissions: [] },
  {
    key: 'admin', label: 'Administración', section: 'system',
    granularPermissions: [
      { key: 'view-costs',    label: 'Ver costos IA',     minLevel: 'VIEW' },
      { key: 'manage-pricing', label: 'Gestionar precios', minLevel: 'MANAGE' },
    ],
  },
  {
    key: 'settings', label: 'Configuración', section: 'system',
    granularPermissions: [
      { key: 'manage-users', label: 'Gestionar usuarios', minLevel: 'MANAGE' },
      { key: 'manage-roles', label: 'Gestionar roles',    minLevel: 'MANAGE' },
      { key: 'manage-org',   label: 'Configurar organización', minLevel: 'MANAGE' },
    ],
  },
];
```

## 5. Lógica de resolución de permisos

```typescript
// packages/shared/src/permissions/helpers.ts

const LEVEL_HIERARCHY: Record<AccessLevel, number> = {
  NONE: 0, VIEW: 1, EDIT: 2, MANAGE: 3,
};

/**
 * Verifica si un rol puede acceder a un módulo (al menos VIEW).
 * Usado para filtrar el sidebar.
 */
export function canAccessModule(
  moduleAccess: { moduleKey: string; accessLevel: AccessLevel }[],
  moduleKey: string,
): boolean {
  const access = moduleAccess.find((a) => a.moduleKey === moduleKey);
  if (!access) return false;
  return LEVEL_HIERARCHY[access.accessLevel] >= LEVEL_HIERARCHY.VIEW;
}

/**
 * Verifica si un rol tiene un permiso específico, considerando:
 * 1. El accessLevel del módulo
 * 2. El minLevel del permiso granular
 * 3. Los overrides
 */
export function hasPermission(
  moduleAccess: { moduleKey: string; accessLevel: AccessLevel }[],
  overrides: { permission: string; granted: boolean }[],
  moduleKey: string,
  permissionKey: string,
): boolean {
  // Permiso base del módulo (ej: "accounting:view" = moduleKey + nivel)
  if (permissionKey === 'view') {
    return canAccessModule(moduleAccess, moduleKey);
  }

  // Buscar override explícito
  const fullPermission = `${moduleKey}:${permissionKey}`;
  const override = overrides.find((o) => o.permission === fullPermission);
  if (override !== undefined) return override.granted;

  // Sin override: verificar si el accessLevel cubre el minLevel del permiso
  const access = moduleAccess.find((a) => a.moduleKey === moduleKey);
  if (!access) return false;

  const moduleDef = MODULE_DEFINITIONS.find((m) => m.key === moduleKey);
  if (!moduleDef) return false;

  const perm = moduleDef.granularPermissions.find((p) => p.key === permissionKey);
  if (!perm) return false;

  return LEVEL_HIERARCHY[access.accessLevel] >= LEVEL_HIERARCHY[perm.minLevel];
}
```

## 6. Roles estándar ERP (seed)

Al crear un tenant, se siembran 5 roles con `isSystem: true`:

### owner
- **Nombre:** Propietario
- **Matriz:** Todos los módulos en `MANAGE`
- **Overrides:** Ninguno
- **isDefault:** false

### admin
- **Nombre:** Administrador
- **Matriz:** Todos los módulos en `MANAGE`
- **Overrides:** Ninguno
- **isDefault:** false

### finance-manager
- **Nombre:** Gerente de Finanzas
- **Matriz:** dashboard: VIEW, assistant: EDIT, calendar: EDIT, documents: EDIT, clients: EDIT, collections: MANAGE, invoicing: MANAGE, accounting: MANAGE, reports: VIEW, admin: VIEW
- **Overrides:** Ninguno
- **isDefault:** false

### accountant
- **Nombre:** Contador
- **Matriz:** dashboard: VIEW, assistant: VIEW, calendar: EDIT, documents: VIEW, clients: VIEW, collections: VIEW, invoicing: VIEW, accounting: EDIT, reports: VIEW
- **Overrides:** `accounting:close-period → false`, `accounting:reopen-period → false`
- **isDefault:** false

### viewer
- **Nombre:** Observador
- **Matriz:** dashboard: VIEW, assistant: VIEW, calendar: VIEW, documents: VIEW, clients: VIEW, collections: VIEW, invoicing: VIEW, accounting: VIEW, directory: VIEW, orgchart: VIEW, reports: VIEW
- **Overrides:** Ninguno
- **isDefault:** true

## 7. Enforcement en Backend (NestJS)

### 7.1 Decorador

```typescript
// apps/api/src/common/decorators/require-permission.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';

export interface RequiredPermission {
  module: string;
  action: string; // 'view' | 'edit' | 'manage' | permiso granular
}

export const RequirePermission = (module: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { module, action });
```

### 7.2 Guard

```typescript
// apps/api/src/common/guards/permission.guard.ts
```

El guard:
1. Lee el metadata `required_permission` del handler
2. Si no hay metadata, permite el acceso (backward compatible)
3. Obtiene el `roleId` del usuario en el tenant actual (desde `UserTenant`)
4. Busca el `Role` con sus `moduleAccess` y `overrides` (cacheado 5 min)
5. Llama a `hasPermission()` de `@zeru/shared`
6. Retorna 403 si no tiene permiso

### 7.3 Registro global

El `PermissionGuard` se registra como guard global en `app.module.ts` junto con `JwtAuthGuard` y `TenantGuard`. Los endpoints solo necesitan el decorador `@RequirePermission()`.

### 7.4 Uso en controllers

```typescript
@Controller('accounting/journal-entries')
export class JournalEntriesController {
  @Get()
  @RequirePermission('accounting', 'view')
  findAll() { ... }

  @Post()
  @RequirePermission('accounting', 'create-entry')
  create() { ... }

  @Post(':id/reverse')
  @RequirePermission('accounting', 'reverse-entry')
  reverse() { ... }
}
```

### 7.5 Endpoint de permisos del usuario

```
GET /auth/my-permissions
→ Response: {
    role: { id, name, slug },
    moduleAccess: [{ moduleKey, accessLevel }],
    overrides: [{ permission, granted }],
  }
```

Usado por el frontend para resolver permisos sin replicar la lógica de DB.

## 8. Enforcement en Frontend (Next.js)

### 8.1 Hook usePermissions

```typescript
// apps/web/hooks/use-permissions.ts
```

- Llama a `GET /auth/my-permissions` y cachea el resultado
- Expone `can(module, action)` y `canAccess(module)` usando las funciones de `@zeru/shared`
- Se invalida al cambiar de tenant

### 8.2 Filtrado del sidebar

En `nav-main.tsx`:
- Cada `NavItem` recibe una propiedad `moduleKey?: string` que mapea al `ModuleDefinition.key`
- Al renderizar, se filtran items donde `canAccess(item.moduleKey) === false`
- Si todos los items de una sección son filtrados, la sección completa desaparece
- Items sin `moduleKey` son siempre visibles (ej: items de core que todos ven)

### 8.3 Componente Can

```tsx
// apps/web/components/shared/can.tsx
interface CanProps {
  module: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;  // por defecto: null (ocultar)
}
```

Para acciones deshabilitadas, el fallback muestra el mismo botón pero con `disabled` y tooltip:

```tsx
<Can module="accounting" action="close-period"
     fallback={
       <Tooltip content="Requiere permiso: Cerrar período">
         <Button disabled>Cerrar Período</Button>
       </Tooltip>
     }>
  <Button onClick={closePeriod}>Cerrar Período</Button>
</Can>
```

### 8.4 Middleware de Next.js

El middleware decodifica el JWT y verifica acceso al módulo de la ruta. Si no tiene acceso, redirige a una página 403 con mensaje claro y botón "Volver al inicio".

Mapeo ruta → módulo via `ROUTE_MODULE_MAP`:

```typescript
export const ROUTE_MODULE_MAP: Record<string, string> = {
  '/clients': 'clients',
  '/collections': 'collections',
  '/invoicing': 'invoicing',
  '/accounting': 'accounting',
  '/personas/directorio': 'directory',
  '/personas/organigrama': 'orgchart',
  '/org-intelligence': 'org-intelligence',
  '/laboratory/reception': 'lab-reception',
  '/laboratory/processing': 'lab-processing',
  '/laboratory/reports': 'lab-reports',
  '/laboratory/coding': 'lab-coding',
  '/linkedin': 'linkedin',
  '/integrations': 'integrations',
  '/reports': 'reports',
  '/admin': 'admin',
  '/settings': 'settings',
};
```

## 9. UI de gestión de roles

**Ubicación:** Configuración > Roles (nueva pestaña/página)

### 9.1 Lista de roles
- Tabla con nombre, descripción, cantidad de usuarios, badge "Sistema" si `isSystem`
- Botón "Crear rol"
- Click en un rol abre el editor

### 9.2 Editor de rol
- Campos: nombre, slug (auto-generado), descripción
- **Matriz de acceso:** tabla de módulos × niveles (radio buttons: Sin acceso / Ver / Editar / Admin)
- Cada fila de módulo tiene un botón "Ajustes" que expande los permisos granulares
- Los permisos granulares se muestran como checkboxes. Los que están incluidos en el nivel base aparecen checked y con label "(incluido en [nivel])". Unchecking crea un override `granted: false`. Checking uno no incluido crea un override `granted: true`.
- Los módulos se agrupan por sección (Negocio, Personas, Laboratorio, etc.)

### 9.3 Asignación de rol a usuario
- En la ficha de cada usuario (Configuración > Usuarios), un select para elegir el rol
- Reemplaza el actual select de enum `UserRole`

## 10. Migración del sistema actual

### 10.1 Migración de datos
1. Crear tablas `Role`, `RoleModuleAccess`, `RolePermissionOverride`
2. Para cada tenant existente, crear los 5 roles estándar (seed)
3. Para cada `UserTenant` existente, mapear el enum al nuevo rol:
   - `OWNER` → rol con slug `owner`
   - `ADMIN` → rol con slug `admin`
   - `ACCOUNTANT` → rol con slug `accountant`
   - `VIEWER` → rol con slug `viewer`
4. Cambiar `UserTenant.role` (enum) por `UserTenant.roleId` (FK)
5. Eliminar enum `UserRole` de Prisma

### 10.2 Migración del JWT
- El JWT actualmente incluye `role: UserRole` (string del enum)
- Cambia a incluir `roleId: string` (UUID del rol)
- El endpoint `GET /auth/my-permissions` devuelve los permisos resueltos
- El guard del backend resuelve permisos desde el `roleId`

### 10.3 Compatibilidad
- Los controllers sin `@RequirePermission` siguen funcionando (guard es no-op si no hay metadata)
- El sidebar sin `moduleKey` en items sigue mostrando todo (filtrado es no-op si no hay moduleKey)
- La migración se puede hacer gradualmente: primero la infraestructura, luego decorar controllers uno por uno

## 11. Cache y performance

- **Backend:** Los permisos del rol se cachean en memoria (Map con TTL 5 min). Key: `roleId`. Se invalida al modificar un rol via el endpoint de gestión.
- **Frontend:** `GET /auth/my-permissions` se cachea con React Query (staleTime: 5 min). Se invalida al cambiar de tenant o al detectar un 403.
- **Middleware Next.js:** Decodifica JWT sin verificar firma (solo para routing, la verificación real la hace el backend). Cachea el mapeo ruta→módulo en memoria.

## 12. Fuera de alcance (futuro)

- Permisos a nivel de registro (row-level security)
- Permisos a nivel de campo (field-level)
- Roles compuestos (un usuario con múltiples roles)
- Permisos condicionales ("solo puede editar registros que creó")
- Integración con CASL
- Audit trail de cambios de permisos
