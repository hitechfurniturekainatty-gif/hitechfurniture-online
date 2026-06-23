import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ALL_STAGES, STAGE_DEFS, stageToneClasses, type PipelineStage } from "@/lib/quotationPipeline";

export const PipelineStageGrid = ({ pipelineCounts }: { pipelineCounts: Record<PipelineStage, number> }) => (
  <Card className="mb-6">
    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
      <div>
        <CardTitle className="font-display text-lg sm:text-xl">Pipeline — by Stage</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">Live counts across the 6-stage automated pipeline.</p>
      </div>
      <Button asChild variant="ghost" size="sm">
        <Link to="/admin/pipeline">View full pipeline →</Link>
      </Button>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {ALL_STAGES.map((s) => {
          const def = STAGE_DEFS[s];
          return (
            <Link
              key={s}
              to={`/admin/quotations?status=stage${s}`}
              className={`group relative block rounded-xl border p-3 transition-smooth hover:shadow-product ${stageToneClasses(def.tone)}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Stage {s}</p>
              <p className="font-display text-2xl font-semibold">{pipelineCounts[s]}</p>
              <p className="mt-0.5 truncate text-sm font-semibold">{def.label}</p>
              <p className="text-[10px] opacity-70">{def.owner}</p>
            </Link>
          );
        })}
      </div>
    </CardContent>
  </Card>
);
