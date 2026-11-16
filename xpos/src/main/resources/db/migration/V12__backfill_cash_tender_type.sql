-- Ensure every org has a CASH tender type (for orgs created after V2 seed).
INSERT INTO tender_type (id, org_id, code, name, active, created_at)
SELECT gen_random_uuid(), o.id, 'CASH', 'Cash', true, now()
FROM org o
WHERE NOT EXISTS (
    SELECT 1 FROM tender_type tt
    WHERE tt.org_id = o.id AND tt.code = 'CASH'
);
