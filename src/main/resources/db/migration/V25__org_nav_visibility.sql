-- Org-level nav visibility: admin/operator sidebar items.
-- Stored per org per scope; enables same settings across devices and locations.
-- Uses TEXT for scope to avoid varchar operator ambiguity from enum casts (V5/V8/V11).
CREATE TABLE IF NOT EXISTS org_nav_visibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES org(id),
    scope TEXT NOT NULL,
    visibility_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_org_nav_visibility_org_scope UNIQUE (org_id, scope),
    CONSTRAINT chk_org_nav_visibility_scope CHECK (scope IN ('admin', 'operator'))
);

CREATE INDEX ix_org_nav_visibility_org ON org_nav_visibility(org_id);
