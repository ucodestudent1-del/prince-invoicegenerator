-- Repair migration: Re-apply Estimate enhancements that were never executed
-- The 20260820_add_estimate_enhancements migration was marked as "applied" in
-- _prisma_migrations via prisma migrate resolve --applied without running the SQL.
-- This migration re-applies the missing schema changes:
--   1. EstimateStatus enum values (VIEWED, INVOICED, REJECTED)
--   2. Estimate engagement tracking columns
--   3. Invoice.estimateId FK column
--   4. EstimateAudit table
--
-- NOTE: PostgreSQL does not allow ALTER TYPE ... ADD VALUE inside a transaction
-- block (which Prisma Migrate uses). We work around this by recreating the enum
-- type inside a DO block if new values are missing.

-- ---------------------------------------------------------------------------
-- 1. Extend the EstimateStatus enum
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'EstimateStatus'
    ) THEN
        -- Enum type doesn't exist yet, create it with all values
        CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'INVOICED');
    ELSE
        -- Check if we need to add new values
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = 'EstimateStatus'::regtype AND enumlabel = 'VIEWED'
        ) THEN
            -- Values are missing — recreate the enum type
            -- Step 1: Convert the status column to TEXT to remove enum dependency
            ALTER TABLE "Estimate" ALTER COLUMN "status" TYPE TEXT USING status::TEXT;

            -- Step 2: Update DECLINED → REJECTED in existing data
            UPDATE "Estimate" SET "status" = 'REJECTED' WHERE "status" = 'DECLINED';

            -- Step 3: Drop old enum type and create new one with all values
            DROP TYPE "EstimateStatus";
            CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'INVOICED');

            -- Step 4: Convert the column back to the new enum type
            ALTER TABLE "Estimate" ALTER COLUMN "status" TYPE "EstimateStatus" USING status::"EstimateStatus";
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
