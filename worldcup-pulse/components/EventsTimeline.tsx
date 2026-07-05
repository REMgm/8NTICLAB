"use client";

import { motion } from "framer-motion";
import type { FixtureEvent, FixtureWithTeams } from "@/lib/types";
import { statItem, statList } from "@/lib/motion";

const icons: Record<FixtureEvent["type"], string> = {
  goal: "⚽",
  card: "🟨",
  subst: "↔",
  var: "▶",
};

// Match timeline with the §7 stat slide-in: x -24 -> 0, bounce, 0.06s stagger.
export default function EventsTimeline({ fixture }: { fixture: FixtureWithTeams }) {
  const events = fixture.events ?? [];
  if (events.length === 0) {
    return (
      <p className="rounded-2xl border border-pitch-700 bg-pitch-900 p-5 text-sm text-flood-dim">
        No events yet — the timeline fills in as the match runs.
      </p>
    );
  }
  return (
    <motion.ul
      variants={statList}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      className="space-y-2"
    >
      {events.map((e, i) => {
        const home = e.team_id === fixture.home_team;
        return (
          <motion.li
            key={`${e.minute}-${i}`}
            variants={statItem}
            className={`flex items-center gap-3 rounded-xl border border-pitch-700 bg-pitch-900 px-4 py-2.5 ${
              home ? "" : "flex-row-reverse text-right"
            }`}
          >
            <span className="num w-10 shrink-0 text-sm font-bold text-signal">{e.minute}&apos;</span>
            <span aria-hidden>{icons[e.type]}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{e.player ?? "—"}</p>
              <p className="truncate text-[11px] text-flood-dim">{e.detail ?? e.type}</p>
            </div>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
