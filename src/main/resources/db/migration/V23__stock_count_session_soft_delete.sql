-- Soft delete for stock count sessions. Only OPEN sessions can be soft-deleted.
ALTER TABLE stock_count_session ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE stock_count_session ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES staff_user(id);

CREATE INDEX IF NOT EXISTS ix_stock_count_session_deleted_at
    ON stock_count_session(deleted_at) WHERE deleted_at IS NOT NULL;
