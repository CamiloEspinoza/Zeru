-- CreateEnum
CREATE TYPE "public"."DteType" AS ENUM ('FACTURA_ELECTRONICA', 'FACTURA_EXENTA_ELECTRONICA', 'BOLETA_ELECTRONICA', 'BOLETA_EXENTA_ELECTRONICA', 'LIQUIDACION_FACTURA_ELECTRONICA', 'FACTURA_COMPRA_ELECTRONICA', 'GUIA_DESPACHO_ELECTRONICA', 'NOTA_DEBITO_ELECTRONICA', 'NOTA_CREDITO_ELECTRONICA');

-- CreateEnum
CREATE TYPE "public"."DteStatus" AS ENUM ('DRAFT', 'QUEUED', 'SIGNED', 'SENT', 'ACCEPTED', 'ACCEPTED_WITH_OBJECTION', 'REJECTED', 'VOIDED', 'ERROR');

-- CreateEnum
CREATE TYPE "public"."DteEnvironment" AS ENUM ('CERTIFICATION', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "public"."DteDirection" AS ENUM ('EMITTED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "public"."DteLogAction" AS ENUM ('CREATED', 'QUEUED', 'FOLIO_ASSIGNED', 'SIGNED', 'SENT_TO_SII', 'SII_RESPONSE', 'ACCEPTED', 'REJECTED', 'VOIDED', 'ERROR', 'EXCHANGE_SENT', 'EXCHANGE_RECEIVED', 'ACCOUNTING_POSTED', 'PDF_GENERATED');

-- CreateEnum
CREATE TYPE "public"."CertificateStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "public"."ExchangeStatus" AS ENUM ('PENDING_SEND', 'SENT', 'RECEIPT_CONFIRMED', 'ACCEPTED', 'REJECTED', 'CLAIMED', 'TACIT_ACCEPTANCE');

-- CreateEnum
CREATE TYPE "public"."RcofStatus" AS ENUM ('PENDING', 'GENERATED', 'SENT', 'ACCEPTED', 'REJECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "public"."DteReferenceCode" AS ENUM ('ANULA_DOCUMENTO', 'CORRIGE_TEXTO', 'CORRIGE_MONTOS');

-- CreateTable
CREATE TABLE "public"."dte_configs" (
    "id" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "giro" TEXT NOT NULL,
    "actividadEco" INTEGER NOT NULL,
    "direccion" TEXT NOT NULL,
    "comuna" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "codigoSucursal" INTEGER,
    "environment" "public"."DteEnvironment" NOT NULL DEFAULT 'CERTIFICATION',
    "resolutionNum" INTEGER NOT NULL,
    "resolutionDate" TIMESTAMP(3) NOT NULL,
    "exchangeEmail" TEXT,
    "imapHost" TEXT,
    "imapPort" INTEGER DEFAULT 993,
    "imapUser" TEXT,
    "imapPass" TEXT,
    "imapEnabled" BOOLEAN NOT NULL DEFAULT false,
    "imapLastPollAt" TIMESTAMP(3),
    "imapLastUid" INTEGER,
    "autoCreateJournalEntry" BOOLEAN NOT NULL DEFAULT true,
    "autoPostJournalEntry" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "dte_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dte_certificates" (
    "id" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "subjectRut" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "public"."CertificateStatus" NOT NULL DEFAULT 'ACTIVE',
    "encryptedP12" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "sha256Fingerprint" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "dte_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dte_folios" (
    "id" TEXT NOT NULL,
    "dteType" "public"."DteType" NOT NULL,
    "environment" "public"."DteEnvironment" NOT NULL,
    "rangeFrom" INTEGER NOT NULL,
    "rangeTo" INTEGER NOT NULL,
    "nextFolio" INTEGER NOT NULL,
    "encryptedCafXml" TEXT NOT NULL,
    "authorizedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isExhausted" BOOLEAN NOT NULL DEFAULT false,
    "alertThreshold" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "dte_folios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dte_configs_tenantId_key" ON "public"."dte_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "dte_certificates_tenantId_sha256Fingerprint_key" ON "public"."dte_certificates"("tenantId", "sha256Fingerprint");

-- CreateIndex
CREATE INDEX "dte_certificates_tenantId_isPrimary_idx" ON "public"."dte_certificates"("tenantId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "dte_folios_tenantId_dteType_environment_rangeFrom_key" ON "public"."dte_folios"("tenantId", "dteType", "environment", "rangeFrom");

-- CreateIndex
CREATE INDEX "dte_folios_tenantId_dteType_environment_isActive_isExhausted_idx" ON "public"."dte_folios"("tenantId", "dteType", "environment", "isActive", "isExhausted");

-- AddForeignKey
ALTER TABLE "public"."dte_configs" ADD CONSTRAINT "dte_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dte_certificates" ADD CONSTRAINT "dte_certificates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dte_folios" ADD CONSTRAINT "dte_folios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
