-- Migration: add triggeredJobId column + unique index to lab_report_validations
--
-- Purpose: BullMQ job id becomes the idempotency key for validation rows.
-- A retry of the same job upserts the existing row instead of creating a
-- duplicate. Re-triggers (new job id) create new rows.

ALTER TABLE "mod_lab"."lab_report_validations"
  ADD COLUMN "triggeredJobId" TEXT;

CREATE UNIQUE INDEX "lab_report_validations_triggeredJobId_key"
  ON "mod_lab"."lab_report_validations" ("triggeredJobId");
