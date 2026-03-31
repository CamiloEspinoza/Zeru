-- AlterTable: Add cost fields and userId to ai_usage_logs
ALTER TABLE "ai_usage_logs" ADD COLUMN     "costOverrideUsd" DECIMAL(65,30),
ADD COLUMN     "costUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "pricingUnit" TEXT,
ADD COLUMN     "units" DECIMAL(65,30),
ADD COLUMN     "userId" TEXT;

-- AlterTable: Add superAdmin to users
ALTER TABLE "users" ADD COLUMN     "superAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: ai_model_pricing
CREATE TABLE "ai_model_pricing" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "contextTier" TEXT NOT NULL DEFAULT 'DEFAULT',
    "pricingUnit" TEXT NOT NULL,
    "inputPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "outputPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cachedPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "longContextThreshold" INTEGER,
    "description" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_model_pricing_provider_model_idx" ON "ai_model_pricing"("provider", "model");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_pricing_provider_model_contextTier_validFrom_key" ON "ai_model_pricing"("provider", "model", "contextTier", "validFrom");

-- CreateIndex
CREATE INDEX "ai_usage_logs_tenantId_userId_createdAt_idx" ON "ai_usage_logs"("tenantId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
