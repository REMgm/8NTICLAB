"use client";

import type { Transition, Variants } from "framer-motion";

// All springs and variants live here (spec §7). One orchestrated moment per
// view, quiet everywhere else.

export const snap: Transition = { type: "spring", stiffness: 500, damping: 30 }; // chips, pills
export const bounce: Transition = { type: "spring", stiffness: 300, damping: 14 }; // stat slide-ins
export const settle: Transition = { type: "spring", stiffness: 120, damping: 20 }; // cards, page elements

// Single global reduced-motion check (spec §7 hard rule). Confetti, loops
// and count-ups all consult this — nowhere else queries the media query.
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Stat slide-in: x -24 -> 0, opacity 0 -> 1, bounce, stagger via parent.
export const statList: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

export const statItem: Variants = {
  hidden: { x: -24, opacity: 0 },
  show: { x: 0, opacity: 1, transition: bounce },
};

export const cardIn: Variants = {
  hidden: { y: 16, opacity: 0 },
  show: { y: 0, opacity: 1, transition: settle },
};

// Live pulse: status dot loop, 2s, only while LIVE.
export const livePulse = {
  scale: [1, 1.35, 1],
  opacity: [1, 0.55, 1],
  transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const },
};
