import type { Stage } from "@/lib/types";

const labels: Record<Stage, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-final",
  SF: "Semi-final",
  "3P": "Third place",
  F: "Final",
};

export default function StagePill({ stage, compact = false }: { stage: Stage; compact?: boolean }) {
  return (
    <span className="num inline-flex items-center rounded-full border border-pitch-600 bg-pitch-800 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-signal">
      {compact ? stage : labels[stage]}
    </span>
  );
}
