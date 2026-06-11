-- Org-level toggle: show Pay by M-Pesa STK at operator checkout (default hidden).
ALTER TABLE org
    ADD COLUMN IF NOT EXISTS mpesa_stk_operator_enabled BOOLEAN NOT NULL DEFAULT false;
