-- Allow Hibernate @Enumerated(EnumType.STRING) to bind VARCHAR to new enum columns.
DO $$
DECLARE
    t text;
    enum_types text[] := ARRAY['customer_debt_status', 'misc_expense_category'];
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
