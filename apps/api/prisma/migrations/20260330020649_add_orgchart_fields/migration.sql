-- CreateEnum
CREATE TYPE "person_status" AS ENUM ('ACTIVE', 'INACTIVE', 'VACANT');

-- CreateEnum
CREATE TYPE "person_source" AS ENUM ('MANUAL', 'AI_INFERRED', 'AI_CONFIRMED', 'CSV_IMPORT');

-- CreateEnum
CREATE TYPE "org_suggestion_type" AS ENUM ('CREATE_PERSON', 'UPDATE_PERSON', 'SET_REPORTS_TO', 'DELETE_PERSON');

-- CreateEnum
CREATE TYPE "org_suggestion_status" AS ENUM ('PENDING', 'APPROVED', 'APPROVED_MODIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "person_profiles" ADD COLUMN     "employeeCode" TEXT,
ADD COLUMN     "reportsToId" TEXT,
ADD COLUMN     "source" "person_source" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "status" "person_status" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "org_suggestions" (
    "id" TEXT NOT NULL,
    "type" "org_suggestion_type" NOT NULL,
    "status" "org_suggestion_status" NOT NULL DEFAULT 'PENDING',
    "confidence" DOUBLE PRECISION NOT NULL,
    "data" JSONB NOT NULL,
    "evidence" TEXT,
    "evidenceTimeSec" INTEGER,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "personId" TEXT,
    "interviewId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_suggestions_tenantId_status_idx" ON "org_suggestions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "org_suggestions_tenantId_personId_idx" ON "org_suggestions"("tenantId", "personId");

-- CreateIndex
CREATE INDEX "person_profiles_tenantId_reportsToId_idx" ON "person_profiles"("tenantId", "reportsToId");

-- CreateIndex
CREATE INDEX "person_profiles_tenantId_department_idx" ON "person_profiles"("tenantId", "department");

-- AddForeignKey
ALTER TABLE "person_profiles" ADD CONSTRAINT "person_profiles_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "person_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_suggestions" ADD CONSTRAINT "org_suggestions_personId_fkey" FOREIGN KEY ("personId") REFERENCES "person_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_suggestions" ADD CONSTRAINT "org_suggestions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
