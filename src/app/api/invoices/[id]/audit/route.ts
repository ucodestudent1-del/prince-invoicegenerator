import { NextRequest, NextResponse } from "next/server";
import { getInvoiceAuditLogs } from "@/lib/actions/invoices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const logs = await getInvoiceAuditLogs(params.id);
    return NextResponse.json(logs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
