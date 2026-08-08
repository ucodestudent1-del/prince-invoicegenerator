DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Invoice' AND column_name = 'logoUrl') THEN
        ALTER TABLE "Invoice" ADD COLUMN "logoUrl" TEXT;
    END IF;
END $$;
