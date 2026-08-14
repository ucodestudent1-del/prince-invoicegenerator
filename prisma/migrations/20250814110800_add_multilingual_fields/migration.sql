-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "defaultLocale" TEXT NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE IF NOT EXISTS "LocalizedString" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalizedString_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LocalizedString_orgId_entityType_entityId_field_locale_key" ON "LocalizedString"("orgId", "entityType", "entityId", "field", "locale");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LocalizedString_orgId_entityType_entityId_idx" ON "LocalizedString"("orgId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "LocalizedString" ADD CONSTRAINT "LocalizedString_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
