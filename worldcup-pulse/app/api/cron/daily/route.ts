import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cronAuth";
import { getProvider } from "@/lib/providers";
import { getServiceSupabase } from "@/lib/supabase";
import { generateTakes } from "@/lib/takesEngine";
import type { Fixture, OddsSnapshot, PlayerWithForm, Team } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily ingest (spec §4): fixtures next 7 days, top scorers, player form
// snapshots -> upsert Supabase. Also regenerates hot takes from the fresh
// deltas. ~4 provider calls + 1 per tracked player: comfortably inside the
// 100 req/day free tier.
export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const db = getServiceSupabase();
  if (!db) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const provider = getProvider();
  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const to = new Date(today.getTime() + 7 * 86400_000).toISOString().slice(0, 10);
  const log: Record<string, number> = {};

  // 1. Teams (id/name/code/flag only — curated colors are never overwritten).
  const teams = await provider.getTeams();
  if (teams.length > 0) {
    await db.from("teams").upsert(
      teams.map((t: Team) => ({ id: t.id, name: t.name, code: t.code, flag_url: t.flag_url })),
      { onConflict: "id" }
    );
  }
  log.teams = teams.length;

  // 2. Fixtures for the next 7 days.
  const fixtures = await provider.getFixtures({ from, to });
  if (fixtures.length > 0) {
    await db.from("fixtures").upsert(
      fixtures.map((f: Fixture) => ({ ...f, elapsed: undefined, updated_at: new Date().toISOString() })),
      { onConflict: "id" }
    );
  }
  log.fixtures = fixtures.length;

  // 3. Top scorers -> players + today's form snapshot.
  const scorers = await provider.getTopScorers();
  log.scorers = scorers.length;
  for (const s of scorers) {
    const stats = await provider.getPlayerStats(s.player_id);
    if (!stats) continue;
    await db.from("players").upsert(
      {
        id: stats.player.id,
        team_id: stats.player.team_id,
        name: stats.player.name,
        position: stats.player.position,
        photo_url: stats.player.photo_url,
      },
      { onConflict: "id" }
    );
    const { data: prev } = await db
      .from("player_form")
      .select("rating")
      .eq("player_id", stats.player.id)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    await db.from("player_form").upsert(
      {
        player_id: stats.player.id,
        snapshot_date: from,
        goals: stats.goals,
        assists: stats.assists,
        xg: stats.xg,
        minutes: stats.minutes,
        rating: stats.rating,
        form_delta: prev?.rating != null ? Math.round((stats.rating - prev.rating) * 100) / 100 : 0,
      },
      { onConflict: "player_id,snapshot_date" }
    );
  }

  // 4. Regenerate hot takes from the freshly written snapshots.
  const [{ data: allFixtures }, { data: players }, { data: form }, { data: odds }] =
    await Promise.all([
      db.from("fixtures").select("*"),
      db.from("players").select("*"),
      db.from("player_form").select("*").order("snapshot_date", { ascending: true }),
      db.from("odds_snapshots").select("*").order("captured_at", { ascending: true }),
    ]);

  const formByPlayer = new Map<number, PlayerWithForm["form"]>();
  for (const s of form ?? []) {
    const list = formByPlayer.get(s.player_id) ?? [];
    list.push(s);
    formByPlayer.set(s.player_id, list);
  }
  const playersWithForm: PlayerWithForm[] = (players ?? []).map((p) => ({
    ...p,
    team: null,
    form: formByPlayer.get(p.id) ?? [],
  }));

  const takes = generateTakes({
    fixtures: (allFixtures ?? []).map((f) => ({ ...f, home: null, away: null })),
    players: playersWithForm,
    odds: (odds ?? []) as OddsSnapshot[],
  });
  // Replace the editorial feed wholesale — takes are derived data.
  await db.from("hot_takes").delete().gte("id", 0);
  if (takes.length > 0) await db.from("hot_takes").insert(takes);
  log.takes = takes.length;

  console.log("[cron/daily]", JSON.stringify(log));
  return NextResponse.json({ ok: true, ...log });
}
