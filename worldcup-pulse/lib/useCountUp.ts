"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

// Animated number count-up: 0.8s, easeOut. Respects reduced motion by
// jumping straight to the final value (spec §7).
export function useCountUp(target: number, active: boolean, durationMs = 800): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const decimals = Number.isInteger(target) ? 0 : 1;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const v = target * eased;
      setValue(parseFloat(v.toFixed(decimals)));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [target, active, durationMs]);

  return value;
}
