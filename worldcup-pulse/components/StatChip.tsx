export default function StatChip({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-pitch-700 bg-pitch-900 px-3 py-2">
      <span className="truncate text-[10px] font-medium uppercase tracking-wider text-flood-dim">
        {label}
      </span>
      <span className={`num text-lg font-bold ${accent ? "text-signal" : "text-flood"}`}>
        {value}
      </span>
    </div>
  );
}
