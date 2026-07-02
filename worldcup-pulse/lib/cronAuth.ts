import { NextResponse } from "next/server";

// All /api/cron/* routes require Authorization: Bearer $CRON_SECRET
// (spec §4). Vercel Cron sends this header automatically when the
// CRON_SECRET env var is set on the project.
export function requireCronAuth(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
