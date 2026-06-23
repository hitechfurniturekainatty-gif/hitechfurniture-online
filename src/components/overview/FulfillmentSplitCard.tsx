import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HardHat, Layers, Warehouse } from "lucide-react";

export type FulfillmentTotals = {
  quotsReadyOnly: number;
  quotsCustomOnly: number;
  quotsMixed: number;
  itemsReadyInWarehouse: number;
  itemsInProduction: number;
  jobsInWarehouse: number;
  jobsDispatched: number;
};

export const FulfillmentSplitCard = ({ fulfillment }: { fulfillment: FulfillmentTotals }) => (
  <Card className="mb-6 border-primary/20">
    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
      <div>
        <CardTitle className="flex items-center gap-2 font-display text-lg sm:text-xl">
          <Layers className="h-5 w-5 text-primary" />
          Fulfillment Split
        </CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Per-item routing — Ready Stock items skip production and go straight to Warehouse.
        </p>
      </div>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Ready Stock only</p>
          <p className="font-display text-2xl font-semibold text-foreground">{fulfillment.quotsReadyOnly}</p>
          <p className="text-[10px] text-muted-foreground">Quotations</p>
        </div>
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">Custom only</p>
          <p className="font-display text-2xl font-semibold text-foreground">{fulfillment.quotsCustomOnly}</p>
          <p className="text-[10px] text-muted-foreground">Quotations</p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Partially Ready</p>
          <p className="font-display text-2xl font-semibold text-foreground">{fulfillment.quotsMixed}</p>
          <p className="text-[10px] text-muted-foreground">Mixed quotations</p>
        </div>
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
            <Warehouse className="h-3 w-3" /> In Warehouse
          </p>
          <p className="font-display text-2xl font-semibold text-foreground">{fulfillment.itemsReadyInWarehouse + fulfillment.jobsInWarehouse}</p>
          <p className="text-[10px] text-muted-foreground">Items ready to pack</p>
        </div>
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-400">
            <HardHat className="h-3 w-3" /> In Production
          </p>
          <p className="font-display text-2xl font-semibold text-foreground">{fulfillment.itemsInProduction}</p>
          <p className="text-[10px] text-muted-foreground">Custom items being built</p>
        </div>
      </div>
    </CardContent>
  </Card>
);
