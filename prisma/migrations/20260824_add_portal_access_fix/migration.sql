-- Repair migration: Add missing Customer portal access columns
-- The 20260820083000_add_client_portal migration was marked as "applied" in
-- _prisma_migrations without actually running the SQL. This migration adds
-- the missing columns directly to repair the production schema.
-- Uses IF NOT EXISTS / DO blocks for idempotency.

-- Add portal access columns to Customer table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'website'
    ) THEN
        ALTER TABLE "Customer" ADD COLUMN "website" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'taxId'
    ) THEN
        ALTER TABLE "Customer" ADD COLUMN "taxId" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'portalAccess'
    ) THEN
        ALTER TABLE "Customer" ADD COLUMN "portalAccess" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'portalPin'
    ) THEN
        ALTER TABLE "Customer" ADD COLUMN "portalPin" TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'outstandingBalance'
    ) THEN
        ALTER TABLE "Customer" ADD COLUMN "outstandingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'totalInvoiced'
    ) THEN
        ALTER TABLE "Customer" ADD COLUMN "totalInvoiced" DOUBLE PRECISION NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'totalPaid'
    ) THEN
        ALTER TABLE "Customer" ADD COLUMN "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'status'
    ) THEN
        ALTER TABLE "Customer" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'archivedAt'
    ) THEN
        ALTER TABLE "Customer" ADD COLUMN "archivedAt" TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create PortalSession table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'PortalSession') THEN
        CREATE TABLE "PortalSession" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "customerId" TEXT NOT NULL,
            "token" TEXT NOT NULL UNIQUE,
            "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
            "lastAccessedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            "ipAddress" TEXT,
            "userAgent" TEXT,
            "revokedAt" TIMESTAMP WITH TIME ZONE,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

            CONSTRAINT "PortalSession_customerId_fkey"
                FOREIGN KEY ("customerId") REFERENCES "Customer" ("id")
                ON DELETE CASCADE ON UPDATE CASCADE
        );
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS "PortalSession_customerId_idx" ON "PortalSession" ("customerId");
CREATE INDEX IF NOT EXISTS "PortalSession_token_idx" ON "PortalSession" ("token");
CREATE INDEX IF NOT EXISTS "Customer_orgId_status_idx" ON "Customer" ("orgId", "status");
