-- AddColumns: User
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'locale') THEN
        ALTER TABLE "User" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
    END IF;
END $$;

-- AddColumns: Organization
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Organization' AND column_name = 'defaultLocale') THEN
        ALTER TABLE "Organization" ADD COLUMN "defaultLocale" TEXT NOT NULL DEFAULT 'en';
    END IF;
END $$;

-- CreateTable: LocalizedString
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'LocalizedString') THEN
        CREATE TABLE "LocalizedString" (
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
    END IF;
END $$;

-- CreateIndex: LocalizedString composite unique
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'LocalizedString_orgId_entityType_entityId_field_locale_key') THEN
        CREATE UNIQUE INDEX "LocalizedString_orgId_entityType_entityId_field_locale_key" ON "LocalizedString"("orgId", "entityType", "entityId", "field", "locale");
    END IF;
END $$;

-- CreateIndex: LocalizedString org/entity lookup
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'LocalizedString_orgId_entityType_entityId_idx') THEN
        CREATE INDEX "LocalizedString_orgId_entityType_entityId_idx" ON "LocalizedString"("orgId", "entityType", "entityId");
    END IF;
END $$;

-- AddForeignKey: LocalizedString -> Organization
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LocalizedString_orgId_fkey' AND table_name = 'LocalizedString') THEN
        ALTER TABLE "LocalizedString" ADD CONSTRAINT "LocalizedString_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
