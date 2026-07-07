import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { ALL_STAGES, STAGE_DEFS, stageToneHex, type PipelineStage } from "@/lib/quotationPipeline";

// Horizontal funnel — one bar per pipeline stage, widest-to-narrowest reads
// as a real funnel since stage counts naturally shrink as work moves
// downstream (each quotation occupies exactly one stage at a time).
export const PipelineFunnelChart = ({ pipelineCounts }: { pipelineCounts: Record<PipelineStage, number> }) => {
  const data = ALL_STAGES.map((s) => ({
    stage: `${s}`,
    label: STAGE_DEFS[s].label,
    owner: STAGE_DEFS[s].owner,
    count: pipelineCounts[s],
    fill: stageToneHex(STAGE_DEFS[s].tone),
  }));
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base sm:text-lg">Pipeline Funnel</CardTitle>
        <p className="text-xs text-muted-foreground">{total} quotation{total === 1 ? "" : "s"} across all 6 stages, right now.</p>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={92}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <RTooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, _name, item) => [`${value} quotation${value === 1 ? "" : "s"}`, item.payload.owner]}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={22}>
                {data.map((d) => (
                  <Cell key={d.stage} fill={d.fill} />
                ))}
                <LabelList dataKey="count" position="right" style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
