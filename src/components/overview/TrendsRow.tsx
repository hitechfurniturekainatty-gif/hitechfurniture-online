import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, TrendingUp, Truck } from "lucide-react";
import { RangeToggle } from "./Charts";
import { QuotationsTrendChart } from "./charts/QuotationsTrendChart";
import { StatusDonut } from "./charts/StatusDonut";
import { tripStatusDonutData } from "@/lib/logistics";

export type TrendData = {
  quotByDay: number[];
  tripsByDay: number[];
  statusTotals: Record<string, number>;
  outForDelivery: number;
  tripsActive: number;
  tripsCompleted: number;
  tripStatusCounts: Record<string, number>;
};

// Two chart cards — quotations created/day, and trip status split for the
// same window. Rendered as siblings (no own grid wrapper) so the parent
// page controls how many columns they share with other chart cards.
export const TrendsRow = ({
  trends,
  trendDays,
  setTrendDays,
}: { trends: TrendData; trendDays: number; setTrendDays: (n: number) => void }) => (
  <>
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
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
        <QuotationsTrendChart data={trends.quotByDay} days={trendDays} />
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 font-display text-base sm:text-lg">
            <Truck className="h-4 w-4 text-sky-600" />
            Delivery Status Split
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">Trips planned in the last {trendDays} days, by status</p>
        </div>
        <RangeToggle value={trendDays} onChange={setTrendDays} />
      </CardHeader>
      <CardContent>
        <StatusDonut data={tripStatusDonutData(trends.tripStatusCounts)} />
        <Link to="/admin/trips" className="mt-3 inline-flex items-center text-[11px] font-medium text-primary hover:underline">
          Open trips <ArrowRight className="ml-0.5 h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  </>
);
