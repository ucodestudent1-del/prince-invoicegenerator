-- Add password field to User table for email/password authentication
--
-- Apply with: npx prisma migrate deploy

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "password" TEXT;
