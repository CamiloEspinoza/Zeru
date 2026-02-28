-- CreateTable
CREATE TABLE "email_configs" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'us-east-1',
    "encryptedAccessKeyId" TEXT NOT NULL,
    "encryptedSecretKey" TEXT NOT NULL,
    "encryptedFromEmail" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "email_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_configs_tenantId_key" ON "email_configs"("tenantId");

-- AddForeignKey
ALTER TABLE "email_configs" ADD CONSTRAINT "email_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
