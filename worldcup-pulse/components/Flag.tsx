import type { Team } from "@/lib/types";

// Flag with a trigram fallback — the UI must never show a broken image
// while assets are in production.
export default function Flag({ team, size = 24 }: { team: Team | null; size?: number }) {
  if (!team) {
    return (
      <span
        className="num inline-flex items-center justify-center rounded-sm bg-pitch-700 text-[9px] font-bold text-flood-dim"
        style={{ width: size, height: size * 0.75 }}
      >
        TBD
      </span>
    );
  }
  if (team.flag_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={team.flag_url}
        alt={`${team.name} flag`}
        width={size}
        height={size * 0.75}
        loading="lazy"
        className="rounded-sm object-cover ring-1 ring-white/10"
        style={{ width: size, height: size * 0.75 }}
      />
    );
  }
  return (
    <span
      className="num inline-flex items-center justify-center rounded-sm bg-pitch-700 text-[9px] font-bold text-flood"
      style={{ width: size, height: size * 0.75 }}
    >
      {team.code ?? team.name.slice(0, 3).toUpperCase()}
    </span>
  );
}
