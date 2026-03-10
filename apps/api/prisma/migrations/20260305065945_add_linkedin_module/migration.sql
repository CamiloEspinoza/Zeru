-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "agentType" TEXT NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "linkedin_connections" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "personUrn" TEXT NOT NULL,
    "profileName" TEXT,
    "profileImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "linkedin_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedin_posts" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'NONE',
    "mediaUrl" TEXT,
    "imageS3Key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "linkedinPostId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "contentPillar" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT,

    CONSTRAINT "linkedin_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedin_agent_configs" (
    "id" TEXT NOT NULL,
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "defaultVisibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "contentPillars" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "linkedin_agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "linkedin_connections_tenantId_key" ON "linkedin_connections"("tenantId");

-- CreateIndex
CREATE INDEX "linkedin_posts_tenantId_idx" ON "linkedin_posts"("tenantId");

-- CreateIndex
CREATE INDEX "linkedin_posts_tenantId_status_idx" ON "linkedin_posts"("tenantId", "status");

-- CreateIndex
CREATE INDEX "linkedin_posts_status_scheduledAt_idx" ON "linkedin_posts"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "linkedin_agent_configs_tenantId_key" ON "linkedin_agent_configs"("tenantId");

-- CreateIndex
CREATE INDEX "conversations_tenantId_agentType_idx" ON "conversations"("tenantId", "agentType");

-- AddForeignKey
ALTER TABLE "linkedin_connections" ADD CONSTRAINT "linkedin_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedin_posts" ADD CONSTRAINT "linkedin_posts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedin_posts" ADD CONSTRAINT "linkedin_posts_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedin_agent_configs" ADD CONSTRAINT "linkedin_agent_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
