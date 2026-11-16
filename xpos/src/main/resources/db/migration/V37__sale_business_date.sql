-- business_date on sale captures the business day the sale is attributed to
-- (used by Sales Recording screen for backdated entries up to 7 days past).
-- Nullable: pre-existing sales derive businessDate from completedAt in branch TZ.
ALTER TABLE sale ADD COLUMN IF NOT EXISTS business_date DATE;

CREATE INDEX IF NOT EXISTS idx_sale_org_branch_business_date
    ON sale (org_id, branch_id, business_date);

COMMENT ON COLUMN sale.business_date IS
    'Business day the sale is attributed to (may differ from created_at for backdated historical entries).';
