import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// Generic "count per day" bar chart — used wherever a role needs a short
// trend of a single count (e.g. measurement tasks completed per day).
export const DailyBarChart = ({
  data,
  days,
  color = "hsl(var(--primary))",
  unitLabel = "item",
}: { data: number[]; days: number; color?: string; unitLabel?: string }) => {
  if (!data || data.length === 0) {
    return <div className="flex h-36 items-center justify-center text-xs text-muted-foreground">No data yet.</div>;
  }
  const today = new Date();
  const chartData = data.map((v, i) => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1 - i));
    return { day: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), count: v };
  });
  return (
    <div className="h-36 w-full">
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} interval={Math.ceil(days / 7)} />
          <YAxis hide allowDecimals={false} />
          <RTooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            formatter={(value: number) => [`${value} ${unitLabel}${value === 1 ? "" : "s"}`, undefined]}
          />
          <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
