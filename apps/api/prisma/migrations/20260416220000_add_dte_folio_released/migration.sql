-- Track folios released back by emission failures (terminal ERROR state)
-- for reporting as FoliosAnulados in the next RCOF.
ALTER TABLE "dtes" ADD COLUMN "folioReleased" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "dtes_tenantId_folioReleased_status_idx" ON "dtes"("tenantId", "folioReleased", "status");
