-- Move POS visibility from price_list_item to item directly.
-- Prices now live on item (buyingPrice, defaultSellingPrice) — price lists are no longer used.
ALTER TABLE item ADD COLUMN IF NOT EXISTS visible_in_pos BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill: if an item has ONLY hidden price list entries (all visible_in_pos=false), mark it hidden.
UPDATE item SET visible_in_pos = FALSE
WHERE id IN (
    SELECT DISTINCT pli.item_id FROM price_list_item pli WHERE pli.visible_in_pos = FALSE
)
AND id NOT IN (
    SELECT DISTINCT pli.item_id FROM price_list_item pli WHERE pli.visible_in_pos = TRUE
);
