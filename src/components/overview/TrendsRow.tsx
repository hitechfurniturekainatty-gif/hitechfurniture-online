import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingUp, Truck } from "lucide-react";
import { Sparkline, RangeToggle } from "./Charts";
import { statusBadgeVariant, statusLabel } from "@/pages/admin/AdminQuotationEditor";

export type TrendData = {
  quotByDay: number[];
  tripsByDay: number[];
  statusTotals: Record<string, number>;
  outForDelivery: number;
  tripsActive: number;
  tripsCompleted: number;
};

export const TrendsRow = ({
  trends,
  trendDays,
  setTrendDays,
}: { trends: TrendData; trendDays: number; setTrendDays: (n: number) => void }) => (
  <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 font-display text-base sm:text-lg">
            <TrendingUp className="h-4 w-4 text-primary" />
            Quotations Trend
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">New quotations created per day · last {trendDays} days</p>
        </div>
        <RangeToggle value={trendDays} onChange={setTrendDays} />
      </CardHeader>
      <CardContent>
        <Sparkline data={trends.quotByDay} stroke="hsl(var(--primary))" height={64} />
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          {Object.entries(trends.statusTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([s, n]) => (
              <Badge key={s} variant={statusBadgeVariant(s)} className="capitalize">
                {statusLabel(s)} · {n}
              </Badge>
            ))}
          {Object.keys(trends.statusTotals).length === 0 && (
            <span className="text-muted-foreground">No quotations in this window.</span>
          )}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 font-display text-base sm:text-lg">
            <Truck className="h-4 w-4 text-sky-600" />
            Deliveries Trend
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">Trips planned per day · last {trendDays} days</p>
        </div>
        <RangeToggle value={trendDays} onChange={setTrendDays} />
      </CardHeader>
      <CardContent>
        <Sparkline data={trends.tripsByDay} stroke="hsl(var(--sky, 199 89% 48%))" fallbackStroke="#0284c7" height={64} />
        {/* Counts below are computed across the same `trendDays` window the
            sparkline uses — labelled "(Nd)" so they're not mistaken for
            live, right-now totals. */}
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">Out for Delivery · {trends.outForDelivery} ({trendDays}d)</Badge>
          <Badge variant="secondary" className="bg-sky-100 text-sky-800">Active trips · {trends.tripsActive} ({trendDays}d)</Badge>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Completed · {trends.tripsCompleted} ({trendDays}d)</Badge>
          <Link to="/admin/trips" className="ml-auto inline-flex items-center text-[11px] font-medium text-primary hover:underline">
            Open trips <ArrowRight className="ml-0.5 h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  </div>
);
