-- Add fields needed for touch-screen POS UX (pub/restaurant quick keys).
-- Safe, additive migration.

ALTER TABLE item
    ADD COLUMN IF NOT EXISTS display_name TEXT,
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quick_key_color TEXT;

-- Optional: support multiple images per item for richer catalog UI.
CREATE TABLE IF NOT EXISTS item_image (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    item_id UUID NOT NULL REFERENCES item(id),
    url TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce at most one primary image per (org_id,item_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_item_image_primary
ON item_image (org_id, item_id)
WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_item_image_item
ON item_image (org_id, item_id, sort_order);
