-- Products & Services Catalog: saved item library
--
-- Apply with: npx prisma migrate deploy
-- The application's isMissingColumnError fallbacks also tolerate an unmigrated
-- database, degrading gracefully when these columns/tables are absent.

-- ---------------------------------------------------------------------------
-- 1. Create the CatalogUnit enum
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'CatalogUnit'
  ) THEN
    CREATE TYPE "CatalogUnit" AS ENUM ('HOURS', 'UNITS', 'FLAT_FEE', 'DAYS', 'PROJECTS');
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Create the CatalogItem table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "CatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL NOT NULL DEFAULT 0,
    "unit" "CatalogUnit" NOT NULL DEFAULT 'UNITS',
    "taxRate" REAL NOT NULL DEFAULT 0,
    "taxCategory" TEXT,
    "sku" TEXT,
    "discount" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT "CatalogItem_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CatalogItem_orgId_idx" ON "CatalogItem" ("orgId");
CREATE INDEX IF NOT EXISTS "CatalogItem_orgId_name_idx" ON "CatalogItem" ("orgId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogItem_orgId_sku_key" ON "CatalogItem" ("orgId", "sku")
    WHERE "sku" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Add sku column to InvoiceItem table
-- ---------------------------------------------------------------------------

-- Add sku column to InvoiceItem and EstimateItem tables
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "sku" TEXT;
CREATE INDEX IF NOT EXISTS "InvoiceItem_sku_idx" ON "InvoiceItem" ("sku");

ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "sku" TEXT;
