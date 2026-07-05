"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { FixtureWithTeams } from "@/lib/types";
import { cardIn, livePulse, prefersReducedMotion } from "@/lib/motion";
import StagePill from "@/components/StagePill";
import Flag from "@/components/Flag";

// Momentum score in [-1, 1]: negative = home surging. Last-15-minute
// events weighted; odds delta folds in server-side later if present.
function momentum(f: FixtureWithTeams): number {
  if (!f.events || f.elapsed == null) return 0;
  let m = 0;
  for (const e of f.events) {
    if (f.elapsed - e.minute > 15) continue;
    const w = e.type === "goal" ? 1 : e.type === "card" ? -0.3 : 0.15;
    m += e.team_id === f.home_team ? -w : w;
  }
  return Math.max(-1, Math.min(1, m));
}

function edgeColor(f: FixtureWithTeams): string {
  const home = f.home?.primary_color ?? "#C8F542";
  const away = f.away?.primary_color ?? "#C8F542";
  const m = momentum(f);
  if (m < -0.15) return home;
  if (m > 0.15) return away;
  return "rgba(200,245,66,0.45)"; // neutral signal
}

export default function MatchCard({ fixture }: { fixture: FixtureWithTeams }) {
  const f = fixture;
  const isLive = f.status === "LIVE" || f.status === "HT";
  const played = f.status === "FT" || f.status === "PEN";
  const color = edgeColor(f);

  return (
    <motion.div variants={cardIn} initial="hidden" whileInView="show" viewport={{ once: true }}>
      <Link
        href={`/match/${f.id}`}
        className="relative block overflow-hidden rounded-2xl border border-pitch-700 bg-pitch-900 p-4 transition-colors hover:border-pitch-600"
      >
        {/* momentum edge: left border + subtle radial glow in the leading
            team's color, 1.2s ease (spec §7) */}
        <motion.span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1"
          animate={{ backgroundColor: color }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        />
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -left-16 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full opacity-20 blur-2xl"
          animate={{ backgroundColor: color }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        />

        <div className="mb-3 flex items-center justify-between">
          <StagePill stage={f.stage} compact />
          <span className="num flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-flood-dim">
            {isLive && (
              <>
                {prefersReducedMotion() ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                ) : (
                  <motion.span animate={livePulse} className="h-1.5 w-1.5 rounded-full bg-signal" />
                )}
                <span className="text-signal">{f.status === "HT" ? "HT" : `${f.elapsed ?? ""}' LIVE`}</span>
              </>
            )}
            {!isLive && played && (f.status === "PEN" ? "FT · PENS" : "FT")}
            {!isLive && !played &&
              new Date(f.kickoff).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
          </span>
        </div>

        <div className="space-y-2.5">
          {(["home", "away"] as const).map((side) => {
            const team = f[side];
            const score = side === "home" ? f.home_score : f.away_score;
            const pens = f.penalties ? (side === "home" ? f.penalties.home : f.penalties.away) : null;
            const won =
              f.status === "FT"
                ? (f.home_score ?? 0) !== (f.away_score ?? 0) &&
                  ((side === "home") === ((f.home_score ?? 0) > (f.away_score ?? 0)))
                : f.status === "PEN" && f.penalties
                  ? (side === "home") === (f.penalties.home > f.penalties.away)
                  : false;
            return (
              <div key={side} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Flag team={team} size={26} />
                  <span
                    className={`display truncate text-base font-bold ${
                      played && !won ? "text-flood-dim" : "text-flood"
                    }`}
                  >
                    {team?.name ?? "To be decided"}
                  </span>
                </div>
                <span className={`num text-2xl font-bold tracking-tight ${won ? "text-signal" : ""}`}>
                  {score ?? "–"}
                  {pens != null && <span className="ml-1 text-xs text-flood-dim">({pens})</span>}
                </span>
              </div>
            );
          })}
        </div>

        {f.venue && (
          <p className="mt-3 truncate text-[11px] text-flood-dim/70">{f.venue}</p>
        )}
      </Link>
    </motion.div>
  );
}
