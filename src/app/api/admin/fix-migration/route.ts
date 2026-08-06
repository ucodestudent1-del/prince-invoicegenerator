import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    await prisma.$executeRaw`
      DELETE FROM _prisma_migrations 
      WHERE migration_name = '0004_reconcile_schema_drift'
    `;

    await prisma.$executeRaw`
      DO $$
      DECLARE
          type_oid oid;
      BEGIN
          SELECT oid INTO type_oid FROM pg_type WHERE typname = 'InvoiceStatus';
          IF type_oid IS NOT NULL THEN
              IF NOT EXISTS (
                  SELECT 1 FROM pg_enum
                  WHERE enumtypid = type_oid
                  AND enumlabel = 'UNPAID'
              ) THEN
                  ALTER TYPE "InvoiceStatus" ADD VALUE 'UNPAID';
              END IF;
          END IF;
      END $$;
    `;

    return NextResponse.json({ success: true, message: "Migration record cleared" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
