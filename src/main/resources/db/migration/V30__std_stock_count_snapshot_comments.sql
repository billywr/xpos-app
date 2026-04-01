-- Optional free-text notes per stock count row (Standard Stock Count Sheet).
ALTER TABLE std_stock_count_snapshot
    ADD COLUMN IF NOT EXISTS comments TEXT;
