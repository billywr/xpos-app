-- Prepared statements do not use IMPLICIT casts for parameter comparison (PostgreSQL limitation).
-- Add explicit equality operators (enum, varchar) and (varchar, enum) so JDBC bound params work.

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
        EXECUTE format(
            'CREATE OR REPLACE FUNCTION %I(character varying, %I) RETURNS boolean AS $body$ '
            'SELECT %I($1) = $2 $body$ LANGUAGE SQL STABLE',
            'varchar_eq_' || t, t, 'varchar_to_' || t
        );
        EXECUTE format(
            'CREATE OR REPLACE FUNCTION %I(%I, character varying) RETURNS boolean AS $body$ '
            'SELECT $1 = %I($2) $body$ LANGUAGE SQL STABLE',
            'enum_eq_varchar_' || t, t, 'varchar_to_' || t
        );
        EXECUTE format(
            'DROP OPERATOR IF EXISTS = (character varying, %I)',
            t
        );
        EXECUTE format(
            'CREATE OPERATOR = (LEFTARG = character varying, RIGHTARG = %I, '
            'PROCEDURE = %I)',
            t, 'varchar_eq_' || t
        );
        EXECUTE format(
            'DROP OPERATOR IF EXISTS = (%I, character varying)',
            t
        );
        EXECUTE format(
            'CREATE OPERATOR = (LEFTARG = %I, RIGHTARG = character varying, '
            'PROCEDURE = %I)',
            t, 'enum_eq_varchar_' || t
        );
    END LOOP;
END
$$;
