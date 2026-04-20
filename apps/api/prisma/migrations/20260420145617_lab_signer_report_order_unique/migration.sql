-- Add unique constraint (diagnosticReportId, signatureOrder) on lab_diagnostic_report_signers
-- so that upsert() can use the compound unique key diagnosticReportId_signatureOrder.
CREATE UNIQUE INDEX "lab_diagnostic_report_signers_diagnosticReportId_signatureO_key"
ON "mod_lab"."lab_diagnostic_report_signers"("diagnosticReportId", "signatureOrder");
