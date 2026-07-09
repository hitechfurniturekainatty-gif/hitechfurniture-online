import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList } from "recharts";
import { STAGE_DEFS, stageToneHex, type PipelineStage } from "@/lib/quotationPipeline";

// Vertical bar, one per stage — a restricted subset of the 6-stage
// pipeline (e.g. just the in-house build stages a production team cares
// about), reusing the same stage colors as every other pipeline chart.
export const StageDistributionBarChart = ({ stages, counts }: { stages: PipelineStage[]; counts: Record<number, number> }) => {
  const data = stages.map((s) => ({
    stage: s,
    label: STAGE_DEFS[s].label,
    count: counts[s] ?? 0,
    fill: stageToneHex(STAGE_DEFS[s].tone),
  }));
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">No jobs in these stages yet.</div>;
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -10, right: 8, top: 16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <RTooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            formatter={(value: number) => [`${value} job${value === 1 ? "" : "s"}`, undefined]}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={64}>
            {data.map((d) => <Cell key={d.stage} fill={d.fill} />)}
            <LabelList dataKey="count" position="top" style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
