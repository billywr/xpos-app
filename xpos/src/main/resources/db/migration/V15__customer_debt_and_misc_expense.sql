-- ===== Customer debt (credit sales / manual debt recording) =====
CREATE TYPE customer_debt_status AS ENUM ('OPEN', 'PARTIAL', 'SETTLED', 'CANCELLED');

CREATE TABLE customer_debt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    customer_id UUID NOT NULL REFERENCES customer(id),
    sale_id UUID REFERENCES sale(id),
    terminal_id UUID REFERENCES terminal(id),
    shift_id UUID REFERENCES shift(id),
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    amount_settled NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (amount_settled >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'KES',
    due_date DATE,
    status customer_debt_status NOT NULL DEFAULT 'OPEN',
    notes TEXT,
    created_by UUID NOT NULL REFERENCES staff_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_customer_debt_amount_settled CHECK (amount_settled <= amount)
);

CREATE INDEX ix_customer_debt_org_id ON customer_debt(org_id);
CREATE INDEX ix_customer_debt_branch_id ON customer_debt(branch_id);
CREATE INDEX ix_customer_debt_customer_id ON customer_debt(customer_id);
CREATE INDEX ix_customer_debt_status ON customer_debt(status);
CREATE INDEX ix_customer_debt_created_at ON customer_debt(created_at);
CREATE INDEX ix_customer_debt_due_date ON customer_debt(due_date);

-- ===== Misc expense (operational expenses recorded by cashier) =====
CREATE TYPE misc_expense_category AS ENUM (
    'UTILITIES', 'SUPPLIES', 'MAINTENANCE', 'TRANSPORT', 'FUEL',
    'RENT', 'SALARIES', 'OTHER'
);

CREATE TABLE misc_expense (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    terminal_id UUID REFERENCES terminal(id),
    shift_id UUID REFERENCES shift(id),
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    category misc_expense_category NOT NULL DEFAULT 'OTHER',
    description TEXT NOT NULL,
    receipt_ref TEXT,
    created_by UUID NOT NULL REFERENCES staff_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_misc_expense_org_id ON misc_expense(org_id);
CREATE INDEX ix_misc_expense_branch_id ON misc_expense(branch_id);
CREATE INDEX ix_misc_expense_created_at ON misc_expense(created_at);
CREATE INDEX ix_misc_expense_category ON misc_expense(category);
