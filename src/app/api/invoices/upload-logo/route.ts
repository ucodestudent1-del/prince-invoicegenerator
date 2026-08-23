import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/org";
import { uploadToR2, isR2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user["organizationId"]) {
    return NextResponse["json"]({ error: "No organization" }, { status: 400 });
  }
  if (!isR2Configured()) {
    return NextResponse["json"]({ error: "Storage not configured" }, { status: 503 });
  }

  const form = await req["formData"]();
  const rawFile = form["get"]("file");
  if (!rawFile || typeof rawFile !== "object" || typeof (rawFile as any).name !== "string") {
    return NextResponse["json"]({ error: "No file" }, { status: 400 });
  }
  const file = rawFile as any;

  if (!ALLOWED_TYPES["includes"](file["type"])) {
    return NextResponse["json"](
      { error: "Invalid file type. Accepted: PNG, JPG, WebP" },
      { status: 400 }
    );
  }

  if (file["size"] > MAX_SIZE) {
    return NextResponse["json"](
      { error: "File too large. Maximum 5MB" },
      { status: 400 }
    );
  }

  const buffer = Buffer["from"](await file["arrayBuffer"]());
  const ext = file["name"]["split"](".")["pop"]() ?? "png";
  const key = `org/${user["organizationId"]}/logos/${Date["now"]()}-${Math["random"]()
    ["toString"](36)
    ["slice"](2)}.${ext}`;

  const url = await uploadToR2(key, buffer, file["type"]);

  return NextResponse["json"]({ url });
}