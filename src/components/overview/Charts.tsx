// Lightweight chart helpers used on the Overview dashboard.
// Extracted from AdminOverview.tsx during the P5 refactor — pure presentational,
// no extra dependencies.

export const Sparkline = ({
  data,
  stroke = "hsl(var(--primary))",
  fallbackStroke,
  height = 56,
}: { data: number[]; stroke?: string; fallbackStroke?: string; height?: number }) => {
  if (!data || data.length === 0) {
    return <div className="flex h-14 items-center justify-center text-xs text-muted-foreground">No data yet.</div>;
  }
  const w = 600;
  const h = 100;
  const max = Math.max(1, ...data);
  const stepX = data.length > 1 ? w / (data.length - 1) : 0;
  const points = data.map((v, i) => `${(i * stepX).toFixed(1)},${(h - (v / max) * (h - 8) - 2).toFixed(1)}`);
  const path = `M ${points.join(" L ")}`;
  const area = `${path} L ${(w).toFixed(1)},${h} L 0,${h} Z`;
  const lastIdx = data.length - 1;
  const lastX = lastIdx * stepX;
  const lastY = h - (data[lastIdx] / max) * (h - 8) - 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" stroke="none" />
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={fallbackStroke ? { stroke: fallbackStroke } : undefined} />
      <circle cx={lastX} cy={lastY} r={3.5} fill={fallbackStroke || stroke} />
    </svg>
  );
};

export const RangeToggle = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="inline-flex items-center rounded-md border bg-card p-0.5 text-[11px]">
    {[7, 14, 30].map((d) => (
      <button
        key={d}
        type="button"
        onClick={() => onChange(d)}
        className={`rounded px-2 py-0.5 font-medium transition-colors ${value === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        {d}d
      </button>
    ))}
  </div>
);
