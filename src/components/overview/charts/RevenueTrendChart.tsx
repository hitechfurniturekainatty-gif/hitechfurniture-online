import { AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatINR } from "@/lib/brand";

export type MonthRevenue = { month: string; revenue: number };

// Last-6-months revenue line/area — same visual language as the
// quotations-trend chart, just money-scaled with a currency tooltip.
export const RevenueTrendChart = ({ data }: { data: MonthRevenue[] }) => {
  if (data.length === 0 || data.every((d) => d.revenue === 0)) {
    return <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">No revenue recorded in this window yet.</div>;
  }
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="revenue-trend-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0E5C66" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#0E5C66" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
            width={40}
          />
          <RTooltip
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            formatter={(value: number) => [formatINR(value), "Revenue"]}
          />
          <Area type="monotone" dataKey="revenue" stroke="#0E5C66" strokeWidth={2} fill="url(#revenue-trend-fill)" dot={{ r: 3, fill: "#0E5C66" }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
