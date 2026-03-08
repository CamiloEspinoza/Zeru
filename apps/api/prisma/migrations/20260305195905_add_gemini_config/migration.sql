-- CreateTable
CREATE TABLE "gemini_configs" (
    "id" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "gemini_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gemini_configs_tenantId_key" ON "gemini_configs"("tenantId");

-- AddForeignKey
ALTER TABLE "gemini_configs" ADD CONSTRAINT "gemini_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
