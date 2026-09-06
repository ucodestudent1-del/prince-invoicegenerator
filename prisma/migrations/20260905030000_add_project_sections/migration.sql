-- Project Notes, Members, Tasks, Purchase Orders, Cost Codes,
-- Retainage Releases, Draw Schedules, Lien Waivers
--
-- Schema drift-safe PostgreSQL migration (idempotent WHERE NOT EXISTS).

-- ProjectNote
CREATE TABLE IF NOT EXISTS "public"."ProjectNote" (
    "id"          TEXT PRIMARY KEY,
    "orgId"       TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "authorId"    TEXT,
    "authorName"  TEXT,
    "content"     TEXT NOT NULL,
    "isInternal"  BOOLEAN NOT NULL DEFAULT true,
    "isPinned"    BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ProjectNote_orgId_idx" ON "public"."ProjectNote"("orgId");
CREATE INDEX IF NOT EXISTS "ProjectNote_projectId_idx" ON "public"."ProjectNote"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectNote_isPinned_idx" ON "public"."ProjectNote"("isPinned");

-- ProjectMember
CREATE TABLE IF NOT EXISTS "public"."ProjectMember" (
    "id"      TEXT PRIMARY KEY,
    "orgId"   TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId"   TEXT,
    "name"     TEXT,
    "role"     TEXT NOT NULL DEFAULT 'SUB',
    "company"  TEXT,
    "email"    TEXT,
    "phone"    TEXT,
    "trade"    TEXT,
    "createdAt"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ProjectMember_orgId_idx" ON "public"."ProjectMember"("orgId");
CREATE INDEX IF NOT EXISTS "ProjectMember_projectId_idx" ON "public"."ProjectMember"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectMember_role_idx" ON "public"."ProjectMember"("role");

-- ProjectTask
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectTaskStatus' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE "public"."ProjectTaskStatus" AS ENUM (
            'TODO',
            'IN_PROGRESS',
            'BLOCKED',
            'COMPLETED'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."ProjectTask" (
    "id"          TEXT PRIMARY KEY,
    "orgId"       TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "assigneeId"  TEXT,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "status"      "public"."ProjectTaskStatus" NOT NULL DEFAULT 'TODO',
    "dueDate"     TIMESTAMP,
    "completedAt" TIMESTAMP,
    "createdAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ProjectTask_orgId_idx" ON "public"."ProjectTask"("orgId");
CREATE INDEX IF NOT EXISTS "ProjectTask_projectId_idx" ON "public"."ProjectTask"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectTask_status_idx" ON "public"."ProjectTask"("status");

-- ProjectPurchaseOrder
CREATE TABLE IF NOT EXISTS "public"."ProjectPurchaseOrder" (
    "id"      TEXT PRIMARY KEY,
    "orgId"   TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number"   TEXT NOT NULL,
    "vendor"   TEXT,
    "amount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status"   TEXT NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP,
    "notes"    TEXT,
    "createdAt"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ProjectPurchaseOrder_orgId_idx" ON "public"."ProjectPurchaseOrder"("orgId");
CREATE INDEX IF NOT EXISTS "ProjectPurchaseOrder_projectId_idx" ON "public"."ProjectPurchaseOrder"("projectId");

-- ProjectCostCode
CREATE TABLE IF NOT EXISTS "public"."ProjectCostCode" (
    "id"          TEXT PRIMARY KEY,
    "orgId"       TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "budget"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actual"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ProjectCostCode_orgId_idx" ON "public"."ProjectCostCode"("orgId");
CREATE INDEX IF NOT EXISTS "ProjectCostCode_projectId_idx" ON "public"."ProjectCostCode"("projectId");

-- RetainageRelease
CREATE TABLE IF NOT EXISTS "public"."RetainageRelease" (
    "id"           TEXT PRIMARY KEY,
    "orgId"        TEXT NOT NULL,
    "projectId"    TEXT NOT NULL,
    "amount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "releaseDate"  TIMESTAMP,
    "releasedById" TEXT,
    "releasedByName" TEXT,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RetainageRelease_orgId_idx" ON "public"."RetainageRelease"("orgId");
CREATE INDEX IF NOT EXISTS "RetainageRelease_projectId_idx" ON "public"."RetainageRelease"("projectId");

-- DrawSchedule
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DrawStatus' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE "public"."DrawStatus" AS ENUM (
            'DRAFT',
            'SCHEDULED',
            'PENDING_APPROVAL',
            'APPROVED',
            'REJECTED',
            'PAID'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."DrawSchedule" (
    "id"          TEXT PRIMARY KEY,
    "orgId"       TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "number"      TEXT NOT NULL,
    "title"       TEXT,
    "description" TEXT,
    "amount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate"     TIMESTAMP,
    "status"      "public"."DrawStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "DrawSchedule_orgId_idx" ON "public"."DrawSchedule"("orgId");
CREATE INDEX IF NOT EXISTS "DrawSchedule_projectId_idx" ON "public"."DrawSchedule"("projectId");
CREATE INDEX IF NOT EXISTS "DrawSchedule_status_idx" ON "public"."DrawSchedule"("status");

-- LienWaiver
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LienWaiverType' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE "public"."LienWaiverType" AS ENUM (
            'CONDITIONAL',
            'UNCONDITIONAL'
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LienWaiverStatus' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE "public"."LienWaiverStatus" AS ENUM (
            'PENDING',
            'SIGNED',
            'NOT_REQUIRED'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."LienWaiver" (
    "id"              TEXT PRIMARY KEY,
    "orgId"           TEXT NOT NULL,
    "projectId"       TEXT NOT NULL,
    "subcontractorId" TEXT,
    "type"            "public"."LienWaiverType" NOT NULL DEFAULT 'UNCONDITIONAL',
    "status"          "public"."LienWaiverStatus" NOT NULL DEFAULT 'PENDING',
    "amount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "signedDate"      TIMESTAMP,
    "documentUrl"     TEXT,
    "createdAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LienWaiver_orgId_idx" ON "public"."LienWaiver"("orgId");
CREATE INDEX IF NOT EXISTS "LienWaiver_projectId_idx" ON "public"."LienWaiver"("projectId");

-- Foreign keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ProjectNote_projectId_fkey' AND table_name = 'ProjectNote' AND table_schema = 'public') THEN
        ALTER TABLE "public"."ProjectNote" ADD CONSTRAINT "ProjectNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ProjectNote_orgId_fkey' AND table_name = 'ProjectNote' AND table_schema = 'public') THEN
        ALTER TABLE "public"."ProjectNote" ADD CONSTRAINT "ProjectNote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ProjectMember_projectId_fkey' AND table_name = 'ProjectMember' AND table_schema = 'public') THEN
        ALTER TABLE "public"."ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ProjectMember_orgId_fkey' AND table_name = 'ProjectMember' AND table_schema = 'public') THEN
        ALTER TABLE "public"."ProjectMember" ADD CONSTRAINT "ProjectMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ProjectTask_projectId_fkey' AND table_name = 'ProjectTask' AND table_schema = 'public') THEN
        ALTER TABLE "public"."ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ProjectTask_orgId_fkey' AND table_name = 'ProjectTask' AND table_schema = 'public') THEN
        ALTER TABLE "public"."ProjectTask" ADD CONSTRAINT "ProjectTask_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ProjectPurchaseOrder_projectId_fkey' AND table_name = 'ProjectPurchaseOrder' AND table_schema = 'public') THEN
        ALTER TABLE "public"."ProjectPurchaseOrder" ADD CONSTRAINT "ProjectPurchaseOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ProjectPurchaseOrder_orgId_fkey' AND table_name = 'ProjectPurchaseOrder' AND table_schema = 'public') THEN
        ALTER TABLE "public"."ProjectPurchaseOrder" ADD CONSTRAINT "ProjectPurchaseOrder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ProjectCostCode_projectId_fkey' AND table_name = 'ProjectCostCode' AND table_schema = 'public') THEN
        ALTER TABLE "public"."ProjectCostCode" ADD CONSTRAINT "ProjectCostCode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ProjectCostCode_orgId_fkey' AND table_name = 'ProjectCostCode' AND table_schema = 'public') THEN
        ALTER TABLE "public"."ProjectCostCode" ADD CONSTRAINT "ProjectCostCode_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'RetainageRelease_projectId_fkey' AND table_name = 'RetainageRelease' AND table_schema = 'public') THEN
        ALTER TABLE "public"."RetainageRelease" ADD CONSTRAINT "RetainageRelease_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'RetainageRelease_orgId_fkey' AND table_name = 'RetainageRelease' AND table_schema = 'public') THEN
        ALTER TABLE "public"."RetainageRelease" ADD CONSTRAINT "RetainageRelease_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DrawSchedule_projectId_fkey' AND table_name = 'DrawSchedule' AND table_schema = 'public') THEN
        ALTER TABLE "public"."DrawSchedule" ADD CONSTRAINT "DrawSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DrawSchedule_orgId_fkey' AND table_name = 'DrawSchedule' AND table_schema = 'public') THEN
        ALTER TABLE "public"."DrawSchedule" ADD CONSTRAINT "DrawSchedule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LienWaiver_projectId_fkey' AND table_name = 'LienWaiver' AND table_schema = 'public') THEN
        ALTER TABLE "public"."LienWaiver" ADD CONSTRAINT "LienWaiver_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LienWaiver_orgId_fkey' AND table_name = 'LienWaiver' AND table_schema = 'public') THEN
        ALTER TABLE "public"."LienWaiver" ADD CONSTRAINT "LienWaiver_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization" ("id") ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LienWaiver_subcontractorId_fkey' AND table_name = 'LienWaiver' AND table_schema = 'public') THEN
        ALTER TABLE "public"."LienWaiver" ADD CONSTRAINT "LienWaiver_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "public"."Subcontractor" ("id") ON DELETE SET NULL;
    END IF;
END $$;

-- Add project_id nullable foreign key to ProjectDocument for versioning
ALTER TABLE "public"."ProjectDocument" ADD COLUMN IF NOT EXISTS "nextId" TEXT;
ALTER INDEX IF EXISTS "public"."ProjectDocument_previousId_key" DO STRICTLY NOTHING;
