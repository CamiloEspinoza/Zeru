-- CreateEnum
CREATE TYPE "journal_entry_source" AS ENUM ('ASSISTANT', 'MANUAL');

-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "conversationId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "createdVia" "journal_entry_source";

-- CreateIndex
CREATE INDEX "journal_entries_createdById_idx" ON "journal_entries"("createdById");

-- CreateIndex
CREATE INDEX "journal_entries_conversationId_idx" ON "journal_entries"("conversationId");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
