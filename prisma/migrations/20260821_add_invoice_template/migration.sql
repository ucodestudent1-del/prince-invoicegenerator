-- Add InvoiceTemplate model

CREATE TABLE IF NOT EXISTS "InvoiceTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseTemplate" TEXT NOT NULL DEFAULT 'professional',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1e40af',
    "showCompanyName" BOOLEAN NOT NULL DEFAULT true,
    "showCompanyAddress" BOOLEAN NOT NULL DEFAULT true,
    "showCompanyPhone" BOOLEAN NOT NULL DEFAULT false,
    "showCompanyEmail" BOOLEAN NOT NULL DEFAULT false,
    "showTaxId" BOOLEAN NOT NULL DEFAULT false,
    "showPaymentInfo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT "InvoiceTemplate_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceTemplate_orgId_name_key" ON "InvoiceTemplate" ("orgId", "name");
CREATE INDEX IF NOT EXISTS "InvoiceTemplate_orgId_idx" ON "InvoiceTemplate" ("orgId");
