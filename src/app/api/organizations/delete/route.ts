import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteOrganization } from "@/lib/actions/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse["json"]({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await deleteOrganization();
    return NextResponse["json"]({ success: true, ...result });
  } catch (error: any) {
    return NextResponse["json"](
      { success: false, error: error["message"] || "Failed to delete organization" },
      { status: 500 }
    );
  }
}
