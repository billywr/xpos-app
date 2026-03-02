-- Add active column for soft delete. Inactive suppliers excluded from list and from GRN selection.
ALTER TABLE supplier ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
COMMENT ON COLUMN supplier.active IS 'Soft delete: false means supplier is deactivated and hidden from lists';
