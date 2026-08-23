import { NextRequest, NextResponse } from "next/server";
import { convertEstimateToInvoice } from "@/lib/actions/estimates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req["json"]();
    const result = await convertEstimateToInvoice(params["id"], {
      dueDate: body["dueDate"],
      paymentTerms: body["paymentTerms"],
      invoiceNumber: body["invoiceNumber"],
    });
    return NextResponse["json"](result);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}
