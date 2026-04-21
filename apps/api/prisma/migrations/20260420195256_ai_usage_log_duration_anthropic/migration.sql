-- Add durationMs + completedAt to AiUsageLog for LLM latency tracking.
ALTER TABLE "public"."ai_usage_logs" ADD COLUMN "durationMs" INTEGER;
ALTER TABLE "public"."ai_usage_logs" ADD COLUMN "completedAt" TIMESTAMP(3);

-- Add ANTHROPIC to ai_provider enum.
ALTER TYPE "public"."ai_provider" ADD VALUE IF NOT EXISTS 'ANTHROPIC';
