-- Standard Stock Count Sheet: daily closing counts per branch/item for bar-style sheet.
-- Opening + Added = Total; Units Sold = Total - Closing; Amount = Units Sold * Selling Price.
CREATE TABLE IF NOT EXISTS std_stock_count_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    item_id UUID NOT NULL REFERENCES item(id),
    business_date DATE NOT NULL,
    closing_qty NUMERIC(20, 3) NOT NULL DEFAULT 0,
    last_saved_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_std_stock_count_branch_item_date UNIQUE (branch_id, item_id, business_date)
);

CREATE INDEX ix_std_stock_count_branch_date ON std_stock_count_snapshot(branch_id, business_date);
CREATE INDEX ix_std_stock_count_org ON std_stock_count_snapshot(org_id);
