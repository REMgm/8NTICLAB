"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { prefersReducedMotion } from "@/lib/motion";

export interface ConfettiDetail {
  colors?: string[];
  origin?: { x: number; y: number }; // 0..1 viewport coords
  count?: number;
}

const EVENT = "wcp:confetti";

// Event-bus trigger: any island can fire confetti without prop drilling.
export function fireConfetti(detail: ConfettiDetail = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ConfettiDetail>(EVENT, { detail }));
}

// Portal-ish listener mounted once in the root layout. Reduced motion
// disables confetti globally (spec §7 hard rule).
export default function ConfettiLayer() {
  useEffect(() => {
    const onFire = (e: Event) => {
      if (prefersReducedMotion()) return;
      const { colors, origin, count } = (e as CustomEvent<ConfettiDetail>).detail ?? {};
      confetti({
        particleCount: count ?? 350,
        spread: 78,
        startVelocity: 42,
        ticks: 160, // ~0.8s at 60fps within the 1.2s hard cap
        origin: origin ?? { x: 0.5, y: 0.6 },
        colors: colors?.length ? colors : ["#C8F542", "#F5F2E8", "#0A1410"],
        disableForReducedMotion: true,
      });
    };
    window.addEventListener(EVENT, onFire);
    return () => window.removeEventListener(EVENT, onFire);
  }, []);

  return null;
}
