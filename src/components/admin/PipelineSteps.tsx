import { Check } from "lucide-react";
import { ALL_STAGES, type PipelineStage, STAGE_DEFS } from "@/lib/quotationPipeline";
import { cn } from "@/lib/utils";

type Props = {
  stage: PipelineStage;
  size?: "sm" | "md";
  showLabels?: boolean;
  className?: string;
};

// Renders 5 step circles with green for completed, orange for the current
// (pending) step, and muted for upcoming. Used inside each quotation card.
export const PipelineSteps = ({ stage, size = "sm", showLabels = false, className }: Props) => {
  const dot = size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";
  const bar = size === "sm" ? "h-1" : "h-1.5";
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-1">
        {ALL_STAGES.map((s, i) => {
          const done = s < stage;
          const current = s === stage;
          return (
            <div key={s} className="flex flex-1 items-center gap-1">
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full border font-semibold transition-smooth",
                  dot,
                  done && "border-emerald-500 bg-emerald-500 text-white",
                  current && "border-amber-500 bg-amber-500 text-white",
                  !done && !current && "border-border bg-muted text-muted-foreground",
                )}
                title={STAGE_DEFS[s].label}
              >
                {done ? <Check className="h-3 w-3" /> : s}
              </div>
              {i < ALL_STAGES.length - 1 && (
                <div
                  className={cn(
                    "flex-1 rounded-full",
                    bar,
                    s < stage ? "bg-emerald-500" : "bg-muted",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      {showLabels && (
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
          {ALL_STAGES.map((s) => (
            <span key={s} className={cn("max-w-[20%] truncate", s === stage && "font-semibold text-foreground")}>
              {STAGE_DEFS[s].label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};