-- AlterTable
ALTER TABLE "memories" ADD COLUMN     "documentId" TEXT;

-- CreateIndex
CREATE INDEX "memories_documentId_idx" ON "memories"("documentId");

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
