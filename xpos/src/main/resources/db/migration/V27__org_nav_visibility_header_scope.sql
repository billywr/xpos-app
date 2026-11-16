-- Add 'header' scope for top navigation bar (Home, Admin, Operator, Org).
ALTER TABLE org_nav_visibility
    DROP CONSTRAINT IF EXISTS chk_org_nav_visibility_scope;

ALTER TABLE org_nav_visibility
    ADD CONSTRAINT chk_org_nav_visibility_scope
    CHECK (scope IN ('admin', 'operator', 'header'));
