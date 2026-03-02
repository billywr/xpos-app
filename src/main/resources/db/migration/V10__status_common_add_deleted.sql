-- Add DELETED to status_common enum for soft-delete support.
ALTER TYPE status_common ADD VALUE IF NOT EXISTS 'DELETED';
