-- Estimates & Quotes: enhance estimate lifecycle (engagement tracking, audit trail, conversion)
--
-- Apply with: npx prisma migrate deploy
-- The application's isMissingColumnError fallbacks also tolerate an unmigrated
-- database, degrading gracefully when these columns/tables are absent.

-- ---------------------------------------------------------------------------
-- 1. Extend the EstimateStatus enum (add VIEWED and INVOICED; rename DECLINED → REJECTED)
-- ---------------------------------------------------------------------------

-- Add VIEWED value to EstimateStatus enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'EstimateStatus'
  ) THEN
    CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'INVOICED');
  ELSE
    -- Enum already exists from init; add new values if they don't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumtypid = 'EstimateStatus'::regtype AND enumlabel = 'VIEWED'
    ) THEN
      ALTER TYPE "EstimateStatus" ADD VALUE 'VIEWED';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumtypid = 'EstimateStatus'::regtype AND enumlabel = 'INVOICED'
    ) THEN
      ALTER TYPE "EstimateStatus" ADD VALUE 'INVOICED';
    END IF;
    -- Rename DECLINED → REJECTED for semantic clarity
    IF EXISTS (
      SELECT 1 FROM pg_enum WHERE enumtypid = 'EstimateStatus'::regtype AND enumlabel = 'DECLINED'
    ) THEN
      -- PostgreSQL doesn't support renaming enum values directly; create a new type
      -- We'll handle the rename at the app level; for DB we add REJECTED alongside DECLINED
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum WHERE enumtypid = 'EstimateStatus'::regtype AND enumlabel = 'REJECTED'
      ) THEN
        ALTER TYPE "EstimateStatus" ADD VALUE 'REJECTED';
      END IF;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumtypid = 'EstimateStatus'::regtype AND enumlabel = 'REJECTED'
    ) THEN
      ALTER TYPE "EstimateStatus" ADD VALUE 'REJECTED';
    END IF;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Add engagement tracking columns to the Estimate table
-- ---------------------------------------------------------------------------

ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "viewedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP WITH TIME ZONE;

-- Fix: viewedAt should be nullable
ALTER TABLE "Estimate" ALTER COLUMN "viewedAt" DROP NOT NULL;

-- Add unique index on shareToken for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS "Estimate_shareToken_key" ON "Estimate" ("shareToken") WHERE "shareToken" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Estimate_viewedAt_idx" ON "Estimate" ("viewedAt");
CREATE INDEX IF NOT EXISTS "Estimate_acceptedAt_idx" ON "Estimate" ("acceptedAt");

-- ---------------------------------------------------------------------------
-- 3. Add estimateId FK to Invoice table (for conversion linking)
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
-- 4. Create the EstimateAudit table (mirrors InvoiceAudit pattern)
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
