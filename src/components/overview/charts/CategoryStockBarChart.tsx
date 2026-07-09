import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export type CategoryStock = { category: string; quantity: number };

// Vertical bar of stock quantity by category. The empty-state message is
// caller-supplied (not hardcoded) since different callers gate on
// different underlying tables being empty.
export const CategoryStockBarChart = ({ data, emptyMessage }: { data: CategoryStock[]; emptyMessage: string }) => {
  if (data.length === 0 || data.every((d) => d.quantity === 0)) {
    return <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">{emptyMessage}</div>;
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <RTooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            formatter={(value: number) => [`${value} unit${value === 1 ? "" : "s"}`, "In stock"]}
          />
          <Bar dataKey="quantity" fill="#0E5C66" radius={[4, 4, 0, 0]} maxBarSize={64} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
