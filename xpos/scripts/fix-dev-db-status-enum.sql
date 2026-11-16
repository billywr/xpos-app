-- One-time fix when soft-delete fails with "null value in column status" or
-- "operator does not exist: status_common <> character varying".
-- Run this against your dev DB if V10__status_common_add_deleted did not apply.
--
-- Usage (adjust host/user/db to match application-dev.yml):
--   psql -h localhost -U postgres -d xpos_dev -f scripts/fix-dev-db-status-enum.sql
--
-- Or:
--   psql -h localhost -U postgres -d xpos_dev -c "ALTER TYPE status_common ADD VALUE IF NOT EXISTS 'DELETED';"

ALTER TYPE status_common ADD VALUE IF NOT EXISTS 'DELETED';
