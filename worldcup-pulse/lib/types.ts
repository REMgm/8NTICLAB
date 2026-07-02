// Domain types shared by providers, Supabase rows and UI.

export type Stage = "R32" | "R16" | "QF" | "SF" | "3P" | "F";
export type FixtureStatus = "NS" | "LIVE" | "HT" | "FT" | "PEN";

export interface Team {
  id: number;
  name: string;
  code: string | null; // FIFA trigram
  flag_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

export interface FixtureEvent {
  minute: number;
  type: "goal" | "card" | "subst" | "var";
  detail: string | null;
  team_id: number | null;
  player: string | null;
}

export interface Fixture {
  id: number;
  kickoff: string; // ISO timestamptz
  stage: Stage;
  status: FixtureStatus;
  home_team: number | null;
  away_team: number | null;
  home_score: number | null;
  away_score: number | null;
  penalties: { home: number; away: number } | null;
  venue: string | null;
  events: FixtureEvent[] | null;
  elapsed?: number | null; // live minute, when available
}

export interface FixtureWithTeams extends Fixture {
  home: Team | null;
  away: Team | null;
}

export interface Player {
  id: number;
  team_id: number | null;
  name: string;
  position: string | null;
  photo_url: string | null;
  stylized_url: string | null;
}

export interface PlayerFormSnapshot {
  player_id: number;
  snapshot_date: string; // YYYY-MM-DD
  goals: number;
  assists: number;
  xg: number;
  minutes: number;
  rating: number;
  form_delta: number;
}

export interface PlayerWithForm extends Player {
  team: Team | null;
  form: PlayerFormSnapshot[]; // ascending by date, newest last
}

export interface OddsSnapshot {
  fixture_id: number;
  captured_at: string;
  bookmaker: string;
  market: "match_winner" | "total_goals" | "btts";
  values: Record<string, number>; // e.g. { home: 2.1, draw: 3.2, away: 3.6 }
}

export type TakeConfidence = "certain" | "likely" | "spicy";

export interface HotTake {
  id: number;
  fixture_id: number | null;
  headline: string;
  body: string;
  confidence: TakeConfidence;
  revealed_stat: { label: string; value: number; suffix?: string } | null;
}

// Provider-facing types
export interface GroupStanding {
  group: string;
  rows: { team_id: number; team_name: string; points: number; played: number; gd: number }[];
}

export interface PlayerStats {
  player: Player;
  goals: number;
  assists: number;
  xg: number;
  minutes: number;
  rating: number;
}

export interface ScorerRow {
  player_id: number;
  name: string;
  team_id: number;
  goals: number;
  assists: number;
  photo_url: string | null;
}
