-- AlterTable
ALTER TABLE "task_comment_reactions" ADD COLUMN "tenantId" TEXT;

-- Backfill tenantId from parent task_comments
UPDATE "task_comment_reactions" tcr
SET "tenantId" = tc."tenantId"
FROM "task_comments" tc
WHERE tcr."commentId" = tc."id" AND tcr."tenantId" IS NULL;

-- Set NOT NULL after backfill
ALTER TABLE "task_comment_reactions" ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "task_comment_reactions_tenantId_idx" ON "task_comment_reactions"("tenantId");
