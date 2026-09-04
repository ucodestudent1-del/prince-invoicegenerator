-- Add ProjectMilestone model for progress billing & unbilled-revenue detection.
-- Milestones represent discrete phases of a project that carry a billable
-- amount. A COMPLETED milestone whose amount is not yet invoiced is eligible
-- for unbilled-revenue detection.

CREATE TABLE IF NOT EXISTS "ProjectMilestone" (
    "id"          TEXT PRIMARY KEY,
    "orgId"       TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "amount"      DOUBLE PRECISION DEFAULT 0,
    "dueDate"     TIMESTAMP,
    "status"      TEXT DEFAULT 'PENDING',
    "completedAt" TIMESTAMP,
    "invoiceId"   TEXT,
    "createdAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ProjectMilestone_orgId_idx" ON "ProjectMilestone"("orgId");
CREATE INDEX IF NOT EXISTS "ProjectMilestone_orgId_projectId_idx" ON "ProjectMilestone"("orgId", "projectId");
CREATE INDEX IF NOT EXISTS "ProjectMilestone_orgId_status_idx" ON "ProjectMilestone"("orgId", "status");

-- Foreign key to Project (added separately so a partially-migrated database
-- without the column still applies cleanly).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProjectMilestone' AND column_name = 'projectId') THEN
        ALTER TABLE "ProjectMilestone"
            ADD CONSTRAINT "ProjectMilestone_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProjectMilestone' AND column_name = 'invoiceId') THEN
        ALTER TABLE "ProjectMilestone"
            ADD CONSTRAINT "ProjectMilestone_invoiceId_fkey"
            FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id")
            ON DELETE SET NULL;
    END IF;
END $$;
