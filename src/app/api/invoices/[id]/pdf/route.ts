import { NextRequest, NextResponse } from "next/server";
import { requireUser, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { generateInvoicePdf } from "@/lib/pdf-generator";
import { uploadPdfToR2 } from "@/lib/r2-storage";
import { logError } from "@/lib/logging";
import { hasFeature } from "@/lib/plans";
import { revalidateWithLocale } from "@/lib/revalidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/invoices/[id]/pdf — Download PDF directly
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    if (!user?.["organizationId"]) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req["url"]);
    const paperSize = (searchParams["get"]("paperSize") as "A4" | "Letter" | "Legal") || "A4";

    const invoice = await getInvoiceData(params["id"], user["organizationId"]);
    if (!invoice) {
      return NextResponse["json"]({ error: "Invoice not found" }, { status: 404 });
    }

    const org = await getOrgData(user["organizationId"]);

    const pdfBuffer = await generateInvoicePdf(invoice, org, { paperSize });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoice["number"]}.pdf"`,
        "Content-Length": pdfBuffer["length"]["toString"](),
        "Cache-Control": "private, no-cache, no-store",
      },
    });
  } catch (err: any) {
    logError("GET /api/invoices/[id]/pdf", err);
    return NextResponse["json"](
      { error: err["message"] || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

// POST /api/invoices/[id]/pdf — Generate and upload to R2
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    if (!user?.["organizationId"]) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req["json"]();
    const paperSize = (body["paperSize"] as "A4" | "Letter" | "Legal") || "A4";

    const invoice = await getInvoiceData(params["id"], user["organizationId"]);
    if (!invoice) {
      return NextResponse["json"]({ error: "Invoice not found" }, { status: 404 });
    }

    const org = await getOrgData(user["organizationId"]);

    const pdfBuffer = await generateInvoicePdf(invoice, org, { paperSize });

    // Upload to R2 for persistent storage
    let r2Url: string | undefined;
    try {
      const uploadResult = await uploadPdfToR2(pdfBuffer, invoice["number"]);
      r2Url = uploadResult["url"];

      // Save PDF record to database
      await db["invoicePdf"]["create"]({
        data: {
          orgId: user["organizationId"],
          invoiceId: invoice["id"],
          url: uploadResult["url"],
          paperSize,
          fileSize: uploadResult["size"],
        },
      });
    } catch (uploadErr) {
      // R2 upload is optional - PDF still returned even if upload fails
      logError("POST /api/invoices/[id]/pdf (R2 upload)", uploadErr);
    }

    return NextResponse["json"]({
      success: true,
      url: r2Url,
      size: pdfBuffer["length"],
      paperSize,
    });
  } catch (err: any) {
    logError("POST /api/invoices/[id]/pdf", err);
    return NextResponse["json"](
      { error: err["message"] || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

async function getInvoiceData(invoiceId: string, orgId: string) {
  try {
    return await db["invoice"]["findFirst"]({
      where: { id: invoiceId, orgId },
      include: {
        customer: true,
        project: true,
        items: { orderBy: { sortOrder: "asc" } },
      },
    });
  } catch (err) {
    if (isMissingColumnError(err)) {
      // Fallback for schema drift — select only safe columns
      return await db["invoice"]["findFirst"]({
        where: { id: invoiceId, orgId },
        select: {
          id: true,
          number: true,
          type: true,
          status: true,
          issueDate: true,
          dueDate: true,
          currency: true,
          subtotal: true,
          taxRate: true,
          taxAmount: true,
          discount: true,
          retainageRate: true,
          retainageAmount: true,
          total: true,
          amountPaid: true,
          logoUrl: true,
          billToAddress: true,
          shipToAddress: true,
          notes: true,
          customerId: true,
          projectId: true,
          customer: true,
          project: true,
          items: { orderBy: { sortOrder: "asc" } },
        },
      });
    }
    throw err;
  }
}

async function getOrgData(orgId: string) {
  const org = await db["organization"]["findUnique"]({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      plan: true,
      brandColor: true,
      accentColor: true,
      fontFamily: true,
      template: true,
      layout: true,
    },
  });
  if (!org) return null;
  return {
    ...org,
    canPdfExport: hasFeature(org["plan"] ?? "FREE", "pdfExport"),
  };
}
