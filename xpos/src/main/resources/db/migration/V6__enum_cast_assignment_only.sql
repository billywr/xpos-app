-- Fix stack depth recursion: cast functions that use $1::enum_type trigger the same cast
-- recursively. Replace with functions that resolve the enum by label via enum_range (no
-- varchar->enum cast in the body). Use IMPLICIT so WHERE clauses and assignments work.

DO $$
DECLARE
    t text;
    enum_types text[] := ARRAY[
        'status_common', 'sale_status', 'item_type', 'vat_category', 'shift_status',
        'denom_stage', 'cash_movement_type', 'movement_type', 'source_type',
        'ledger_account_type', 'debit_credit', 'approval_type', 'ticket_type',
        'ticket_status', 'outbox_status', 'day_close_status', 'etims_status'
    ];
BEGIN
    FOREACH t IN ARRAY enum_types
    LOOP
        -- Replace function with non-recursive version: find enum by label via enum_range
        EXECUTE format(
            'CREATE OR REPLACE FUNCTION %I(character varying) RETURNS %I AS $body$ '
            'SELECT e FROM unnest(enum_range(NULL::%I)) AS e WHERE e::text = $1 LIMIT 1 '
            '$body$ LANGUAGE SQL STABLE',
            'varchar_to_' || t, t, t
        );
        EXECUTE format('DROP CAST IF EXISTS (character varying AS %I)', t);
        EXECUTE format(
            'CREATE CAST (character varying AS %I) WITH FUNCTION varchar_to_%I(character varying) AS IMPLICIT',
            t, t
        );
    END LOOP;
END
$$;
