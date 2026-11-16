CREATE TABLE IF NOT EXISTS sales_recording_draft (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    terminal_id UUID NOT NULL REFERENCES terminal(id),
    iam_user_id TEXT NOT NULL,
    sale_date DATE NOT NULL,
    draft_json JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, branch_id, terminal_id, iam_user_id, sale_date)
);

CREATE INDEX IF NOT EXISTS idx_sales_recording_draft_scope
    ON sales_recording_draft (org_id, branch_id, terminal_id, iam_user_id);
