-- Project hub: construction operating workspace
--
-- Adds:
--   Project.description           — free-text job description shown on detail page
--   Project.projectType           — enum-style work category (residential, commercial, …)
--   Project.estimatedCost         — contractor's estimated cost baseline (separate
--                                    from contract value) used to derive estimated
--                                    profit and projected profitability
--
-- All statements are idempotent so this migration is safe to re-run against
-- a database that was bootstrapped with `prisma db push` and is therefore not
-- recorded in the migration table.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectType' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE "public"."ProjectType" AS ENUM (
            'RESIDENTIAL_REMODEL',
            'NEW_CONSTRUCTION',
            'COMMERCIAL',
            'ROOFING',
            'ELECTRICAL',
            'PLUMBING',
            'HVAC',
            'LANDSCAPING',
            'GENERAL_CONTRACTING',
            'OTHER'
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Project'
          AND column_name = 'description'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."Project" ADD COLUMN "description" TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Project'
          AND column_name = 'projectType'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."Project"
            ADD COLUMN "projectType" "public"."ProjectType" DEFAULT 'GENERAL_CONTRACTING';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Project'
          AND column_name = 'estimatedCost'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."Project"
            ADD COLUMN "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Project_projectType_idx"
    ON "public"."Project"("projectType");
