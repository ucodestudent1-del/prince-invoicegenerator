-- Add missing projectId column to RecurringInvoiceConfig
-- This column was added to schema.prisma but migration 0003 wasn't applied to all databases.
-- This migration ensures the column is added idempotently.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'RecurringInvoiceConfig' AND column_name = 'projectId'
    ) THEN
        ALTER TABLE "RecurringInvoiceConfig" ADD COLUMN "projectId" TEXT;
    END IF;
END $$;

-- AddForeignKey: RecurringInvoiceConfig.projectId
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'RecurringInvoiceConfig_projectId_fkey'
          AND table_name = 'RecurringInvoiceConfig'
    ) THEN
        ALTER TABLE "RecurringInvoiceConfig"
        ADD CONSTRAINT "RecurringInvoiceConfig_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "Project"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'RecurringInvoiceConfig_projectId_idx'
    ) THEN
        CREATE INDEX "RecurringInvoiceConfig_projectId_idx"
        ON "RecurringInvoiceConfig"("projectId");
    END IF;
END $$;
