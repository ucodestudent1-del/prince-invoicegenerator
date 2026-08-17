-- Drop default constraint first
ALTER TABLE "Organization" ALTER COLUMN "template" DROP DEFAULT;

-- Create new enum type
CREATE TYPE "TemplateStyle_new" AS ENUM ('REGULAR_INVOICE', 'TAX_INVOICE', 'PROFORMA_INVOICE', 'RECEIPT');

-- Alter column to use new enum type with mapping
ALTER TABLE "Organization" 
  ALTER COLUMN "template" TYPE "TemplateStyle_new" 
  USING (
    CASE "template"
      WHEN 'STANDARD' THEN 'REGULAR_INVOICE'::"TemplateStyle_new"
      WHEN 'MODERN' THEN 'REGULAR_INVOICE'::"TemplateStyle_new"
      WHEN 'MINIMAL' THEN 'REGULAR_INVOICE'::"TemplateStyle_new"
      WHEN 'CLASSIC' THEN 'REGULAR_INVOICE'::"TemplateStyle_new"
      ELSE 'REGULAR_INVOICE'::"TemplateStyle_new"
    END
  );

-- Set new default
ALTER TABLE "Organization" ALTER COLUMN "template" SET DEFAULT 'REGULAR_INVOICE';

-- Drop old enum type
DROP TYPE "TemplateStyle";

-- Rename new enum type to original name
ALTER TYPE "TemplateStyle_new" RENAME TO "TemplateStyle";