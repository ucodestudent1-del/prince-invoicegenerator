-- Organisation roles & permissions (Plan: Roles & Permissions)
--
-- Adds the membership → role → permission hierarchy so that team access is
-- driven by granular, per-organisation permissions instead of a hard-coded
-- role column on the User row. Introduces the new invoice states
-- PENDING_REVIEW and APPROVED used by the state-aware invoice authorisation.

-- ----------------------------------------------------------------------------
-- Invoice status enum: add PENDING_REVIEW and APPROVED
-- ----------------------------------------------------------------------------
-- PostgreSQL enum values are added immutably. Guard with a conditional so the
-- migration is idempotent against already-applied databases.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = '"InvoiceStatus"'::regtype AND enumlabel = 'PENDING_REVIEW'
        ) THEN
            ALTER TYPE "InvoiceStatus" ADD VALUE 'PENDING_REVIEW' AFTER 'DRAFT';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum WHERE enumtypid = '"InvoiceStatus"'::regtype AND enumlabel = 'APPROVED'
        ) THEN
            ALTER TYPE "InvoiceStatus" ADD VALUE 'APPROVED' AFTER 'PENDING_REVIEW';
        END IF;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- OrganizationRole
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "OrganizationRole" (
    "id"          TEXT PRIMARY KEY,
    "orgId"       TEXT,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "isSystem"    BOOLEAN NOT NULL DEFAULT false,
    "isEditable"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "OrganizationRole_orgId_idx" ON "OrganizationRole"("orgId");
CREATE INDEX IF NOT EXISTS "OrganizationRole_isSystem_idx" ON "OrganizationRole"("isSystem");
-- System roles (orgId IS NULL) are unique by name; per-org roles are unique per org.
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationRole_orgId_name_key"
    ON "OrganizationRole"("orgId", "name")
    WHERE ("orgId" IS NOT NULL OR "name" IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationRole_system_name_key"
    ON "OrganizationRole"("name")
    WHERE "orgId" IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'OrganizationRole' AND column_name = 'orgId') THEN
        ALTER TABLE "OrganizationRole"
            ADD CONSTRAINT "OrganizationRole_orgId_fkey"
            FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
            ON DELETE CASCADE;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- OrganizationRolePermission
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "OrganizationRolePermission" (
    "id"         TEXT PRIMARY KEY,
    "roleId"     TEXT NOT NULL,
    "permission" TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationRolePermission_roleId_permission_key"
    ON "OrganizationRolePermission"("roleId", "permission");
CREATE INDEX IF NOT EXISTS "OrganizationRolePermission_permission_idx"
    ON "OrganizationRolePermission"("permission");

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'OrganizationRolePermission' AND column_name = 'roleId') THEN
        ALTER TABLE "OrganizationRolePermission"
            ADD CONSTRAINT "OrganizationRolePermission_roleId_fkey"
            FOREIGN KEY ("roleId") REFERENCES "OrganizationRole" ("id")
            ON DELETE CASCADE;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- OrganizationMembership
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "OrganizationMembership" (
    "id"        TEXT PRIMARY KEY,
    "orgId"     TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "roleId"    TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMembership_orgId_userId_key"
    ON "OrganizationMembership"("orgId", "userId");
CREATE INDEX IF NOT EXISTS "OrganizationMembership_orgId_idx" ON "OrganizationMembership"("orgId");
CREATE INDEX IF NOT EXISTS "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");
CREATE INDEX IF NOT EXISTS "OrganizationMembership_orgId_roleId_idx" ON "OrganizationMembership"("orgId", "roleId");

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'OrganizationMembership' AND column_name = 'orgId') THEN
        ALTER TABLE "OrganizationMembership"
            ADD CONSTRAINT "OrganizationMembership_orgId_fkey"
            FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
            ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'OrganizationMembership' AND column_name = 'userId') THEN
        ALTER TABLE "OrganizationMembership"
            ADD CONSTRAINT "OrganizationMembership_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User" ("id")
            ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'OrganizationMembership' AND column_name = 'roleId') THEN
        ALTER TABLE "OrganizationMembership"
            ADD CONSTRAINT "OrganizationMembership_roleId_fkey"
            FOREIGN KEY ("roleId") REFERENCES "OrganizationRole" ("id")
            ON DELETE SET NULL;
    END IF;
END $$;

-- Link Organization back to its roles/memberships (relation mirrors).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'Organization' AND column_name = 'roleId'
    ) THEN
        ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "roleId" TEXT;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- ProjectMember: add roleId for project-level permission scoping
-- ----------------------------------------------------------------------------
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "roleId" TEXT;
CREATE INDEX IF NOT EXISTS "ProjectMember_roleId_idx" ON "ProjectMember"("roleId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ProjectMember_roleId_fkey'
          AND table_name = 'ProjectMember' AND table_schema = 'public'
    ) THEN
        ALTER TABLE "ProjectMember"
            ADD CONSTRAINT "ProjectMember_roleId_fkey"
            FOREIGN KEY ("roleId") REFERENCES "OrganizationRole" ("id")
            ON DELETE SET NULL;
    END IF;
END $$;
