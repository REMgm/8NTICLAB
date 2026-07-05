import type {
  Fixture,
  GroupStanding,
  OddsSnapshot,
  PlayerStats,
  ScorerRow,
  Team,
} from "@/lib/types";

// Every provider implements one interface so the fallback is a config
// switch, not a refactor (spec §3.1).
export interface FootballProvider {
  name: string;
  getTeams(): Promise<Team[]>;
  getFixtures(opts: { from?: string; to?: string; live?: boolean }): Promise<Fixture[]>;
  getStandings(): Promise<GroupStanding[]>; // historical/group context only
  getPlayerStats(playerId: number): Promise<PlayerStats | null>;
  getTopScorers(): Promise<ScorerRow[]>;
  getOdds(fixtureId: number): Promise<OddsSnapshot | null>;
}
