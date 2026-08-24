-- Migration 20260824: Reconcile schema drift between Prisma schema.prisma and
-- existing database state. This migration addresses all discrepancies found
-- by comparing the expected SQL (derived from schema.prisma) against the
-- cumulative migration SQL.
--
-- Discrepancies addressed:
-- 1. CustomerStatus enum never created — column added as TEXT instead of enum
-- 2. Estimate.linkedInvoiceId column missing from database
-- 3. Customer_orgId_email_key unique index missing from database
-- 4. InvoiceTemplate.primaryColor should be nullable (schema) not NOT NULL (migration)
-- 5. ReminderConfig.emailSubject should be nullable (schema) not NOT NULL (migration)
-- 6. ReminderConfig.emailTemplate should be nullable (schema) not NOT NULL (migration)
-- 7. User.locale should be nullable (schema) not NOT NULL (migration)
--
-- All operations are idempotent (wrapped in DO $$ blocks with IF NOT EXISTS checks).

-- ===========================================================================
-- 1. Create the CustomerStatus enum (was never created by a prior migration)
-- ===========================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CustomerStatus') THEN
    CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'SUSPENDED');
  END IF;
END $$;

-- ===========================================================================
-- 2. Migrate Customer.status from TEXT to CustomerStatus enum
--    The column was created as TEXT in migration 20260820083000_add_client_portal
--    but the schema expects CustomerStatus enum type.
-- ===========================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Customer' AND column_name = 'status' AND data_type = 'text'
  ) THEN
    ALTER TABLE "Customer" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "Customer" ALTER COLUMN "status" TYPE "CustomerStatus"
      USING "status"::"CustomerStatus";
    ALTER TABLE "Customer" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"CustomerStatus";
  END IF;
END $$;

-- ===========================================================================
-- 3. Add missing linkedInvoiceId column to Estimate table
--    This column exists in schema.prisma but was never added by any migration.
--    Without it, Prisma INSERT ... RETURNING * queries throw P2022.
-- ===========================================================================

-- Create the column if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Estimate' AND column_name = 'linkedInvoiceId'
  ) THEN
    ALTER TABLE "Estimate" ADD COLUMN "linkedInvoiceId" TEXT;
  END IF;
END $$;

-- Create foreign key from Estimate.linkedInvoiceId → Invoice.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Estimate_linkedInvoiceId_fkey'
      AND table_name = 'Estimate'
  ) THEN
    ALTER TABLE "Estimate"
      ADD CONSTRAINT "Estimate_linkedInvoiceId_fkey"
      FOREIGN KEY ("linkedInvoiceId") REFERENCES "Invoice" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ===========================================================================
-- 4. Add missing unique index on Customer(orgId, email)
--    The schema has @@unique([orgId, email]) but no migration created this index.
-- ===========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'Customer_orgId_email_key'
  ) THEN
    CREATE UNIQUE INDEX "Customer_orgId_email_key" ON "Customer" ("orgId", "email");
  END IF;
END $$;

-- ===========================================================================
-- 5. Fix InvoiceTemplate.primaryColor: make nullable (schema: String?)
--    Migration 20260821_add_invoice_template created it as NOT NULL.
-- ===========================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'InvoiceTemplate' AND column_name = 'primaryColor'
  ) THEN
    ALTER TABLE "InvoiceTemplate" ALTER COLUMN "primaryColor" DROP NOT NULL;
  END IF;
END $$;

-- ===========================================================================
-- 6. Fix ReminderConfig.emailSubject: make nullable (schema: String?)
--    Migration 0003 created it as NOT NULL.
-- ===========================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ReminderConfig' AND column_name = 'emailSubject'
  ) THEN
    ALTER TABLE "ReminderConfig" ALTER COLUMN "emailSubject" DROP NOT NULL;
  END IF;
END $$;

-- ===========================================================================
-- 7. Fix ReminderConfig.emailTemplate: make nullable (schema: String?)
--    Migration 0003 created it as NOT NULL.
-- ===========================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ReminderConfig' AND column_name = 'emailTemplate'
  ) THEN
    ALTER TABLE "ReminderConfig" ALTER COLUMN "emailTemplate" DROP NOT NULL;
  END IF;
END $$;

-- ===========================================================================
-- 8. Fix User.locale: make nullable (schema: String? @default("en"))
--    Migration 20250814110800_add_multilingual_fields created it as NOT NULL.
-- ===========================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'locale'
  ) THEN
    ALTER TABLE "User" ALTER COLUMN "locale" DROP NOT NULL;
  END IF;
END $$;
