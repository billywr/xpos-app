CREATE TABLE IF NOT EXISTS pending_cart (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    iam_user_id VARCHAR(255) NOT NULL,
    cart_json JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, branch_id, iam_user_id)
);
