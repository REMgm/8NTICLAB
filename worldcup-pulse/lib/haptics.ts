"use client";

// navigator.vibrate wrapper (spec §9): capability-checked, silent no-op on
// iOS Safari (no API support), never a permission prompt.
export function buzz(ms = 10): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(ms);
  } catch {
    // never surface haptics failures
  }
}
