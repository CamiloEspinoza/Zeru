-- AlterEnum: Add OWNER to UserRole
ALTER TYPE "UserRole" ADD VALUE 'OWNER';

-- AlterTable users: drop role and tenantId FK columns
ALTER TABLE "users" DROP CONSTRAINT "users_tenantId_fkey";
ALTER TABLE "users" DROP COLUMN "role";
ALTER TABLE "users" DROP COLUMN "tenantId";

-- AlterTable users: email becomes globally unique
DROP INDEX IF EXISTS "users_email_tenantId_key";
ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");

-- Remove old tenants relation on users from Tenant side
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "users";

-- CreateTable user_tenants
CREATE TABLE "user_tenants" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OWNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "user_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_tenants_userId_idx" ON "user_tenants"("userId");
CREATE INDEX "user_tenants_tenantId_idx" ON "user_tenants"("tenantId");
CREATE UNIQUE INDEX "user_tenants_userId_tenantId_key" ON "user_tenants"("userId", "tenantId");

-- AddForeignKey
ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
