import { AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// Generic "count per day" line/area chart — the line-chart sibling of
// DailyBarChart, for daily volumes (e.g. WhatsApp enquiries) rather than
// weekly/short trends.
export const DailyLineChart = ({
  data,
  days,
  color = "#0E5C66",
  unitLabel = "item",
}: { data: number[]; days: number; color?: string; unitLabel?: string }) => {
  if (!data || data.length === 0 || data.every((v) => v === 0)) {
    return <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">No activity in this window yet.</div>;
  }
  const today = new Date();
  const chartData = data.map((v, i) => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1 - i));
    return { day: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), count: v };
  });
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="daily-line-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="day"
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            interval={days > 14 ? Math.ceil(days / 7) : 1}
          />
          <YAxis hide allowDecimals={false} />
          <RTooltip
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            formatter={(value: number) => [`${value} ${unitLabel}${value === 1 ? "" : "s"}`, undefined]}
          />
          <Area type="monotone" dataKey="count" stroke={color} strokeWidth={2} fill="url(#daily-line-fill)" dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
