-- Stock taking schedule: daily or weekly automatic stock counts per branch.
-- One active schedule per branch. Manual sessions remain available.
CREATE TABLE IF NOT EXISTS stock_taking_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    branch_id UUID NOT NULL REFERENCES branch(id),
    frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY')),
    day_of_week INTEGER CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
    scheduled_hour INTEGER NOT NULL CHECK (scheduled_hour >= 0 AND scheduled_hour <= 23),
    scheduled_minute INTEGER NOT NULL CHECK (scheduled_minute >= 0 AND scheduled_minute <= 59),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_stock_taking_schedule_branch UNIQUE (org_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_taking_schedule_org_branch ON stock_taking_schedule(org_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_taking_schedule_active ON stock_taking_schedule(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE stock_taking_schedule IS 'Configures automatic stock count sessions. DAILY: every day at scheduled time. WEEKLY: day_of_week (0=Sunday) at scheduled time.';
COMMENT ON COLUMN stock_taking_schedule.day_of_week IS '0=Sunday, 1=Monday, ..., 6=Saturday. Required when frequency=WEEKLY.';

-- Extend stock_count_session: source (manual vs scheduled), optional schedule reference, who closed.
ALTER TABLE stock_count_session
    ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES stock_taking_schedule(id),
    ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES staff_user(id);

ALTER TABLE stock_count_session
    ADD CONSTRAINT chk_stock_count_session_source_type CHECK (source_type IN ('MANUAL', 'SCHEDULED'));

CREATE INDEX IF NOT EXISTS idx_stock_count_session_schedule ON stock_count_session(schedule_id) WHERE schedule_id IS NOT NULL;
