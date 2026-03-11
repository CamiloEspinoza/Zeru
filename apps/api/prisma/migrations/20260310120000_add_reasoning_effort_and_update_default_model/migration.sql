-- AlterTable: add reasoning_effort column and update default model
ALTER TABLE "ai_provider_configs"
  ADD COLUMN "reasoningEffort" TEXT NOT NULL DEFAULT 'medium';

-- Update default model from gpt-5.2 to gpt-5.4 for existing configs
ALTER TABLE "ai_provider_configs"
  ALTER COLUMN "model" SET DEFAULT 'gpt-5.4';
