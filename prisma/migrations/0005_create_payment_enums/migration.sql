-- CreateEnum: PaymentMethod if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN
        CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CHECK', 'CREDIT_CARD', 'STRIPE', 'PAYPAL', 'BANK_TRANSFER', 'OTHER');
    END IF;
END $$;

-- CreateEnum: PaymentStatus if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
        CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
    END IF;
END $$;

-- AlterTable: Payment.method from TEXT to PaymentMethod
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Payment' AND column_name = 'method' AND data_type = 'text') THEN
        ALTER TABLE "Payment" ALTER COLUMN "method" DROP DEFAULT;
        ALTER TABLE "Payment" ALTER COLUMN "method" TYPE "PaymentMethod" USING "method"::"PaymentMethod";
        ALTER TABLE "Payment" ALTER COLUMN "method" SET DEFAULT 'OTHER'::"PaymentMethod";
    END IF;
END $$;

-- AlterTable: Payment.status from TEXT to PaymentStatus
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Payment' AND column_name = 'status' AND data_type = 'text') THEN
        ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;
        ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus" USING "status"::"PaymentStatus";
        ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'COMPLETED'::"PaymentStatus";
    END IF;
END $$;
