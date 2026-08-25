import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/org";
import { db } from "@/lib/db";
import { uploadToR2, isR2Configured } from "@/lib/r2";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const limit = rateLimit(req);
  if (!limit["ok"]) {
    return NextResponse["json"]({ error: "Too many requests" }, { status: 429 });
  }

  const user = await requireUser();
  if (!user["organizationId"]) {
    return NextResponse["json"]({ error: "No organization" }, { status: 400 });
  }
  if (!isR2Configured()) {
    return NextResponse["json"]({ error: "Storage not configured" }, { status: 503 });
  }

  const contentType = req["headers"]["get"]("content-type") || "";
  if (!contentType["includes"]("multipart/form-data")) {
    return NextResponse["json"]({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const contentLength = req["headers"]["get"]("content-length");
  if (contentLength && Number(contentLength) > 20 * 1024 * 1024) {
    return NextResponse["json"]({ error: "Request too large" }, { status: 413 });
  }

  const form = await req["formData"]();
  const file = form["get"]("file");
  if (!(file instanceof File)) {
    return NextResponse["json"]({ error: "No file" }, { status: 400 });
  }

  const buffer = Buffer["from"](await file["arrayBuffer"]());
  const ext = file["name"]["split"](".")["pop"]() ?? "bin";
  const key = `org/${user["organizationId"]}/photos/${Date["now"]()}-${Math["random"]()
    ["toString"](36)
    ["slice"](2)}.${ext}`;

  const url = await uploadToR2(key, buffer, file["type"]);

  const photo = await db["photoAttachment"]["create"]({
    data: {
      orgId: user["organizationId"],
      key,
      url,
      filename: file["name"],
      contentType: file["type"],
      size: buffer["length"],
      uploadedById: user["id"],
    },
    select: { id: true, url: true },
  });

  return NextResponse["json"]({ id: photo["id"], url: photo["url"] });
}
