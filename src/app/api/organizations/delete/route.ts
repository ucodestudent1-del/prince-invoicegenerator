import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureVerified } from "@/lib/org";
import { deleteOrganization } from "@/lib/actions/data";
import { logError } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureVerified();
    const result = await deleteOrganization();
    return NextResponse["json"]({ success: true, ...result });
  } catch (error: any) {
    if (error && error["name"] === "EmailVerificationError") {
      return NextResponse["json"]({ error: error["message"] }, { status: 403 });
    }
    if (error && error["name"] === "ActionError") {
      return NextResponse["json"]({ error: error["message"] }, { status: 400 });
    }
    logError("api.organizations.delete", error);
    return NextResponse["json"](
      { success: false, error: "Failed to delete organization" },
      { status: 500 }
    );
  }
}
