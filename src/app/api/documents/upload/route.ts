import { NextRequest, NextResponse } from "next/server";
import { getPresignedUploadUrl, isR2Configured, R2_BUCKET } from "@/lib/r2";
import { requireUser } from "@/lib/org";
import * as crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (!user["organizationId"]) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    if (!isR2Configured()) {
      return NextResponse.json({ error: "R2 not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const projectId: string = body["projectId"];
    const filename: string = body["filename"];
    const contentType: string = body["contentType"] ?? "application/octet-stream";
    const size: number = body["size"] ?? 0;

    if (!projectId || !filename) {
      return NextResponse.json({ error: "projectId and filename required" }, { status: 400 });
    }

    const ext = filename["slice"](filename["lastIndexOf"](".")).toLowerCase();
    const key = `projects/${projectId}/documents/${crypto.randomUUID()}${ext}`;
    const uploadUrl = await getPresignedUploadUrl(key, contentType);
    const publicUrl = `${process.env["R2_PUBLIC_URL"]}/${key}`;

    return NextResponse.json({
      uploadUrl,
      key,
      url: publicUrl,
      bucket: R2_BUCKET,
      size,
      contentType,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.["message"] ?? "Upload failed" }, { status: 500 });
  }
}
