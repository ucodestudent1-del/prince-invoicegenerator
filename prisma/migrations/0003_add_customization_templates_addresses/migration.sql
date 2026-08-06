-- Add missing UNPAID value to InvoiceStatus enum (added in schema but not in migration 0000)
DO $$
DECLARE
    type_oid oid;
BEGIN
    SELECT oid INTO type_oid FROM pg_type WHERE typname = 'InvoiceStatus';
    IF type_oid IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = type_oid AND enumlabel = 'UNPAID') THEN
            ALTER TYPE "InvoiceStatus" ADD VALUE 'UNPAID';
        END IF;
    END IF;
END $$;

-- CreateEnum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AddressType') THEN
        CREATE TYPE "AddressType" AS ENUM ('BILLING', 'SHIPPING');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TemplateStyle') THEN
        CREATE TYPE "TemplateStyle" AS ENUM ('STANDARD', 'MODERN', 'MINIMAL', 'CLASSIC');
    END IF;
END $$;

-- CreateEnum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN
        CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CHECK', 'CREDIT_CARD', 'STRIPE', 'PAYPAL', 'BANK_TRANSFER', 'OTHER');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
        CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
    END IF;
END $$;

-- AlterTable: RecurringInvoiceConfig (add missing projectId column)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RecurringInvoiceConfig' AND column_name = 'projectId') THEN
        ALTER TABLE "RecurringInvoiceConfig" ADD COLUMN "projectId" TEXT;
    END IF;
END $$;

-- AddForeignKey: RecurringInvoiceConfig.projectId
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'RecurringInvoiceConfig_projectId_fkey' AND table_name = 'RecurringInvoiceConfig') THEN
        ALTER TABLE "RecurringInvoiceConfig" ADD CONSTRAINT "RecurringInvoiceConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'RecurringInvoiceConfig_projectId_idx') THEN
        CREATE INDEX "RecurringInvoiceConfig_projectId_idx" ON "RecurringInvoiceConfig"("projectId");
    END IF;
END $$;

-- AlterTable: Organization
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Organization' AND column_name = 'template') THEN
        ALTER TABLE "Organization" ADD COLUMN "template" "TemplateStyle" NOT NULL DEFAULT 'STANDARD';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Organization' AND column_name = 'theme') THEN
        ALTER TABLE "Organization" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'light';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Organization' AND column_name = 'brandColor') THEN
        ALTER TABLE "Organization" ADD COLUMN "brandColor" TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Organization' AND column_name = 'accentColor') THEN
        ALTER TABLE "Organization" ADD COLUMN "accentColor" TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Organization' AND column_name = 'fontFamily') THEN
        ALTER TABLE "Organization" ADD COLUMN "fontFamily" TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Organization' AND column_name = 'layout') THEN
        ALTER TABLE "Organization" ADD COLUMN "layout" TEXT NOT NULL DEFAULT 'default';
    END IF;
END $$;

-- AlterTable: Invoice
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Invoice' AND column_name = 'scheduledFor') THEN
        ALTER TABLE "Invoice" ADD COLUMN "scheduledFor" TIMESTAMP(3);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Invoice' AND column_name = 'lateFeeAmount') THEN
        ALTER TABLE "Invoice" ADD COLUMN "lateFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
    END IF;
END $$;

-- CreateTable: CustomerAddress
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'CustomerAddress') THEN
        CREATE TABLE "CustomerAddress" (
            "id" TEXT NOT NULL,
            "orgId" TEXT NOT NULL,
            "customerId" TEXT NOT NULL,
            "label" TEXT,
            "type" "AddressType" NOT NULL DEFAULT 'BILLING',
            "line1" TEXT NOT NULL,
            "line2" TEXT,
            "city" TEXT NOT NULL,
            "state" TEXT,
            "postalCode" TEXT,
            "country" TEXT,
            "isDefault" BOOLEAN NOT NULL DEFAULT false,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CustomerAddress_orgId_idx') THEN
        CREATE INDEX "CustomerAddress_orgId_idx" ON "CustomerAddress"("orgId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CustomerAddress_customerId_idx') THEN
        CREATE INDEX "CustomerAddress_customerId_idx" ON "CustomerAddress"("customerId");
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CustomerAddress_orgId_fkey' AND table_name = 'CustomerAddress') THEN
        ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CustomerAddress_customerId_fkey' AND table_name = 'CustomerAddress') THEN
        ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: InvoiceAudit
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'InvoiceAudit') THEN
        CREATE TABLE "InvoiceAudit" (
            "id" TEXT NOT NULL,
            "invoiceId" TEXT NOT NULL,
            "orgId" TEXT NOT NULL,
            "action" TEXT NOT NULL,
            "fromStatus" TEXT,
            "toStatus" TEXT,
            "amount" DOUBLE PRECISION,
            "note" TEXT,
            "createdById" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "InvoiceAudit_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'InvoiceAudit_invoiceId_idx') THEN
        CREATE INDEX "InvoiceAudit_invoiceId_idx" ON "InvoiceAudit"("invoiceId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'InvoiceAudit_orgId_idx') THEN
        CREATE INDEX "InvoiceAudit_orgId_idx" ON "InvoiceAudit"("orgId");
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'InvoiceAudit_invoiceId_fkey' AND table_name = 'InvoiceAudit') THEN
        ALTER TABLE "InvoiceAudit" ADD CONSTRAINT "InvoiceAudit_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'InvoiceAudit_orgId_fkey' AND table_name = 'InvoiceAudit') THEN
        ALTER TABLE "InvoiceAudit" ADD CONSTRAINT "InvoiceAudit_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: ReminderConfig
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ReminderConfig') THEN
        CREATE TABLE "ReminderConfig" (
            "id" TEXT NOT NULL,
            "orgId" TEXT NOT NULL,
            "enabled" BOOLEAN NOT NULL DEFAULT true,
            "remindBeforeDue" INTEGER NOT NULL DEFAULT 3,
            "remindAfterDue" INTEGER NOT NULL DEFAULT 1,
            "frequencyHours" INTEGER NOT NULL DEFAULT 24,
            "maxReminders" INTEGER NOT NULL DEFAULT 3,
            "emailSubject" TEXT NOT NULL DEFAULT 'Payment reminder for invoice {{invoiceNumber}}',
            "emailTemplate" TEXT NOT NULL DEFAULT 'Dear {{customerName}}, this is a reminder that invoice {{invoiceNumber}} for {{amount}} is due on {{dueDate}}.',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "ReminderConfig_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ReminderConfig_orgId_key') THEN
        CREATE UNIQUE INDEX "ReminderConfig_orgId_key" ON "ReminderConfig"("orgId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ReminderConfig_orgId_idx') THEN
        CREATE INDEX "ReminderConfig_orgId_idx" ON "ReminderConfig"("orgId");
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ReminderConfig_orgId_fkey' AND table_name = 'ReminderConfig') THEN
        ALTER TABLE "ReminderConfig" ADD CONSTRAINT "ReminderConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: Reminder
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'Reminder') THEN
        CREATE TABLE "Reminder" (
            "id" TEXT NOT NULL,
            "orgId" TEXT NOT NULL,
            "invoiceId" TEXT,
            "type" TEXT NOT NULL,
            "scheduledAt" TIMESTAMP(3) NOT NULL,
            "sentAt" TIMESTAMP(3),
            "status" TEXT NOT NULL DEFAULT 'PENDING',
            "channel" TEXT NOT NULL DEFAULT 'EMAIL',
            "note" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Reminder_orgId_idx') THEN
        CREATE INDEX "Reminder_orgId_idx" ON "Reminder"("orgId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Reminder_invoiceId_idx') THEN
        CREATE INDEX "Reminder_invoiceId_idx" ON "Reminder"("invoiceId");
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Reminder_orgId_fkey' AND table_name = 'Reminder') THEN
        ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Reminder_invoiceId_fkey' AND table_name = 'Reminder') THEN
        ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: LateFeeConfig
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'LateFeeConfig') THEN
        CREATE TABLE "LateFeeConfig" (
            "id" TEXT NOT NULL,
            "orgId" TEXT NOT NULL,
            "enabled" BOOLEAN NOT NULL DEFAULT false,
            "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "graceDays" INTEGER NOT NULL DEFAULT 0,
            "fixedFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "maxFee" DOUBLE PRECISION,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "LateFeeConfig_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'LateFeeConfig_orgId_key') THEN
        CREATE UNIQUE INDEX "LateFeeConfig_orgId_key" ON "LateFeeConfig"("orgId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'LateFeeConfig_orgId_idx') THEN
        CREATE INDEX "LateFeeConfig_orgId_idx" ON "LateFeeConfig"("orgId");
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LateFeeConfig_orgId_fkey' AND table_name = 'LateFeeConfig') THEN
        ALTER TABLE "LateFeeConfig" ADD CONSTRAINT "LateFeeConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: Payment
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'Payment') THEN
        CREATE TABLE "Payment" (
            "id" TEXT NOT NULL,
            "invoiceId" TEXT NOT NULL,
            "orgId" TEXT NOT NULL,
            "amount" DOUBLE PRECISION NOT NULL,
            "method" TEXT NOT NULL DEFAULT 'OTHER',
            "status" TEXT NOT NULL DEFAULT 'COMPLETED',
            "stripePaymentId" TEXT,
            "paypalTransactionId" TEXT,
            "note" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateIndex
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Payment_invoiceId_idx') THEN
        CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Payment_orgId_idx') THEN
        CREATE INDEX "Payment_orgId_idx" ON "Payment"("orgId");
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Payment_invoiceId_fkey' AND table_name = 'Payment') THEN
        ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Payment_orgId_fkey' AND table_name = 'Payment') THEN
        ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
