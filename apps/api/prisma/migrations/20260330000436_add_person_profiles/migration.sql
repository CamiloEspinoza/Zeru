-- DropIndex
DROP INDEX "idx_interview_chunks_embedding_hnsw";

-- DropIndex
DROP INDEX "idx_interview_chunks_tsv";

-- DropIndex
DROP INDEX "memories_embedding_idx";

-- DropIndex
DROP INDEX "idx_org_entities_embedding_hnsw";

-- CreateTable
CREATE TABLE "person_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "department" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "avatarS3Key" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "person_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "person_profiles_tenantId_idx" ON "person_profiles"("tenantId");

-- CreateIndex
CREATE INDEX "person_profiles_tenantId_name_idx" ON "person_profiles"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "person_profiles" ADD CONSTRAINT "person_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
