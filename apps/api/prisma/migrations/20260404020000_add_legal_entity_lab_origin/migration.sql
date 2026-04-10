-- CreateEnum
CREATE TYPE "PaymentTerms" AS ENUM ('IMMEDIATE', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'VISTA', 'OTHER');

-- CreateEnum
CREATE TYPE "LabOriginCategory" AS ENUM ('CONSULTA', 'CENTRO_MEDICO', 'CLINICA_HOSPITAL', 'LABORATORIO', 'OTRO');

-- CreateEnum
CREATE TYPE "SampleReceptionMode" AS ENUM ('PRESENCIAL', 'COURIER', 'AMBAS');

-- CreateEnum
CREATE TYPE "ReportDeliveryMethod" AS ENUM ('WEB', 'IMPRESO', 'FTP', 'EMAIL');

-- DropIndex
DROP INDEX "citolab_fm"."fm_sync_records_tenantId_fmDatabase_fmLayout_fmRecordId_key";

-- CreateTable
CREATE TABLE "legal_entities" (
    "id" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "businessActivity" TEXT,
    "isClient" BOOLEAN NOT NULL DEFAULT false,
    "isSupplier" BOOLEAN NOT NULL DEFAULT false,
    "street" TEXT,
    "streetNumber" TEXT,
    "unit" TEXT,
    "commune" TEXT,
    "city" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "paymentTerms" "PaymentTerms" NOT NULL DEFAULT 'NET_30',
    "customPaymentDays" INTEGER,
    "billingDayOfMonth" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_entity_contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "legal_entity_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_entity_bank_accounts" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountType" "BankAccountType" NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "holderRut" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "legal_entity_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_origins" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "LabOriginCategory" NOT NULL DEFAULT 'OTRO',
    "legalEntityId" TEXT,
    "parentId" TEXT,
    "street" TEXT,
    "streetNumber" TEXT,
    "unit" TEXT,
    "commune" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "sampleReceptionMode" "SampleReceptionMode" NOT NULL DEFAULT 'PRESENCIAL',
    "reportDeliveryMethods" "ReportDeliveryMethod"[],
    "deliveryDaysBiopsy" INTEGER,
    "deliveryDaysPap" INTEGER,
    "deliveryDaysCytology" INTEGER,
    "deliveryDaysIhc" INTEGER,
    "deliveryDaysDefault" INTEGER,
    "encryptedFtpHost" TEXT,
    "encryptedFtpUser" TEXT,
    "encryptedFtpPassword" TEXT,
    "ftpPath" TEXT,
    "criticalNotificationEmails" TEXT[],
    "sendsQualityReports" BOOLEAN NOT NULL DEFAULT false,
    "contractDate" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "lab_origins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_origin_pricing" (
    "id" TEXT NOT NULL,
    "billingConcept" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DECIMAL(18,2) NOT NULL,
    "referencePrice" DECIMAL(18,2),
    "multiplier" DECIMAL(8,4) NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "labOriginId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "lab_origin_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_entities_tenantId_idx" ON "legal_entities"("tenantId");

-- CreateIndex
CREATE INDEX "legal_entities_tenantId_isClient_idx" ON "legal_entities"("tenantId", "isClient");

-- CreateIndex
CREATE INDEX "legal_entities_tenantId_isSupplier_idx" ON "legal_entities"("tenantId", "isSupplier");

-- CreateIndex
CREATE UNIQUE INDEX "legal_entities_tenantId_rut_key" ON "legal_entities"("tenantId", "rut");

-- CreateIndex
CREATE INDEX "legal_entity_contacts_legalEntityId_idx" ON "legal_entity_contacts"("legalEntityId");

-- CreateIndex
CREATE INDEX "legal_entity_contacts_tenantId_idx" ON "legal_entity_contacts"("tenantId");

-- CreateIndex
CREATE INDEX "legal_entity_bank_accounts_legalEntityId_idx" ON "legal_entity_bank_accounts"("legalEntityId");

-- CreateIndex
CREATE INDEX "legal_entity_bank_accounts_tenantId_idx" ON "legal_entity_bank_accounts"("tenantId");

-- CreateIndex
CREATE INDEX "lab_origins_tenantId_idx" ON "lab_origins"("tenantId");

-- CreateIndex
CREATE INDEX "lab_origins_tenantId_category_idx" ON "lab_origins"("tenantId", "category");

-- CreateIndex
CREATE INDEX "lab_origins_tenantId_isActive_idx" ON "lab_origins"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "lab_origins_legalEntityId_idx" ON "lab_origins"("legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_origins_tenantId_code_key" ON "lab_origins"("tenantId", "code");

-- CreateIndex
CREATE INDEX "lab_origin_pricing_labOriginId_idx" ON "lab_origin_pricing"("labOriginId");

-- CreateIndex
CREATE INDEX "lab_origin_pricing_tenantId_idx" ON "lab_origin_pricing"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_origin_pricing_labOriginId_billingConcept_key" ON "lab_origin_pricing"("labOriginId", "billingConcept");

-- CreateIndex
CREATE UNIQUE INDEX "fm_sync_records_tenantId_fmDatabase_fmLayout_fmRecordId_ent_key" ON "citolab_fm"."fm_sync_records"("tenantId", "fmDatabase", "fmLayout", "fmRecordId", "entityType");

-- AddForeignKey
ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_entity_contacts" ADD CONSTRAINT "legal_entity_contacts_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_entity_bank_accounts" ADD CONSTRAINT "legal_entity_bank_accounts_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_origins" ADD CONSTRAINT "lab_origins_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_origins" ADD CONSTRAINT "lab_origins_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "lab_origins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_origins" ADD CONSTRAINT "lab_origins_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_origin_pricing" ADD CONSTRAINT "lab_origin_pricing_labOriginId_fkey" FOREIGN KEY ("labOriginId") REFERENCES "lab_origins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
