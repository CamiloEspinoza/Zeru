/*
  Warnings:

  - The `category` column on the `memories` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "memory_category" AS ENUM ('PREFERENCE', 'FACT', 'PROCEDURE', 'DECISION', 'CONTEXT');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_uploadedById_fkey";

-- DropIndex
DROP INDEX "memories_embedding_idx";

-- AlterTable
ALTER TABLE "ai_provider_configs" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "lastResponseOutput" JSONB,
ADD COLUMN     "parentResponseId" TEXT,
ADD COLUMN     "pendingToolOutputs" JSONB,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "tags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "memories" DROP COLUMN "category",
ADD COLUMN     "category" "memory_category" NOT NULL DEFAULT 'CONTEXT';

-- DropEnum
DROP TYPE "MemoryCategory";

-- CreateTable
CREATE TABLE "accounting_process_steps" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "accounting_process_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_step_completions" (
    "id" TEXT NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stepId" TEXT NOT NULL,
    "fiscalPeriodId" TEXT NOT NULL,
    "completedById" TEXT,

    CONSTRAINT "accounting_step_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_process_steps_tenantId_idx" ON "accounting_process_steps"("tenantId");

-- CreateIndex
CREATE INDEX "accounting_step_completions_fiscalPeriodId_idx" ON "accounting_step_completions"("fiscalPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_step_completions_stepId_fiscalPeriodId_key" ON "accounting_step_completions"("stepId", "fiscalPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_email_key" ON "waitlist_entries"("email");

-- AddForeignKey
ALTER TABLE "accounting_process_steps" ADD CONSTRAINT "accounting_process_steps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_step_completions" ADD CONSTRAINT "accounting_step_completions_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "accounting_process_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_step_completions" ADD CONSTRAINT "accounting_step_completions_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "fiscal_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_step_completions" ADD CONSTRAINT "accounting_step_completions_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Recreate HNSW index for pgvector cosine similarity search on memories
CREATE INDEX IF NOT EXISTS "memories_embedding_idx" ON "memories" USING hnsw ("embedding" vector_cosine_ops);
