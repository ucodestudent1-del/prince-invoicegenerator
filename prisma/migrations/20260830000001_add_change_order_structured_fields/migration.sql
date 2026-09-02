-- Add structured change order fields, new document models, and enum enhancements.
--
-- Apply with: npx prisma migrate deploy
-- The application's isMissingColumnError fallbacks also tolerate an unmigrated
-- database, so deploying the code before this migration is safe.
--
-- NOTE: PostgreSQL does not allow `ALTER TYPE ... ADD VALUE` inside a
-- transaction block (which Prisma Migrate uses). Following the pattern from
-- 2026082502_repair_estimate_enhancements, each enum that needs new values is
-- recreated atomically: drop default → cast to TEXT → drop type → create
-- type with all values → cast back → restore default.

-- ---------------------------------------------------------------------------
-- 1. Create new enums (CREATE TYPE is transactional — safe inside a migration
--    transaction)
-- ---------------------------------------------------------------------------

CREATE TYPE IF NOT EXISTS "ChangeType" AS ENUM ('ADD', 'REMOVE', 'MODIFY', 'REPLACE');
CREATE TYPE IF NOT EXISTS "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- ---------------------------------------------------------------------------
-- 2. Recreate PaymentMethod enum (add CARD, WIRE, ACH)
--    Only referenced by Payment.method
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    has_card BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_enum pe
        JOIN pg_type pt ON pe.enumtypid = pt.oid
        WHERE pt.typname = 'PaymentMethod' AND pe.enumlabel = 'CARD'
    ) INTO has_card;

    IF NOT has_card THEN
        ALTER TABLE "Payment" ALTER COLUMN "method" DROP DEFAULT;
        ALTER TABLE "Payment" ALTER COLUMN "method" TYPE TEXT USING "method"::TEXT;

        DROP TYPE "PaymentMethod";
        CREATE TYPE "PaymentMethod" AS ENUM (
            'CASH', 'CHECK', 'CREDIT_CARD', 'STRIPE', 'PAYPAL',
            'BANK_TRANSFER', 'OTHER', 'CARD', 'WIRE', 'ACH'
        );

        ALTER TABLE "Payment" ALTER COLUMN "method" TYPE "PaymentMethod"
            USING "method"::"PaymentMethod";
        ALTER TABLE "Payment" ALTER COLUMN "method" SET DEFAULT 'OTHER'::"PaymentMethod";
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Recreate InvoiceStatus enum (add PARTIALLY_PAID, CANCELLED, WRITTEN_OFF)
--    Only referenced by Invoice.status
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    has_partially_paid BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_enum pe
        JOIN pg_type pt ON pe.enumtypid = pt.oid
        WHERE pt.typname = 'InvoiceStatus' AND pe.enumlabel = 'PARTIALLY_PAID'
    ) INTO has_partially_paid;

    IF NOT has_partially_paid THEN
        ALTER TABLE "Invoice" ALTER COLUMN "status" DROP DEFAULT;
        ALTER TABLE "Invoice" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;

        DROP TYPE "InvoiceStatus";
        CREATE TYPE "InvoiceStatus" AS ENUM (
            'DRAFT', 'SENT', 'VIEWED', 'PARTIALLY_PAID', 'PAID',
            'UNPAID', 'OVERDUE', 'VOID', 'CANCELLED', 'WRITTEN_OFF'
        );

        ALTER TABLE "Invoice" ALTER COLUMN "status" TYPE "InvoiceStatus"
            USING "status"::"InvoiceStatus";
        ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"InvoiceStatus";
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Recreate EstimateStatus enum (add CANCELLED, CONVERTED; normalize
--    DECLINED → REJECTED)
--    Only referenced by Estimate.status
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    has_cancelled BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_enum pe
        JOIN pg_type pt ON pe.enumtypid = pt.oid
        WHERE pt.typname = 'EstimateStatus' AND pe.enumlabel = 'CANCELLED'
    ) INTO has_cancelled;

    IF NOT has_cancelled THEN
        ALTER TABLE "Estimate" ALTER COLUMN "status" DROP DEFAULT;
        ALTER TABLE "Estimate" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;

        -- Normalize any legacy DECLINED values to REJECTED
        UPDATE "Estimate" SET "status" = 'REJECTED' WHERE "status" = 'DECLINED';

        DROP TYPE "EstimateStatus";
        CREATE TYPE "EstimateStatus" AS ENUM (
            'DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED',
            'EXPIRED', 'INVOICED', 'CANCELLED', 'CONVERTED'
        );

        ALTER TABLE "Estimate" ALTER COLUMN "status" TYPE "EstimateStatus"
            USING "status"::"EstimateStatus";
        ALTER TABLE "Estimate" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"EstimateStatus";
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Recreate ChangeOrderStatus enum (add DRAFT, PENDING_APPROVAL,
--    CANCELLED, VOID; reorder to match Prisma schema)
--    Only referenced by ChangeOrder.status
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    has_draft BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_enum pe
        JOIN pg_type pt ON pe.enumtypid = pt.oid
        WHERE pt.typname = 'ChangeOrderStatus' AND pe.enumlabel = 'DRAFT'
    ) INTO has_draft;

    IF NOT has_draft THEN
        ALTER TABLE "ChangeOrder" ALTER COLUMN "status" DROP DEFAULT;
        ALTER TABLE "ChangeOrder" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;

        DROP TYPE "ChangeOrderStatus";
        CREATE TYPE "ChangeOrderStatus" AS ENUM (
            'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
            'CANCELLED', 'VOID', 'PROPOSED', 'INVOICED'
        );

        ALTER TABLE "ChangeOrder" ALTER COLUMN "status" TYPE "ChangeOrderStatus"
            USING "status"::"ChangeOrderStatus";
        ALTER TABLE "ChangeOrder" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"ChangeOrderStatus";
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Recreate EntityType enum (add CHANGE_ORDER, PAYMENT)
--    Only referenced by PhotoAttachment.entityType
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    has_change_order BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_enum pe
        JOIN pg_type pt ON pe.enumtypid = pt.oid
        WHERE pt.typname = 'EntityType' AND pe.enumlabel = 'CHANGE_ORDER'
    ) INTO has_change_order;

    IF NOT has_change_order THEN
        ALTER TABLE "PhotoAttachment" ALTER COLUMN "entityType" DROP DEFAULT;
        ALTER TABLE "PhotoAttachment" ALTER COLUMN "entityType" TYPE TEXT USING "entityType"::Text;

        DROP TYPE "EntityType";
        CREATE TYPE "EntityType" AS ENUM (
            'INVOICE', 'ESTIMATE', 'CHANGE_ORDER', 'EXPENSE',
            'PROJECT', 'PAYMENT'
        );

        ALTER TABLE "PhotoAttachment" ALTER COLUMN "entityType" TYPE "EntityType"
            USING "entityType"::"EntityType";
        ALTER TABLE "PhotoAttachment" ALTER COLUMN "entityType" SET DEFAULT 'INVOICE'::"EntityType";
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Add columns to Project
--   (id, orgId, org, customerId, customer, name, address, startDate, endDate,
--    status, createdAt, updatedAt already exist)
-- ---------------------------------------------------------------------------

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "number" TEXT;

-- ---------------------------------------------------------------------------
-- 8. Add columns to Invoice
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
-- 9. Add columns to InvoiceItem
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
-- 10. Add columns to Estimate
--   (id, orgId, number, customerId, customer, projectId, project, status,
--    issueDate, validUntil, currency, subtotal, taxRate, taxAmount, discount,
--    total, notes, shareToken, viewedAt, acceptedAt, rejectedAt,
--    rejectionReason, convertedAt, sentAt, linkedInvoiceId, linkedInvoice
--    already exist)
-- ---------------------------------------------------------------------------

ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "acceptedBy" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "expirationDate" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "discountTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "taxTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "feeTotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "signatureId" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "signedBy" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "signatureMethod" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "customerNotes" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "termsAndConditions" TEXT;

-- ---------------------------------------------------------------------------
-- 11. Add columns to EstimateItem
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
-- 12. Add columns to ChangeOrder
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

-- Add unique constraint on [orgId, number] (matches @@unique in Prisma schema)
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
-- 13. Add columns to Payment
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
-- 14. Create ChangeOrderLineItem table
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
-- 15. Create ChangeOrderAudit table
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
-- 16. Create DocumentAuditLog table
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
