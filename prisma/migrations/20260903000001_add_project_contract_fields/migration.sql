-- Add construction-specific fields to the Project model.
-- These support the Project Workspace: contract value tracking, payment terms,
-- retainage, deposits, project manager, and estimated completion date.
-- Uses IF NOT EXISTS guards for safe re-application on partially-migrated databases.

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "estCompletionDate" TIMESTAMP;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "contractValue" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT DEFAULT 'NET_30';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "taxRate" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "retainageRate" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "depositRequired" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "depositPaid" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "projectManager" TEXT;
