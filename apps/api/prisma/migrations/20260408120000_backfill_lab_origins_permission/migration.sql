-- Backfill role_module_access for the new lab-origins module.
-- System roles (owner/admin/viewer) mirror what seedDefaultRoles would set.
-- Non-lab system roles (finance-manager/accountant) and any custom roles
-- default to NONE so an admin must opt in via the Roles UI.
--
-- Idempotent: the unique index (roleId, moduleKey) + WHERE NOT EXISTS guard
-- make this safe to re-run.

INSERT INTO "role_module_access" ("id", "roleId", "moduleKey", "accessLevel")
SELECT
  gen_random_uuid()::text,
  r."id",
  'lab-origins',
  CASE
    WHEN r."isSystem" = true AND r."slug" IN ('owner', 'admin') THEN 'MANAGE'::"AccessLevel"
    WHEN r."isSystem" = true AND r."slug" = 'viewer' THEN 'VIEW'::"AccessLevel"
    ELSE 'NONE'::"AccessLevel"
  END
FROM "roles" r
WHERE NOT EXISTS (
  SELECT 1 FROM "role_module_access" rma
  WHERE rma."roleId" = r."id" AND rma."moduleKey" = 'lab-origins'
);
