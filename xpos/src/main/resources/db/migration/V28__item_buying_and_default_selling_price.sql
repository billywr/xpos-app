-- Item-level default buying price (cascades to goods receipt as received unit cost)
-- and default selling price (used when adding item to a price list).
-- Both nullable for backward compatibility.

ALTER TABLE item
    ADD COLUMN IF NOT EXISTS buying_price NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS default_selling_price NUMERIC(18,2);

COMMENT ON COLUMN item.buying_price IS 'Default cost per unit; used as received unit cost on GRN lines (read-only in UI when set).';
COMMENT ON COLUMN item.default_selling_price IS 'Default selling price; used when adding item to a price list.';
