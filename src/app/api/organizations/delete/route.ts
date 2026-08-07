import { NextRequest, NextResponse } from "next/server";
import { deleteOrganization } from "@/lib/actions/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const result = await deleteOrganization();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete organization" },
      { status: 500 }
    );
  }
}
