-- Repair migration for 20260906000000_add_roles_permissions
--
-- The original migration partially applied on production: it created the
-- OrganizationRole table and its first two indexes, but failed at the
-- CREATE UNIQUE INDEX WHERE (orgId IS NOT NULL ...) statement because
-- 'orgId' was used as an unquoted identifier (folded to lowercase 'orgid').
-- This left OrganizationRolePermission, OrganizationMembership tables,
-- remaining indexes, and foreign keys uncreated.
--
-- This migration safely creates all missing objects using IF NOT EXISTS /
-- DO $$ guards so it is idempotent against fully-applied databases.

-- ----------------------------------------------------------------------------
-- OrganizationRole: complete missing indexes and foreign key
-- ----------------------------------------------------------------------------

-- Unique index: per-org unique by name (where orgId is not null)
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationRole_orgId_name_key"
    ON "OrganizationRole"("orgId", "name")
    WHERE ("orgId" IS NOT NULL OR "name" IS NOT NULL);

-- Unique index: system-wide unique by name (where orgId is null)
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationRole_system_name_key"
    ON "OrganizationRole"("name")
    WHERE "orgId" IS NULL;

-- Foreign key: OrganizationRole.orgId -> Organization.id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'OrganizationRole' AND column_name = 'orgId')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints
           WHERE constraint_name = 'OrganizationRole_orgId_fkey'
             AND table_name = 'OrganizationRole' AND table_schema = 'public'
       ) THEN
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
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'OrganizationRolePermission' AND column_name = 'roleId')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints
           WHERE constraint_name = 'OrganizationRolePermission_roleId_fkey'
             AND table_name = 'OrganizationRolePermission' AND table_schema = 'public'
       ) THEN
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
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'OrganizationMembership' AND column_name = 'orgId')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints
           WHERE constraint_name = 'OrganizationMembership_orgId_fkey'
             AND table_name = 'OrganizationMembership' AND table_schema = 'public'
       ) THEN
        ALTER TABLE "OrganizationMembership"
            ADD CONSTRAINT "OrganizationMembership_orgId_fkey"
            FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
            ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'OrganizationMembership' AND column_name = 'userId')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints
           WHERE constraint_name = 'OrganizationMembership_userId_fkey'
             AND table_name = 'OrganizationMembership' AND table_schema = 'public'
       ) THEN
        ALTER TABLE "OrganizationMembership"
            ADD CONSTRAINT "OrganizationMembership_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User" ("id")
            ON DELETE CASCADE;
    END IF;
END $$;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'OrganizationMembership' AND column_name = 'roleId')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints
           WHERE constraint_name = 'OrganizationMembership_roleId_fkey'
             AND table_name = 'OrganizationMembership' AND table_schema = 'public'
       ) THEN
        ALTER TABLE "OrganizationMembership"
            ADD CONSTRAINT "OrganizationMembership_roleId_fkey"
            FOREIGN KEY ("roleId") REFERENCES "OrganizationRole" ("id")
            ON DELETE SET NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Organization: add roleId foreign key column
-- ----------------------------------------------------------------------------
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "roleId" TEXT;

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