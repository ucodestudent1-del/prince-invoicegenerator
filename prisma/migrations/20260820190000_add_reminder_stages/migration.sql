-- Automated Reminders: add tiered reminder stages, delivery tracking, and per-invoice suppression
--
-- Apply with: npx prisma migrate deploy
-- The application's isMissingColumnError fallbacks also tolerate an unmigrated
-- database, degrading gracefully when these columns/tables are absent.

-- ---------------------------------------------------------------------------
-- 1. Create the ReminderStageType enum
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ReminderStageType'
  ) THEN
    CREATE TYPE "ReminderStageType" AS ENUM ('PRE_DUE', 'DUE_DATE', 'POST_DUE');
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Create the ReminderStage table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ReminderStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ReminderStageType" NOT NULL DEFAULT 'DUE_DATE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "daysOffset" INTEGER NOT NULL DEFAULT 0,
    "timeOfDay" TEXT,
    "subjectTemplate" TEXT,
    "bodyTemplate" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ReminderStage_configId_idx" ON "ReminderStage"("configId");
CREATE INDEX IF NOT EXISTS "ReminderStage_type_idx" ON "ReminderStage"("type");

ALTER TABLE "ReminderStage"
    ADD CONSTRAINT "ReminderStage_configId_fkey"
    FOREIGN KEY ("configId") REFERENCES "ReminderConfig" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. Add stages relation column to ReminderConfig (for Prisma relation)
-- ReminderConfig already has the id column; no new column needed on it.
-- The relation is defined by the FK on ReminderStage.

-- ---------------------------------------------------------------------------
-- 4. Enhance the Reminder table with delivery tracking fields
-- ---------------------------------------------------------------------------
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "stageId" TEXT;
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "recipient" TEXT;
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE INDEX IF NOT EXISTS "Reminder_stageId_idx" ON "Reminder"("stageId");
CREATE INDEX IF NOT EXISTS "Reminder_invoiceId_type_idx" ON "Reminder"("invoiceId", "type");

ALTER TABLE "Reminder"
    ADD CONSTRAINT "Reminder_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES "ReminderStage" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. Create the InvoiceReminderSuppression table (per-invoice overrides)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "InvoiceReminderSuppression" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "suppressedAll" BOOLEAN NOT NULL DEFAULT false,
    "snoozedUntil" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceReminderSuppression_orgId_invoiceId_key"
    ON "InvoiceReminderSuppression"("orgId", "invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceReminderSuppression_orgId_idx" ON "InvoiceReminderSuppression"("orgId");
CREATE INDEX IF NOT EXISTS "InvoiceReminderSuppression_invoiceId_idx" ON "InvoiceReminderSuppression"("invoiceId");

ALTER TABLE "InvoiceReminderSuppression"
    ADD CONSTRAINT "InvoiceReminderSuppression_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceReminderSuppression"
    ADD CONSTRAINT "InvoiceReminderSuppression_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. Backfill: Seed default stages for existing ReminderConfig rows
-- ---------------------------------------------------------------------------
INSERT INTO "ReminderStage" ("id", "configId", "name", "type", "enabled", "daysOffset", "timeOfDay", "subjectTemplate", "bodyTemplate", "channel", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::TEXT,
    rc."id",
    stage_defs."name",
    stage_defs."type",
    true,
    stage_defs."daysOffset",
    NULL,
    stage_defs."subjectTemplate",
    stage_defs."bodyTemplate",
    'EMAIL',
    now(),
    now()
FROM "ReminderConfig" rc
CROSS JOIN (
    VALUES
        ('Friendly reminder',          'PRE_DUE',  -7, 'Friendly reminder: Invoice {{invoiceNumber}} due on {{dueDate}}', 'Dear {{customerName}},

This is a friendly heads-up that invoice {{invoiceNumber}} for {{amount}} is due on {{dueDate}}.

If you''ve already sent payment, thank you. Otherwise, please arrange payment at your earliest convenience.

Pay online: {{invoiceUrl}}

Thank you,
{{companyName}}'),
        ('Due date notification',       'DUE_DATE',  0, 'Invoice {{invoiceNumber}} is due today', 'Dear {{customerName}},

This is a courtesy reminder that invoice {{invoiceNumber}} for {{amount}} was due today ({{dueDate}}).

Please arrange payment as soon as possible to avoid any late fees.

Pay online: {{invoiceUrl}}

Thank you,
{{companyName}}'),
        ('1 day overdue',               'POST_DUE',  1, 'Invoice {{invoiceNumber}} is 1 day overdue', 'Dear {{customerName}},

Invoice {{invoiceNumber}} for {{balance}} is now overdue (originally due {{dueDate}}).

Please settle this invoice immediately. A late fee may have been applied.

Pay online: {{invoiceUrl}}

Thank you,
{{companyName}}'),
        ('7 days overdue',              'POST_DUE',  7, 'Invoice {{invoiceNumber}} is 7 days overdue', 'Dear {{customerName}},

This is a firm reminder that invoice {{invoiceNumber}} for {{balance}} is now 7 days past due.

Please settle this invoice immediately. A late fee may have been applied.

Pay online: {{invoiceUrl}}

Thank you,
{{companyName}}'),
        ('14 days overdue',             'POST_DUE', 14, 'URGENT: Invoice {{invoiceNumber}} is 14 days overdue', 'Dear {{customerName}},

Invoice {{invoiceNumber}} for {{balance}} is now 14 days overdue.

We have not yet received payment and this matter requires immediate attention.

Pay online: {{invoiceUrl}}

If you are experiencing financial hardship or dispute the charges, contact us immediately.

{{companyName}}'),
        ('30 days overdue (final notice)', 'POST_DUE', 30, 'FINAL NOTICE: Invoice {{invoiceNumber}} is 30 days overdue', 'Dear {{customerName}},

This is a final notice regarding invoice {{invoiceNumber}} for {{balance}}, which is now 30 days overdue.

This account is being referred to our collections partner. Unless we receive full payment or hear from you within 48 hours, collection proceedings may begin.

Pay in full immediately: {{invoiceUrl}}

Collections Department
{{companyName}}')
) AS stage_defs ("name", "type", "daysOffset", "subjectTemplate", "bodyTemplate")
WHERE NOT EXISTS (
    SELECT 1 FROM "ReminderStage" rs WHERE rs."configId" = rc."id"
);

-- ---------------------------------------------------------------------------
-- 7. Update existing Reminder rows to have valid status values
-- ---------------------------------------------------------------------------
UPDATE "Reminder"
SET "status" = 'SENT'
WHERE "status" = 'FAILED'
  AND "errorMessage" IS NULL;
