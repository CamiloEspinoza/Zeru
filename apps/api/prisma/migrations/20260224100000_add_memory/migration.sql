-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "MemoryCategory" AS ENUM ('PREFERENCE', 'FACT', 'PROCEDURE', 'DECISION', 'CONTEXT');

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "MemoryCategory" NOT NULL DEFAULT 'CONTEXT',
    "importance" INTEGER NOT NULL DEFAULT 5,
    "embedding" vector(1536),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memories_tenantId_idx" ON "memories"("tenantId");

-- CreateIndex
CREATE INDEX "memories_userId_tenantId_idx" ON "memories"("userId", "tenantId");

-- CreateIndex: HNSW index for fast cosine similarity search
CREATE INDEX "memories_embedding_idx" ON "memories" USING hnsw ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
