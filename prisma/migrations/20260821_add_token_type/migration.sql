-- Add type column to VerificationToken table

ALTER TABLE "VerificationToken" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'EMAIL_VERIFY';
