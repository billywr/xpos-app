-- M-Pesa STK Push: org/branch Daraja config and STK request tracking

CREATE TABLE IF NOT EXISTS mpesa_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID REFERENCES branch(id),
    environment TEXT NOT NULL DEFAULT 'SANDBOX',
    consumer_key TEXT NOT NULL,
    consumer_secret TEXT NOT NULL,
    passkey TEXT NOT NULL,
    shortcode TEXT NOT NULL,
    till_number TEXT,
    stk_auto_complete BOOLEAN NOT NULL DEFAULT false,
    callback_base_url TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mpesa_config_org_branch
    ON mpesa_config (org_id, branch_id)
    NULLS NOT DISTINCT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mpesa_config_active_org_default
    ON mpesa_config (org_id)
    WHERE branch_id IS NULL AND status = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS uq_mpesa_config_active_branch
    ON mpesa_config (org_id, branch_id)
    WHERE branch_id IS NOT NULL AND status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_mpesa_config_org ON mpesa_config (org_id);

CREATE TABLE IF NOT EXISTS mpesa_stk_request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    terminal_id UUID NOT NULL REFERENCES terminal(id),
    sale_id UUID NOT NULL REFERENCES sale(id),
    staff_user_id UUID NOT NULL REFERENCES staff_user(id),
    amount NUMERIC(18, 2) NOT NULL,
    phone_number TEXT NOT NULL,
    account_reference TEXT NOT NULL,
    checkout_request_id TEXT,
    merchant_request_id TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    result_code INTEGER,
    result_desc TEXT,
    mpesa_receipt_number TEXT,
    tender_id UUID REFERENCES tender(id),
    raw_callback_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    callback_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_mpesa_stk_amount_positive CHECK (amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mpesa_stk_checkout_request_id
    ON mpesa_stk_request (checkout_request_id)
    WHERE checkout_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mpesa_stk_merchant_request_id
    ON mpesa_stk_request (merchant_request_id)
    WHERE merchant_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mpesa_stk_receipt_org
    ON mpesa_stk_request (org_id, mpesa_receipt_number)
    WHERE mpesa_receipt_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mpesa_stk_sale_status
    ON mpesa_stk_request (sale_id, status);

CREATE INDEX IF NOT EXISTS idx_mpesa_stk_org_created
    ON mpesa_stk_request (org_id, created_at DESC);

-- Seed MPESA_STK tender type for all orgs
INSERT INTO tender_type (org_id, code, name)
SELECT o.id, 'MPESA_STK', 'M-Pesa STK'
FROM org o
ON CONFLICT (org_id, code) DO NOTHING;

-- Enable duplicate M-Pesa receipt detection on payment references
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_ref
    ON payment_reference (org_id, reference_type, reference_value);
