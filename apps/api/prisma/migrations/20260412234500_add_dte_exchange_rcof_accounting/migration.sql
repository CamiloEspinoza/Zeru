-- AlterTable
ALTER TABLE "legal_entities" ADD COLUMN "dteExchangeEmail" TEXT;
ALTER TABLE "legal_entities" ADD COLUMN "isAuthorizedDte" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "legal_entities" ADD COLUMN "siiLastRefresh" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "dte_exchanges" (
    "id" TEXT NOT NULL,
    "status" "ExchangeStatus" NOT NULL DEFAULT 'PENDING_SEND',
    "recipientEmail" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dteId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "dte_exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dte_exchange_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "xmlContent" TEXT,
    "metadata" JSONB,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exchangeId" TEXT NOT NULL,

    CONSTRAINT "dte_exchange_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dte_rcofs" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "environment" "DteEnvironment" NOT NULL,
    "status" "RcofStatus" NOT NULL DEFAULT 'PENDING',
    "summary" JSONB NOT NULL,
    "xmlContent" TEXT,
    "siiTrackId" TEXT,
    "siiResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "dte_rcofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dte_account_mappings" (
    "id" TEXT NOT NULL,
    "dteTypeCode" INTEGER NOT NULL,
    "direction" "DteDirection" NOT NULL,
    "receivableAccountId" TEXT,
    "payableAccountId" TEXT,
    "cashAccountId" TEXT,
    "revenueAccountId" TEXT,
    "revenueExemptAccountId" TEXT,
    "purchaseAccountId" TEXT,
    "ivaDebitoAccountId" TEXT,
    "ivaCreditoAccountId" TEXT,
    "salesReturnAccountId" TEXT,
    "purchaseReturnAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "dte_account_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dte_exchanges_tenantId_status_idx" ON "dte_exchanges"("tenantId", "status");

-- CreateIndex
CREATE INDEX "dte_exchanges_tenantId_deadlineAt_idx" ON "dte_exchanges"("tenantId", "deadlineAt");

-- CreateIndex
CREATE INDEX "dte_exchange_events_exchangeId_idx" ON "dte_exchange_events"("exchangeId");

-- CreateIndex
CREATE INDEX "dte_rcofs_tenantId_status_idx" ON "dte_rcofs"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dte_rcofs_tenantId_date_environment_key" ON "dte_rcofs"("tenantId", "date", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "dte_account_mappings_tenantId_dteTypeCode_direction_key" ON "dte_account_mappings"("tenantId", "dteTypeCode", "direction");

-- AddForeignKey
ALTER TABLE "dte_exchanges" ADD CONSTRAINT "dte_exchanges_dteId_fkey" FOREIGN KEY ("dteId") REFERENCES "dtes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dte_exchange_events" ADD CONSTRAINT "dte_exchange_events_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "dte_exchanges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dte_rcofs" ADD CONSTRAINT "dte_rcofs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dte_account_mappings" ADD CONSTRAINT "dte_account_mappings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
