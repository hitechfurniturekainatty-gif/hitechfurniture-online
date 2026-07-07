import { AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// Replaces the old hand-rolled Sparkline with a real, tooltip-able area
// chart — same "quotations created per day" series, now with day labels
// and an exact count on hover instead of just a shape.
export const QuotationsTrendChart = ({ data, days }: { data: number[]; days: number }) => {
  if (!data || data.length === 0) {
    return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">No data yet.</div>;
  }
  const today = new Date();
  const chartData = data.map((v, i) => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1 - i));
    return { day: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), count: v };
  });
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="quot-trend-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
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
            formatter={(value: number) => [`${value} quotation${value === 1 ? "" : "s"}`, "Created"]}
          />
          <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#quot-trend-fill)" dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
