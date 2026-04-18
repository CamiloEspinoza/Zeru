-- CreateEnum
CREATE TYPE "ApprovalSubjectType" AS ENUM ('LAB_REPORT_VALIDATION');

-- CreateEnum
CREATE TYPE "ApprovalReason" AS ENUM ('CRITICAL_VALIDATION_FAILED', 'NON_CRITICAL_VALIDATION_FAILED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalDecisionKind" AS ENUM ('APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "RecipientScope" AS ENUM ('GROUP_MEMBER', 'PERMISSION', 'USER', 'ORIGINAL_ACTOR');

-- CreateEnum
CREATE TYPE "mod_lab"."ValidationRunStatus" AS ENUM ('PENDING', 'SYNCED', 'ANALYZING', 'COMPLETED', 'ERROR', 'CANCELLED');

-- CreateEnum
CREATE TYPE "mod_lab"."ValidationVerdict" AS ENUM ('GREEN', 'YELLOW', 'RED', 'PENDING');

-- CreateEnum
CREATE TYPE "mod_lab"."ValidationAgentKey" AS ENUM ('IDENTITY', 'ORIGIN', 'SAMPLE', 'CONCORDANCE', 'CRITICALITY', 'TRACEABILITY', 'VISION_REQUEST', 'VISION_ENCAPSULATION_MACRO', 'PDF_FINAL');

-- CreateEnum
CREATE TYPE "mod_lab"."FindingSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "mod_lab"."FindingVerdict" AS ENUM ('PASS', 'WARN', 'FAIL');

-- CreateEnum
CREATE TYPE "mod_lab"."SensitiveRule" AS ENUM ('MUESTRA_TEXTUAL_EXACTA');

-- CreateEnum
CREATE TYPE "mod_lab"."LexCategory" AS ENUM ('MALIGNIDAD', 'INVASION', 'IN_SITU', 'SOSPECHA', 'INFECCION_CRITICA', 'HEMATOLOGIA_AGRESIVA', 'TRASPLANTE_VASCULITIS', 'NEGACION');

-- CreateEnum
CREATE TYPE "mod_lab"."LateralityReq" AS ENUM ('REQUIRED', 'NOT_APPLICABLE', 'CONTEXTUAL');

-- CreateEnum
CREATE TYPE "mod_lab"."AuditSource" AS ENUM ('RANDOM_SAMPLING', 'ESCALATION', 'REPLAY', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "mod_lab"."HumanJudgement" AS ENUM ('AGENT_CORRECT', 'AGENT_MISSED', 'AGENT_FALSE_POSITIVE', 'UNCERTAIN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "mod_lab"."WorkflowEventType" ADD VALUE 'SECRETARY_PRE_VALIDATION';
ALTER TYPE "mod_lab"."WorkflowEventType" ADD VALUE 'TM_REVIEW';
ALTER TYPE "mod_lab"."WorkflowEventType" ADD VALUE 'SCANNER_CAPTURE';
ALTER TYPE "mod_lab"."WorkflowEventType" ADD VALUE 'CRITICAL_NOTIFICATION_SENT';
ALTER TYPE "mod_lab"."WorkflowEventType" ADD VALUE 'PATIENT_NOTIFICATION';
ALTER TYPE "mod_lab"."WorkflowEventType" ADD VALUE 'AGENT_VALIDATION_RUN';
ALTER TYPE "mod_lab"."WorkflowEventType" ADD VALUE 'AGENT_VALIDATION_PASSED';
ALTER TYPE "mod_lab"."WorkflowEventType" ADD VALUE 'AGENT_VALIDATION_FAILED';

-- DropIndex
DROP INDEX "dtes_tenantId_folioReleased_status_idx";

-- AlterTable
ALTER TABLE "mod_lab"."lab_diagnostic_reports" ADD COLUMN     "blockedForDispatch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ccbComments" TEXT,
ADD COLUMN     "criticalNotificationPdfKey" TEXT,
ADD COLUMN     "criticalNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "criticalNotifiedByNameSnapshot" TEXT,
ADD COLUMN     "criticalPatientNotifyFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "diagnosticModified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastValidationRunId" TEXT,
ADD COLUMN     "modifiedAt" TIMESTAMP(3),
ADD COLUMN     "modifiedByNameSnapshot" TEXT,
ADD COLUMN     "rejectedByCcb" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "validationVerdict" "mod_lab"."ValidationVerdict";

-- AlterTable
ALTER TABLE "mod_lab"."lab_practitioners" ADD COLUMN     "codeSnapshot" TEXT,
ADD COLUMN     "rutSnapshot" TEXT;

-- AlterTable
ALTER TABLE "mod_lab"."lab_service_requests" ADD COLUMN     "externalFolioNumber" TEXT,
ADD COLUMN     "externalInstitutionId" TEXT,
ADD COLUMN     "externalOrderNumber" TEXT,
ADD COLUMN     "requestingPhysicianEmail" TEXT;

-- AlterTable
ALTER TABLE "mod_lab"."lab_specimens" ADD COLUMN     "cassetteCount" INTEGER,
ADD COLUMN     "containerType" TEXT,
ADD COLUMN     "ihqAntibodies" TEXT[],
ADD COLUMN     "ihqNumbers" TEXT,
ADD COLUMN     "ihqRequestedAt" TIMESTAMP(3),
ADD COLUMN     "ihqRespondedAt" TIMESTAMP(3),
ADD COLUMN     "ihqResponsibleNameSnapshot" TEXT,
ADD COLUMN     "ihqStatus" TEXT,
ADD COLUMN     "placaHeCount" INTEGER,
ADD COLUMN     "specialTechniquesCount" INTEGER,
ADD COLUMN     "tacoCount" INTEGER;

-- CreateTable
CREATE TABLE "mod_lab"."lab_report_validations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "diagnosticReportId" TEXT NOT NULL,
    "fmInformeNumber" INTEGER NOT NULL,
    "fmSource" "mod_lab"."FmSource" NOT NULL,
    "triggeredByUserId" TEXT,
    "status" "mod_lab"."ValidationRunStatus" NOT NULL DEFAULT 'PENDING',
    "verdict" "mod_lab"."ValidationVerdict",
    "confidenceAvg" DECIMAL(5,4),
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "isAcuteCritical" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),
    "analysisStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "pdfExtractedText" TEXT,
    "summary" JSONB,
    "isReplay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_report_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_lab"."lab_validation_agent_runs" (
    "id" TEXT NOT NULL,
    "validationId" TEXT NOT NULL,
    "agentKey" "mod_lab"."ValidationAgentKey" NOT NULL,
    "verdict" "mod_lab"."FindingVerdict" NOT NULL,
    "severity" "mod_lab"."FindingSeverity" NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "model" TEXT,
    "provider" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "aiUsageLogId" TEXT,
    "rawOutput" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_validation_agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_lab"."lab_validation_findings" (
    "id" TEXT NOT NULL,
    "validationId" TEXT NOT NULL,
    "agentKey" "mod_lab"."ValidationAgentKey" NOT NULL,
    "ruleId" TEXT NOT NULL,
    "verdict" "mod_lab"."FindingVerdict" NOT NULL,
    "severity" "mod_lab"."FindingSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "field" TEXT,
    "evidenceQuote" TEXT,
    "evidenceSource" TEXT,
    "suggestion" TEXT,
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT false,
    "blocksDispatch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_validation_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_lab"."lab_sensitive_origins" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "labOriginId" TEXT,
    "nameMatch" TEXT,
    "rule" "mod_lab"."SensitiveRule" NOT NULL DEFAULT 'MUESTRA_TEXTUAL_EXACTA',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_sensitive_origins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_lab"."lab_criticality_lexicon" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" "mod_lab"."LexCategory" NOT NULL,
    "pattern" TEXT NOT NULL,
    "isRegex" BOOLEAN NOT NULL DEFAULT false,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "locale" TEXT NOT NULL DEFAULT 'es-CL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_criticality_lexicon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_lab"."lab_laterality_organ_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organPattern" TEXT NOT NULL,
    "requirement" "mod_lab"."LateralityReq" NOT NULL,

    CONSTRAINT "lab_laterality_organ_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_lab"."lab_validation_rulesets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "gateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "thresholdCritical" INTEGER NOT NULL DEFAULT 3,
    "thresholdMediumConfidence" DECIMAL(5,4) NOT NULL DEFAULT 0.70,
    "autoApproveWithExplicitFlag" BOOLEAN NOT NULL DEFAULT true,
    "concordanceEnsembleOnMalign" BOOLEAN NOT NULL DEFAULT true,
    "visionVlmEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pdfFinalVlmEnabled" BOOLEAN NOT NULL DEFAULT false,
    "agentsEnabled" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_validation_rulesets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_lab"."lab_validation_audit_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "validationId" TEXT NOT NULL,
    "source" "mod_lab"."AuditSource" NOT NULL,
    "sampledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "judgement" "mod_lab"."HumanJudgement",
    "comments" TEXT,
    "missedFindingsRule" TEXT[],
    "agreedFindingsRule" TEXT[],
    "falsePositiveRule" TEXT[],

    CONSTRAINT "lab_validation_audit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_lab"."lab_validation_replay_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filterCriteria" JSONB NOT NULL,
    "totalCases" INTEGER NOT NULL,
    "processedCases" INTEGER NOT NULL DEFAULT 0,
    "detectedCases" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "lab_validation_replay_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_groups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "reason" "ApprovalReason" NOT NULL,
    "minApprovers" INTEGER NOT NULL DEFAULT 1,
    "excludeOriginalActor" BOOLEAN NOT NULL DEFAULT true,
    "slaHours" INTEGER NOT NULL DEFAULT 72,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedById" TEXT,

    CONSTRAINT "approval_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subjectType" "ApprovalSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "reason" "ApprovalReason" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "originalActorId" TEXT,
    "groupId" TEXT NOT NULL,
    "approvalsRequired" INTEGER NOT NULL,
    "approvalsCount" INTEGER NOT NULL DEFAULT 0,
    "rejectionsCount" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_decisions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "decidedById" TEXT NOT NULL,
    "decision" "ApprovalDecisionKind" NOT NULL,
    "notes" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_alert_recipients" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT,
    "reason" "ApprovalReason",
    "scope" "RecipientScope" NOT NULL,
    "permissionKey" TEXT,
    "userId" TEXT,
    "channels" "AlertChannel"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_alert_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lab_report_validations_tenantId_status_startedAt_idx" ON "mod_lab"."lab_report_validations"("tenantId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "lab_report_validations_tenantId_diagnosticReportId_idx" ON "mod_lab"."lab_report_validations"("tenantId", "diagnosticReportId");

-- CreateIndex
CREATE INDEX "lab_report_validations_tenantId_fmSource_fmInformeNumber_idx" ON "mod_lab"."lab_report_validations"("tenantId", "fmSource", "fmInformeNumber");

-- CreateIndex
CREATE INDEX "lab_validation_agent_runs_validationId_idx" ON "mod_lab"."lab_validation_agent_runs"("validationId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_validation_agent_runs_validationId_agentKey_key" ON "mod_lab"."lab_validation_agent_runs"("validationId", "agentKey");

-- CreateIndex
CREATE INDEX "lab_validation_findings_validationId_severity_idx" ON "mod_lab"."lab_validation_findings"("validationId", "severity");

-- CreateIndex
CREATE INDEX "lab_validation_findings_ruleId_idx" ON "mod_lab"."lab_validation_findings"("ruleId");

-- CreateIndex
CREATE INDEX "lab_sensitive_origins_tenantId_isActive_idx" ON "mod_lab"."lab_sensitive_origins"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "lab_criticality_lexicon_tenantId_category_isActive_idx" ON "mod_lab"."lab_criticality_lexicon"("tenantId", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "lab_laterality_organ_rules_tenantId_organPattern_key" ON "mod_lab"."lab_laterality_organ_rules"("tenantId", "organPattern");

-- CreateIndex
CREATE UNIQUE INDEX "lab_validation_rulesets_tenantId_key" ON "mod_lab"."lab_validation_rulesets"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_validation_audit_records_validationId_key" ON "mod_lab"."lab_validation_audit_records"("validationId");

-- CreateIndex
CREATE INDEX "lab_validation_audit_records_tenantId_source_sampledAt_idx" ON "mod_lab"."lab_validation_audit_records"("tenantId", "source", "sampledAt");

-- CreateIndex
CREATE INDEX "lab_validation_audit_records_reviewerId_reviewedAt_idx" ON "mod_lab"."lab_validation_audit_records"("reviewerId", "reviewedAt");

-- CreateIndex
CREATE INDEX "lab_validation_replay_runs_tenantId_status_startedAt_idx" ON "mod_lab"."lab_validation_replay_runs"("tenantId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "approval_groups_tenantId_isActive_reason_idx" ON "approval_groups"("tenantId", "isActive", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "approval_groups_tenantId_slug_key" ON "approval_groups"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "approval_group_members_userId_idx" ON "approval_group_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "approval_group_members_groupId_userId_key" ON "approval_group_members"("groupId", "userId");

-- CreateIndex
CREATE INDEX "approval_requests_tenantId_status_createdAt_idx" ON "approval_requests"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "approval_requests_tenantId_subjectType_subjectId_idx" ON "approval_requests"("tenantId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "approval_decisions_decidedById_idx" ON "approval_decisions"("decidedById");

-- CreateIndex
CREATE UNIQUE INDEX "approval_decisions_requestId_decidedById_key" ON "approval_decisions"("requestId", "decidedById");

-- CreateIndex
CREATE INDEX "approval_alert_recipients_tenantId_groupId_reason_idx" ON "approval_alert_recipients"("tenantId", "groupId", "reason");

-- AddForeignKey
ALTER TABLE "dte_exchanges" ADD CONSTRAINT "dte_exchanges_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_lab"."lab_report_validations" ADD CONSTRAINT "lab_report_validations_diagnosticReportId_fkey" FOREIGN KEY ("diagnosticReportId") REFERENCES "mod_lab"."lab_diagnostic_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_lab"."lab_validation_agent_runs" ADD CONSTRAINT "lab_validation_agent_runs_validationId_fkey" FOREIGN KEY ("validationId") REFERENCES "mod_lab"."lab_report_validations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_lab"."lab_validation_findings" ADD CONSTRAINT "lab_validation_findings_validationId_fkey" FOREIGN KEY ("validationId") REFERENCES "mod_lab"."lab_report_validations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_group_members" ADD CONSTRAINT "approval_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "approval_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_group_members" ADD CONSTRAINT "approval_group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "approval_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_req_validation_fk" FOREIGN KEY ("subjectId") REFERENCES "mod_lab"."lab_report_validations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_alert_recipients" ADD CONSTRAINT "approval_alert_recipients_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "approval_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "dte_folios_tenantId_dteType_environment_isActive_isExhausted_id" RENAME TO "dte_folios_tenantId_dteType_environment_isActive_isExhauste_idx";


-- ═══════════════════════════════════════════════════════════════
-- Triggers de inmutabilidad para audit log y decisiones
-- ═══════════════════════════════════════════════════════════════

-- Approval decisions: nunca se pueden modificar ni borrar
CREATE OR REPLACE FUNCTION forbid_approval_decision_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'approval_decisions are immutable (attempted %)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER approval_decisions_immutable
BEFORE UPDATE OR DELETE ON public.approval_decisions
FOR EACH ROW
EXECUTE FUNCTION forbid_approval_decision_mutation();

-- Enforce SoD: un mismo usuario no puede aprobar su propia validación
-- si el grupo tiene excludeOriginalActor=true
CREATE OR REPLACE FUNCTION enforce_sod_on_decision()
RETURNS TRIGGER AS $$
DECLARE
  v_original_actor_id TEXT;
  v_exclude_original  BOOLEAN;
BEGIN
  SELECT ar."originalActorId",
         ag."excludeOriginalActor"
    INTO v_original_actor_id, v_exclude_original
  FROM public.approval_requests ar
  JOIN public.approval_groups   ag ON ag.id = ar."groupId"
  WHERE ar.id = NEW."requestId";

  IF v_exclude_original AND v_original_actor_id = NEW."decidedById" THEN
    RAISE EXCEPTION 'SoD violation: original actor cannot decide on their own approval request';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER approval_decisions_sod
BEFORE INSERT ON public.approval_decisions
FOR EACH ROW
EXECUTE FUNCTION enforce_sod_on_decision();
