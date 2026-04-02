-- CreateEnum
CREATE TYPE "user_type" AS ENUM ('HUMAN', 'SERVICE');

-- AlterTable: Add type column to users
ALTER TABLE "users" ADD COLUMN "type" "user_type" NOT NULL DEFAULT 'HUMAN';

-- AlterTable: Add userId column to person_profiles
ALTER TABLE "person_profiles" ADD COLUMN "userId" TEXT;

-- AddForeignKey
ALTER TABLE "person_profiles" ADD CONSTRAINT "person_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: unique constraint on userId + tenantId
CREATE UNIQUE INDEX "person_profiles_userId_tenantId_key" ON "person_profiles"("userId", "tenantId");
