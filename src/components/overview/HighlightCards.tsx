import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, CalendarClock, CheckCircle2, MapPin, Phone, Ruler } from "lucide-react";

export type UpcomingDelivery = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string | null;
  party_phone: string | null;
  expected_delivery_date: string;
  status: string;
  total: number;
};

export type AwaitingPricing = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string | null;
  party_phone: string | null;
  created_at: string;
  created_by: string | null;
};

const PartyRow = ({ q }: { q: { id: string; party_name: string; party_place: string | null; party_phone: string | null } }) => (
  <Link
    key={q.id}
    to={`/admin/quotations/${q.id}`}
    className="block rounded-lg border bg-card p-3 transition-smooth hover:border-primary hover:shadow-sm"
  >
    <p className="truncate font-medium text-foreground">{q.party_name}</p>
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {q.party_phone && (
        <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{q.party_phone}</span>
      )}
      {q.party_place && (
        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{q.party_place}</span>
      )}
    </div>
  </Link>
);

export const HighlightCards = ({
  upcoming,
  needsPricing,
  opsStage3,
  stage3Count,
  isOfficeStaff,
}: {
  upcoming: UpcomingDelivery[];
  needsPricing: AwaitingPricing[];
  opsStage3: AwaitingPricing[];
  stage3Count: number;
  isOfficeStaff: boolean;
}) => (
  <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
    {/* Upcoming Deliveries */}
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-lg sm:text-xl">
          <CalendarClock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          Upcoming Deliveries
          <Badge variant="secondary" className="ml-1">{upcoming.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card/50 p-4 text-center text-xs text-muted-foreground">
            No deliveries scheduled in the next 2 days.
          </p>
        ) : (
          upcoming.slice(0, 5).map((q) => <PartyRow key={q.id} q={q} />)
        )}
        <Button asChild variant="outline" size="sm" className="mt-1 w-full">
          <Link to="/admin/quotations">View All <ArrowRight className="ml-1 h-3 w-3" /></Link>
        </Button>
      </CardContent>
    </Card>

    {/* Drafts needing pricing */}
    {isOfficeStaff && (
      <Card className="border-rose-500/40 bg-rose-500/5">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg sm:text-xl">
            <Ruler className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            Drafts needing pricing
            <Badge variant="secondary" className="ml-1">{needsPricing.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {needsPricing.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-card/50 p-4 text-center text-xs text-muted-foreground">
              No measurement drafts waiting on a price.
            </p>
          ) : (
            needsPricing.slice(0, 5).map((q) => <PartyRow key={q.id} q={q} />)
          )}
          <Button asChild variant="outline" size="sm" className="mt-1 w-full">
            <Link to="/admin/quotations?status=drafted">View All <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </CardContent>
      </Card>
    )}

    {/* Stage 3 OPS Work */}
    {isOfficeStaff && (
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg sm:text-xl">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Stage 3 — OPS Work
            <Badge variant="secondary" className="ml-1">{stage3Count}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {opsStage3.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-card/50 p-4 text-center text-xs text-muted-foreground">
              No finalized quotations in OPS right now.
            </p>
          ) : (
            opsStage3.slice(0, 5).map((q) => <PartyRow key={q.id} q={q} />)
          )}
          <Button asChild variant="outline" size="sm" className="mt-1 w-full">
            <Link to="/admin/quotations?status=stage3">View All <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </CardContent>
      </Card>
    )}
  </div>
);
