-- Recurring invoice configuration enhancements
-- Adds start/end gates, occurrence limits, payment terms, auto-send/auto-charge,
-- and per-config default tax/discount/items so a recurring config can generate
-- invoices without requiring a linked template invoice.
--
-- Apply with: npx prisma migrate deploy  (Docker image does NOT auto-migrate;
-- the application's isMissingColumnError fallbacks also tolerate an unmigrated
-- database, degrading gracefully when these columns are absent.)

ALTER TABLE "RecurringInvoiceConfig" ADD COLUMN "startDate" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "RecurringInvoiceConfig" ADD COLUMN "endDate" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "RecurringInvoiceConfig" ADD COLUMN "occurrences" INTEGER;
ALTER TABLE "RecurringInvoiceConfig" ADD COLUMN "generatedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RecurringInvoiceConfig" ADD COLUMN "paymentTerms" TEXT NOT NULL DEFAULT 'NET_30';
ALTER TABLE "RecurringInvoiceConfig" ADD COLUMN "autoSend" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RecurringInvoiceConfig" ADD COLUMN "autoCharge" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RecurringInvoiceConfig" ADD COLUMN "defaultTaxRate" DOUBLE PRECISION;
ALTER TABLE "RecurringInvoiceConfig" ADD COLUMN "defaultDiscount" DOUBLE PRECISION;
ALTER TABLE "RecurringInvoiceConfig" ADD COLUMN "defaultItems" JSONB;

-- Existing configs keep behaving as before (autoSend=true by schema default).
