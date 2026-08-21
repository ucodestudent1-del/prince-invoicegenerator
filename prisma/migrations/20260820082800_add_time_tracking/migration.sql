-- Time Tracking Module: saved item library for tracking billable hours
--
-- Apply with: npx prisma migrate deploy
-- The application's isMissingColumnError fallbacks also tolerate an unmigrated
-- database, degrading gracefully when these columns/tables are absent.

-- ---------------------------------------------------------------------------
-- 1. Create the TimeEntryStatus enum
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'TimeEntryStatus'
  ) THEN
    CREATE TYPE "TimeEntryStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'INVOICED', 'REJECTED');
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Create the TimeEntry table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "startTime" TIMESTAMP WITH TIME ZONE NOT NULL,
    "endTime" TIMESTAMP WITH TIME ZONE,
    "duration" REAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "hourlyRate" REAL NOT NULL DEFAULT 0,
    "amount" REAL NOT NULL DEFAULT 0,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "status" "TimeEntryStatus" NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT "TimeEntry_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_invoiceId_fkey"
        FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TimeEntry_orgId_idx" ON "TimeEntry" ("orgId");
CREATE INDEX IF NOT EXISTS "TimeEntry_orgId_userId_idx" ON "TimeEntry" ("orgId", "userId");
CREATE INDEX IF NOT EXISTS "TimeEntry_orgId_projectId_idx" ON "TimeEntry" ("orgId", "projectId");
CREATE INDEX IF NOT EXISTS "TimeEntry_orgId_invoiceId_idx" ON "TimeEntry" ("orgId", "invoiceId");
CREATE INDEX IF NOT EXISTS "TimeEntry_orgId_billable_idx" ON "TimeEntry" ("orgId", "billable");
CREATE INDEX IF NOT EXISTS "TimeEntry_orgId_status_idx" ON "TimeEntry" ("orgId", "status");
CREATE INDEX IF NOT EXISTS "TimeEntry_orgId_startTime_idx" ON "TimeEntry" ("orgId", "startTime");
