-- CreateEnum
CREATE TYPE "org_project_status" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "transcription_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "transcription_provider" AS ENUM ('DEEPGRAM', 'OPENAI');

-- CreateEnum
CREATE TYPE "org_entity_type" AS ENUM ('ORGANIZATION', 'DEPARTMENT', 'ROLE', 'PROCESS', 'ACTIVITY', 'SYSTEM', 'DOCUMENT_TYPE', 'PROBLEM', 'IMPROVEMENT');

-- CreateEnum
CREATE TYPE "org_relation_type" AS ENUM ('BELONGS_TO', 'EXECUTES', 'OWNS', 'CONTAINS', 'DEPENDS_ON', 'USES', 'PRECEDES', 'FOLLOWS', 'TRIGGERS', 'INPUTS', 'OUTPUTS');

-- CreateEnum
CREATE TYPE "problem_severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "conflict_type" AS ENUM ('FACTUAL', 'PERSPECTIVE', 'SCOPE');

-- CreateEnum
CREATE TYPE "conflict_resolution" AS ENUM ('PENDING', 'RESOLVED_VERIFIED', 'RESOLVED_BOTH_VALID', 'RESOLVED_MERGED', 'DISMISSED');

-- CreateTable
CREATE TABLE "org_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "org_project_status" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "config" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "org_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "audioS3Key" TEXT,
    "audioMimeType" TEXT,
    "audioDurationMs" INTEGER,
    "transcriptionText" TEXT,
    "transcriptionJson" JSONB,
    "transcriptionStatus" "transcription_status" NOT NULL DEFAULT 'PENDING',
    "transcriptionProvider" "transcription_provider",
    "interviewDate" TIMESTAMP(3),
    "extractionResult" JSONB,
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_speakers" (
    "id" TEXT NOT NULL,
    "speakerLabel" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT,
    "department" TEXT,
    "isInterviewer" BOOLEAN NOT NULL DEFAULT false,
    "interviewId" TEXT NOT NULL,
    "personEntityId" TEXT,

    CONSTRAINT "interview_speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_chunks" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contextPrefix" TEXT,
    "topicSummary" TEXT,
    "startTimeMs" INTEGER,
    "endTimeMs" INTEGER,
    "chunkOrder" INTEGER NOT NULL,
    "tokenCount" INTEGER,
    "embeddingModel" TEXT,
    "embedding" vector(1536),
    "tsv" tsvector,
    "interviewId" TEXT NOT NULL,
    "speakerId" TEXT,
    "parentChunkId" TEXT,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "interview_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_entities" (
    "id" TEXT NOT NULL,
    "type" "org_entity_type" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "aliases" TEXT[],
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "originalEntityId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sourceChunkIds" TEXT[],
    "sourceInterviewId" TEXT,
    "embedding" vector(1536),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "org_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_relations" (
    "id" TEXT NOT NULL,
    "type" "org_relation_type" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "fromEntityId" TEXT NOT NULL,
    "toEntityId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sourceInterviewId" TEXT,
    "sourceChunkId" TEXT,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "problem_severity" NOT NULL,
    "category" TEXT,
    "evidence" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sourceInterviewId" TEXT,
    "riceScore" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_links" (
    "id" TEXT NOT NULL,
    "impactDescription" TEXT,
    "problemId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,

    CONSTRAINT "problem_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "improvements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT,
    "effort" TEXT,
    "impact" TEXT,
    "priority" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,

    CONSTRAINT "improvements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factual_claims" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "predicate" TEXT NOT NULL,
    "object" TEXT NOT NULL,
    "claimType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "evidence" TEXT,
    "sourceInterviewId" TEXT,
    "sourceChunkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "factual_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflict_records" (
    "id" TEXT NOT NULL,
    "type" "conflict_type" NOT NULL,
    "description" TEXT NOT NULL,
    "claimsData" JSONB NOT NULL,
    "interviewIds" TEXT[],
    "resolution" "conflict_resolution" NOT NULL DEFAULT 'PENDING',
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "conflict_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_projects_tenantId_idx" ON "org_projects"("tenantId");

-- CreateIndex
CREATE INDEX "org_projects_tenantId_status_idx" ON "org_projects"("tenantId", "status");

-- CreateIndex
CREATE INDEX "interviews_projectId_idx" ON "interviews"("projectId");

-- CreateIndex
CREATE INDEX "interviews_tenantId_idx" ON "interviews"("tenantId");

-- CreateIndex
CREATE INDEX "interviews_tenantId_processingStatus_idx" ON "interviews"("tenantId", "processingStatus");

-- CreateIndex
CREATE INDEX "interview_speakers_interviewId_idx" ON "interview_speakers"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_speakers_interviewId_speakerLabel_key" ON "interview_speakers"("interviewId", "speakerLabel");

-- CreateIndex
CREATE INDEX "interview_chunks_interviewId_idx" ON "interview_chunks"("interviewId");

-- CreateIndex
CREATE INDEX "interview_chunks_tenantId_idx" ON "interview_chunks"("tenantId");

-- CreateIndex
CREATE INDEX "interview_chunks_tenantId_interviewId_idx" ON "interview_chunks"("tenantId", "interviewId");

-- CreateIndex
CREATE INDEX "org_entities_tenantId_projectId_type_idx" ON "org_entities"("tenantId", "projectId", "type");

-- CreateIndex
CREATE INDEX "org_entities_tenantId_type_status_idx" ON "org_entities"("tenantId", "type", "status");

-- CreateIndex
CREATE INDEX "org_entities_tenantId_projectId_type_validTo_idx" ON "org_entities"("tenantId", "projectId", "type", "validTo");

-- CreateIndex
CREATE INDEX "org_relations_tenantId_projectId_idx" ON "org_relations"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "org_relations_fromEntityId_idx" ON "org_relations"("fromEntityId");

-- CreateIndex
CREATE INDEX "org_relations_toEntityId_idx" ON "org_relations"("toEntityId");

-- CreateIndex
CREATE INDEX "org_relations_type_idx" ON "org_relations"("type");

-- CreateIndex
CREATE INDEX "org_relations_tenantId_type_validTo_idx" ON "org_relations"("tenantId", "type", "validTo");

-- CreateIndex
CREATE INDEX "problems_tenantId_projectId_idx" ON "problems"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "problems_severity_idx" ON "problems"("severity");

-- CreateIndex
CREATE INDEX "problems_tenantId_projectId_severity_idx" ON "problems"("tenantId", "projectId", "severity");

-- CreateIndex
CREATE INDEX "problem_links_problemId_idx" ON "problem_links"("problemId");

-- CreateIndex
CREATE INDEX "problem_links_entityId_idx" ON "problem_links"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "problem_links_problemId_entityId_key" ON "problem_links"("problemId", "entityId");

-- CreateIndex
CREATE INDEX "improvements_tenantId_projectId_idx" ON "improvements"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "improvements_problemId_idx" ON "improvements"("problemId");

-- CreateIndex
CREATE INDEX "factual_claims_tenantId_projectId_idx" ON "factual_claims"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "factual_claims_subject_idx" ON "factual_claims"("subject");

-- CreateIndex
CREATE INDEX "factual_claims_tenantId_projectId_subject_predicate_idx" ON "factual_claims"("tenantId", "projectId", "subject", "predicate");

-- CreateIndex
CREATE INDEX "conflict_records_tenantId_projectId_idx" ON "conflict_records"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "conflict_records_tenantId_projectId_resolution_idx" ON "conflict_records"("tenantId", "projectId", "resolution");

-- AddForeignKey
ALTER TABLE "org_projects" ADD CONSTRAINT "org_projects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_projects" ADD CONSTRAINT "org_projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "org_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_speakers" ADD CONSTRAINT "interview_speakers_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_chunks" ADD CONSTRAINT "interview_chunks_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_chunks" ADD CONSTRAINT "interview_chunks_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "interview_speakers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_entities" ADD CONSTRAINT "org_entities_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "org_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_relations" ADD CONSTRAINT "org_relations_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "org_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_relations" ADD CONSTRAINT "org_relations_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "org_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_relations" ADD CONSTRAINT "org_relations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "org_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "org_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_links" ADD CONSTRAINT "problem_links_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_links" ADD CONSTRAINT "problem_links_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "org_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "improvements" ADD CONSTRAINT "improvements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "org_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "improvements" ADD CONSTRAINT "improvements_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factual_claims" ADD CONSTRAINT "factual_claims_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "org_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_records" ADD CONSTRAINT "conflict_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "org_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
