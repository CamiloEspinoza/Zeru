-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- Mark all existing tenants as onboarding completed
UPDATE "tenants" SET "onboardingCompletedAt" = NOW();
