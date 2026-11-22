-- Backfill business_date for pre-existing sales that have a NULL business_date.
-- Derives the business date from completed_at (or created_at) converted to the branch's timezone.
UPDATE sale s
SET business_date = ((COALESCE(s.completed_at, s.created_at) AT TIME ZONE COALESCE(b.timezone, 'Africa/Nairobi')))::date
FROM branch b
WHERE s.branch_id = b.id
  AND s.business_date IS NULL;
