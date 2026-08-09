import { NextRequest, NextResponse } from "next/server";
import { getInvoicePayments } from "@/lib/actions/invoices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payments = await getInvoicePayments(params.id);
    return NextResponse.json(payments);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
