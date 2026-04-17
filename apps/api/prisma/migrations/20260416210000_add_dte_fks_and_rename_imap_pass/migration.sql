-- Rename DteConfig.imapPass -> encryptedImapPass
ALTER TABLE "dte_configs" RENAME COLUMN "imapPass" TO "encryptedImapPass";

-- Add FK from DteReference.referencedDteId -> Dte.id (SET NULL on delete)
ALTER TABLE "dte_references"
  ADD CONSTRAINT "dte_references_referencedDteId_fkey"
  FOREIGN KEY ("referencedDteId") REFERENCES "dtes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "dte_references_referencedDteId_idx"
  ON "dte_references"("referencedDteId");

-- Add FKs from DteAccountMapping.*AccountId -> Account.id (RESTRICT on delete)
ALTER TABLE "dte_account_mappings"
  ADD CONSTRAINT "dte_account_mappings_receivableAccountId_fkey"
  FOREIGN KEY ("receivableAccountId") REFERENCES "accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dte_account_mappings"
  ADD CONSTRAINT "dte_account_mappings_payableAccountId_fkey"
  FOREIGN KEY ("payableAccountId") REFERENCES "accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dte_account_mappings"
  ADD CONSTRAINT "dte_account_mappings_cashAccountId_fkey"
  FOREIGN KEY ("cashAccountId") REFERENCES "accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dte_account_mappings"
  ADD CONSTRAINT "dte_account_mappings_revenueAccountId_fkey"
  FOREIGN KEY ("revenueAccountId") REFERENCES "accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dte_account_mappings"
  ADD CONSTRAINT "dte_account_mappings_revenueExemptAccountId_fkey"
  FOREIGN KEY ("revenueExemptAccountId") REFERENCES "accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dte_account_mappings"
  ADD CONSTRAINT "dte_account_mappings_purchaseAccountId_fkey"
  FOREIGN KEY ("purchaseAccountId") REFERENCES "accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dte_account_mappings"
  ADD CONSTRAINT "dte_account_mappings_ivaDebitoAccountId_fkey"
  FOREIGN KEY ("ivaDebitoAccountId") REFERENCES "accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dte_account_mappings"
  ADD CONSTRAINT "dte_account_mappings_ivaCreditoAccountId_fkey"
  FOREIGN KEY ("ivaCreditoAccountId") REFERENCES "accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dte_account_mappings"
  ADD CONSTRAINT "dte_account_mappings_salesReturnAccountId_fkey"
  FOREIGN KEY ("salesReturnAccountId") REFERENCES "accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dte_account_mappings"
  ADD CONSTRAINT "dte_account_mappings_purchaseReturnAccountId_fkey"
  FOREIGN KEY ("purchaseReturnAccountId") REFERENCES "accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "dte_account_mappings_receivableAccountId_idx"
  ON "dte_account_mappings"("receivableAccountId");
CREATE INDEX "dte_account_mappings_payableAccountId_idx"
  ON "dte_account_mappings"("payableAccountId");
CREATE INDEX "dte_account_mappings_cashAccountId_idx"
  ON "dte_account_mappings"("cashAccountId");
CREATE INDEX "dte_account_mappings_revenueAccountId_idx"
  ON "dte_account_mappings"("revenueAccountId");
CREATE INDEX "dte_account_mappings_revenueExemptAccountId_idx"
  ON "dte_account_mappings"("revenueExemptAccountId");
CREATE INDEX "dte_account_mappings_purchaseAccountId_idx"
  ON "dte_account_mappings"("purchaseAccountId");
CREATE INDEX "dte_account_mappings_ivaDebitoAccountId_idx"
  ON "dte_account_mappings"("ivaDebitoAccountId");
CREATE INDEX "dte_account_mappings_ivaCreditoAccountId_idx"
  ON "dte_account_mappings"("ivaCreditoAccountId");
CREATE INDEX "dte_account_mappings_salesReturnAccountId_idx"
  ON "dte_account_mappings"("salesReturnAccountId");
CREATE INDEX "dte_account_mappings_purchaseReturnAccountId_idx"
  ON "dte_account_mappings"("purchaseReturnAccountId");

-- Add composite index to DteExchangeEvent
CREATE INDEX "dte_exchange_events_exchangeId_eventType_idx"
  ON "dte_exchange_events"("exchangeId", "eventType");
