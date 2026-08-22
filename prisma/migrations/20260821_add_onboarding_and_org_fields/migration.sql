-- Extend Organization with onboarding and business fields
-- Add OnboardingState model

-- ---------------------------------------------------------------------------
-- 1. Extend Organization table
-- ---------------------------------------------------------------------------

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "industry" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "businessType" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "addressLine1" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "addressLine2" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'US';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "taxId" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "taxIdType" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/New_York';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "dateFormat" TEXT NOT NULL DEFAULT 'MM/DD/YYYY';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "numberFormat" TEXT NOT NULL DEFAULT 'en-US';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "defaultTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "defaultPaymentTerms" TEXT NOT NULL DEFAULT 'NET_30';

-- ---------------------------------------------------------------------------
-- 2. Create OnboardingState table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "OnboardingState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "currentStep" TEXT NOT NULL DEFAULT 'identity',
    "completedSteps" TEXT[],
    "identityData" JSONB,
    "contactData" JSONB,
    "complianceData" JSONB,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP WITH TIME ZONE,
    "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "lastActiveAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT "OnboardingState_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OnboardingState_userId_idx" ON "OnboardingState" ("userId");
CREATE INDEX IF NOT EXISTS "OnboardingState_isComplete_idx" ON "OnboardingState" ("isComplete");
