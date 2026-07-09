import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { ALL_STAGES, STAGE_DEFS, stageToneHex } from "@/lib/quotationPipeline";

export type MonthlyStageRow = { month: string } & Record<string, number | string>;

// Stacked bar — one bar per month, one segment per pipeline stage. Counts
// pipeline_notifications rows (stage-entry events), not distinct
// quotations, since a quotation can re-enter/re-notify the same stage —
// the tooltip and subtitle both say so explicitly.
export const PipelineStageMonthlyBarChart = ({ data }: { data: MonthlyStageRow[] }) => {
  const hasAny = data.some((row) => ALL_STAGES.some((s) => Number(row[`stage${s}`] ?? 0) > 0));
  if (!hasAny) {
    return <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">No stage activity in this window yet.</div>;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <RTooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {ALL_STAGES.map((s) => (
            <Bar
              key={s}
              dataKey={`stage${s}`}
              name={STAGE_DEFS[s].label}
              stackId="stages"
              fill={stageToneHex(STAGE_DEFS[s].tone)}
              radius={s === ALL_STAGES[ALL_STAGES.length - 1] ? [4, 4, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
