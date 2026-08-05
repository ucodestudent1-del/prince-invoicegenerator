import { NextRequest, NextResponse } from "next/server";
import { createPaymentLink } from "@/lib/actions/invoices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const gateway = body.gateway;
    if (!["stripe", "paypal"].includes(gateway)) {
      return NextResponse.json({ error: "Invalid gateway. Use 'stripe' or 'paypal'." }, { status: 400 });
    }
    const result = await createPaymentLink({ invoiceId: params.id, gateway: gateway as "stripe" | "paypal" });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
