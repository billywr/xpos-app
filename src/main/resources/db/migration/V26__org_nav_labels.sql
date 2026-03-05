-- Custom labels for nav items (path -> display label). Empty = use default from config.
ALTER TABLE org_nav_visibility
    ADD COLUMN IF NOT EXISTS labels_json JSONB NOT NULL DEFAULT '{}';
