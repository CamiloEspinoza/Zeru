-- CreateTable
CREATE TABLE "storage_configs" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'us-east-1',
    "encryptedAccessKeyId" TEXT NOT NULL,
    "encryptedSecretKey" TEXT NOT NULL,
    "encryptedBucket" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "storage_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "storage_configs_tenantId_key" ON "storage_configs"("tenantId");

-- AddForeignKey
ALTER TABLE "storage_configs" ADD CONSTRAINT "storage_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
