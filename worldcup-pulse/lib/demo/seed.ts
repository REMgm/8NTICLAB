import type {
  Fixture,
  HotTake,
  OddsSnapshot,
  Player,
  PlayerFormSnapshot,
  Team,
} from "@/lib/types";

// -----------------------------------------------------------------------
// Demo dataset. Used ONLY when Supabase env vars are absent so the app
// renders end-to-end in local dev / preview. Production reads Supabase,
// which is filled by the cron ingest — never this file.
// -----------------------------------------------------------------------

const flag = (iso: string) => `https://flagcdn.com/w80/${iso}.png`;

export const demoTeams: Team[] = [
  { id: 1, name: "United States", code: "USA", flag_url: flag("us"), primary_color: "#1F45FC", secondary_color: "#BF0A30" },
  { id: 2, name: "Mexico", code: "MEX", flag_url: flag("mx"), primary_color: "#006847", secondary_color: "#CE1126" },
  { id: 3, name: "Canada", code: "CAN", flag_url: flag("ca"), primary_color: "#D80621", secondary_color: "#FFFFFF" },
  { id: 4, name: "Argentina", code: "ARG", flag_url: flag("ar"), primary_color: "#75AADB", secondary_color: "#F6B40E" },
  { id: 5, name: "Brazil", code: "BRA", flag_url: flag("br"), primary_color: "#FFDF00", secondary_color: "#009C3B" },
  { id: 6, name: "France", code: "FRA", flag_url: flag("fr"), primary_color: "#0055A4", secondary_color: "#EF4135" },
  { id: 7, name: "England", code: "ENG", flag_url: flag("gb-eng"), primary_color: "#FFFFFF", secondary_color: "#CE1124" },
  { id: 8, name: "Spain", code: "ESP", flag_url: flag("es"), primary_color: "#AA151B", secondary_color: "#F1BF00" },
  { id: 9, name: "Germany", code: "GER", flag_url: flag("de"), primary_color: "#FFFFFF", secondary_color: "#000000" },
  { id: 10, name: "Portugal", code: "POR", flag_url: flag("pt"), primary_color: "#046A38", secondary_color: "#DA291C" },
  { id: 11, name: "Netherlands", code: "NED", flag_url: flag("nl"), primary_color: "#FF6C00", secondary_color: "#21468B" },
  { id: 12, name: "Belgium", code: "BEL", flag_url: flag("be"), primary_color: "#E30613", secondary_color: "#FDDA24" },
  { id: 13, name: "Croatia", code: "CRO", flag_url: flag("hr"), primary_color: "#FF0000", secondary_color: "#FFFFFF" },
  { id: 14, name: "Italy", code: "ITA", flag_url: flag("it"), primary_color: "#0064AA", secondary_color: "#008C45" },
  { id: 15, name: "Uruguay", code: "URU", flag_url: flag("uy"), primary_color: "#55B5E5", secondary_color: "#FCD116" },
  { id: 16, name: "Colombia", code: "COL", flag_url: flag("co"), primary_color: "#FCD116", secondary_color: "#003893" },
  { id: 17, name: "Morocco", code: "MAR", flag_url: flag("ma"), primary_color: "#C1272D", secondary_color: "#006233" },
  { id: 18, name: "Senegal", code: "SEN", flag_url: flag("sn"), primary_color: "#00853F", secondary_color: "#FDEF42" },
  { id: 19, name: "Japan", code: "JPN", flag_url: flag("jp"), primary_color: "#1D2088", secondary_color: "#BC002D" },
  { id: 20, name: "South Korea", code: "KOR", flag_url: flag("kr"), primary_color: "#CD2E3A", secondary_color: "#0047A0" },
  { id: 21, name: "Australia", code: "AUS", flag_url: flag("au"), primary_color: "#FFCD00", secondary_color: "#00843D" },
  { id: 22, name: "Switzerland", code: "SUI", flag_url: flag("ch"), primary_color: "#DA291C", secondary_color: "#FFFFFF" },
  { id: 23, name: "Denmark", code: "DEN", flag_url: flag("dk"), primary_color: "#C8102E", secondary_color: "#FFFFFF" },
  { id: 24, name: "Ecuador", code: "ECU", flag_url: flag("ec"), primary_color: "#FFDD00", secondary_color: "#034EA2" },
  { id: 25, name: "Nigeria", code: "NGA", flag_url: flag("ng"), primary_color: "#008751", secondary_color: "#FFFFFF" },
  { id: 26, name: "Egypt", code: "EGY", flag_url: flag("eg"), primary_color: "#CE1126", secondary_color: "#000000" },
  { id: 27, name: "Poland", code: "POL", flag_url: flag("pl"), primary_color: "#DC143C", secondary_color: "#FFFFFF" },
  { id: 28, name: "Austria", code: "AUT", flag_url: flag("at"), primary_color: "#ED2939", secondary_color: "#FFFFFF" },
  { id: 29, name: "Norway", code: "NOR", flag_url: flag("no"), primary_color: "#BA0C2F", secondary_color: "#00205B" },
  { id: 30, name: "Ukraine", code: "UKR", flag_url: flag("ua"), primary_color: "#005BBB", secondary_color: "#FFD500" },
  { id: 31, name: "Ghana", code: "GHA", flag_url: flag("gh"), primary_color: "#006B3F", secondary_color: "#FCD116" },
  { id: 32, name: "Paraguay", code: "PAR", flag_url: flag("py"), primary_color: "#D52B1E", secondary_color: "#0038A8" },
];

// Knockout tree, 2026 tri-host edition. R32 complete, R16 underway "today"
// (2026-07-02), later rounds TBD.
export const demoFixtures: Fixture[] = [
  // --- Round of 32 (all FT) ---
  { id: 101, kickoff: "2026-06-28T16:00:00Z", stage: "R32", status: "FT", home_team: 4, away_team: 32, home_score: 3, away_score: 0, penalties: null, venue: "Estadio Azteca, Mexico City", events: null },
  { id: 102, kickoff: "2026-06-28T19:00:00Z", stage: "R32", status: "FT", home_team: 17, away_team: 21, home_score: 2, away_score: 1, penalties: null, venue: "SoFi Stadium, Los Angeles", events: null },
  { id: 103, kickoff: "2026-06-28T22:00:00Z", stage: "R32", status: "FT", home_team: 6, away_team: 27, home_score: 2, away_score: 0, penalties: null, venue: "MetLife Stadium, New York/NJ", events: null },
  { id: 104, kickoff: "2026-06-29T01:00:00Z", stage: "R32", status: "FT", home_team: 19, away_team: 23, home_score: 1, away_score: 1, penalties: { home: 4, away: 3 }, venue: "BC Place, Vancouver", events: null },
  { id: 105, kickoff: "2026-06-29T16:00:00Z", stage: "R32", status: "FT", home_team: 8, away_team: 26, home_score: 4, away_score: 1, penalties: null, venue: "AT&T Stadium, Dallas", events: null },
  { id: 106, kickoff: "2026-06-29T19:00:00Z", stage: "R32", status: "FT", home_team: 15, away_team: 20, home_score: 2, away_score: 1, penalties: null, venue: "Estadio BBVA, Monterrey", events: null },
  { id: 107, kickoff: "2026-06-29T22:00:00Z", stage: "R32", status: "FT", home_team: 9, away_team: 24, home_score: 3, away_score: 1, penalties: null, venue: "Lumen Field, Seattle", events: null },
  { id: 108, kickoff: "2026-06-30T01:00:00Z", stage: "R32", status: "FT", home_team: 12, away_team: 30, home_score: 0, away_score: 1, penalties: null, venue: "Gillette Stadium, Boston", events: null },
  { id: 109, kickoff: "2026-06-30T16:00:00Z", stage: "R32", status: "FT", home_team: 5, away_team: 28, home_score: 2, away_score: 0, penalties: null, venue: "Hard Rock Stadium, Miami", events: null },
  { id: 110, kickoff: "2026-06-30T19:00:00Z", stage: "R32", status: "FT", home_team: 16, away_team: 22, home_score: 1, away_score: 0, penalties: null, venue: "NRG Stadium, Houston", events: null },
  { id: 111, kickoff: "2026-06-30T22:00:00Z", stage: "R32", status: "FT", home_team: 7, away_team: 18, home_score: 2, away_score: 1, penalties: null, venue: "Arrowhead Stadium, Kansas City", events: null },
  { id: 112, kickoff: "2026-07-01T01:00:00Z", stage: "R32", status: "FT", home_team: 14, away_team: 25, home_score: 1, away_score: 1, penalties: { home: 5, away: 4 }, venue: "Mercedes-Benz Stadium, Atlanta", events: null },
  { id: 113, kickoff: "2026-07-01T16:00:00Z", stage: "R32", status: "FT", home_team: 10, away_team: 31, home_score: 3, away_score: 1, penalties: null, venue: "Levi's Stadium, San Francisco", events: null },
  { id: 114, kickoff: "2026-07-01T19:00:00Z", stage: "R32", status: "FT", home_team: 11, away_team: 29, home_score: 1, away_score: 2, penalties: null, venue: "Lincoln Financial Field, Philadelphia", events: null },
  { id: 115, kickoff: "2026-07-01T22:00:00Z", stage: "R32", status: "FT", home_team: 1, away_team: 13, home_score: 2, away_score: 1, penalties: null, venue: "SoFi Stadium, Los Angeles", events: null },
  { id: 116, kickoff: "2026-07-02T01:00:00Z", stage: "R32", status: "FT", home_team: 2, away_team: 3, home_score: 1, away_score: 0, penalties: null, venue: "Estadio Azteca, Mexico City", events: null },

  // --- Round of 16 ---
  {
    id: 201, kickoff: "2026-07-02T16:00:00Z", stage: "R16", status: "LIVE",
    home_team: 4, away_team: 17, home_score: 1, away_score: 1, penalties: null,
    venue: "AT&T Stadium, Dallas", elapsed: 63,
    events: [
      { minute: 12, type: "goal", detail: "Normal Goal", team_id: 17, player: "A. Ziyech" },
      { minute: 38, type: "card", detail: "Yellow Card", team_id: 4, player: "R. De Paul" },
      { minute: 54, type: "goal", detail: "Normal Goal", team_id: 4, player: "L. Messi" },
    ],
  },
  { id: 202, kickoff: "2026-07-02T20:00:00Z", stage: "R16", status: "NS", home_team: 6, away_team: 19, home_score: null, away_score: null, penalties: null, venue: "MetLife Stadium, New York/NJ", events: null },
  { id: 203, kickoff: "2026-07-03T16:00:00Z", stage: "R16", status: "NS", home_team: 8, away_team: 15, home_score: null, away_score: null, penalties: null, venue: "SoFi Stadium, Los Angeles", events: null },
  { id: 204, kickoff: "2026-07-03T20:00:00Z", stage: "R16", status: "NS", home_team: 9, away_team: 30, home_score: null, away_score: null, penalties: null, venue: "NRG Stadium, Houston", events: null },
  { id: 205, kickoff: "2026-07-04T16:00:00Z", stage: "R16", status: "NS", home_team: 5, away_team: 16, home_score: null, away_score: null, penalties: null, venue: "Hard Rock Stadium, Miami", events: null },
  { id: 206, kickoff: "2026-07-04T20:00:00Z", stage: "R16", status: "NS", home_team: 7, away_team: 14, home_score: null, away_score: null, penalties: null, venue: "Arrowhead Stadium, Kansas City", events: null },
  { id: 207, kickoff: "2026-07-05T16:00:00Z", stage: "R16", status: "NS", home_team: 10, away_team: 29, home_score: null, away_score: null, penalties: null, venue: "Lumen Field, Seattle", events: null },
  { id: 208, kickoff: "2026-07-05T20:00:00Z", stage: "R16", status: "NS", home_team: 1, away_team: 2, home_score: null, away_score: null, penalties: null, venue: "Estadio Azteca, Mexico City", events: null },

  // --- Quarter-finals onward: brackets drawn, teams TBD ---
  { id: 301, kickoff: "2026-07-09T20:00:00Z", stage: "QF", status: "NS", home_team: null, away_team: null, home_score: null, away_score: null, penalties: null, venue: "Gillette Stadium, Boston", events: null },
  { id: 302, kickoff: "2026-07-10T20:00:00Z", stage: "QF", status: "NS", home_team: null, away_team: null, home_score: null, away_score: null, penalties: null, venue: "SoFi Stadium, Los Angeles", events: null },
  { id: 303, kickoff: "2026-07-11T16:00:00Z", stage: "QF", status: "NS", home_team: null, away_team: null, home_score: null, away_score: null, penalties: null, venue: "Hard Rock Stadium, Miami", events: null },
  { id: 304, kickoff: "2026-07-11T20:00:00Z", stage: "QF", status: "NS", home_team: null, away_team: null, home_score: null, away_score: null, penalties: null, venue: "Arrowhead Stadium, Kansas City", events: null },
  { id: 401, kickoff: "2026-07-14T20:00:00Z", stage: "SF", status: "NS", home_team: null, away_team: null, home_score: null, away_score: null, penalties: null, venue: "AT&T Stadium, Dallas", events: null },
  { id: 402, kickoff: "2026-07-15T20:00:00Z", stage: "SF", status: "NS", home_team: null, away_team: null, home_score: null, away_score: null, penalties: null, venue: "Mercedes-Benz Stadium, Atlanta", events: null },
  { id: 451, kickoff: "2026-07-18T20:00:00Z", stage: "3P", status: "NS", home_team: null, away_team: null, home_score: null, away_score: null, penalties: null, venue: "Hard Rock Stadium, Miami", events: null },
  { id: 501, kickoff: "2026-07-19T19:00:00Z", stage: "F", status: "NS", home_team: null, away_team: null, home_score: null, away_score: null, penalties: null, venue: "MetLife Stadium, New York/NJ", events: null },
];

export const demoPlayers: Player[] = [
  { id: 1001, team_id: 4, name: "Lionel Messi", position: "RW", photo_url: null, stylized_url: null },
  { id: 1002, team_id: 6, name: "Kylian Mbappé", position: "ST", photo_url: null, stylized_url: null },
  { id: 1003, team_id: 7, name: "Jude Bellingham", position: "AM", photo_url: null, stylized_url: null },
  { id: 1004, team_id: 8, name: "Lamine Yamal", position: "RW", photo_url: null, stylized_url: null },
  { id: 1005, team_id: 29, name: "Erling Haaland", position: "ST", photo_url: null, stylized_url: null },
  { id: 1006, team_id: 5, name: "Vinícius Júnior", position: "LW", photo_url: null, stylized_url: null },
  { id: 1007, team_id: 9, name: "Jamal Musiala", position: "AM", photo_url: null, stylized_url: null },
  { id: 1008, team_id: 7, name: "Harry Kane", position: "ST", photo_url: null, stylized_url: null },
  { id: 1009, team_id: 17, name: "Brahim Díaz", position: "AM", photo_url: null, stylized_url: null },
  { id: 1010, team_id: 1, name: "Christian Pulisic", position: "LW", photo_url: null, stylized_url: null },
];

// Five snapshots per player, ascending; sparklines draw `rating`,
// form_delta drives the leaderboard sort and the takes engine.
function form(
  player_id: number,
  ratings: number[],
  goals: number,
  assists: number,
  xg: number,
  minutes: number
): PlayerFormSnapshot[] {
  const dates = ["2026-06-28", "2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02"];
  return ratings.map((rating, i) => ({
    player_id,
    snapshot_date: dates[i],
    goals,
    assists,
    xg,
    minutes,
    rating,
    form_delta: i === 0 ? 0 : Math.round((rating - ratings[i - 1]) * 100) / 100,
  }));
}

export const demoForm: PlayerFormSnapshot[] = [
  ...form(1001, [7.4, 7.6, 7.9, 8.4, 8.8], 4, 3, 3.1, 390),
  ...form(1002, [8.1, 8.3, 8.2, 8.6, 8.7], 6, 1, 4.8, 420),
  ...form(1003, [7.2, 7.5, 7.8, 7.7, 8.1], 3, 2, 1.9, 410),
  ...form(1004, [7.8, 8.0, 8.5, 8.3, 8.6], 3, 4, 2.4, 400),
  ...form(1005, [7.9, 7.6, 7.4, 7.9, 8.2], 5, 0, 5.6, 380),
  ...form(1006, [7.1, 7.4, 7.7, 8.0, 8.0], 2, 3, 2.2, 370),
  ...form(1007, [7.3, 7.7, 7.6, 8.1, 8.3], 2, 2, 1.6, 360),
  ...form(1008, [7.5, 7.3, 7.6, 7.5, 7.7], 4, 1, 4.1, 420),
  ...form(1009, [6.9, 7.2, 7.8, 8.0, 8.4], 2, 2, 1.3, 350),
  ...form(1010, [7.0, 7.3, 7.1, 7.8, 8.0], 2, 1, 1.7, 400),
];

// Append-only odds history so movement can be charted (decimal odds,
// match_winner). The Argentina–Morocco drift powers the demo hot take.
export const demoOdds: OddsSnapshot[] = [
  { fixture_id: 201, captured_at: "2026-06-30T08:00:00Z", bookmaker: "Consensus", market: "match_winner", values: { home: 1.55, draw: 3.9, away: 6.5 } },
  { fixture_id: 201, captured_at: "2026-06-30T16:00:00Z", bookmaker: "Consensus", market: "match_winner", values: { home: 1.6, draw: 3.85, away: 6.1 } },
  { fixture_id: 201, captured_at: "2026-07-01T08:00:00Z", bookmaker: "Consensus", market: "match_winner", values: { home: 1.72, draw: 3.7, away: 5.2 } },
  { fixture_id: 201, captured_at: "2026-07-01T16:00:00Z", bookmaker: "Consensus", market: "match_winner", values: { home: 1.8, draw: 3.6, away: 4.6 } },
  { fixture_id: 201, captured_at: "2026-07-02T08:00:00Z", bookmaker: "Consensus", market: "match_winner", values: { home: 1.85, draw: 3.55, away: 4.3 } },
  { fixture_id: 201, captured_at: "2026-07-02T14:00:00Z", bookmaker: "Consensus", market: "match_winner", values: { home: 1.9, draw: 3.5, away: 4.1 } },
  { fixture_id: 202, captured_at: "2026-07-01T08:00:00Z", bookmaker: "Consensus", market: "match_winner", values: { home: 1.65, draw: 3.8, away: 5.4 } },
  { fixture_id: 202, captured_at: "2026-07-02T08:00:00Z", bookmaker: "Consensus", market: "match_winner", values: { home: 1.62, draw: 3.8, away: 5.6 } },
  { fixture_id: 202, captured_at: "2026-07-02T14:00:00Z", bookmaker: "Consensus", market: "match_winner", values: { home: 1.58, draw: 3.85, away: 5.9 } },
];

export const demoTakes: HotTake[] = [
  {
    id: 1,
    fixture_id: 201,
    headline: "The market is quietly bailing on Argentina",
    body:
      "The favourite's price has drifted from 1.55 to 1.90 in 48 hours — a 12-point implied-probability slide with no injury news attached. Someone knows how compact this Morocco block really is.",
    confidence: "spicy",
    revealed_stat: { label: "Implied win % drop, 48h", value: 12, suffix: "%" },
  },
  {
    id: 2,
    fixture_id: 202,
    headline: "Mbappé is overdue in exactly the way defences fear",
    body:
      "Six goals from 4.8 xG says finishing hot streak, and Japan concede the near-post channel he attacks most. The regression argument would land better if he weren't shooting every 19 minutes.",
    confidence: "likely",
    revealed_stat: { label: "Shots per 90", value: 4.7 },
  },
  {
    id: 3,
    fixture_id: 208,
    headline: "USA–Mexico is a coin flip wearing a rivalry costume",
    body:
      "The market can't split them and neither can the underlying numbers: both sides create ~1.4 xG per knockout game and both keepers are overperforming shot-stopping models.",
    confidence: "certain",
    revealed_stat: { label: "xG per game, both sides", value: 1.4 },
  },
  {
    id: 4,
    fixture_id: 203,
    headline: "Yamal's assist column is about to embarrass Uruguay's left side",
    body:
      "Four assists in five snapshots and the highest form delta of any wide player left in the draw. Uruguay's left-back has faced one elite dribbler this tournament and got booked inside 30 minutes.",
    confidence: "spicy",
    revealed_stat: { label: "Tournament assists", value: 4 },
  },
];
