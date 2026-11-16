-- Add inequality operators (enum <> varchar) and (varchar <> enum) for JDBC bound params.
-- Prepared statements bind enum params as VARCHAR; equality (=) is covered by V8, inequality (<>) by this migration.

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
            'SELECT %I($1) <> $2 $body$ LANGUAGE SQL STABLE',
            'varchar_ne_' || t, t, 'varchar_to_' || t
        );
        EXECUTE format(
            'CREATE OR REPLACE FUNCTION %I(%I, character varying) RETURNS boolean AS $body$ '
            'SELECT $1 <> %I($2) $body$ LANGUAGE SQL STABLE',
            'enum_ne_varchar_' || t, t, 'varchar_to_' || t
        );
        EXECUTE format(
            'DROP OPERATOR IF EXISTS <> (character varying, %I)',
            t
        );
        EXECUTE format(
            'CREATE OPERATOR <> (LEFTARG = character varying, RIGHTARG = %I, '
            'PROCEDURE = %I)',
            t, 'varchar_ne_' || t
        );
        EXECUTE format(
            'DROP OPERATOR IF EXISTS <> (%I, character varying)',
            t
        );
        EXECUTE format(
            'CREATE OPERATOR <> (LEFTARG = %I, RIGHTARG = character varying, '
            'PROCEDURE = %I)',
            t, 'enum_ne_varchar_' || t
        );
    END LOOP;
END
$$;
