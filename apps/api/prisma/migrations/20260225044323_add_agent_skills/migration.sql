-- CreateTable
CREATE TABLE "agent_skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "repoUrl" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "agent_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_skill_files" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "agent_skill_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_skills_tenantId_idx" ON "agent_skills"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_skills_tenantId_repoUrl_key" ON "agent_skills"("tenantId", "repoUrl");

-- CreateIndex
CREATE INDEX "agent_skill_files_skillId_idx" ON "agent_skill_files"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_skill_files_skillId_path_key" ON "agent_skill_files"("skillId", "path");

-- AddForeignKey
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_skill_files" ADD CONSTRAINT "agent_skill_files_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "agent_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
