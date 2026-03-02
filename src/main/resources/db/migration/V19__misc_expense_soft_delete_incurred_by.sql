-- Soft delete and incurred-by for misc expenses.

ALTER TABLE misc_expense ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE misc_expense ADD COLUMN incurred_by VARCHAR(255);
CREATE INDEX ix_misc_expense_deleted_at ON misc_expense(deleted_at)
    WHERE deleted_at IS NOT NULL;
