DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Invoice' AND column_name = 'billToAddress') THEN
        ALTER TABLE "Invoice" ADD COLUMN "billToAddress" TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Invoice' AND column_name = 'shipToAddress') THEN
        ALTER TABLE "Invoice" ADD COLUMN "shipToAddress" TEXT;
    END IF;
END $$;
