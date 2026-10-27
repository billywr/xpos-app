-- ===== Recurring utility expense (recurring monthly bills like Rent, Electricity, Internet) =====
-- Uses TEXT for apply_timing to avoid varchar operator ambiguity from enum casts (V5/V8/V11/V25).
CREATE TABLE recurring_utility_expense (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    name VARCHAR(150) NOT NULL,
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    apply_timing TEXT NOT NULL DEFAULT 'BEGINNING_OF_MONTH' CHECK (apply_timing IN ('BEGINNING_OF_MONTH', 'END_OF_MONTH')),
    due_day_of_month INT NOT NULL DEFAULT 1 CHECK (due_day_of_month >= 1 AND due_day_of_month <= 31),
    payee VARCHAR(255),
    account_number VARCHAR(100),
    incurred_by VARCHAR(150),
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES staff_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_recurring_utility_org_branch ON recurring_utility_expense(org_id, branch_id);
CREATE INDEX ix_recurring_utility_active ON recurring_utility_expense(active);
CREATE INDEX ix_recurring_utility_deleted_at ON recurring_utility_expense(deleted_at);
CREATE INDEX ix_recurring_utility_created_at ON recurring_utility_expense(created_at);
