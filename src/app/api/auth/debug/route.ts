import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process["env"]["NODE_ENV"] === "production") {
    return NextResponse["json"]({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await getCurrentUser();
    return NextResponse["json"]({
      authenticated: !!user,
    });
  } catch (err: any) {
    return NextResponse["json"](
      { error: "Failed to check auth status" },
      { status: 500 }
    );
  }
}
