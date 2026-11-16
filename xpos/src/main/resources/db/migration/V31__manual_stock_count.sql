-- Manual bar-style stock sheet: independent of ledger/GRN; opening carries from prior day's saved closing.
CREATE TABLE IF NOT EXISTS manual_stock_count_sheet (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    business_date DATE NOT NULL,
    last_saved_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_manual_stock_sheet_org FOREIGN KEY (org_id) REFERENCES org (id),
    CONSTRAINT fk_manual_stock_sheet_branch FOREIGN KEY (branch_id) REFERENCES branch (id),
    CONSTRAINT uq_manual_stock_count_sheet_branch_date UNIQUE (branch_id, business_date)
);

CREATE INDEX ix_manual_stock_sheet_branch_date ON manual_stock_count_sheet (branch_id, business_date);
CREATE INDEX ix_manual_stock_sheet_org ON manual_stock_count_sheet (org_id);

CREATE TABLE IF NOT EXISTS manual_stock_count_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id UUID NOT NULL,
    line_order INT NOT NULL DEFAULT 0,
    item_id UUID,
    item_name VARCHAR(512) NOT NULL,
    sku VARCHAR(128),
    opening_qty INT NOT NULL DEFAULT 0,
    added_qty INT NOT NULL DEFAULT 0,
    added_today_qty INT NOT NULL DEFAULT 0,
    closing_qty INT,
    system_qty INT,
    selling_price NUMERIC(20, 4) NOT NULL DEFAULT 0,
    comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_manual_stock_line_sheet FOREIGN KEY (sheet_id) REFERENCES manual_stock_count_sheet (id) ON DELETE CASCADE,
    CONSTRAINT fk_manual_stock_line_item FOREIGN KEY (item_id) REFERENCES item (id)
);

CREATE INDEX ix_manual_stock_line_sheet ON manual_stock_count_line (sheet_id);
