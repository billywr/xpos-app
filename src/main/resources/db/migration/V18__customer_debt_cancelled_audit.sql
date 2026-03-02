-- Audit trail for cancelled (cleared) debts.

ALTER TABLE customer_debt ADD COLUMN cancelled_at TIMESTAMPTZ;
ALTER TABLE customer_debt ADD COLUMN cancelled_by UUID REFERENCES staff_user(id);
CREATE INDEX ix_customer_debt_cancelled_at ON customer_debt(cancelled_at)
    WHERE cancelled_at IS NOT NULL;
