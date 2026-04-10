-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('NONE', 'VIEW', 'EDIT', 'MANAGE');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_module_access" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "role_module_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission_overrides" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,

    CONSTRAINT "role_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- Add roleId to user_tenants
ALTER TABLE "user_tenants" ADD COLUMN "roleId" TEXT;

-- CreateIndex
CREATE INDEX "roles_tenantId_idx" ON "roles"("tenantId");
CREATE UNIQUE INDEX "roles_tenantId_slug_key" ON "roles"("tenantId", "slug");

CREATE INDEX "role_module_access_roleId_idx" ON "role_module_access"("roleId");
CREATE UNIQUE INDEX "role_module_access_roleId_moduleKey_key" ON "role_module_access"("roleId", "moduleKey");

CREATE INDEX "role_permission_overrides_roleId_idx" ON "role_permission_overrides"("roleId");
CREATE UNIQUE INDEX "role_permission_overrides_roleId_permission_key" ON "role_permission_overrides"("roleId", "permission");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_module_access" ADD CONSTRAINT "role_module_access_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permission_overrides" ADD CONSTRAINT "role_permission_overrides_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════
-- DATA MIGRATION: Seed default roles for existing tenants
-- ═══════════════════════════════════════════════════════════

-- Seed default roles for each existing tenant
INSERT INTO roles (id, "tenantId", name, slug, description, "isSystem", "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid(), t.id, 'Propietario', 'owner', 'Acceso total al sistema', true, false, NOW(), NOW()
FROM tenants t;

INSERT INTO roles (id, "tenantId", name, slug, description, "isSystem", "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid(), t.id, 'Administrador', 'admin', 'Gestión operativa completa', true, false, NOW(), NOW()
FROM tenants t;

INSERT INTO roles (id, "tenantId", name, slug, description, "isSystem", "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid(), t.id, 'Gerente de Finanzas', 'finance-manager', 'Ciclo financiero completo', true, false, NOW(), NOW()
FROM tenants t;

INSERT INTO roles (id, "tenantId", name, slug, description, "isSystem", "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid(), t.id, 'Contador', 'accountant', 'Contabilidad y reportes financieros', true, false, NOW(), NOW()
FROM tenants t;

INSERT INTO roles (id, "tenantId", name, slug, description, "isSystem", "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid(), t.id, 'Observador', 'viewer', 'Solo lectura', true, true, NOW(), NOW()
FROM tenants t;

-- Seed module access for owner role (all modules MANAGE)
INSERT INTO role_module_access (id, "roleId", "moduleKey", "accessLevel")
SELECT gen_random_uuid(), r.id, m.key, 'MANAGE'::"AccessLevel"
FROM roles r
CROSS JOIN (VALUES
  ('dashboard'),('assistant'),('calendar'),('documents'),
  ('clients'),('collections'),('invoicing'),('accounting'),
  ('directory'),('orgchart'),('org-intelligence'),
  ('lab-reception'),('lab-processing'),('lab-reports'),('lab-coding'),
  ('linkedin'),('integrations'),('reports'),('admin'),('settings')
) AS m(key)
WHERE r.slug = 'owner';

-- Seed module access for admin role (all modules MANAGE)
INSERT INTO role_module_access (id, "roleId", "moduleKey", "accessLevel")
SELECT gen_random_uuid(), r.id, m.key, 'MANAGE'::"AccessLevel"
FROM roles r
CROSS JOIN (VALUES
  ('dashboard'),('assistant'),('calendar'),('documents'),
  ('clients'),('collections'),('invoicing'),('accounting'),
  ('directory'),('orgchart'),('org-intelligence'),
  ('lab-reception'),('lab-processing'),('lab-reports'),('lab-coding'),
  ('linkedin'),('integrations'),('reports'),('admin'),('settings')
) AS m(key)
WHERE r.slug = 'admin';

-- Seed module access for finance-manager role
INSERT INTO role_module_access (id, "roleId", "moduleKey", "accessLevel")
SELECT gen_random_uuid(), r.id, m.key, m.level::"AccessLevel"
FROM roles r
CROSS JOIN (VALUES
  ('dashboard', 'VIEW'),('assistant', 'EDIT'),('calendar', 'EDIT'),('documents', 'MANAGE'),
  ('clients', 'MANAGE'),('collections', 'MANAGE'),('invoicing', 'MANAGE'),('accounting', 'MANAGE'),
  ('directory', 'VIEW'),('orgchart', 'VIEW'),('org-intelligence', 'NONE'),
  ('lab-reception', 'NONE'),('lab-processing', 'NONE'),('lab-reports', 'NONE'),('lab-coding', 'NONE'),
  ('linkedin', 'NONE'),('integrations', 'VIEW'),('reports', 'MANAGE'),('admin', 'NONE'),('settings', 'VIEW')
) AS m(key, level)
WHERE r.slug = 'finance-manager';

-- Seed module access for accountant role
INSERT INTO role_module_access (id, "roleId", "moduleKey", "accessLevel")
SELECT gen_random_uuid(), r.id, m.key, m.level::"AccessLevel"
FROM roles r
CROSS JOIN (VALUES
  ('dashboard', 'VIEW'),('assistant', 'VIEW'),('calendar', 'VIEW'),('documents', 'VIEW'),
  ('clients', 'VIEW'),('collections', 'VIEW'),('invoicing', 'VIEW'),('accounting', 'EDIT'),
  ('directory', 'VIEW'),('orgchart', 'NONE'),('org-intelligence', 'NONE'),
  ('lab-reception', 'NONE'),('lab-processing', 'NONE'),('lab-reports', 'NONE'),('lab-coding', 'NONE'),
  ('linkedin', 'NONE'),('integrations', 'NONE'),('reports', 'VIEW'),('admin', 'NONE'),('settings', 'NONE')
) AS m(key, level)
WHERE r.slug = 'accountant';

-- Seed module access for viewer role (all VIEW)
INSERT INTO role_module_access (id, "roleId", "moduleKey", "accessLevel")
SELECT gen_random_uuid(), r.id, m.key, 'VIEW'::"AccessLevel"
FROM roles r
CROSS JOIN (VALUES
  ('dashboard'),('assistant'),('calendar'),('documents'),
  ('clients'),('collections'),('invoicing'),('accounting'),
  ('directory'),('orgchart'),('org-intelligence'),
  ('lab-reception'),('lab-processing'),('lab-reports'),('lab-coding'),
  ('linkedin'),('integrations'),('reports'),('admin'),('settings')
) AS m(key)
WHERE r.slug = 'viewer';

-- Migrate existing UserTenant.role enum to roleId
UPDATE user_tenants ut
SET "roleId" = r.id
FROM roles r
WHERE r."tenantId" = ut."tenantId"
AND r.slug = LOWER(ut.role::text);
