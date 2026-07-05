import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cronAuth";
import { getProvider } from "@/lib/providers";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Live tick (spec §4): runs every minute during the 15:00–23:59 UTC window
// but exits immediately (NO provider call) unless a fixture in Supabase is
// LIVE/HT or kicks off within ±10 minutes. This guard is what keeps the
// free tier alive on match days.
export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const db = getServiceSupabase();
  if (!db) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const now = Date.now();
  const lo = new Date(now - 10 * 60_000).toISOString();
  const hi = new Date(now + 10 * 60_000).toISOString();

  const { data: candidates } = await db
    .from("fixtures")
    .select("id,status,kickoff")
    .or(`status.in.(LIVE,HT),and(kickoff.gte.${lo},kickoff.lte.${hi})`);

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, skipped: true }); // no API call spent
  }

  const provider = getProvider();
  const live = await provider.getFixtures({ live: true });

  let updated = 0;
  for (const f of live) {
    await db.from("fixtures").upsert(
      {
        id: f.id,
        kickoff: f.kickoff,
        stage: f.stage,
        status: f.status,
        home_team: f.home_team,
        away_team: f.away_team,
        home_score: f.home_score,
        away_score: f.away_score,
        penalties: f.penalties,
        venue: f.venue,
        events: f.events,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    updated++;
  }

  // Fixtures we were watching that dropped out of the live feed have ended;
  // pull their final line once so status flips off LIVE.
  const liveIds = new Set(live.map((f) => f.id));
  const ended = candidates.filter(
    (c) => (c.status === "LIVE" || c.status === "HT") && !liveIds.has(c.id)
  );
  if (ended.length > 0) {
    const day = new Date(now).toISOString().slice(0, 10);
    const finals = await provider.getFixtures({ from: day, to: day });
    for (const f of finals.filter((x) => ended.some((e) => e.id === x.id))) {
      await db
        .from("fixtures")
        .update({
          status: f.status,
          home_score: f.home_score,
          away_score: f.away_score,
          penalties: f.penalties,
          events: f.events,
          updated_at: new Date().toISOString(),
        })
        .eq("id", f.id);
    }
  }

  console.log("[cron/live]", JSON.stringify({ watched: candidates.length, updated }));
  return NextResponse.json({ ok: true, watched: candidates.length, updated });
}
