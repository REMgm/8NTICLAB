"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { FixtureWithTeams, Stage, Team } from "@/lib/types";
import { livePulse, prefersReducedMotion } from "@/lib/motion";
import Flag from "@/components/Flag";

// SVG knockout tree (spec §6/§7): connector paths draw 0 -> 1 on scroll
// into view; a decided tie's outgoing path takes the winner's team color.
// On mobile the rail is horizontal snap-scroll with stage tabs (spec §9).

const STAGES: { key: Stage; label: string }[] = [
  { key: "R32", label: "Round of 32" },
  { key: "R16", label: "Round of 16" },
  { key: "QF", label: "Quarters" },
  { key: "SF", label: "Semis" },
  { key: "F", label: "Final" },
];

const NODE_W = 216;
const NODE_H = 68;
const COL_GAP = 56;
const UNIT = 84; // vertical band of one R32 slot

function winner(f: FixtureWithTeams): Team | null {
  if (f.status === "FT") {
    if ((f.home_score ?? 0) > (f.away_score ?? 0)) return f.home;
    if ((f.away_score ?? 0) > (f.home_score ?? 0)) return f.away;
    return null;
  }
  if (f.status === "PEN" && f.penalties) {
    return f.penalties.home > f.penalties.away ? f.home : f.away;
  }
  return null;
}

export default function BracketTree({ fixtures }: { fixtures: FixtureWithTeams[] }) {
  const railRef = useRef<HTMLDivElement>(null);

  const byStage = new Map<Stage, FixtureWithTeams[]>();
  for (const s of STAGES) {
    byStage.set(
      s.key,
      fixtures
        .filter((f) => f.stage === s.key)
        .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    );
  }
  const thirdPlace = fixtures.find((f) => f.stage === "3P") ?? null;

  // Stages that actually exist in the data (a tournament snapshot might
  // start at R16). Column geometry derives from the first present stage.
  const presentStages = STAGES.filter((s) => (byStage.get(s.key)?.length ?? 0) > 0 || s.key === "F");
  const baseCount = byStage.get(presentStages[0]?.key ?? "R32")?.length || 16;
  const totalH = baseCount * UNIT * 2;

  const colX = (i: number) => i * (NODE_W + COL_GAP);
  const slotY = (col: number, idx: number) => {
    const band = (totalH / (baseCount * 2)) * Math.pow(2, col + 1);
    return idx * band + band / 2;
  };

  const scrollToCol = (i: number) => {
    railRef.current?.scrollTo({ left: colX(i) - 16, behavior: "smooth" });
  };

  const width = colX(presentStages.length - 1) + NODE_W + 8;

  return (
    <div>
      {/* stage tabs — mobile navigation for the rail */}
      <div className="mb-4 flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {presentStages.map((s, i) => (
          <button
            key={s.key}
            onClick={() => scrollToCol(i)}
            className="num min-h-[44px] shrink-0 rounded-full border border-pitch-600 px-4 text-xs font-bold uppercase tracking-wider text-flood-dim transition-colors hover:border-signal hover:text-signal"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div ref={railRef} className="bracket-rail overflow-x-auto pb-4">
        <div className="relative" style={{ width, height: totalH }}>
          {/* connectors */}
          <svg
            className="pointer-events-none absolute inset-0"
            width={width}
            height={totalH}
            aria-hidden
          >
            {presentStages.slice(0, -1).map((s, col) => {
              const matches = byStage.get(s.key) ?? [];
              return matches.map((f, j) => {
                const x1 = colX(col) + NODE_W;
                const y1 = slotY(col, j);
                const x2 = colX(col + 1);
                const y2 = slotY(col + 1, Math.floor(j / 2));
                const midX = x1 + COL_GAP / 2;
                const w = winner(f);
                return (
                  <motion.path
                    key={f.id}
                    d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`}
                    fill="none"
                    stroke={w?.primary_color ?? "rgba(200,245,66,0.18)"}
                    strokeWidth={w ? 2.5 : 1.5}
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.9, ease: "easeOut", delay: 0.04 * j }}
                  />
                );
              });
            })}
          </svg>

          {/* nodes */}
          {presentStages.map((s, col) => {
            const matches = byStage.get(s.key) ?? [];
            const slots = Math.max(matches.length, baseCount >> col > 0 ? baseCount >> col : 1);
            return Array.from({ length: slots }).map((_, j) => {
              const f = matches[j];
              const y = slotY(col, j);
              return (
                <div
                  key={`${s.key}-${j}`}
                  className="absolute"
                  style={{ left: colX(col), top: y - NODE_H / 2, width: NODE_W, height: NODE_H }}
                >
                  {f ? <BracketNode fixture={f} /> : <EmptyNode label={s.label} />}
                </div>
              );
            });
          })}

          {/* third-place tie sits under the final column */}
          {thirdPlace && (
            <div
              className="absolute"
              style={{
                left: colX(presentStages.length - 1),
                top: slotY(presentStages.length - 1, 0) + NODE_H * 1.4,
                width: NODE_W,
                height: NODE_H,
              }}
            >
              <BracketNode fixture={thirdPlace} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyNode({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-pitch-700 text-[10px] uppercase tracking-widest text-flood-dim/50">
      {label} · TBD
    </div>
  );
}

function BracketNode({ fixture: f }: { fixture: FixtureWithTeams }) {
  const isLive = f.status === "LIVE" || f.status === "HT";
  const w = winner(f);
  return (
    <Link
      href={`/match/${f.id}`}
      className={`block h-full rounded-xl border bg-pitch-900 px-3 py-1.5 transition-colors hover:border-signal/60 ${
        isLive ? "border-signal/60" : "border-pitch-700"
      }`}
    >
      {(["home", "away"] as const).map((side) => {
        const team = f[side];
        const score = side === "home" ? f.home_score : f.away_score;
        const pens = f.penalties ? (side === "home" ? f.penalties.home : f.penalties.away) : null;
        const isWinner = w != null && team != null && w.id === team.id;
        return (
          <div key={side} className="flex h-1/2 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <Flag team={team} size={16} />
              <span
                className={`truncate text-xs font-semibold ${
                  w && !isWinner ? "text-flood-dim/60" : "text-flood"
                }`}
              >
                {team?.code ?? team?.name ?? "TBD"}
              </span>
            </div>
            <span className={`num text-sm font-bold ${isWinner ? "text-signal" : ""}`}>
              {score ?? ""}
              {pens != null && <span className="text-[9px] text-flood-dim"> ({pens})</span>}
            </span>
          </div>
        );
      })}
      {isLive && (
        <span className="absolute -right-1 -top-1">
          {prefersReducedMotion() ? (
            <span className="block h-2.5 w-2.5 rounded-full bg-signal" />
          ) : (
            <motion.span animate={livePulse} className="block h-2.5 w-2.5 rounded-full bg-signal" />
          )}
        </span>
      )}
    </Link>
  );
}
