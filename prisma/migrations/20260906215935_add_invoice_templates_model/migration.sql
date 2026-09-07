-- Add templateId to Invoice table referencing InvoiceTemplate
ALTER TABLE "Invoice" ADD COLUMN "templateId" TEXT;

-- Create InvoiceTemplate table
CREATE TABLE "InvoiceTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "invoiceType" TEXT NOT NULL DEFAULT 'STANDARD',
    "configuration" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceTemplate_pkey" PRIMARY KEY ("id")
);

-- Foreign key constraints
ALTER TABLE "InvoiceTemplate" ADD CONSTRAINT "InvoiceTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceTemplate" ADD CONSTRAINT "InvoiceTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InvoiceTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "InvoiceTemplate_orgId_idx" ON "InvoiceTemplate" ("orgId");
CREATE INDEX "InvoiceTemplate_userId_idx" ON "InvoiceTemplate" ("userId");
CREATE INDEX "InvoiceTemplate_orgId_isDefault_idx" ON "InvoiceTemplate" ("orgId", "isDefault");
CREATE UNIQUE INDEX "InvoiceTemplate_orgId_name_key" ON "InvoiceTemplate" ("orgId", "name");
