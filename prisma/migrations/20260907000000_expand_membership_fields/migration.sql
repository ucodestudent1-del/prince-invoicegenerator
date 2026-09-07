-- Expand membership fields for the comprehensive team directory.
--
-- Adds:
--   User.jobTitle              — distinguishes job title from system role
--   OrganizationMembership.jobTitle, invitedById, invitedAt,
--       invitationAcceptedAt, isActive
--   InvitationInviter FK on User for invitedById

-- ----------------------------------------------------------------------------
-- User.jobTitle
-- ----------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;

-- ----------------------------------------------------------------------------
-- OrganizationMembership: job title, invitation tracking, active flag
-- ----------------------------------------------------------------------------
ALTER TABLE "OrganizationMembership" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;
ALTER TABLE "OrganizationMembership" ADD COLUMN IF NOT EXISTS "invitedById" TEXT;
ALTER TABLE "OrganizationMembership" ADD COLUMN IF NOT EXISTS "invitedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "OrganizationMembership" ADD COLUMN IF NOT EXISTS "invitationAcceptedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "OrganizationMembership" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "OrganizationMembership_invitedById_idx" ON "OrganizationMembership"("invitedById");
CREATE INDEX IF NOT EXISTS "OrganizationMembership_isActive_idx" ON "OrganizationMembership"("isActive");

-- FK: invitedById → User (self-reference for "who invited this member").
-- Use a distinct constraint name so re-running the migration is a no-op.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'OrganizationMembership' AND column_name = 'invitedById'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'OrganizationMembership_invitedById_fkey'
              AND table_name = 'OrganizationMembership'
        ) THEN
            ALTER TABLE "OrganizationMembership"
                ADD CONSTRAINT "OrganizationMembership_invitedById_fkey"
                FOREIGN KEY ("invitedById") REFERENCES "User" ("id")
                ON DELETE SET NULL;
        END IF;
    END IF;
END $$;
