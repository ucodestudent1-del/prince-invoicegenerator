import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLateFeeConfig, saveLateFeeConfig } from "@/lib/actions/late-fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    const config = await getLateFeeConfig();
    return NextResponse["json"](config);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req["json"]();
    const config = await saveLateFeeConfig({
      enabled: body["enabled"] ?? false,
      rate: Number(body["rate"]) || 0,
      graceDays: Number(body["graceDays"]) || 0,
      fixedFee: Number(body["fixedFee"]) || 0,
      maxFee: body["maxFee"] ? Number(body["maxFee"]) : null,
    });
    return NextResponse["json"](config);
  } catch (err: any) {
    return NextResponse["json"]({ error: err["message"] }, { status: 400 });
  }
}
