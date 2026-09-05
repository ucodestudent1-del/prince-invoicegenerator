-- Production repair migration.
--
-- This migration makes the database safe to re-run. It only creates objects
-- if they do not already exist, so it is safe to run against a database that
-- has been bootstrapped via `prisma db push` (which does not record history
-- and so produces "drift" against the migration table).
--
-- The missing objects in production were:
--   * enum public.MilestoneStatus
--   * table public.ProjectMilestone (and its FKs / indexes)
--   * table public.ReminderStage
--   * column public.Reminder.stageId + index + FK
--   * table public.InvoiceReminderSuppression
--   * enum public.ReminderStageType
--
-- Companion fix: the Reminder model has a "reminderStageType" field that the
-- original 20260820190000 migration backfilled. The application now uses the
-- richer ReminderStage model, so this migration is the canonical shape.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MilestoneStatus' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE "public"."MilestoneStatus" AS ENUM ('PENDING', 'COMPLETED', 'INVOICED', 'CANCELLED');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReminderStageType' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE "public"."ReminderStageType" AS ENUM ('PRE_DUE', 'DUE_DATE', 'POST_DUE');
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- ProjectMilestone
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."ProjectMilestone" (
    "id"          TEXT PRIMARY KEY,
    "orgId"       TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "amount"      DOUBLE PRECISION DEFAULT 0,
    "dueDate"     TIMESTAMP,
    "status"      "public"."MilestoneStatus" DEFAULT 'PENDING',
    "completedAt" TIMESTAMP,
    "invoiceId"   TEXT,
    "createdAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ProjectMilestone_orgId_idx" ON "public"."ProjectMilestone"("orgId");
CREATE INDEX IF NOT EXISTS "ProjectMilestone_orgId_projectId_idx" ON "public"."ProjectMilestone"("orgId", "projectId");
CREATE INDEX IF NOT EXISTS "ProjectMilestone_orgId_status_idx" ON "public"."ProjectMilestone"("orgId", "status");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ProjectMilestone_projectId_fkey'
          AND table_name = 'ProjectMilestone'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."ProjectMilestone"
            ADD CONSTRAINT "ProjectMilestone_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "public"."Project" ("id")
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ProjectMilestone_invoiceId_fkey'
          AND table_name = 'ProjectMilestone'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."ProjectMilestone"
            ADD CONSTRAINT "ProjectMilestone_invoiceId_fkey"
            FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice" ("id")
            ON DELETE SET NULL;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- ReminderStage
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."ReminderStage" (
    "id"             TEXT PRIMARY KEY,
    "configId"       TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "type"           "public"."ReminderStageType" NOT NULL,
    "enabled"        BOOLEAN NOT NULL DEFAULT TRUE,
    "daysOffset"     INTEGER NOT NULL,
    "timeOfDay"      TEXT,
    "subjectTemplate" TEXT,
    "bodyTemplate"   TEXT,
    "channel"        TEXT NOT NULL DEFAULT 'EMAIL',
    "createdAt"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ReminderStage_configId_idx" ON "public"."ReminderStage"("configId");
CREATE INDEX IF NOT EXISTS "ReminderStage_type_idx" ON "public"."ReminderStage"("type");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ReminderStage_configId_fkey'
          AND table_name = 'ReminderStage'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."ReminderStage"
            ADD CONSTRAINT "ReminderStage_configId_fkey"
            FOREIGN KEY ("configId") REFERENCES "public"."ReminderConfig" ("id")
            ON DELETE CASCADE;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Reminder.stageId
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Reminder'
          AND column_name = 'stageId'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."Reminder" ADD COLUMN "stageId" TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Reminder_stageId_idx" ON "public"."Reminder"("stageId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'Reminder_stageId_fkey'
          AND table_name = 'Reminder'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."Reminder"
            ADD CONSTRAINT "Reminder_stageId_fkey"
            FOREIGN KEY ("stageId") REFERENCES "public"."ReminderStage" ("id")
            ON DELETE SET NULL;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- InvoiceReminderSuppression
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."InvoiceReminderSuppression" (
    "id"            TEXT PRIMARY KEY,
    "orgId"         TEXT NOT NULL,
    "invoiceId"     TEXT NOT NULL,
    "suppressedAll" BOOLEAN NOT NULL DEFAULT FALSE,
    "snoozedUntil"  TIMESTAMP,
    "createdAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceReminderSuppression_orgId_invoiceId_key"
    ON "public"."InvoiceReminderSuppression"("orgId", "invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceReminderSuppression_orgId_idx" ON "public"."InvoiceReminderSuppression"("orgId");
CREATE INDEX IF NOT EXISTS "InvoiceReminderSuppression_invoiceId_idx" ON "public"."InvoiceReminderSuppression"("invoiceId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'InvoiceReminderSuppression_orgId_fkey'
          AND table_name = 'InvoiceReminderSuppression'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."InvoiceReminderSuppression"
            ADD CONSTRAINT "InvoiceReminderSuppression_orgId_fkey"
            FOREIGN KEY ("orgId") REFERENCES "public"."Organization" ("id")
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'InvoiceReminderSuppression_invoiceId_fkey'
          AND table_name = 'InvoiceReminderSuppression'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."InvoiceReminderSuppression"
            ADD CONSTRAINT "InvoiceReminderSuppression_invoiceId_fkey"
            FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice" ("id")
            ON DELETE CASCADE;
    END IF;
END $$;
