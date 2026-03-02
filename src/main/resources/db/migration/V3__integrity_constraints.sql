-- Add missing integrity constraints to align schema with xpos entity relationship spec.
-- This migration is safe to run after V1/V2 have already been applied.

-- 1) Ensure one receipt is linked to at most one sale (per org).
CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_org_receipt
ON sale (org_id, receipt_id)
WHERE receipt_id IS NOT NULL;

-- 2) Ensure audit vault hash chain is tamper-evident by preventing duplicate hashes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_vault_chain_hash
ON audit_vault_record (org_id, branch_id, hash);

-- 3) Ensure each (event_type, event_id) is recorded once per branch in audit vault.
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_vault_event
ON audit_vault_record (org_id, branch_id, event_type, event_id);
