"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { livePulse, prefersReducedMotion } from "@/lib/motion";
import { fireConfetti } from "@/components/ConfettiLayer";
import { buzz } from "@/lib/haptics";

interface TickerFixture {
  id: number;
  stage: string;
  status: string;
  kickoff: string;
  elapsed: number | null;
  home: { id: number; name: string; code: string | null } | null;
  away: { id: number; name: string; code: string | null } | null;
  home_score: number | null;
  away_score: number | null;
}

const POLL_MS = 30_000;

// Client island (spec §4): polls /api/live — an ISR-cached Supabase read,
// never the provider. Goal diffs fire confetti + haptics.
export default function LiveTicker() {
  const [fixtures, setFixtures] = useState<TickerFixture[]>([]);
  const prevScores = useRef<Map<number, number>>(new Map());
  const [pulling, setPulling] = useState(false);
  const touchStartY = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/live");
      if (!res.ok) return;
      const data = (await res.json()) as { fixtures: TickerFixture[] };
      const next = data.fixtures ?? [];

      // Goal diff detection -> confetti burst + 10ms buzz.
      for (const f of next) {
        const total = (f.home_score ?? 0) + (f.away_score ?? 0);
        const prev = prevScores.current.get(f.id);
        if (prev !== undefined && total > prev && (f.status === "LIVE" || f.status === "HT")) {
          fireConfetti({ origin: { x: 0.5, y: 0.85 }, count: 200 });
          buzz(10);
        }
        prevScores.current.set(f.id, total);
      }
      setFixtures(next);
    } catch {
      // ticker degrades silently; next poll retries
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Pull-down refetch: visual affordance only, data is already cached (§9).
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current != null && e.changedTouches[0].clientY - touchStartY.current > 48) {
      setPulling(true);
      load().finally(() => setTimeout(() => setPulling(false), 500));
    }
    touchStartY.current = null;
  };

  if (fixtures.length === 0) return null;

  return (
    <div
      className="glass fixed inset-x-0 bottom-0 z-50"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="region"
      aria-label="Live scores ticker"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-width:none]">
        <span className="num shrink-0 text-[10px] font-bold uppercase tracking-widest text-signal">
          {pulling ? "Syncing" : "Pulse"}
        </span>
        {fixtures.map((f) => {
          const isLive = f.status === "LIVE" || f.status === "HT";
          return (
            <Link
              key={f.id}
              href={`/match/${f.id}`}
              className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-pitch-700 bg-pitch-900/80 px-3.5 py-1.5"
            >
              {isLive &&
                (prefersReducedMotion() ? (
                  <span className="h-2 w-2 rounded-full bg-signal" />
                ) : (
                  <motion.span animate={livePulse} className="h-2 w-2 rounded-full bg-signal" />
                ))}
              <span className="text-xs font-semibold">
                {f.home?.code ?? "TBD"}{" "}
                <span className="num text-signal">
                  {f.home_score ?? ""}
                  {f.home_score != null ? "–" : "v"}
                  {f.away_score ?? ""}
                </span>{" "}
                {f.away?.code ?? "TBD"}
              </span>
              <span className="num text-[10px] text-flood-dim">
                {isLive
                  ? f.status === "HT"
                    ? "HT"
                    : `${f.elapsed ?? ""}'`
                  : f.status === "NS"
                    ? new Date(f.kickoff).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : f.status}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
