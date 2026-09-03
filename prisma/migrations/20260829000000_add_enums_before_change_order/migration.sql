-- Add enum values that are referenced by DDL defaults in later migrations.
--
-- PostgreSQL requires new enum values to be committed before they can be used
-- (e.g. as a column DEFAULT). Because Prisma runs each migration in a single
-- transaction, referencing a newly added enum value in the same migration
-- raises error 55P04 ("unsafe use of new value ... of enum type ...").
--
-- This migration adds only the enum values, committing them before any
-- subsequent migration DDL (like ALTER COLUMN ... SET DEFAULT 'DRAFT') runs.

-- PaymentMethod: add CARD, WIRE, ACH
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid
            WHERE pt.typname = 'PaymentMethod' AND pe.enumlabel = 'CARD'
        ) THEN
            ALTER TYPE "PaymentMethod" ADD VALUE 'CARD';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid
            WHERE pt.typname = 'PaymentMethod' AND pe.enumlabel = 'WIRE'
        ) THEN
            ALTER TYPE "PaymentMethod" ADD VALUE 'WIRE';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid
            WHERE pt.typname = 'PaymentMethod' AND pe.enumlabel = 'ACH'
        ) THEN
            ALTER TYPE "PaymentMethod" ADD VALUE 'ACH';
        END IF;
    END IF;
END $$;

-- InvoiceStatus: add PARTIALLY_PAID, CANCELLED, WRITTEN_OFF
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid
            WHERE pt.typname = 'InvoiceStatus' AND pe.enumlabel = 'PARTIALLY_PAID'
        ) THEN
            ALTER TYPE "InvoiceStatus" ADD VALUE 'PARTIALLY_PAID';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid
            WHERE pt.typname = 'InvoiceStatus' AND pe.enumlabel = 'CANCELLED'
        ) THEN
            ALTER TYPE "InvoiceStatus" ADD VALUE 'CANCELLED';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid
            WHERE pt.typname = 'InvoiceStatus' AND pe.enumlabel = 'WRITTEN_OFF'
        ) THEN
            ALTER TYPE "InvoiceStatus" ADD VALUE 'WRITTEN_OFF';
        END IF;
    END IF;
END $$;

-- EstimateStatus: add CANCELLED, CONVERTED
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstimateStatus') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid
            WHERE pt.typname = 'EstimateStatus' AND pe.enumlabel = 'CANCELLED'
        ) THEN
            ALTER TYPE "EstimateStatus" ADD VALUE 'CANCELLED';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid
            WHERE pt.typname = 'EstimateStatus' AND pe.enumlabel = 'CONVERTED'
        ) THEN
            ALTER TYPE "EstimateStatus" ADD VALUE 'CONVERTED';
        END IF;
    END IF;
END $$;

-- ChangeOrderStatus: add DRAFT, PENDING_APPROVAL, CANCELLED, VOID
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChangeOrderStatus') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid
            WHERE pt.typname = 'ChangeOrderStatus' AND pe.enumlabel = 'DRAFT'
        ) THEN
            ALTER TYPE "ChangeOrderStatus" ADD VALUE 'DRAFT';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid
            WHERE pt.typname = 'ChangeOrderStatus' AND pe.enumlabel = 'PENDING_APPROVAL'
        ) THEN
            ALTER TYPE "ChangeOrderStatus" ADD VALUE 'PENDING_APPROVAL';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid
            WHERE pt.typname = 'ChangeOrderStatus' AND pe.enumlabel = 'CANCELLED'
        ) THEN
            ALTER TYPE "ChangeOrderStatus" ADD VALUE 'CANCELLED';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid
            WHERE pt.typname = 'ChangeOrderStatus' AND pe.enumlabel = 'VOID'
        ) THEN
            ALTER TYPE "ChangeOrderStatus" ADD VALUE 'VOID';
        END IF;
    END IF;
END $$;

-- EntityType: add CHANGE_ORDER, PAYMENT
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EntityType') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid
            WHERE pt.typname = 'EntityType' AND pe.enumlabel = 'CHANGE_ORDER'
        ) THEN
            ALTER TYPE "EntityType" ADD VALUE 'CHANGE_ORDER';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum pe JOIN pg_type pt ON pe.enumtypid = pt.oid
            WHERE pt.typname = 'EntityType' AND pe.enumlabel = 'PAYMENT'
        ) THEN
            ALTER TYPE "EntityType" ADD VALUE 'PAYMENT';
        END IF;
    END IF;
END $$;
