-- ===== Performance composite indexes for high-frequency inventory, GRN, stock movement, and auth queries =====

-- 1) Goods Receipt Notes & GRN Lines
CREATE INDEX IF NOT EXISTS idx_grn_branch_active_received
    ON goods_receipt_note (org_id, branch_id, active, received_at);

CREATE INDEX IF NOT EXISTS idx_grn_line_grn_item
    ON grn_line (grn_id, item_id);

-- 2) Stock Movements (for standard stock count adjustments and ledger aggregations)
CREATE INDEX IF NOT EXISTS idx_stock_movement_branch_type_src_created
    ON stock_movement (org_id, branch_id, movement_type, source_type, created_at);

-- 3) Standard Stock Count Snapshots (for latest snapshot lookup by item)
CREATE INDEX IF NOT EXISTS idx_std_stock_count_branch_item_date_desc
    ON std_stock_count_snapshot (branch_id, item_id, business_date DESC);

-- 4) Staff branch assignment & user lookup for authorization
CREATE INDEX IF NOT EXISTS idx_staff_branch_assignment_branch_staff
    ON staff_branch_assignment (branch_id, staff_user_id);

CREATE INDEX IF NOT EXISTS idx_staff_user_org_iam
    ON staff_user (org_id, iam_user_id);
