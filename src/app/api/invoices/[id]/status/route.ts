import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { markInvoiceStatus } from "@/lib/actions/invoices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req["json"]();
    const status = body["status"];
    const validStatuses = ["DRAFT", "SENT", "VIEWED", "PAID", "UNPAID", "OVERDUE", "VOID"];
    if (!validStatuses["includes"](status)) {
      return NextResponse["json"]({ error: "Invalid status." }, { status: 400 });
    }
    await markInvoiceStatus(params["id"], status);
    return NextResponse["json"]({ success: true });
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}
