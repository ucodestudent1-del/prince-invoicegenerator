-- Add title and billToAddress columns to the Estimate table.
-- These support the enhanced 4-section estimate form (Phase 4).
--
-- Apply with: npx prisma migrate deploy
-- The application's isMissingColumnError fallbacks tolerate an unmigrated
-- database, degrading gracefully when these columns are absent.

ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "billToAddress" TEXT;
