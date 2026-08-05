import { NextRequest, NextResponse } from "next/server";
import { exportInvoices } from "@/lib/actions/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const formatParam = url.searchParams.get("format") || "csv";
    const format = formatParam === "xlsx" ? "xlsx" : "csv";
    const result = await exportInvoices(format);

    if (format === "csv") {
      return new NextResponse(result.content, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${result.filename}"`,
        },
      });
    }

    const buffer = Buffer.from(result.content, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
