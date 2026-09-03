-- Add structured change order fields, new document models, and enum enhancements.
--
-- Apply with: npx prisma migrate deploy
-- The application's isMissingColumnError fallbacks also tolerate an unmigrated
-- database, so deploying the code before this migration is safe.

-- ---------------------------------------------------------------------------
-- 1. Create new enums
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChangeType') THEN
        CREATE TYPE "ChangeType" AS ENUM ('ADD', 'REMOVE', 'MODIFY', 'REPLACE');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiscountType') THEN
        CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Add values to existing enums
--    PostgreSQL 12+ allows ALTER TYPE ... ADD VALUE inside a transaction
--    (proven by 0004_reconcile_schema_drift migration which uses this pattern).
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 3. Add columns to Project
-- ---------------------------------------------------------------------------

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "number" TEXT;

-- ---------------------------------------------------------------------------
-- 4. Add columns to Invoice
--   (billToAddress, shipToAddress, logoUrl, estimateId, notes already exist)
-- ---------------------------------------------------------------------------

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "discountTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "taxTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "feeTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "amountCredited" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "amountDue" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "customerNotes" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "termsAndConditions" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT NOT NULL DEFAULT 'NET_30';

-- ---------------------------------------------------------------------------
-- 5. Add columns to InvoiceItem
--   (id, invoiceId, invoice, description, quantity, unitPrice, amount,
--    sortOrder, sku already exist)
-- ---------------------------------------------------------------------------

ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'units';
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "discountType" "DiscountType" DEFAULT 'PERCENT';
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "discountValue" REAL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "taxable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "taxRate" REAL NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "lineSubtotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "lineDiscount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "lineTax" REAL NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "lineTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;

CREATE INDEX IF NOT EXISTS "InvoiceItem_sourceType_sourceId_idx" ON "InvoiceItem" ("sourceType", "sourceId");

-- ---------------------------------------------------------------------------
-- 6. Add columns to Estimate
--   (id, orgId, number, customerId, customer, projectId, project, status,
--    issueDate, validUntil, currency, subtotal, taxRate, taxAmount, discount,
--    total, notes, shareToken, viewedAt, acceptedAt, rejectedAt,
--    rejectionReason, convertedAt, sentAt, linkedInvoiceId, linkedInvoice
--    already exist)
-- ---------------------------------------------------------------------------

ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "acceptedBy" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "expirationDate" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "discountTotal" REAL DEFAULT 0;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "taxTotal" REAL DEFAULT 0;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "feeTotal" REAL DEFAULT 0;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "signatureId" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "signedBy" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "signatureMethod" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "customerNotes" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "termsAndConditions" TEXT;

-- ---------------------------------------------------------------------------
-- 7. Add columns to EstimateItem
--   (id, estimateId, estimate, description, quantity, unitPrice, amount,
--    sortOrder, sku already exist)
-- ---------------------------------------------------------------------------

ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "itemId" TEXT;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'units';
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "discountType" "DiscountType" DEFAULT 'PERCENT';
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "discountValue" REAL DEFAULT 0;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "taxable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "taxRate" REAL NOT NULL DEFAULT 0;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "lineSubtotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "lineDiscount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "lineTax" REAL NOT NULL DEFAULT 0;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "lineTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "isOptional" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "EstimateItem_itemId_idx" ON "EstimateItem" ("itemId");

-- ---------------------------------------------------------------------------
-- 8. Add columns to ChangeOrder
--   (id, orgId, number, title, description, invoiceId, invoice, projectId,
--    project, amount, status, createdAt, updatedAt already exist)
-- ---------------------------------------------------------------------------

ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "estimateId" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "contractId" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "issueDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "effectiveDate" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "scopeChangeDescription" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "scheduleImpactDescription" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "originalTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "changeAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "revisedTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "customerNotes" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "termsAndConditions" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "rejectedBy" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "originalCompletionDate" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "daysAdded" INTEGER;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "newCompletionDate" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "billToAddress" TEXT;

-- Update default on status column from PROPOSED to DRAFT
ALTER TABLE "ChangeOrder" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- Add unique constraint on [orgId, number]
CREATE UNIQUE INDEX IF NOT EXISTS "ChangeOrder_orgId_number_key" ON "ChangeOrder" ("orgId", "number");

-- Add FK constraints for new FK columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ChangeOrder_customerId_fkey'
    ) THEN
        ALTER TABLE "ChangeOrder"
            ADD CONSTRAINT "ChangeOrder_customerId_fkey"
            FOREIGN KEY ("customerId") REFERENCES "Customer" ("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ChangeOrder_estimateId_fkey'
    ) THEN
        ALTER TABLE "ChangeOrder"
            ADD CONSTRAINT "ChangeOrder_estimateId_fkey"
            FOREIGN KEY ("estimateId") REFERENCES "Estimate" ("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ChangeOrder_estimateId_idx" ON "ChangeOrder" ("estimateId");
CREATE INDEX IF NOT EXISTS "ChangeOrder_customerId_idx" ON "ChangeOrder" ("customerId");

-- ---------------------------------------------------------------------------
-- 9. Add columns to Payment
--   (id, invoiceId, invoice, orgId, org, amount, method, status,
--    stripePaymentId, paypalTransactionId, note, createdAt, updatedAt
--    already exist)
-- ---------------------------------------------------------------------------

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paymentDate" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

CREATE INDEX IF NOT EXISTS "Payment_customerId_idx" ON "Payment" ("customerId");

-- ---------------------------------------------------------------------------
-- 10. Create ChangeOrderLineItem table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ChangeOrderLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "changeOrderId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "changeType" "ChangeType" NOT NULL,
    "originalLineItemId" TEXT,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "quantityBefore" REAL,
    "quantityAfter" REAL,
    "quantityDelta" REAL,
    "unit" TEXT DEFAULT 'units',
    "unitPriceBefore" REAL,
    "unitPriceAfter" REAL,
    "unitPriceDelta" REAL,
    "lineAmount" REAL NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "lineTax" REAL NOT NULL DEFAULT 0,

    CONSTRAINT "ChangeOrderLineItem_changeOrderId_fkey"
        FOREIGN KEY ("changeOrderId") REFERENCES "ChangeOrder" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ChangeOrderLineItem_changeOrderId_idx" ON "ChangeOrderLineItem" ("changeOrderId");

-- ---------------------------------------------------------------------------
-- 11. Create ChangeOrderAudit table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ChangeOrderAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "changeOrderId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "ChangeOrderStatus",
    "toStatus" "ChangeOrderStatus",
    "changedBy" TEXT,
    "changedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "metadata" JSONB,

    CONSTRAINT "ChangeOrderAudit_changeOrderId_fkey"
        FOREIGN KEY ("changeOrderId") REFERENCES "ChangeOrder" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChangeOrderAudit_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ChangeOrderAudit_changeOrderId_idx" ON "ChangeOrderAudit" ("changeOrderId");
CREATE INDEX IF NOT EXISTS "ChangeOrderAudit_orgId_idx" ON "ChangeOrderAudit" ("orgId");

-- ---------------------------------------------------------------------------
-- 12. Create DocumentAuditLog table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "DocumentAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "metadata" JSONB,

    CONSTRAINT "DocumentAuditLog_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DocumentAuditLog_orgId_idx" ON "DocumentAuditLog" ("orgId");
CREATE INDEX IF NOT EXISTS "DocumentAuditLog_documentType_documentId_idx" ON "DocumentAuditLog" ("documentType", "documentId");
CREATE INDEX IF NOT EXISTS "DocumentAuditLog_documentType_action_idx" ON "DocumentAuditLog" ("documentType", "action");
CREATE INDEX IF NOT EXISTS "DocumentAuditLog_changedAt_idx" ON "DocumentAuditLog" ("changedAt");
