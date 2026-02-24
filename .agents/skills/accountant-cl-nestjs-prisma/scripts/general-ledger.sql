-- Libro Mayor por cuenta con saldo acumulado simple
-- Parámetros:
--  :company_id, :account_id, :date_from, :date_to

WITH lines AS (
  SELECT
    je.entry_date,
    je.entry_number,
    je.description,
    jel.line_number,
    jel.debit::numeric(18,2) AS debit,
    jel.credit::numeric(18,2) AS credit
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.entry_id
  WHERE je.company_id = :company_id
    AND je.status = 'POSTED'
    AND jel.account_id = :account_id
    AND je.entry_date >= :date_from
    AND je.entry_date < (:date_to::date + INTERVAL '1 day')
)
SELECT
  entry_date,
  entry_number,
  description,
  line_number,
  debit,
  credit,
  SUM(debit - credit) OVER (ORDER BY entry_date, entry_number, line_number) AS running_balance_debit_nature
FROM lines
ORDER BY entry_date, entry_number, line_number;
