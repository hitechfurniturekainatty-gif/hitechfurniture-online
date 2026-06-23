export function ProgressRing({ pct, size = 96, stroke = 8, color = "hsl(var(--primary))" }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" className="transition-all duration-500" />
      <text x="50%" y="50%" dy=".35em" textAnchor="middle" transform={`rotate(90 ${size / 2} ${size / 2})`}
        className="fill-foreground text-xs font-semibold">{Math.round(pct)}%</text>
    </svg>
  );
}
