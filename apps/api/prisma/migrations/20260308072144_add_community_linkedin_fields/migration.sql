-- AlterTable
ALTER TABLE "linkedin_agent_configs" ADD COLUMN     "organizationUrn" TEXT;

-- AlterTable
ALTER TABLE "linkedin_connections" ADD COLUMN     "communityAccessToken" TEXT,
ADD COLUMN     "communityExpiresAt" TIMESTAMP(3),
ADD COLUMN     "communityRefreshToken" TEXT;
