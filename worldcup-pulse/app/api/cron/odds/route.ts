import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cronAuth";
import { getProvider } from "@/lib/providers";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Odds snapshots (spec §4): fixtures inside the next 48h. Append-only —
// every snapshot is stored so odds movement can be charted.
export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const db = getServiceSupabase();
  if (!db) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 48 * 3600_000);
  const { data: upcoming } = await db
    .from("fixtures")
    .select("id")
    .gte("kickoff", now.toISOString())
    .lte("kickoff", horizon.toISOString());

  const provider = getProvider();
  let captured = 0;
  for (const f of upcoming ?? []) {
    const snap = await provider.getOdds(f.id);
    if (!snap) continue; // fallback provider: degrade silently, UI hides odds
    await db.from("odds_snapshots").insert({
      fixture_id: snap.fixture_id,
      bookmaker: snap.bookmaker,
      market: snap.market,
      values: snap.values,
    });
    captured++;
  }

  console.log("[cron/odds]", JSON.stringify({ fixtures: upcoming?.length ?? 0, captured }));
  return NextResponse.json({ ok: true, fixtures: upcoming?.length ?? 0, captured });
}
