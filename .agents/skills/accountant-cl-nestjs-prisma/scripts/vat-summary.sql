-- Resumen IVA mensual (base auditable)
-- Supuestos:
--  - tax_transactions.direction usa valores: output/input
--  - tax_codes.kind = 'iva'
-- Parámetros:
--  :company_id, :period_id

SELECT
  tc.code AS tax_code,
  tc.kind,
  SUM(COALESCE(tt.base_amount,0))::numeric(18,2) AS total_base,
  SUM(COALESCE(tt.tax_amount,0))::numeric(18,2) AS total_tax,
  COUNT(*) AS tx_count,
  MIN(tt.occurred_at) AS first_tx_at,
  MAX(tt.occurred_at) AS last_tx_at
FROM tax_transactions tt
JOIN tax_codes tc ON tc.id = tt.tax_code_id
WHERE tt.company_id = :company_id
  AND tt.period_id = :period_id
  AND tc.kind = 'iva'
GROUP BY tc.code, tc.kind
ORDER BY tc.code;
