-- Add tenantId column to child/join tables for defense-in-depth tenant isolation
-- All columns are nullable to avoid breaking existing records

-- Tier 1: Critical (Message, InterviewSpeaker)
ALTER TABLE "messages" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "interview_speakers" ADD COLUMN "tenantId" TEXT;

-- Tier 2: Recommended (LinkedInPostVersion, LinkedInImageVersion, JournalEntryLine)
ALTER TABLE "linkedin_post_versions" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "linkedin_image_versions" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "journal_entry_lines" ADD COLUMN "tenantId" TEXT;

-- Tier 3: Complete (DocumentJournalEntry, AccountingStepCompletion, AgentSkillFile, ProblemLink)
ALTER TABLE "document_journal_entries" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "accounting_step_completions" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "agent_skill_files" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "problem_links" ADD COLUMN "tenantId" TEXT;

-- Backfill tenantId from parent tables
UPDATE "messages" m SET "tenantId" = c."tenantId" FROM "conversations" c WHERE m."conversationId" = c."id" AND m."tenantId" IS NULL;
UPDATE "interview_speakers" s SET "tenantId" = i."tenantId" FROM "interviews" i WHERE s."interviewId" = i."id" AND s."tenantId" IS NULL;
UPDATE "linkedin_post_versions" v SET "tenantId" = p."tenantId" FROM "linkedin_posts" p WHERE v."postId" = p."id" AND v."tenantId" IS NULL;
UPDATE "linkedin_image_versions" v SET "tenantId" = p."tenantId" FROM "linkedin_posts" p WHERE v."postId" = p."id" AND v."tenantId" IS NULL;
UPDATE "journal_entry_lines" l SET "tenantId" = je."tenantId" FROM "journal_entries" je WHERE l."journalEntryId" = je."id" AND l."tenantId" IS NULL;
UPDATE "document_journal_entries" dje SET "tenantId" = d."tenantId" FROM "documents" d WHERE dje."documentId" = d."id" AND dje."tenantId" IS NULL;
UPDATE "accounting_step_completions" sc SET "tenantId" = s."tenantId" FROM "accounting_process_steps" s WHERE sc."stepId" = s."id" AND sc."tenantId" IS NULL;
UPDATE "agent_skill_files" f SET "tenantId" = s."tenantId" FROM "agent_skills" s WHERE f."skillId" = s."id" AND f."tenantId" IS NULL;
UPDATE "problem_links" pl SET "tenantId" = p."tenantId" FROM "problems" p WHERE pl."problemId" = p."id" AND pl."tenantId" IS NULL;

-- Add indexes for tenant filtering
CREATE INDEX "messages_tenantId_idx" ON "messages"("tenantId");
CREATE INDEX "interview_speakers_tenantId_idx" ON "interview_speakers"("tenantId");
CREATE INDEX "linkedin_post_versions_tenantId_idx" ON "linkedin_post_versions"("tenantId");
CREATE INDEX "linkedin_image_versions_tenantId_idx" ON "linkedin_image_versions"("tenantId");
CREATE INDEX "journal_entry_lines_tenantId_idx" ON "journal_entry_lines"("tenantId");
CREATE INDEX "document_journal_entries_tenantId_idx" ON "document_journal_entries"("tenantId");
CREATE INDEX "accounting_step_completions_tenantId_idx" ON "accounting_step_completions"("tenantId");
CREATE INDEX "agent_skill_files_tenantId_idx" ON "agent_skill_files"("tenantId");
CREATE INDEX "problem_links_tenantId_idx" ON "problem_links"("tenantId");
