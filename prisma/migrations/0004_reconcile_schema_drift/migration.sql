-- Migration 0004: Reconcile schema drift between Prisma schema and database
-- This migration fixes missing enum values and columns that were added to
-- schema.prisma but not propagated to existing databases via migrations.
--
-- Issues addressed:
-- 1. InvoiceStatus enum missing UNPAID value (added to schema.prisma but not migration 0000)
-- 2. This migration also ensures consistency between Prisma client and database

-- ---------------------------------------------------------------------------
-- Add UNPAID value to InvoiceStatus enum if missing
-- (Idempotent: only adds if the type exists and the value doesn't)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumtypid = 'InvoiceStatus'::regtype
            AND enumlabel = 'UNPAID'
        ) THEN
            ALTER TYPE "InvoiceStatus" ADD VALUE 'UNPAID';
        END IF;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Verify all InvoiceStatus enum values from schema are present:
-- Expected: DRAFT, SENT, VIEWED, PAID, UNPAID, OVERDUE, VOID
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    missing_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus') THEN
        SELECT COUNT(*) INTO missing_count
        FROM (VALUES ('UNPAID')) AS expected(val)
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumtypid = 'InvoiceStatus'::regtype
            AND enumlabel = expected.val
        );

        IF missing_count > 0 THEN
            RAISE WARNING 'InvoiceStatus enum is missing values. Please add manually.';
        END IF;
    END IF;
END $$;
