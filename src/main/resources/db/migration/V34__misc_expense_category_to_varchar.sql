-- Convert misc_expense.category from PostgreSQL ENUM to VARCHAR so categories
-- are user-defined (operators can type custom values, stored as-is).
-- Normalise existing UPPER_CASE enum values to Title Case for display.

ALTER TABLE misc_expense
    ALTER COLUMN category TYPE VARCHAR(100) USING category::text;

ALTER TABLE misc_expense
    ALTER COLUMN category SET DEFAULT 'Other';

UPDATE misc_expense SET category = initcap(lower(category));

-- Drop implicit casts that reference the now-unused enum type.
DROP CAST IF EXISTS (character varying AS misc_expense_category);
DROP CAST IF EXISTS (misc_expense_category AS character varying);

DROP TYPE IF EXISTS misc_expense_category CASCADE;
