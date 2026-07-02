import { getSupabase } from "@/lib/supabase";
import {
  demoFixtures,
  demoForm,
  demoOdds,
  demoPlayers,
  demoTakes,
  demoTeams,
} from "@/lib/demo/seed";
import type {
  Fixture,
  FixtureWithTeams,
  HotTake,
  OddsSnapshot,
  PlayerWithForm,
  Team,
} from "@/lib/types";

// Read layer for server components. Cache-first (spec §2 decision 2): reads
// come from Supabase only; when Supabase env is absent (local dev/preview)
// the demo seed keeps the whole UI functional.

export function isDemoMode(): boolean {
  return getSupabase() === null;
}

export async function getTeams(): Promise<Team[]> {
  const db = getSupabase();
  if (!db) return demoTeams;
  const { data } = await db.from("teams").select("*");
  return (data as Team[]) ?? [];
}

function joinTeams(fixtures: Fixture[], teams: Team[]): FixtureWithTeams[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  return fixtures.map((f) => ({
    ...f,
    home: f.home_team != null ? (byId.get(f.home_team) ?? null) : null,
    away: f.away_team != null ? (byId.get(f.away_team) ?? null) : null,
  }));
}

export async function getFixtures(): Promise<FixtureWithTeams[]> {
  const db = getSupabase();
  if (!db) {
    return joinTeams(demoFixtures, demoTeams).sort((a, b) =>
      a.kickoff.localeCompare(b.kickoff)
    );
  }
  const [{ data: fixtures }, teams] = await Promise.all([
    db.from("fixtures").select("*").order("kickoff", { ascending: true }),
    getTeams(),
  ]);
  return joinTeams((fixtures as Fixture[]) ?? [], teams);
}

export async function getFixture(id: number): Promise<FixtureWithTeams | null> {
  const fixtures = await getFixtures();
  return fixtures.find((f) => f.id === id) ?? null;
}

// Fixtures on the given UTC day plus anything currently live.
export async function getTodayFixtures(now = new Date()): Promise<FixtureWithTeams[]> {
  const day = now.toISOString().slice(0, 10);
  const fixtures = await getFixtures();
  return fixtures.filter(
    (f) => f.kickoff.slice(0, 10) === day || f.status === "LIVE" || f.status === "HT"
  );
}

export async function getPlayersWithForm(): Promise<PlayerWithForm[]> {
  const db = getSupabase();
  const teams = await getTeams();
  const teamById = new Map(teams.map((t) => [t.id, t]));

  if (!db) {
    return demoPlayers.map((p) => ({
      ...p,
      team: p.team_id != null ? (teamById.get(p.team_id) ?? null) : null,
      form: demoForm
        .filter((s) => s.player_id === p.id)
        .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date)),
    }));
  }

  const [{ data: players }, { data: form }] = await Promise.all([
    db.from("players").select("*"),
    db.from("player_form").select("*").order("snapshot_date", { ascending: true }),
  ]);
  type FormRow = PlayerWithForm["form"][number];
  const formByPlayer = new Map<number, FormRow[]>();
  for (const s of (form as FormRow[]) ?? []) {
    const list = formByPlayer.get(s.player_id) ?? [];
    list.push(s);
    formByPlayer.set(s.player_id, list);
  }
  return ((players as PlayerWithForm[]) ?? []).map((p) => ({
    ...p,
    team: p.team_id != null ? (teamById.get(p.team_id) ?? null) : null,
    form: formByPlayer.get(p.id) ?? [],
  }));
}

export async function getOddsHistory(fixtureId: number): Promise<OddsSnapshot[]> {
  const db = getSupabase();
  if (!db) {
    return demoOdds
      .filter((o) => o.fixture_id === fixtureId && o.market === "match_winner")
      .sort((a, b) => a.captured_at.localeCompare(b.captured_at));
  }
  const { data } = await db
    .from("odds_snapshots")
    .select("*")
    .eq("fixture_id", fixtureId)
    .eq("market", "match_winner")
    .order("captured_at", { ascending: true });
  return (data as OddsSnapshot[]) ?? [];
}

export async function getHotTakes(fixtureId?: number): Promise<HotTake[]> {
  const db = getSupabase();
  if (!db) {
    return fixtureId != null
      ? demoTakes.filter((t) => t.fixture_id === fixtureId)
      : demoTakes;
  }
  let query = db.from("hot_takes").select("*").order("created_at", { ascending: false });
  if (fixtureId != null) query = query.eq("fixture_id", fixtureId);
  const { data } = await query;
  return (data as HotTake[]) ?? [];
}
