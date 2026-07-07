import { PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer } from "recharts";

export type DonutSlice = { name: string; value: number; color: string };

// Generic part-of-whole donut with an always-on legend (never color-alone)
// and a center total. Kept to small segment counts (status breakdowns) —
// never used for open-ended categorical data.
export const StatusDonut = ({ data, size = 148 }: { data: DonutSlice[]; size?: number }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <div className="flex h-36 items-center justify-center text-xs text-muted-foreground">No data yet.</div>;
  }
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={data.filter((d) => d.value > 0).length > 1 ? 2 : 0}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <RTooltip
              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              formatter={(value: number, name: string) => [`${value} (${Math.round((value / total) * 100)}%)`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-semibold text-foreground">{total}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">total</span>
        </div>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
              {d.name}
            </span>
            <span className="font-semibold tabular-nums text-foreground">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
