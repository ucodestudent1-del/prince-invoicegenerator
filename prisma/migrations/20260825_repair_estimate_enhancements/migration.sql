-- Repair migration: Re-apply Estimate enhancements that were never executed
-- The 20260820_add_estimate_enhancements migration was marked as "applied" in
-- _prisma_migrations via prisma migrate resolve --applied without running the SQL.
-- This migration re-applies the missing schema changes:
--   1. EstimateStatus enum type (may not exist or may be missing values)
--   2. Estimate engagement tracking columns
--   3. Invoice.estimateId FK column
--   4. EstimateAudit table
-- All operations are idempotent (IF NOT EXISTS guards).

-- ---------------------------------------------------------------------------
-- 1. Extend the EstimateStatus enum
-- ---------------------------------------------------------------------------
-- PostgreSQL doesn't allow ALTER TYPE ... ADD VALUE inside a transaction
-- (which Prisma Migrate uses). We work around this by recreating the type
-- if new values are needed.
DO $$
DECLARE
    type_exists BOOLEAN;
    has_viewed BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstimateStatus') INTO type_exists;

    IF NOT type_exists THEN
        -- Type doesn't exist at all, create it with all values
        CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'INVOICED');

        -- Try to cast the status column to the new type (in case it's TEXT)
        BEGIN
            ALTER TABLE "Estimate" ALTER COLUMN "status" TYPE "EstimateStatus" USING status::"EstimateStatus";
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    ELSE
        -- Type exists, check if VIEWED value is missing (using safe JOIN)
        SELECT EXISTS (
            SELECT 1 FROM pg_enum pe
            JOIN pg_type pt ON pe.enumtypid = pt.oid
            WHERE pt.typname = 'EstimateStatus' AND pe.enumlabel = 'VIEWED'
        ) INTO has_viewed;

        IF NOT has_viewed THEN
            -- Recreate the enum type to add new values
            -- Step 1: Drop default and convert column to TEXT to remove type dependency
            ALTER TABLE "Estimate" ALTER COLUMN "status" DROP DEFAULT;
            ALTER TABLE "Estimate" ALTER COLUMN "status" TYPE TEXT USING status::TEXT;

            -- Step 2: Update DECLINED → REJECTED in existing data
            UPDATE "Estimate" SET "status" = 'REJECTED' WHERE "status" = 'DECLINED';

            -- Step 3: Drop old enum type and create new one with all values
            DROP TYPE "EstimateStatus";
            CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'INVOICED');

            -- Step 4: Convert the column back to the new enum type
            ALTER TABLE "Estimate" ALTER COLUMN "status" TYPE "EstimateStatus" USING status::"EstimateStatus";

            -- Step 5: Restore the default value
            ALTER TABLE "Estimate" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"EstimateStatus";
        END IF;
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Add engagement tracking columns to Estimate table
-- ---------------------------------------------------------------------------
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "viewedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP WITH TIME ZONE;

-- Add indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Estimate_shareToken_key" ON "Estimate" ("shareToken") WHERE "shareToken" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Estimate_viewedAt_idx" ON "Estimate" ("viewedAt");
CREATE INDEX IF NOT EXISTS "Estimate_acceptedAt_idx" ON "Estimate" ("acceptedAt");

-- ---------------------------------------------------------------------------
-- 3. Add estimateId FK to Invoice table
-- ---------------------------------------------------------------------------
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "estimateId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_estimateId_key" ON "Invoice" ("estimateId") WHERE "estimateId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Invoice_estimateId_idx" ON "Invoice" ("estimateId");

-- Add FK constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_estimateId_fkey'
    ) THEN
        ALTER TABLE "Invoice"
            ADD CONSTRAINT "Invoice_estimateId_fkey"
            FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id")
            ON DELETE SET NULL;
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 4. Create the EstimateAudit table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "EstimateAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "estimateId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT "EstimateAudit_estimateId_fkey"
        FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EstimateAudit_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EstimateAudit_estimateId_idx" ON "EstimateAudit" ("estimateId");
CREATE INDEX IF NOT EXISTS "EstimateAudit_orgId_idx" ON "EstimateAudit" ("orgId");
