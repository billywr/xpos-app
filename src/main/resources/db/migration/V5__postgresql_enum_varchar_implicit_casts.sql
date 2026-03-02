-- Allow Hibernate/JPA @Enumerated(EnumType.STRING) to bind VARCHAR to PostgreSQL enum columns.
-- Without these casts, INSERT/UPDATE fail with: column "x" is of type enum_type but expression is of type character varying.

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
            'CREATE OR REPLACE FUNCTION %I(character varying) RETURNS %I AS ''SELECT $1::%I'' LANGUAGE SQL IMMUTABLE',
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
