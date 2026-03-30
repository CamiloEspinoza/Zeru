ALTER TABLE "interviews" ADD COLUMN "objective" TEXT;
ALTER TABLE "interviews" ADD COLUMN "generatedIntro" TEXT;
ALTER TABLE "interviews" ADD COLUMN "generatedQuestions" JSONB;
ALTER TABLE "interviews" ADD COLUMN "questionsGeneratedAt" TIMESTAMP;
