import type { FootballProvider } from "./types";
import type {
  Fixture,
  FixtureEvent,
  FixtureStatus,
  GroupStanding,
  OddsSnapshot,
  PlayerStats,
  ScorerRow,
  Stage,
} from "@/lib/types";
import { getConfig, setConfig } from "@/lib/supabase";

const BASE = "https://v3.football.api-sports.io";
const SEASON = 2026;

async function api<T = unknown>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`, {
    headers: { "x-apisports-key": key },
    // Cron routes are the only callers; never cache at the fetch layer so
    // the Supabase snapshot is the single source of truth.
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`api-football ${path} -> ${res.status}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`api-football ${path} -> ${JSON.stringify(json.errors)}`);
  }
  return json.response as T[];
}

// Resolve the World Cup league + season IDs dynamically — do not hardcode
// (spec §3.2). Pinned into the Supabase `config` table on first resolution.
export async function resolveLeagueId(): Promise<number> {
  const pinned = await getConfig<number>("league_id");
  if (pinned) return pinned;

  const leagues = await api<{
    league: { id: number; name: string; type: string };
    seasons: { year: number; current: boolean }[];
  }>("/leagues", { search: "world cup", type: "cup" });

  const wc = leagues.find(
    (l) =>
      /^fifa world cup$|^world cup$/i.test(l.league.name.trim()) &&
      l.seasons.some((s) => s.year === SEASON)
  );
  if (!wc) throw new Error("Could not resolve World Cup league id for season 2026");

  await setConfig("league_id", wc.league.id);
  await setConfig("season", SEASON);
  return wc.league.id;
}

// API-Football short status -> our compact status set.
function mapStatus(short: string): FixtureStatus {
  switch (short) {
    case "NS":
    case "TBD":
    case "PST":
      return "NS";
    case "HT":
      return "HT";
    case "FT":
    case "AET":
      return "FT";
    case "PEN":
      return "PEN";
    case "1H":
    case "2H":
    case "ET":
    case "BT":
    case "P":
    case "LIVE":
      return "LIVE";
    default:
      return "NS";
  }
}

function mapRoundToStage(round: string): Stage {
  const r = round.toLowerCase();
  if (r.includes("round of 32")) return "R32";
  if (r.includes("round of 16")) return "R16";
  if (r.includes("quarter")) return "QF";
  if (r.includes("semi")) return "SF";
  if (r.includes("third")) return "3P";
  if (r.includes("final")) return "F";
  return "R32";
}

type AFFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
    venue: { name: string | null; city: string | null };
  };
  league: { round: string };
  teams: { home: { id: number }; away: { id: number } };
  goals: { home: number | null; away: number | null };
  score: { penalty: { home: number | null; away: number | null } };
  events?: AFEvent[];
};

type AFEvent = {
  time: { elapsed: number };
  type: string;
  detail: string;
  team: { id: number };
  player: { name: string };
};

function mapEvents(events: AFEvent[] | undefined): FixtureEvent[] | null {
  if (!events || events.length === 0) return null;
  return events.map((e) => ({
    minute: e.time.elapsed,
    type:
      e.type.toLowerCase() === "goal"
        ? "goal"
        : e.type.toLowerCase() === "card"
          ? "card"
          : e.type.toLowerCase() === "var"
            ? "var"
            : "subst",
    detail: e.detail ?? null,
    team_id: e.team?.id ?? null,
    player: e.player?.name ?? null,
  }));
}

function mapFixture(f: AFFixture): Fixture {
  const pen = f.score?.penalty;
  return {
    id: f.fixture.id,
    kickoff: f.fixture.date,
    stage: mapRoundToStage(f.league.round),
    status: mapStatus(f.fixture.status.short),
    home_team: f.teams.home.id,
    away_team: f.teams.away.id,
    home_score: f.goals.home,
    away_score: f.goals.away,
    penalties:
      pen && pen.home != null && pen.away != null
        ? { home: pen.home, away: pen.away }
        : null,
    venue: f.fixture.venue?.name ?? null,
    events: mapEvents(f.events),
    elapsed: f.fixture.status.elapsed,
  };
}

export const apiFootballProvider: FootballProvider = {
  name: "api-football",

  async getTeams() {
    const league = await resolveLeagueId();
    const rows = await api<{ team: { id: number; name: string; code: string | null; logo: string } }>(
      "/teams",
      { league, season: SEASON }
    );
    return rows.map((r) => ({
      id: r.team.id,
      name: r.team.name,
      code: r.team.code,
      flag_url: r.team.logo ?? null,
      primary_color: null, // curated by hand in Supabase; ingest never overwrites
      secondary_color: null,
    }));
  },

  async getFixtures({ from, to, live }) {
    const league = await resolveLeagueId();
    if (live) {
      const rows = await api<AFFixture>("/fixtures", { live: "all", league });
      return rows.map(mapFixture);
    }
    const params: Record<string, string | number> = { league, season: SEASON };
    if (from) params.from = from;
    if (to) params.to = to;
    const rows = await api<AFFixture>("/fixtures", params);
    return rows.map(mapFixture);
  },

  async getStandings() {
    const league = await resolveLeagueId();
    const rows = await api<{
      league: {
        standings: {
          group: string;
          team: { id: number; name: string };
          points: number;
          all: { played: number };
          goalsDiff: number;
        }[][];
      };
    }>("/standings", { league, season: SEASON });
    const groups = rows[0]?.league.standings ?? [];
    return groups.map((g) => ({
      group: g[0]?.group ?? "",
      rows: g.map((r) => ({
        team_id: r.team.id,
        team_name: r.team.name,
        points: r.points,
        played: r.all.played,
        gd: r.goalsDiff,
      })),
    })) as GroupStanding[];
  },

  async getPlayerStats(playerId) {
    const rows = await api<{
      player: { id: number; name: string; photo: string };
      statistics: {
        team: { id: number };
        games: { position: string | null; minutes: number | null; rating: string | null };
        goals: { total: number | null; assists: number | null };
        shots: { total: number | null; on: number | null };
      }[];
    }>("/players", { id: playerId, season: SEASON });
    const row = rows[0];
    if (!row) return null;
    const s = row.statistics[0];
    return {
      player: {
        id: row.player.id,
        team_id: s?.team.id ?? null,
        name: row.player.name,
        position: s?.games.position ?? null,
        photo_url: row.player.photo ?? null,
        stylized_url: null,
      },
      goals: s?.goals.total ?? 0,
      assists: s?.goals.assists ?? 0,
      // API-Football has no xG on this endpoint; approximate from shots on
      // target so the form engine still has a signal.
      xg: s?.shots.on ? Math.round(s.shots.on * 0.31 * 100) / 100 : 0,
      minutes: s?.games.minutes ?? 0,
      rating: s?.games.rating ? parseFloat(s.games.rating) : 0,
    } satisfies PlayerStats;
  },

  async getTopScorers() {
    const league = await resolveLeagueId();
    const rows = await api<{
      player: { id: number; name: string; photo: string };
      statistics: { team: { id: number }; goals: { total: number | null; assists: number | null } }[];
    }>("/players/topscorers", { league, season: SEASON });
    return rows.map((r) => ({
      player_id: r.player.id,
      name: r.player.name,
      team_id: r.statistics[0]?.team.id ?? 0,
      goals: r.statistics[0]?.goals.total ?? 0,
      assists: r.statistics[0]?.goals.assists ?? 0,
      photo_url: r.player.photo ?? null,
    })) satisfies ScorerRow[];
  },

  async getOdds(fixtureId) {
    const rows = await api<{
      bookmakers: {
        name: string;
        bets: { name: string; values: { value: string; odd: string }[] }[];
      }[];
    }>("/odds", { fixture: fixtureId });
    const bm = rows[0]?.bookmakers?.[0];
    const market = bm?.bets.find((b) => b.name === "Match Winner");
    if (!bm || !market) return null;
    const values: Record<string, number> = {};
    for (const v of market.values) {
      const k = v.value === "Home" ? "home" : v.value === "Away" ? "away" : "draw";
      values[k] = parseFloat(v.odd);
    }
    return {
      fixture_id: fixtureId,
      captured_at: new Date().toISOString(),
      bookmaker: bm.name,
      market: "match_winner",
      values,
    } satisfies OddsSnapshot;
  },
};
