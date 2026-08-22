// Client Management & Customer Portal: schema updates
//
// Apply with: npx prisma migrate deployed

-- Add new fields to Customer table
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "taxId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "portalAccess" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "portalPin" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "outstandingBalance" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "totalInvoiced" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "totalPaid" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP WITH TIME ZONE;

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS "Customer_orgId_status_idx" ON "Customer" ("orgId", "status");

-- Create PortalSession table
CREATE TABLE IF NOT EXISTS "PortalSession" (
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

CREATE INDEX IF NOT EXISTS "PortalSession_customerId_idx" ON "PortalSession" ("customerId");
CREATE INDEX IF NOT EXISTS "PortalSession_token_idx" ON "PortalSession" ("token");
