-- CreateTable: departments
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "parentId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "departments_tenantId_idx" ON "departments"("tenantId");

-- CreateIndex (unique constraint on tenantId + name)
CREATE UNIQUE INDEX "departments_tenantId_name_key" ON "departments"("tenantId", "name");

-- AddForeignKey: departments.tenantId -> tenants.id
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: departments.parentId -> departments.id (self-relation)
ALTER TABLE "departments" ADD CONSTRAINT "departments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- DATA MIGRATION: Convert person_profiles.department (String) to departmentId (FK)
-- ============================================================

-- 1. Insert unique departments from existing person_profiles
INSERT INTO "departments" ("id", "name", "tenantId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "department", "tenantId", NOW(), NOW()
FROM "person_profiles"
WHERE "department" IS NOT NULL AND "department" != ''
GROUP BY "department", "tenantId";

-- 2. Add new departmentId column
ALTER TABLE "person_profiles" ADD COLUMN "departmentId" TEXT;

-- 3. Populate departmentId from the newly created departments
UPDATE "person_profiles" pp
SET "departmentId" = d."id"
FROM "departments" d
WHERE pp."department" = d."name" AND pp."tenantId" = d."tenantId";

-- 4. Drop the old department column
ALTER TABLE "person_profiles" DROP COLUMN "department";

-- 5. Add foreign key constraint
ALTER TABLE "person_profiles" ADD CONSTRAINT "person_profiles_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Create index on departmentId (replacing old department index)
DROP INDEX IF EXISTS "person_profiles_tenantId_department_idx";
CREATE INDEX "person_profiles_tenantId_departmentId_idx" ON "person_profiles"("tenantId", "departmentId");
