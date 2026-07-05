import type { Metadata } from "next";
import { getPlayersWithForm } from "@/lib/data";
import PlayerCarousel from "@/components/PlayerCarousel";
import FormSparkline from "@/components/FormSparkline";
import Flag from "@/components/Flag";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Form Leaderboard — WorldCup Pulse",
};

export default async function PlayersPage() {
  const players = await getPlayersWithForm();

  const ranked = [...players].sort((a, b) => {
    const la = a.form[a.form.length - 1];
    const lb = b.form[b.form.length - 1];
    return (lb?.rating ?? 0) - (la?.rating ?? 0);
  });

  return (
    <>
      <h1 className="display mb-1 text-3xl font-black">Who&apos;s hot</h1>
      <p className="mb-6 text-sm text-flood-dim">
        Daily form snapshots. Flip a card for the full sheet; drag the rail.
      </p>

      <section className="mb-12">
        <PlayerCarousel players={ranked} />
      </section>

      <section>
        <h2 className="display mb-4 text-xl font-black">Form leaderboard</h2>
        <ol className="divide-y divide-pitch-800 overflow-hidden rounded-2xl border border-pitch-700 bg-pitch-900">
          {ranked.map((p, i) => {
            const latest = p.form[p.form.length - 1];
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:gap-4">
                <span className="num w-6 shrink-0 text-sm font-bold text-flood-dim">{i + 1}</span>
                <Flag team={p.team} size={22} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-[11px] text-flood-dim">
                    {p.team?.name ?? ""} {p.position ? `· ${p.position}` : ""}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <FormSparkline form={p.form} />
                </div>
                <div className="w-14 text-right">
                  <p className="num text-lg font-bold text-signal">
                    {latest ? latest.rating.toFixed(1) : "–"}
                  </p>
                  {latest && (
                    <p
                      className={`num text-[10px] ${
                        latest.form_delta >= 0 ? "text-signal" : "text-flood-dim"
                      }`}
                    >
                      {latest.form_delta >= 0 ? "▲" : "▼"} {Math.abs(latest.form_delta).toFixed(2)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
