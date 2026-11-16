-- Enforce unique organization name to prevent duplicate orgs with the same name.
-- First de-duplicate existing names by appending (2), (3), ... so migration runs on existing DBs.
WITH numbered AS (
    SELECT id, name, row_number() OVER (PARTITION BY name ORDER BY created_at, id) AS rn
    FROM org
),
duplicates AS (
    SELECT id, name || ' (' || rn || ')' AS new_name
    FROM numbered
    WHERE rn > 1
)
UPDATE org o
SET name = d.new_name
FROM duplicates d
WHERE o.id = d.id;

ALTER TABLE org
ADD CONSTRAINT uq_org_name UNIQUE (name);
