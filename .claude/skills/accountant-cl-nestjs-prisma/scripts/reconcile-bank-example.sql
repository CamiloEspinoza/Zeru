-- Ejemplo de reconciliación bancaria (matching exacto por monto y ventana de fecha)
-- NOTA: esquema de ejemplo; adaptar nombres de tabla/campos.
-- Parámetros: :company_id, :bank_account_id, :days_window

SELECT
  bm.id AS bank_movement_id,
  bm.movement_date,
  bm.amount AS bank_amount,
  je.id AS journal_entry_id,
  je.entry_date,
  (SUM(jel.debit) - SUM(jel.credit))::numeric(18,2) AS ledger_net
FROM bank_movements bm
JOIN journal_entries je
  ON je.company_id = bm.company_id
 AND je.status = 'POSTED'
 AND je.entry_date BETWEEN (bm.movement_date - (:days_window || ' days')::interval)
                       AND (bm.movement_date + (:days_window || ' days')::interval)
JOIN journal_entry_lines jel ON jel.entry_id = je.id
WHERE bm.company_id = :company_id
  AND bm.bank_account_id = :bank_account_id
  AND bm.reconciled_at IS NULL
GROUP BY bm.id, bm.movement_date, bm.amount, je.id, je.entry_date
HAVING ABS((SUM(jel.debit) - SUM(jel.credit)) - bm.amount) < 0.01
ORDER BY bm.movement_date, je.entry_date;
