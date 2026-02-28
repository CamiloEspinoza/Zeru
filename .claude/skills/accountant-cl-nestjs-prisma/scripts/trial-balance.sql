-- Trial Balance (Balance de Comprobación) por periodo
-- Supuestos:
--  - PostgreSQL
--  - Se incluyen solo asientos POSTED
-- Parámetros:
--  :company_id, :period_start, :period_end

WITH movements AS (
  SELECT
    a.id AS account_id,
    a.code,
    a.name,
    a.type,
    SUM(COALESCE(jel.debit, 0))::numeric(18,2) AS period_debits,
    SUM(COALESCE(jel.credit, 0))::numeric(18,2) AS period_credits
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.entry_id
  JOIN accounts a ON a.id = jel.account_id
  WHERE je.company_id = :company_id
    AND je.status = 'POSTED'
    AND je.entry_date >= :period_start
    AND je.entry_date < (:period_end::date + INTERVAL '1 day')
  GROUP BY a.id, a.code, a.name, a.type
)
SELECT
  account_id,
  code,
  name,
  type,
  period_debits,
  period_credits,
  CASE
    WHEN type IN ('ASSET', 'EXPENSE')
      THEN (period_debits - period_credits)::numeric(18,2)
    ELSE
      (period_credits - period_debits)::numeric(18,2)
  END AS balance
FROM movements
ORDER BY code;
