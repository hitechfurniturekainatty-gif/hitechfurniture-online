import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export type KpiCardProps = {
  label: string;
  value: string;
  icon: any;
  /** Month-over-month (or similar) % change. Omit when there's no prior period to compare. */
  deltaPercent?: number | null;
  deltaCaption?: string;
  sub?: string;
  to?: string;
};

// Single KPI tile — a plain number, or a number plus a colored delta badge
// when a prior-period comparison is available. Never fabricates a delta:
// pass deltaPercent={null} (not 0) when there's nothing to compare against.
export const KpiCard = ({ label, value, icon: Icon, deltaPercent, deltaCaption, sub, to }: KpiCardProps) => {
  const body = (
    <Card className="h-full bg-card transition-smooth hover:shadow-product">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="truncate">{label}</span>
          <Icon className="h-4 w-4 text-primary" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="font-display text-2xl font-semibold text-foreground sm:text-3xl">{value}</p>
          {deltaPercent !== undefined && deltaPercent !== null && Number.isFinite(deltaPercent) && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                deltaPercent >= 0
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
              }`}
            >
              {deltaPercent >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(deltaPercent).toFixed(0)}%
            </span>
          )}
        </div>
        {(sub || deltaCaption) && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{deltaCaption ?? sub}</p>
        )}
      </CardContent>
    </Card>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
};
