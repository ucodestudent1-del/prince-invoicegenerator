import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTaxesCollectedReport } from "@/lib/actions/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL(req["url"]);
    const year = url["searchParams"]["get"]("year") ? Number(url["searchParams"]["get"]("year")) : undefined;
    const report = await getTaxesCollectedReport(year);
    return NextResponse["json"](report);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}
