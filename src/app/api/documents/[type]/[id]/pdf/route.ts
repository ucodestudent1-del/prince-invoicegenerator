import { NextRequest, NextResponse } from "next/server";
import { requireUser, isMissingColumnError } from "@/lib/org";
import { db } from "@/lib/db";
import { generateDocumentPdf } from "@/lib/pdf-generator";
import { resolvePaperSize } from "@/lib/pdf-constants";
import { logError } from "@/lib/logging";
import { hasFeature } from "@/lib/plans";
import type { EntityType } from "@/components/document-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DocConfig = { label: string; entityType: EntityType };

const SUPPORTED: Record<string, DocConfig> = {
  invoices: { label: "Invoice", entityType: "invoices" },
  "change-orders": { label: "Change-Order", entityType: "change-orders" },
  estimates: { label: "Estimate", entityType: "estimates" },
};

export async function GET(
  req: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  try {
    const user = await requireUser();
    if (!user["emailVerified"]) {
      return NextResponse["json"]({ error: "Email verification required" }, { status: 403 });
    }
    if (!user?.["organizationId"]) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }

    const cfg = SUPPORTED[params["type"]];
    if (!cfg) {
      return NextResponse["json"]({ error: "Unsupported document type" }, { status: 400 });
    }

    const { searchParams } = new URL(req["url"]);
    const paperSize = resolvePaperSize(searchParams["get"]("paperSize"));
    const locale = searchParams["get"]("locale") || "en";

    const doc = await getDocumentData(cfg["entityType"], params["id"], user["organizationId"]);
    if (!doc) {
      return NextResponse["json"]({ error: "Document not found" }, { status: 404 });
    }

    const org = await getOrgData(user["organizationId"]);

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generateDocumentPdf(cfg["entityType"], doc, org, { paperSize, locale });
    } catch (genErr: any) {
      const msg = genErr?.["message"] ?? "Failed to generate PDF";
      const retryable = /Chromium|launch/i["test"](msg);
      return NextResponse["json"](
        { error: retryable ? "PDF service unavailable" : "Failed to generate PDF", retryable },
        { status: retryable ? 503 : 500 }
      );
    }

    const filename = `${cfg["label"]}-${doc["number"] ?? doc["id"]}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer["length"]["toString"](),
        "Cache-Control": "private, no-cache, no-store",
      },
    });
  } catch (err: any) {
    logError("GET /api/documents/[type]/[id]/pdf", err);
    if (err && err["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 403 });
    }
    if (err && err["name"] === "ActionError") {
      return NextResponse["json"]({ error: err["message"] }, { status: 400 });
    }
    return NextResponse["json"]({ error: "Failed to generate PDF" }, { status: 500 });
  }
}

async function getDocumentData(entityType: EntityType, docId: string, orgId: string): Promise<any> {
  try {
    if (entityType === "invoices") {
      return await db["invoice"]["findFirst"]({
        where: { id: docId, orgId },
        include: {
          customer: true,
          project: true,
          items: { orderBy: { sortOrder: "asc" } },
        },
      });
    }
    if (entityType === "estimates") {
      return await db["estimate"]["findFirst"]({
        where: { id: docId, orgId },
        include: {
          customer: true,
          project: true,
          items: { orderBy: { sortOrder: "asc" } },
          linkedInvoice: { select: { id: true, number: true, status: true, total: true } },
        },
      });
    }
    return await db["changeOrder"]["findFirst"]({
      where: { id: docId, orgId },
      include: {
        project: true,
        invoice: { select: { id: true, number: true, status: true, total: true } },
      },
    });
  } catch (err) {
    if (isMissingColumnError(err)) {
      if (entityType === "invoices") {
        return await db["invoice"]["findFirst"]({
          where: { id: docId, orgId },
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
      if (entityType === "estimates") {
        return await db["estimate"]["findFirst"]({
          where: { id: docId, orgId },
          select: {
            id: true,
            number: true,
            status: true,
            issueDate: true,
            validUntil: true,
            currency: true,
            subtotal: true,
            taxRate: true,
            taxAmount: true,
            discount: true,
            total: true,
            notes: true,
            customerId: true,
            projectId: true,
            createdAt: true,
            updatedAt: true,
            customer: { select: { id: true, name: true, company: true, email: true, address: true } },
            project: { select: { id: true, name: true } },
            items: { orderBy: { sortOrder: "asc" } },
            linkedInvoice: { select: { id: true, number: true, status: true, total: true } },
          },
        });
      }
      return await db["changeOrder"]["findFirst"]({
        where: { id: docId, orgId },
        select: {
          id: true,
          number: true,
          title: true,
          description: true,
          amount: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          projectId: true,
          invoiceId: true,
          project: { select: { id: true, name: true } },
          invoice: { select: { id: true, number: true, status: true, total: true } },
        },
      });
    }
    throw err;
  }
}

async function getOrgData(orgId: string): Promise<any> {
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
      currency: true,
    },
  });
  if (!org) return null;
  return {
    ...org,
    canPdfExport: hasFeature(org["plan"] ?? "FREE", "pdfExport"),
  };
}
