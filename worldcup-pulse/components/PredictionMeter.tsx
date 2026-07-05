"use client";

import { motion } from "framer-motion";
import { useCountUp } from "@/lib/useCountUp";
import { useState } from "react";

// Animated gauge with spring physics (spec §6). Shows the market-implied
// probability for one side — framed as context, never a tip.
export default function PredictionMeter({
  label,
  percent,
  color = "#C8F542",
}: {
  label: string;
  percent: number; // 0..100
  color?: string;
}) {
  const [inView, setInView] = useState(false);
  const shown = useCountUp(Math.round(percent), inView);

  // Semi-circular gauge: sweep from -90° to +90°.
  const r = 54;
  const cx = 64;
  const cy = 64;
  const arc = (deg: number) => {
    const rad = ((deg - 180) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const start = arc(0);
  const end = arc(180);

  return (
    <motion.div
      className="flex flex-col items-center rounded-2xl border border-pitch-700 bg-pitch-900 p-5"
      onViewportEnter={() => setInView(true)}
      viewport={{ once: true }}
    >
      <svg viewBox="0 0 128 76" className="w-40" aria-hidden>
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
          fill="none"
          stroke="#1A3325"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <motion.path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={inView ? { pathLength: percent / 100 } : undefined}
          transition={{ type: "spring", stiffness: 60, damping: 16 }}
        />
      </svg>
      <p className="num -mt-6 text-3xl font-bold" style={{ color }}>
        {shown}%
      </p>
      <p className="mt-1 text-center text-[11px] uppercase tracking-wider text-flood-dim">
        {label}
      </p>
    </motion.div>
  );
}
