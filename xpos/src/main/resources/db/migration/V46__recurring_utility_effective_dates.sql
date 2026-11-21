-- ===== Add effective_from and effective_to to recurring_utility_expense =====
ALTER TABLE recurring_utility_expense
    ADD COLUMN IF NOT EXISTS effective_from DATE,
    ADD COLUMN IF NOT EXISTS effective_to DATE;

-- Populate existing rows: normalize to 1st of month using created_at (or CURRENT_DATE)
UPDATE recurring_utility_expense
    SET effective_from = DATE_TRUNC('month', COALESCE(created_at, CURRENT_TIMESTAMP))::date
    WHERE effective_from IS NULL;

ALTER TABLE recurring_utility_expense
    ALTER COLUMN effective_from SET NOT NULL,
    ALTER COLUMN effective_from SET DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS ix_recurring_utility_effective_dates
    ON recurring_utility_expense (org_id, branch_id, effective_from, effective_to);
