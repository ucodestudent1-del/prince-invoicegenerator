-- Add OrganizationSettings and PaymentInfo models

-- ---------------------------------------------------------------------------
-- 1. Create OrganizationSettings table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "OrganizationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL UNIQUE,
    "defaultTemplateId" TEXT,
    "emailSubjectTemplate" TEXT,
    "emailBodyTemplate" TEXT,
    "autoReminders" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT "OrganizationSettings_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrganizationSettings_orgId_idx" ON "OrganizationSettings" ("orgId");

-- ---------------------------------------------------------------------------
-- 2. Create PaymentInfo table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "PaymentInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL UNIQUE,
    "showOnInvoice" BOOLEAN NOT NULL DEFAULT true,
    "paymentInstructions" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT "PaymentInfo_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PaymentInfo_orgId_idx" ON "PaymentInfo" ("orgId");
