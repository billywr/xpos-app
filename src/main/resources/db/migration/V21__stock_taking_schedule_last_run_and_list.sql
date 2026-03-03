-- Stock taking: idempotency for scheduled runs. Prevents duplicate sessions when cron fires
-- multiple times in same minute or when trigger is used. Industry standard: one count per
-- schedule per period (DAILY=per day, WEEKLY=per week).
ALTER TABLE stock_taking_schedule
    ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_stock_taking_schedule_org_list
    ON stock_taking_schedule(org_id, created_at DESC);

COMMENT ON COLUMN stock_taking_schedule.last_run_at IS
    'When this schedule last created a session. Used for idempotency (DAILY: once per day; WEEKLY: once per week).';
