-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "citolab_fm";

-- CreateEnum
CREATE TYPE "citolab_fm"."FmSyncStatus" AS ENUM ('SYNCED', 'PENDING_TO_FM', 'PENDING_TO_ZERU', 'ERROR');

-- CreateTable
CREATE TABLE "citolab_fm"."fm_sync_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fmDatabase" TEXT NOT NULL,
    "fmLayout" TEXT NOT NULL,
    "fmRecordId" TEXT NOT NULL,
    "fmModId" TEXT,
    "syncStatus" "citolab_fm"."FmSyncStatus" NOT NULL DEFAULT 'SYNCED',
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fm_sync_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citolab_fm"."fm_sync_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "fmRecordId" TEXT,
    "action" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "details" JSONB,
    "error" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fm_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fm_sync_records_syncStatus_idx" ON "citolab_fm"."fm_sync_records"("syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "fm_sync_records_tenantId_entityType_entityId_key" ON "citolab_fm"."fm_sync_records"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "fm_sync_records_tenantId_fmDatabase_fmLayout_fmRecordId_key" ON "citolab_fm"."fm_sync_records"("tenantId", "fmDatabase", "fmLayout", "fmRecordId");

-- CreateIndex
CREATE INDEX "fm_sync_logs_tenantId_createdAt_idx" ON "citolab_fm"."fm_sync_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "fm_sync_logs_entityType_action_idx" ON "citolab_fm"."fm_sync_logs"("entityType", "action");

-- AddForeignKey
ALTER TABLE "citolab_fm"."fm_sync_records" ADD CONSTRAINT "fm_sync_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
