-- Drop the InvoiceTemplate table and remove defaultTemplateId from OrganizationSettings
DROP TABLE IF EXISTS "InvoiceTemplate";

ALTER TABLE "OrganizationSettings" DROP COLUMN IF EXISTS "defaultTemplateId";

-- Drop the foreign key constraint if it still references InvoiceTemplate
ALTER TABLE "OrganizationSettings" DROP CONSTRAINT IF EXISTS "OrganizationSettings_defaultTemplateId_fkey";
