import { NextRequest, NextResponse } from "next/server";
import { recordPayment, getInvoicePayments } from "@/lib/actions/invoices";

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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const payment = await recordPayment({
      invoiceId: params.id,
      amount: Number(body.amount),
      method: body.method,
      note: body.note,
      stripePaymentId: body.stripePaymentId,
      paypalTransactionId: body.paypalTransactionId,
    });
    return NextResponse.json(payment);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
