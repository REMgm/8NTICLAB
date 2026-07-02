"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { HotTake } from "@/lib/types";
import { settle } from "@/lib/motion";
import { useCountUp } from "@/lib/useCountUp";
import { fireConfetti } from "@/components/ConfettiLayer";
import { buzz } from "@/lib/haptics";

const confidenceMeta = {
  certain: { label: "Cold read", tone: "text-flood-dim border-pitch-600" },
  likely: { label: "Leaning in", tone: "text-flood border-flood/30" },
  spicy: { label: "Spicy", tone: "text-signal border-signal/50" },
} as const;

// The signature interaction (spec §7): collapsed shows only category +
// blurred headline; tap dissolves the blur, expands with `settle`, counts
// the revealed stat up — and spicy takes burst team-colored confetti from
// the card's own origin.
export default function HotTakeCard({
  take,
  teamColors,
}: {
  take: HotTake;
  teamColors?: string[];
}) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);
  const stat = take.revealed_stat;
  const shown = useCountUp(stat?.value ?? 0, open);
  const meta = confidenceMeta[take.confidence];

  const reveal = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    buzz(10);
    if (take.confidence === "spicy" && cardRef.current) {
      const r = cardRef.current.getBoundingClientRect();
      fireConfetti({
        origin: {
          x: (r.left + r.width / 2) / window.innerWidth,
          y: (r.top + r.height / 2) / window.innerHeight,
        },
        count: 350,
        colors: teamColors?.length ? teamColors : undefined,
      });
    }
  };

  return (
    <motion.button
      ref={cardRef}
      layout
      transition={settle}
      onClick={reveal}
      aria-expanded={open}
      className="block w-full rounded-2xl border border-pitch-700 bg-pitch-900 p-5 text-left transition-colors hover:border-pitch-600"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`num rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${meta.tone}`}
        >
          {meta.label}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-flood-dim/60">
          {open ? "Tap to hide" : "Tap to reveal"}
        </span>
      </div>

      <motion.h3
        className="display text-lg font-black leading-snug sm:text-xl"
        animate={{ filter: open ? "blur(0px)" : "blur(7px)", opacity: open ? 1 : 0.8 }}
        transition={{ duration: 0.25 }}
      >
        {take.headline}
      </motion.h3>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={settle}
            className="overflow-hidden"
          >
            <p className="mt-3 text-sm leading-relaxed text-flood-dim">{take.body}</p>
            {stat && (
              <div className="mt-4 flex items-baseline gap-3 rounded-xl border border-pitch-700 bg-pitch-950 px-4 py-3">
                <span className="num text-3xl font-bold text-signal">
                  {shown}
                  {stat.suffix ?? ""}
                </span>
                <span className="text-xs uppercase tracking-wider text-flood-dim">{stat.label}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
