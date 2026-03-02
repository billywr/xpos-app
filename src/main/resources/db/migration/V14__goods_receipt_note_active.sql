-- Add active column for soft delete on goods_receipt_note
ALTER TABLE goods_receipt_note
    ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
