-- Fix V16 cast functions: use non-recursive enum_range pattern (V6 style) instead of $1::enum_type
-- which triggers infinite recursion when the cast is IMPLICIT.

DO $$
DECLARE
    t text;
    enum_types text[] := ARRAY['customer_debt_status', 'misc_expense_category'];
BEGIN
    FOREACH t IN ARRAY enum_types
    LOOP
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
