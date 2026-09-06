-- Project Documents
--
-- A project-scoped document store for contracts, signed change orders,
-- invoices, receipts, plans, permits, insurance docs, and progress photos.
-- File bytes live on R2 (key/url); this table is metadata only.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectDocumentCategory' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE "public"."ProjectDocumentCategory" AS ENUM (
            'CONTRACT',
            'ESTIMATE',
            'CHANGE_ORDER',
            'INVOICE',
            'RECEIPT',
            'PERMIT',
            'PHOTO',
            'INSURANCE',
            'PLAN',
            'OTHER'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."ProjectDocument" (
    "id"            TEXT PRIMARY KEY,
    "orgId"         TEXT NOT NULL,
    "projectId"     TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "description"   TEXT,
    "category"      "public"."ProjectDocumentCategory" NOT NULL DEFAULT 'OTHER',
    "r2Key"         TEXT NOT NULL,
    "url"           TEXT NOT NULL,
    "contentType"   TEXT,
    "size"          INTEGER,
    "uploadedById"  TEXT,
    "uploadedByName" TEXT,
    "version"       INTEGER NOT NULL DEFAULT 1,
    "previousId"    TEXT,
    "createdAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ProjectDocument_orgId_idx" ON "public"."ProjectDocument"("orgId");
CREATE INDEX IF NOT EXISTS "ProjectDocument_projectId_idx" ON "public"."ProjectDocument"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectDocument_category_idx" ON "public"."ProjectDocument"("category");
CREATE INDEX IF NOT EXISTS "ProjectDocument_createdAt_idx" ON "public"."ProjectDocument"("createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ProjectDocument_projectId_fkey'
          AND table_name = 'ProjectDocument'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."ProjectDocument"
            ADD CONSTRAINT "ProjectDocument_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "public"."Project" ("id")
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ProjectDocument_orgId_fkey'
          AND table_name = 'ProjectDocument'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."ProjectDocument"
            ADD CONSTRAINT "ProjectDocument_orgId_fkey"
            FOREIGN KEY ("orgId") REFERENCES "public"."Organization" ("id")
            ON DELETE CASCADE;
    END IF;
END $$;
