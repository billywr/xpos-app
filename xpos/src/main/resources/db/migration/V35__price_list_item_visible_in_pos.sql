-- Per-price-list-item POS/menu visibility toggle.
-- Default TRUE so existing items remain visible.
ALTER TABLE price_list_item ADD COLUMN IF NOT EXISTS
    visible_in_pos BOOLEAN NOT NULL DEFAULT TRUE;
