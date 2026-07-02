"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { settle } from "@/lib/motion";

// Hero shell. The photoreal Higgsfield key visual drops into the same slot
// (16:9, no identifiable crowd faces) — until the asset lands, a layered
// floodlight gradient carries the atmosphere so layout never shifts.
export default function Hero({ liveCount }: { liveCount: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 80]); // parallax drift
  const fade = useTransform(scrollYProgress, [0, 0.9], [1, 0.25]);

  return (
    <section
      ref={ref}
      className="relative mb-10 overflow-hidden rounded-3xl border border-pitch-700"
    >
      <motion.div
        style={{ y, opacity: fade }}
        className="absolute inset-0"
        aria-hidden
      >
        {/* stand-in stadium atmosphere: pitch band, floodlight pools, crowd bokeh dots */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-20%,#24462f_0%,#0d1a14_55%,#0a1410_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_40%_at_20%_0%,rgba(245,242,232,0.16),transparent_60%),radial-gradient(50%_35%_at_85%_5%,rgba(200,245,66,0.13),transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-[repeating-linear-gradient(90deg,rgba(200,245,66,0.05)_0_48px,transparent_48px_96px)]" />
      </motion.div>

      <div className="relative px-6 py-14 sm:px-10 sm:py-20">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={settle}
          className="num mb-3 text-xs font-bold uppercase tracking-[0.25em] text-signal"
        >
          {liveCount > 0 ? `${liveCount} match${liveCount > 1 ? "es" : ""} live now` : "Knockout stage · 2026"}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...settle, delay: 0.06 }}
          className="display max-w-2xl text-4xl font-black leading-[0.95] sm:text-6xl"
        >
          The bracket is<br />
          <span className="text-signal">the whole story.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...settle, delay: 0.12 }}
          className="mt-4 max-w-lg text-sm text-flood-dim sm:text-base"
        >
          Live knockout pulse, player form curves and prediction reveals — editorial takes with
          the stat that justifies them, never tips.
        </motion.p>

        {/* tournament pulse line */}
        <motion.svg
          viewBox="0 0 400 24"
          className="mt-8 h-6 w-full max-w-md text-signal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          aria-hidden
        >
          <motion.path
            d="M0 12 H120 L132 4 L144 20 L156 2 L168 22 L180 12 H400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </motion.svg>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/bracket"
            className="display rounded-full bg-signal px-6 py-3 text-sm font-black uppercase tracking-wide text-pitch-950 transition-transform hover:scale-[1.03]"
          >
            Open the bracket
          </Link>
          <Link
            href="/players"
            className="rounded-full border border-pitch-600 px-6 py-3 text-sm font-semibold text-flood transition-colors hover:bg-pitch-800"
          >
            Who&apos;s in form
          </Link>
        </div>
      </div>
    </section>
  );
}
