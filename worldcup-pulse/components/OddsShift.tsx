"use client";

import { motion } from "framer-motion";
import type { OddsSnapshot } from "@/lib/types";

const impliedPct = (odd: number) => 100 / odd;

// Odds movement as editorial context ("market says 68%") — never a betting
// CTA (spec §3.4). Hidden entirely when no snapshots exist (fallback
// provider degradation).
export default function OddsShift({
  snapshots,
  homeName,
  awayName,
}: {
  snapshots: OddsSnapshot[];
  homeName: string;
  awayName: string;
}) {
  if (snapshots.length < 2) return null;

  const width = 320;
  const height = 120;
  const pad = 8;
  const series: { key: "home" | "draw" | "away"; label: string; color: string }[] = [
    { key: "home", label: homeName, color: "#C8F542" },
    { key: "draw", label: "Draw", color: "#6B685C" },
    { key: "away", label: awayName, color: "#F5F2E8" },
  ];

  const all = snapshots.flatMap((s) => Object.values(s.values).map(impliedPct));
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;

  const path = (key: "home" | "draw" | "away") =>
    snapshots
      .map((s, i) => {
        const x = pad + (i / (snapshots.length - 1)) * (width - pad * 2);
        const y = pad + (1 - (impliedPct(s.values[key] ?? 0) - min) / span) * (height - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  const latest = snapshots[snapshots.length - 1];
  const first = snapshots[0];

  return (
    <div className="rounded-2xl border border-pitch-700 bg-pitch-900 p-5">
      <h3 className="display mb-1 text-sm font-black uppercase tracking-wider text-flood">
        What the market says
      </h3>
      <p className="mb-4 text-xs text-flood-dim">
        Implied win probability since the first snapshot. Context, not a tip.
      </p>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" aria-hidden>
        {series.map((s) => (
          <motion.path
            key={s.key}
            d={path(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.key === "draw" ? 1.5 : 2.5}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.0, ease: "easeOut" }}
          />
        ))}
      </svg>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {series.map((s) => {
          const now = impliedPct(latest.values[s.key] ?? 0);
          const was = impliedPct(first.values[s.key] ?? 0);
          const delta = now - was;
          return (
            <div key={s.key} className="rounded-xl bg-pitch-950 px-3 py-2">
              <p className="truncate text-[10px] uppercase tracking-wider text-flood-dim">
                {s.label}
              </p>
              <p className="num text-lg font-bold" style={{ color: s.color }}>
                {now.toFixed(0)}%
              </p>
              <p className={`num text-[10px] ${delta >= 0 ? "text-signal" : "text-flood-dim"}`}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} pts
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
