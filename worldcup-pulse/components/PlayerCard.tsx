"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { PlayerWithForm } from "@/lib/types";
import { settle, statItem, statList } from "@/lib/motion";
import Flag from "@/components/Flag";

// Flip card (spec §7): caricature/photo front, stat sheet back. 3D rotateY
// with `settle`; back face staggers its stat chips. While the Higgsfield
// caricature queue drains, the front shows the licensed photo or a
// monogram placeholder — never a broken image.
export default function PlayerCard({ player }: { player: PlayerWithForm }) {
  const [flipped, setFlipped] = useState(false);
  const latest = player.form[player.form.length - 1];
  const art = player.stylized_url ?? player.photo_url;
  const initials = player.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  const teamColor = player.team?.primary_color ?? "#C8F542";

  return (
    <button
      onClick={() => setFlipped((v) => !v)}
      className="block w-full text-left [perspective:1000px]"
      aria-pressed={flipped}
      aria-label={`${player.name} card, tap to flip`}
    >
      <motion.div
        className="relative h-64 w-full [transform-style:preserve-3d]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={settle}
      >
        {/* front */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl border border-pitch-700 bg-pitch-900 [backface-visibility:hidden]">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(80% 60% at 50% 0%, ${teamColor}55, transparent 70%)`,
            }}
            aria-hidden
          />
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={art}
              alt={player.name}
              className="absolute inset-0 h-full w-full object-cover object-top"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="display text-6xl font-black opacity-40"
                style={{ color: teamColor }}
              >
                {initials}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-pitch-950 via-pitch-950/80 to-transparent p-4 pt-10">
            <div className="flex items-center gap-2">
              <Flag team={player.team} size={20} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-flood-dim">
                {player.position ?? ""}
              </span>
            </div>
            <p className="display mt-1 text-lg font-black leading-tight">{player.name}</p>
            {!player.stylized_url && (
              <p className="mt-0.5 text-[9px] uppercase tracking-widest text-flood-dim/50">
                caricature in production
              </p>
            )}
          </div>
        </div>

        {/* back: stat sheet */}
        <div className="absolute inset-0 rotate-y-180 overflow-hidden rounded-2xl border border-pitch-700 bg-pitch-900 p-4 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <p className="display text-base font-black">{player.name}</p>
          <p className="mb-3 text-[10px] uppercase tracking-wider text-flood-dim">
            Tournament sheet
          </p>
          {latest ? (
            <motion.div
              variants={statList}
              initial="hidden"
              animate={flipped ? "show" : "hidden"}
              className="grid grid-cols-2 gap-2"
            >
              {[
                { label: "Goals", value: latest.goals },
                { label: "Assists", value: latest.assists },
                { label: "xG", value: latest.xg.toFixed(1) },
                { label: "Minutes", value: latest.minutes },
                { label: "Rating", value: latest.rating.toFixed(1) },
                {
                  label: "Form Δ",
                  value: `${latest.form_delta >= 0 ? "+" : ""}${latest.form_delta.toFixed(2)}`,
                },
              ].map((s) => (
                <motion.div
                  key={s.label}
                  variants={statItem}
                  className="rounded-xl bg-pitch-950 px-3 py-2"
                >
                  <p className="text-[9px] uppercase tracking-wider text-flood-dim">{s.label}</p>
                  <p className="num text-lg font-bold text-signal">{s.value}</p>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="text-xs text-flood-dim">Form snapshots arriving with the next ingest.</p>
          )}
        </div>
      </motion.div>
    </button>
  );
}
