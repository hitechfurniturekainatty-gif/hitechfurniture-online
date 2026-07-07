export type StatusSegment = { name: string; value: number; color: string };

// Compact segmented proportion bar — a mobile-friendly substitute for a
// donut when horizontal space is tight (worn on a phone, on a job site).
// Same rule as StatusDonut: legend always present, never color-alone.
export const StatusBar = ({ data }: { data: StatusSegment[] }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <p className="text-xs text-muted-foreground">No jobs yet.</p>;
  }
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {data.filter((d) => d.value > 0).map((d) => (
          <div
            key={d.name}
            style={{ width: `${(d.value / total) * 100}%`, backgroundColor: d.color }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            {d.name} <span className="font-semibold tabular-nums text-foreground">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
