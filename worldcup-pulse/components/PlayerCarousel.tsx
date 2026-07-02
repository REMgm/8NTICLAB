"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import type { PlayerWithForm } from "@/lib/types";
import PlayerCard from "@/components/PlayerCard";

// Draggable card rail (spec §9): Framer drag="x" with constraints + elastic.
export default function PlayerCarousel({ players }: { players: PlayerWithForm[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={viewportRef} className="overflow-hidden">
      <motion.div
        ref={trackRef}
        drag="x"
        dragConstraints={viewportRef}
        dragElastic={0.12}
        className="flex cursor-grab gap-4 active:cursor-grabbing"
      >
        {players.map((p) => (
          <div key={p.id} className="w-48 shrink-0">
            <PlayerCard player={p} />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
