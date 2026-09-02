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
-- ---------------------------------------------------------------------------

-- PaymentMethod: add CARD, WIRE, ACH
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = 'PaymentMethod'::regtype AND enumlabel = 'CARD'
        ) THEN
            ALTER TYPE "PaymentMethod" ADD VALUE 'CARD';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = 'PaymentMethod'::regtype AND enumlabel = 'WIRE'
        ) THEN
            ALTER TYPE "PaymentMethod" ADD VALUE 'WIRE';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = 'PaymentMethod'::regtype AND enumlabel = 'ACH'
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
            SELECT 1 FROM pg_enum WHERE enumtypid = 'InvoiceStatus'::regtype AND enumlabel = 'PARTIALLY_PAID'
        ) THEN
            ALTER TYPE "InvoiceStatus" ADD VALUE 'PARTIALLY_PAID';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = 'InvoiceStatus'::regtype AND enumlabel = 'CANCELLED'
        ) THEN
            ALTER TYPE "InvoiceStatus" ADD VALUE 'CANCELLED';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = 'InvoiceStatus'::regtype AND enumlabel = 'WRITTEN_OFF'
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
            SELECT 1 FROM pg_enum WHERE enumtypid = 'EstimateStatus'::regtype AND enumlabel = 'CANCELLED'
        ) THEN
            ALTER TYPE "EstimateStatus" ADD VALUE 'CANCELLED';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = 'EstimateStatus'::regtype AND enumlabel = 'CONVERTED'
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
            SELECT 1 FROM pg_enum WHERE enumtypid = 'ChangeOrderStatus'::regtype AND enumlabel = 'DRAFT'
        ) THEN
            ALTER TYPE "ChangeOrderStatus" ADD VALUE 'DRAFT';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = 'ChangeOrderStatus'::regtype AND enumlabel = 'PENDING_APPROVAL'
        ) THEN
            ALTER TYPE "ChangeOrderStatus" ADD VALUE 'PENDING_APPROVAL';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = 'ChangeOrderStatus'::regtype AND enumlabel = 'CANCELLED'
        ) THEN
            ALTER TYPE "ChangeOrderStatus" ADD VALUE 'CANCELLED';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = 'ChangeOrderStatus'::regtype AND enumlabel = 'VOID'
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
            SELECT 1 FROM pg_enum WHERE enumtypid = 'EntityType'::regtype AND enumlabel = 'CHANGE_ORDER'
        ) THEN
            ALTER TYPE "EntityType" ADD VALUE 'CHANGE_ORDER';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = 'EntityType'::regtype AND enumlabel = 'PAYMENT'
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

CREATE INDEX IF NOT EXISTS "Invoice_estimateId_idx" ON "Invoice" ("estimateId");

-- ---------------------------------------------------------------------------
-- 5. Add columns to InvoiceItem
-- ---------------------------------------------------------------------------

ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'units';
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "discountType" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "discountValue" REAL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "taxable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "taxRate" REAL NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "lineSubtotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "lineDiscount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT NULL "lineTax" REAL NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "lineTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT NULL "sourceId" TEXT;

CREATE INDEX IF NOT EXISTS "InvoiceItem_sourceType_sourceId_idx" ON "InvoiceItem" ("sourceType", "sourceId");

-- ---------------------------------------------------------------------------
-- 6. Add columns to Estimate
-- ---------------------------------------------------------------------------

ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "acceptedBy" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "expirationDate" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "discountTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "taxTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Estimate" ADD COLUMN IF NOT NULL "feeTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Estimate" ADD COLUMN IF NOT NULL "signatureId" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT NULL "signedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Estimate" ADD COLUMN IF NOT NULL "signatureMethod" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT NULL "customerNotes" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT NULL "internalNotes" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT NULL "termsAndConditions" TEXT;

-- ---------------------------------------------------------------------------
-- 7. Add columns to EstimateItem
-- ---------------------------------------------------------------------------

ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT NULL "itemId" TEXT;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT NULL "unit" TEXT NOT NULL DEFAULT 'units';
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT NULL "discountType" TEXT;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT NULL "taxable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT NULL "taxRate" REAL NOT NULL DEFAULT 0;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT NULL "lineSubtotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT NULL "lineDiscount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT NULL "lineTax" REAL NOT NULL DEFAULT 0;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT NULL "lineTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT NULL "isOptional" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "EstimateItem_itemId_idx" ON "EstimateItem" ("itemId");

-- ---------------------------------------------------------------------------
-- 8. Add columns to ChangeOrder
-- ---------------------------------------------------------------------------

ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "estimateId" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "contractId" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "issueDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "effectiveDate" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "reason" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "scopeChangeDescription" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "scheduleImpactDescription" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "originalTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "changeAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "revisedTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "customerNotes" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "internalNotes" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "termsAndConditions" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "notes" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "approvedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "approvedBy" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "rejectedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "rejectedBy" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "originalCompletionDate" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "daysAdded" INTEGER;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "newCompletionDate" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT NULL "billToAddress" TEXT;

-- Update default on status column from PROPOSED to DRAFT
ALTER TABLE "ChangeOrder" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

CREATE INDEX IF NOT EXISTS "ChangeOrder_estimateId_idx" ON "ChangeOrder" ("estimateId");
CREATE INDEX IF NOT EXISTS "ChangeOrder_customerId_idx" ON "ChangeOrder" ("customerId");

-- ---------------------------------------------------------------------------
-- 9. Add columns to Payment
-- ---------------------------------------------------------------------------

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT NULL "paymentDate" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Payment" ADD COLUMN IF NOT NULL "reference" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT NULL "createdById" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';

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

    CONSTRAINT "ChangeOrderLineItem_update_fkey"
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
