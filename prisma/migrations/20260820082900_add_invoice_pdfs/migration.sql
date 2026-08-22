-- Invoice PDFs: store generated PDF documents for email attachments and re-download
--
-- Apply with: npx prisma migrate deploy

CREATE TABLE IF NOT EXISTS "InvoicePdf" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "paperSize" TEXT NOT NULL DEFAULT 'A4',
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT "InvoicePdf_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoicePdf_invoiceId_fkey"
        FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "InvoicePdf_invoiceId_idx" ON "InvoicePdf" ("invoiceId");
CREATE INDEX IF NOT EXISTS "InvoicePdf_orgId_idx" ON "InvoicePdf" ("orgId");
