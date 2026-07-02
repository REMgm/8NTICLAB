"use client";

import { motion } from "framer-motion";
import type { PlayerFormSnapshot } from "@/lib/types";

// 5-snapshot rating sparkline; the path draws itself on viewport entry.
export default function FormSparkline({
  form,
  width = 96,
  height = 28,
}: {
  form: PlayerFormSnapshot[];
  width?: number;
  height?: number;
}) {
  if (form.length < 2) {
    return <span className="text-[10px] text-flood-dim/60">no data</span>;
  }
  const ratings = form.map((s) => s.rating);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const span = max - min || 1;
  const pad = 3;
  const pts = ratings.map((r, i) => ({
    x: pad + (i / (ratings.length - 1)) * (width - pad * 2),
    y: pad + (1 - (r - min) / span) * (height - pad * 2),
  }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const rising = ratings[ratings.length - 1] >= ratings[0];
  const last = pts[pts.length - 1];

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      <motion.path
        d={d}
        fill="none"
        stroke={rising ? "#C8F542" : "#B8B4A6"}
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <motion.circle
        cx={last.x}
        cy={last.y}
        r="2.5"
        fill={rising ? "#C8F542" : "#B8B4A6"}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.7 }}
      />
    </svg>
  );
}
