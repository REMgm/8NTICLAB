import type {
  FixtureWithTeams,
  HotTake,
  OddsSnapshot,
  PlayerWithForm,
  TakeConfidence,
} from "@/lib/types";

// Hot takes v1 (spec §5): a deterministic rules engine over player_form and
// odds_snapshots deltas. No LLM in the hot path; an LLM polish pass can be
// layered later. Runs at cron time; output is upserted into `hot_takes`.

const impliedPct = (decimalOdd: number) => 100 / decimalOdd;

interface RuleContext {
  fixtures: FixtureWithTeams[];
  players: PlayerWithForm[];
  odds: OddsSnapshot[]; // append-only history, ascending by captured_at
}

type GeneratedTake = Omit<HotTake, "id">;

// Rule 1 — odds moved >8 implied points against the favourite inside 24h.
function oddsDriftTakes(ctx: RuleContext): GeneratedTake[] {
  const takes: GeneratedTake[] = [];
  const byFixture = new Map<number, OddsSnapshot[]>();
  for (const o of ctx.odds) {
    if (o.market !== "match_winner") continue;
    const list = byFixture.get(o.fixture_id) ?? [];
    list.push(o);
    byFixture.set(o.fixture_id, list);
  }

  for (const [fixtureId, snaps] of byFixture) {
    if (snaps.length < 2) continue;
    const first = snaps[0];
    const last = snaps[snaps.length - 1];
    const favSide = first.values.home <= first.values.away ? "home" : "away";
    const before = impliedPct(first.values[favSide]);
    const after = impliedPct(last.values[favSide]);
    const drop = before - after;
    if (drop <= 8) continue;

    const fixture = ctx.fixtures.find((f) => f.id === fixtureId);
    const fav = favSide === "home" ? fixture?.home : fixture?.away;
    const dog = favSide === "home" ? fixture?.away : fixture?.home;
    if (!fixture || !fav || !dog) continue;

    takes.push({
      fixture_id: fixtureId,
      headline: `The market is quietly bailing on ${fav.name}`,
      body: `${fav.name}'s implied win probability has slid ${drop.toFixed(0)} points since the first snapshot with no team news attached. The money arriving late is ${dog.name} money.`,
      confidence: drop > 12 ? "spicy" : "likely",
      revealed_stat: { label: "Implied win % drop", value: Math.round(drop), suffix: "%" },
    });
  }
  return takes;
}

// Rule 2 — striker xG overperformance > 0.4/game: goals well above chance quality.
function xgOverperformanceTakes(ctx: RuleContext): GeneratedTake[] {
  const takes: GeneratedTake[] = [];
  for (const p of ctx.players) {
    const latest = p.form[p.form.length - 1];
    if (!latest || latest.minutes < 180) continue;
    const games = latest.minutes / 90;
    const over = (latest.goals - latest.xg) / games;
    if (over <= 0.4) continue;
    takes.push({
      fixture_id: nextFixtureIdForTeam(ctx, p.team_id),
      headline: `${p.name} is finishing chances that don't exist`,
      body: `${latest.goals} goals from ${latest.xg.toFixed(1)} xG is ${over.toFixed(1)} goals per game above the model. Either the hottest streak of the tournament, or defences are about to get a refund.`,
      confidence: over > 0.6 ? "spicy" : "likely",
      revealed_stat: {
        label: "Goals above xG per game",
        value: parseFloat(over.toFixed(1)),
      },
    });
  }
  return takes;
}

// Rule 3 — steep form curve: rating delta over the snapshot window > 1.0.
function formSurgeTakes(ctx: RuleContext): GeneratedTake[] {
  const takes: GeneratedTake[] = [];
  for (const p of ctx.players) {
    if (p.form.length < 3) continue;
    const first = p.form[0];
    const latest = p.form[p.form.length - 1];
    const surge = latest.rating - first.rating;
    if (surge <= 1.0) continue;
    takes.push({
      fixture_id: nextFixtureIdForTeam(ctx, p.team_id),
      headline: `${p.name} is peaking at exactly the wrong time for everyone else`,
      body: `Match rating up from ${first.rating.toFixed(1)} to ${latest.rating.toFixed(1)} across the knockout window — the steepest form curve left in the draw.`,
      confidence: surge > 1.3 ? "spicy" : "certain",
      revealed_stat: {
        label: "Rating climb, 5 snapshots",
        value: parseFloat(surge.toFixed(1)),
      },
    });
  }
  return takes;
}

function nextFixtureIdForTeam(ctx: RuleContext, teamId: number | null): number | null {
  if (teamId == null) return null;
  const next = ctx.fixtures
    .filter(
      (f) =>
        (f.home_team === teamId || f.away_team === teamId) &&
        (f.status === "NS" || f.status === "LIVE" || f.status === "HT")
    )
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
  return next?.id ?? null;
}

export function generateTakes(ctx: RuleContext): GeneratedTake[] {
  const all = [
    ...oddsDriftTakes(ctx),
    ...xgOverperformanceTakes(ctx),
    ...formSurgeTakes(ctx),
  ];
  // Spiciest first; cap so the feed stays editorial, not a firehose.
  const rank: Record<TakeConfidence, number> = { spicy: 0, likely: 1, certain: 2 };
  return all.sort((a, b) => rank[a.confidence] - rank[b.confidence]).slice(0, 8);
}
