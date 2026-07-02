import Link from "next/link";
import { getFixtures, getHotTakes, getTodayFixtures } from "@/lib/data";
import Hero from "@/components/Hero";
import MatchCard from "@/components/MatchCard";
import HotTakeCard from "@/components/HotTakeCard";

export const revalidate = 60;

export default async function HomePage() {
  const [today, all, takes] = await Promise.all([
    getTodayFixtures(),
    getFixtures(),
    getHotTakes(),
  ]);

  const liveCount = today.filter((f) => f.status === "LIVE" || f.status === "HT").length;
  const upcoming = all
    .filter((f) => f.status === "NS" && f.home && !today.some((t) => t.id === f.id))
    .slice(0, 6);
  const fixtureById = new Map(all.map((f) => [f.id, f]));

  return (
    <>
      <Hero liveCount={liveCount} />

      <section className="mb-12">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="display text-2xl font-black">Today&apos;s pulse</h2>
          <Link href="/bracket" className="text-sm font-semibold text-signal hover:underline">
            Full bracket →
          </Link>
        </div>
        {today.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {today.map((f) => (
              <MatchCard key={f.id} fixture={f} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-pitch-700 bg-pitch-900 p-6 text-sm text-flood-dim">
            Rest day. The bracket resumes with the next kickoff.
          </p>
        )}
      </section>

      {takes.length > 0 && (
        <section className="mb-12">
          <h2 className="display mb-1 text-2xl font-black">The takes</h2>
          <p className="mb-4 text-sm text-flood-dim">
            Tap to reveal. Every take carries the stat that justifies it.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {takes.map((t) => {
              const fx = t.fixture_id != null ? fixtureById.get(t.fixture_id) : undefined;
              const colors = [fx?.home?.primary_color, fx?.away?.primary_color].filter(
                (c): c is string => !!c
              );
              return <HotTakeCard key={t.id} take={t} teamColors={colors} />;
            })}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="display mb-4 text-2xl font-black">Next up</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((f) => (
              <MatchCard key={f.id} fixture={f} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
