import { NextResponse } from "next/server";
import { getTodayFixtures } from "@/lib/data";

// Client-facing live feed (spec §4): the LiveTicker island polls this. It
// reads Supabase (or the demo seed) — NEVER the football provider — and is
// ISR-cached so a stadium's worth of clients costs one Supabase read per
// 30 seconds.
export const revalidate = 30;

export async function GET() {
  const fixtures = await getTodayFixtures();
  return NextResponse.json({
    fixtures: fixtures.map((f) => ({
      id: f.id,
      stage: f.stage,
      status: f.status,
      kickoff: f.kickoff,
      elapsed: f.elapsed ?? null,
      home: f.home ? { id: f.home.id, name: f.home.name, code: f.home.code } : null,
      away: f.away ? { id: f.away.id, name: f.away.name, code: f.away.code } : null,
      home_score: f.home_score,
      away_score: f.away_score,
      penalties: f.penalties,
    })),
  });
}
