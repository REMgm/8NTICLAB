import type { FootballProvider } from "./types";
import type { Fixture, FixtureStatus, GroupStanding, Stage } from "@/lib/types";

// Fallback adapter (spec §3.3): football-data.org v4, competition code WC.
// Implements getFixtures and getStandings only; player stats and odds return
// empty and the UI degrades gracefully (odds chips hidden, form-only cards).
const BASE = "https://api.football-data.org/v4";

async function api<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("FOOTBALL_DATA_TOKEN is not set");
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`football-data ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

function mapStatus(status: string): FixtureStatus {
  switch (status) {
    case "IN_PLAY":
      return "LIVE";
    case "PAUSED":
      return "HT";
    case "FINISHED":
      return "FT";
    default:
      return "NS";
  }
}

function mapStage(stage: string): Stage {
  switch (stage) {
    case "LAST_32":
      return "R32";
    case "LAST_16":
      return "R16";
    case "QUARTER_FINALS":
      return "QF";
    case "SEMI_FINALS":
      return "SF";
    case "THIRD_PLACE":
      return "3P";
    case "FINAL":
      return "F";
    default:
      return "R32";
  }
}

type FDMatch = {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  venue: string | null;
  homeTeam: { id: number | null };
  awayTeam: { id: number | null };
  score: {
    fullTime: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null };
  };
};

export const footballDataProvider: FootballProvider = {
  name: "football-data",

  async getTeams() {
    const data = await api<{
      teams: { id: number; name: string; tla: string | null; crest: string | null }[];
    }>("/competitions/WC/teams");
    return data.teams.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.tla,
      flag_url: t.crest,
      primary_color: null,
      secondary_color: null,
    }));
  },

  async getFixtures({ from, to, live }) {
    const params: Record<string, string> = {};
    if (from) params.dateFrom = from;
    if (to) params.dateTo = to;
    if (live) params.status = "IN_PLAY";
    const data = await api<{ matches: FDMatch[] }>("/competitions/WC/matches", params);
    return data.matches
      .filter((m) => m.stage !== "GROUP_STAGE")
      .map((m): Fixture => {
        const pen = m.score.penalties;
        return {
          id: m.id,
          kickoff: m.utcDate,
          stage: mapStage(m.stage),
          status: mapStatus(m.status),
          home_team: m.homeTeam.id,
          away_team: m.awayTeam.id,
          home_score: m.score.fullTime.home,
          away_score: m.score.fullTime.away,
          penalties:
            pen && pen.home != null && pen.away != null
              ? { home: pen.home, away: pen.away }
              : null,
          venue: m.venue,
          events: null,
        };
      });
  },

  async getStandings() {
    const data = await api<{
      standings: {
        group: string;
        table: {
          team: { id: number; name: string };
          points: number;
          playedGames: number;
          goalDifference: number;
        }[];
      }[];
    }>("/competitions/WC/standings");
    return data.standings.map(
      (s): GroupStanding => ({
        group: s.group,
        rows: s.table.map((r) => ({
          team_id: r.team.id,
          team_name: r.team.name,
          points: r.points,
          played: r.playedGames,
          gd: r.goalDifference,
        })),
      })
    );
  },

  async getPlayerStats() {
    return null; // not supported -> UI shows form-only cards
  },

  async getTopScorers() {
    return []; // not supported
  },

  async getOdds() {
    return null; // not supported -> odds chip hidden
  },
};
