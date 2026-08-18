import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET() {
  try {
    const resolve = execSync("npx prisma migrate resolve --rolled-back 20260816223700_replace_template_styles || true", {
      encoding: "utf8",
      cwd: process.cwd(),
      env: process.env,
    }).trim();

    const deploy = execSync("npx prisma migrate deploy", {
      encoding: "utf8",
      cwd: process.cwd(),
      env: process.env,
    }).trim();

    return NextResponse.json({ success: true, resolve, deploy });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
