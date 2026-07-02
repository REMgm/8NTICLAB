import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getFixture, getHotTakes, getOddsHistory } from "@/lib/data";
import StagePill from "@/components/StagePill";
import Flag from "@/components/Flag";
import EventsTimeline from "@/components/EventsTimeline";
import OddsShift from "@/components/OddsShift";
import PredictionMeter from "@/components/PredictionMeter";
import HotTakeCard from "@/components/HotTakeCard";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const f = await getFixture(Number(id));
  if (!f) return { title: "Match — WorldCup Pulse" };
  return {
    title: `${f.home?.name ?? "TBD"} vs ${f.away?.name ?? "TBD"} — WorldCup Pulse`,
  };
}

const impliedPct = (odd: number) => 100 / odd;

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fixtureId = Number(id);
  if (!Number.isFinite(fixtureId)) notFound();

  const [fixture, odds, takes] = await Promise.all([
    getFixture(fixtureId),
    getOddsHistory(fixtureId),
    getHotTakes(fixtureId),
  ]);
  if (!fixture) notFound();

  const isLive = fixture.status === "LIVE" || fixture.status === "HT";
  const latestOdds = odds[odds.length - 1] ?? null;
  const favorite =
    latestOdds && fixture.home && fixture.away
      ? latestOdds.values.home <= latestOdds.values.away
        ? { team: fixture.home, pct: impliedPct(latestOdds.values.home) }
        : { team: fixture.away, pct: impliedPct(latestOdds.values.away) }
      : null;
  const teamColors = [fixture.home?.primary_color, fixture.away?.primary_color].filter(
    (c): c is string => !!c
  );

  return (
    <>
      {/* scoreboard header — scores set huge, tabular, tight (spec §8) */}
      <section className="mb-8 rounded-3xl border border-pitch-700 bg-pitch-900 p-6 sm:p-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <StagePill stage={fixture.stage} />
          <span className="num text-xs font-semibold uppercase tracking-wider text-flood-dim">
            {isLive ? (
              <span className="text-signal">
                {fixture.status === "HT" ? "Half-time" : `${fixture.elapsed ?? ""}' — live`}
              </span>
            ) : fixture.status === "NS" ? (
              new Date(fixture.kickoff).toLocaleString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            ) : fixture.status === "PEN" ? (
              "Full-time · decided on penalties"
            ) : (
              "Full-time"
            )}
          </span>
          {fixture.venue && (
            <span className="text-xs text-flood-dim/70">· {fixture.venue}</span>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {(["home", "away"] as const).map((side, i) => {
            const team = fixture[side];
            return (
              <div
                key={side}
                className={`flex items-center gap-3 ${i === 1 ? "flex-row-reverse text-right" : ""} ${
                  side === "away" ? "order-3" : ""
                }`}
              >
                <Flag team={team} size={40} />
                <span className="display text-xl font-black leading-tight sm:text-3xl">
                  {team?.name ?? "To be decided"}
                </span>
              </div>
            );
          })}
          <div className="order-2 text-center">
            <span className="num text-5xl font-bold tracking-tighter sm:text-7xl">
              {fixture.home_score ?? "–"}
              <span className="text-flood-dim">:</span>
              {fixture.away_score ?? "–"}
            </span>
            {fixture.penalties && (
              <p className="num mt-1 text-sm text-flood-dim">
                pens {fixture.penalties.home}–{fixture.penalties.away}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="display mb-4 text-xl font-black">Timeline</h2>
          <EventsTimeline fixture={fixture} />

          {takes.length > 0 && (
            <div className="mt-10">
              <h2 className="display mb-4 text-xl font-black">Takes on this one</h2>
              <div className="space-y-4">
                {takes.map((t) => (
                  <HotTakeCard key={t.id} take={t} teamColors={teamColors} />
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          {favorite && (
            <PredictionMeter
              label={`Market-implied chance: ${favorite.team.name}`}
              percent={favorite.pct}
              color={favorite.team.primary_color ?? "#C8F542"}
            />
          )}
          {fixture.home && fixture.away && (
            <OddsShift
              snapshots={odds}
              homeName={fixture.home.name}
              awayName={fixture.away.name}
            />
          )}
        </aside>
      </div>
    </>
  );
}
