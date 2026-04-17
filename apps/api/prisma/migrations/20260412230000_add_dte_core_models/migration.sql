-- CreateTable
CREATE TABLE "dtes" (
    "id" TEXT NOT NULL,
    "dteType" "DteType" NOT NULL,
    "folio" INTEGER NOT NULL,
    "environment" "DteEnvironment" NOT NULL,
    "status" "DteStatus" NOT NULL DEFAULT 'DRAFT',
    "direction" "DteDirection" NOT NULL DEFAULT 'EMITTED',
    "emisorRut" TEXT NOT NULL,
    "emisorRazon" TEXT NOT NULL,
    "emisorGiro" TEXT,
    "receptorRut" TEXT,
    "receptorRazon" TEXT,
    "receptorGiro" TEXT,
    "receptorDir" TEXT,
    "receptorComuna" TEXT,
    "receptorCiudad" TEXT,
    "formaPago" INTEGER,
    "medioPago" TEXT,
    "indServicio" INTEGER,
    "periodoDesde" TIMESTAMP(3),
    "periodoHasta" TIMESTAMP(3),
    "fechaVenc" TIMESTAMP(3),
    "montoNeto" INTEGER NOT NULL DEFAULT 0,
    "montoExento" INTEGER NOT NULL DEFAULT 0,
    "montoBruto" INTEGER,
    "tasaIva" DECIMAL(5,2) NOT NULL DEFAULT 19,
    "iva" INTEGER NOT NULL DEFAULT 0,
    "ivaRetTotal" INTEGER NOT NULL DEFAULT 0,
    "montoTotal" INTEGER NOT NULL DEFAULT 0,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "xmlContent" TEXT,
    "tedXml" TEXT,
    "xmlS3Key" TEXT,
    "pdfS3Key" TEXT,
    "siiTrackId" TEXT,
    "siiResponse" JSONB,
    "receptionDate" TIMESTAMP(3),
    "deadlineDate" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "folioRangeId" TEXT,
    "legalEntityId" TEXT,
    "journalEntryId" TEXT,
    "createdById" TEXT,
    "decidedById" TEXT,

    CONSTRAINT "dtes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dte_items" (
    "id" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "description" TEXT,
    "indExe" INTEGER,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unit" TEXT,
    "unitPrice" DECIMAL(18,6) NOT NULL,
    "descuentoPct" DECIMAL(5,2),
    "descuentoMonto" DECIMAL(18,2),
    "recargoPct" DECIMAL(5,2),
    "recargoMonto" DECIMAL(18,2),
    "montoItem" DECIMAL(18,2) NOT NULL,
    "codigosItem" JSONB,
    "dteId" TEXT NOT NULL,

    CONSTRAINT "dte_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dte_references" (
    "id" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "tipoDocRef" INTEGER NOT NULL,
    "folioRef" INTEGER NOT NULL,
    "fechaRef" TIMESTAMP(3) NOT NULL,
    "codRef" "DteReferenceCode",
    "razonRef" TEXT,
    "dteId" TEXT NOT NULL,
    "referencedDteId" TEXT,

    CONSTRAINT "dte_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dte_global_discounts" (
    "id" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "tipoMovimiento" TEXT NOT NULL,
    "glosa" TEXT,
    "tipoValor" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "indExeDR" INTEGER,
    "dteId" TEXT NOT NULL,

    CONSTRAINT "dte_global_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dte_logs" (
    "id" TEXT NOT NULL,
    "action" "DteLogAction" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dteId" TEXT NOT NULL,

    CONSTRAINT "dte_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dtes_journalEntryId_key" ON "dtes"("journalEntryId");

-- CreateIndex
CREATE INDEX "dtes_tenantId_status_idx" ON "dtes"("tenantId", "status");

-- CreateIndex
CREATE INDEX "dtes_tenantId_dteType_idx" ON "dtes"("tenantId", "dteType");

-- CreateIndex
CREATE INDEX "dtes_tenantId_direction_idx" ON "dtes"("tenantId", "direction");

-- CreateIndex
CREATE INDEX "dtes_tenantId_direction_status_idx" ON "dtes"("tenantId", "direction", "status");

-- CreateIndex
CREATE INDEX "dtes_tenantId_fechaEmision_idx" ON "dtes"("tenantId", "fechaEmision");

-- CreateIndex
CREATE INDEX "dtes_tenantId_receptorRut_idx" ON "dtes"("tenantId", "receptorRut");

-- CreateIndex
CREATE INDEX "dtes_tenantId_emisorRut_idx" ON "dtes"("tenantId", "emisorRut");

-- CreateIndex
CREATE INDEX "dtes_tenantId_legalEntityId_idx" ON "dtes"("tenantId", "legalEntityId");

-- CreateIndex
CREATE INDEX "dtes_tenantId_deadlineDate_idx" ON "dtes"("tenantId", "deadlineDate");

-- CreateIndex
CREATE INDEX "dtes_siiTrackId_idx" ON "dtes"("siiTrackId");

-- CreateIndex
CREATE UNIQUE INDEX "dtes_tenantId_dteType_folio_emisorRut_key" ON "dtes"("tenantId", "dteType", "folio", "emisorRut");

-- CreateIndex
CREATE INDEX "dte_items_dteId_idx" ON "dte_items"("dteId");

-- CreateIndex
CREATE INDEX "dte_references_dteId_idx" ON "dte_references"("dteId");

-- CreateIndex
CREATE INDEX "dte_global_discounts_dteId_idx" ON "dte_global_discounts"("dteId");

-- CreateIndex
CREATE INDEX "dte_logs_dteId_action_idx" ON "dte_logs"("dteId", "action");

-- CreateIndex
CREATE INDEX "dte_logs_createdAt_idx" ON "dte_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "dtes" ADD CONSTRAINT "dtes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtes" ADD CONSTRAINT "dtes_folioRangeId_fkey" FOREIGN KEY ("folioRangeId") REFERENCES "dte_folios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtes" ADD CONSTRAINT "dtes_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtes" ADD CONSTRAINT "dtes_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtes" ADD CONSTRAINT "dtes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtes" ADD CONSTRAINT "dtes_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dte_items" ADD CONSTRAINT "dte_items_dteId_fkey" FOREIGN KEY ("dteId") REFERENCES "dtes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dte_references" ADD CONSTRAINT "dte_references_dteId_fkey" FOREIGN KEY ("dteId") REFERENCES "dtes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dte_global_discounts" ADD CONSTRAINT "dte_global_discounts_dteId_fkey" FOREIGN KEY ("dteId") REFERENCES "dtes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dte_logs" ADD CONSTRAINT "dte_logs_dteId_fkey" FOREIGN KEY ("dteId") REFERENCES "dtes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
