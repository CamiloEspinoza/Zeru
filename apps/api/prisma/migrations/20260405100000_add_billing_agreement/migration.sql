-- CreateEnum
CREATE TYPE "public"."BillingAgreementStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DRAFT');

-- CreateEnum
CREATE TYPE "public"."BillingModality" AS ENUM ('MONTHLY_SETTLEMENT', 'FONASA_VOUCHER', 'ISAPRE_VOUCHER', 'CASH', 'CHECK', 'BANK_TRANSFER', 'OTHER');

-- CreateTable
CREATE TABLE "public"."billing_concepts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "referencePrice" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "billing_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_agreements" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "status" "public"."BillingAgreementStatus" NOT NULL DEFAULT 'ACTIVE',
    "contractDate" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "paymentTerms" "public"."PaymentTerms" NOT NULL DEFAULT 'NET_30',
    "customPaymentDays" INTEGER,
    "billingDayOfMonth" INTEGER,
    "isMonthlySettlement" BOOLEAN NOT NULL DEFAULT false,
    "billingModalities" "public"."BillingModality"[],
    "examTypes" TEXT[],
    "operationalFlags" JSONB,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "billing_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_agreement_lines" (
    "id" TEXT NOT NULL,
    "billingAgreementId" TEXT NOT NULL,
    "billingConceptId" TEXT NOT NULL,
    "factor" DECIMAL(8,4) NOT NULL DEFAULT 1,
    "negotiatedPrice" DECIMAL(18,2) NOT NULL,
    "referencePrice" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "billing_agreement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_contacts" (
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
    "billingAgreementId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "billing_contacts_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add billingAgreementId to lab_origins
ALTER TABLE "public"."lab_origins" ADD COLUMN "billingAgreementId" TEXT;

-- AlterTable: Drop contract fields from lab_origins
ALTER TABLE "public"."lab_origins" DROP COLUMN IF EXISTS "contractDate",
DROP COLUMN IF EXISTS "contractActive",
DROP COLUMN IF EXISTS "incorporationDate",
DROP COLUMN IF EXISTS "agreementDate",
DROP COLUMN IF EXISTS "lastAddendumNumber",
DROP COLUMN IF EXISTS "lastAddendumDate",
DROP COLUMN IF EXISTS "lastAddendumDetail";

-- AlterTable: Drop billing fields from legal_entities
ALTER TABLE "public"."legal_entities" DROP COLUMN IF EXISTS "paymentTerms",
DROP COLUMN IF EXISTS "customPaymentDays",
DROP COLUMN IF EXISTS "billingDayOfMonth";

-- DropTable
DROP TABLE IF EXISTS "public"."lab_origin_pricing";

-- CreateIndex
CREATE UNIQUE INDEX "billing_concepts_tenantId_code_key" ON "public"."billing_concepts"("tenantId", "code");

-- CreateIndex
CREATE INDEX "billing_concepts_tenantId_idx" ON "public"."billing_concepts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_agreements_tenantId_code_key" ON "public"."billing_agreements"("tenantId", "code");

-- CreateIndex
CREATE INDEX "billing_agreements_tenantId_idx" ON "public"."billing_agreements"("tenantId");

-- CreateIndex
CREATE INDEX "billing_agreements_legalEntityId_idx" ON "public"."billing_agreements"("legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_agreement_lines_billingAgreementId_billingConceptId_key" ON "public"."billing_agreement_lines"("billingAgreementId", "billingConceptId");

-- CreateIndex
CREATE INDEX "billing_agreement_lines_billingAgreementId_idx" ON "public"."billing_agreement_lines"("billingAgreementId");

-- CreateIndex
CREATE INDEX "billing_agreement_lines_billingConceptId_idx" ON "public"."billing_agreement_lines"("billingConceptId");

-- CreateIndex
CREATE INDEX "billing_agreement_lines_tenantId_idx" ON "public"."billing_agreement_lines"("tenantId");

-- CreateIndex
CREATE INDEX "billing_contacts_billingAgreementId_idx" ON "public"."billing_contacts"("billingAgreementId");

-- CreateIndex
CREATE INDEX "billing_contacts_tenantId_idx" ON "public"."billing_contacts"("tenantId");

-- CreateIndex
CREATE INDEX "lab_origins_billingAgreementId_idx" ON "public"."lab_origins"("billingAgreementId");

-- AddForeignKey
ALTER TABLE "public"."billing_concepts" ADD CONSTRAINT "billing_concepts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_agreements" ADD CONSTRAINT "billing_agreements_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "public"."legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_agreements" ADD CONSTRAINT "billing_agreements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_agreement_lines" ADD CONSTRAINT "billing_agreement_lines_billingAgreementId_fkey" FOREIGN KEY ("billingAgreementId") REFERENCES "public"."billing_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_agreement_lines" ADD CONSTRAINT "billing_agreement_lines_billingConceptId_fkey" FOREIGN KEY ("billingConceptId") REFERENCES "public"."billing_concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_contacts" ADD CONSTRAINT "billing_contacts_billingAgreementId_fkey" FOREIGN KEY ("billingAgreementId") REFERENCES "public"."billing_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lab_origins" ADD CONSTRAINT "lab_origins_billingAgreementId_fkey" FOREIGN KEY ("billingAgreementId") REFERENCES "public"."billing_agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
