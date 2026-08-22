-- Add unique constraint on Organization.ownerId
-- This prevents duplicate organizations for the same owner

-- First, handle any existing duplicates by setting ownerId to NULL for duplicates
-- (keeping the first organization for each owner)
DO $$
DECLARE
  duplicate_owners CURSOR FOR
    SELECT ownerId, COUNT(*) as cnt
    FROM "Organization"
    WHERE ownerId IS NOT NULL
    GROUP BY ownerId
    HAVING COUNT(*) > 1;
BEGIN
  FOR rec IN duplicate_owners LOOP
    UPDATE "Organization"
    SET ownerId = NULL
    WHERE id IN (
      SELECT id FROM "Organization"
      WHERE ownerId = rec.ownerId
      ORDER BY "createdAt" ASC
      OFFSET 1
    );
  END LOOP;
END
$$;

-- Add the unique constraint
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_key" UNIQUE ("ownerId");
