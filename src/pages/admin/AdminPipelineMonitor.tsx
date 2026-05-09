import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminOnly } from "@/components/admin/AdminOnly";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Loader2, ArrowRight, RefreshCw, Ruler, FileText, Hammer, Truck, CheckCircle2, ExternalLink, Phone, MapPin, Wallet, Package, User } from "lucide-react";
import { computeStage, ALL_STAGES, STAGE_DEFS, stageToneClasses, type PipelineStage } from "@/lib/quotationPipeline";
import { formatINR } from "@/lib/brand";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Q = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string;
  status: string;
  total: number;
  advance_amount: number | null;
  submitted_for_pricing_at: string | null;
  is_direct_order: boolean | null;
  source_task_id: string | null;
};

type Job = { quotation_id: string | null; status: string };
type TripQ = { quotation_id: string; trip: { status: string } | null };

type Task = {
  id: string;
  customer_name: string;
  customer_place: string;
  status: string;
  draft_quotation_id: string | null;
};

type BoardCard = {
  key: string;
  stage: PipelineStage;
  title: string;
  subtitle: string;
  meta?: string;
  total?: number;
  href?: string;
  // For stage transitions
  quotationId?: string;
  taskId?: string;
  tripQuotationId?: string;
  canAdvance?: boolean;
  nextLabel?: string;
  // Extra context shown in the in-pipeline detail sheet
  phone?: string | null;
  address?: string | null;
  advance?: number;
  jobsTotal?: number;
  jobsDone?: number;
  hasTrip?: boolean;
  tripStatus?: string;
};

const STAGE_ICON: Record<PipelineStage, ReactNode> = {
  1: <Ruler className="h-4 w-4" />,
  2: <FileText className="h-4 w-4" />,
  3: <Hammer className="h-4 w-4" />,
  4: <Truck className="h-4 w-4" />,
  5: <CheckCircle2 className="h-4 w-4" />,
};

// Per-stage column accent (clean & subtle)
const COLUMN_ACCENT: Record<PipelineStage, string> = {
  1: "border-t-amber-500",
  2: "border-t-sky-500",
  3: "border-t-orange-500",
  4: "border-t-indigo-500",
  5: "border-t-emerald-500",
};

const AdminPipelineMonitor = () => {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<Array<{ id: string; description: string; quantity: number; amount: number }>>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (card: BoardCard) => {
    setDetailKey(card.key);
    setDetailItems([]);
    if (!card.quotationId) return;
    setDetailLoading(true);
    const { data } = await supabase
      .from("quotation_items")
      .select("id, description, quantity, amount")
      .eq("quotation_id", card.quotationId)
      .order("display_order");
    setDetailItems((data ?? []) as any);
    setDetailLoading(false);
  };
  const detailCard = cards.find((c) => c.key === detailKey) || null;

  const load = async () => {
    setLoading(true);
    const [qRes, jRes, tqRes, tRes] = await Promise.all([
      supabase
        .from("quotations")
        .select("id, quotation_id, party_name, party_place, party_phone, party_address, status, total, advance_amount, submitted_for_pricing_at, is_direct_order, source_task_id")
        .is("deleted_at", null)
        .eq("document_type", "quotation")
        .order("created_at", { ascending: false }),
      supabase
        .from("job_work_orders")
        .select("quotation_id, status")
        .is("deleted_at", null),
      supabase
        .from("trip_quotations")
        .select("id, quotation_id, delivered_at, trips:trip_id(status)") as any,
      supabase
        .from("measurement_tasks")
        .select("id, customer_name, customer_place, customer_phone, customer_address, status, draft_quotation_id")
        .is("deleted_at", null)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    const jobs = ((jRes.data ?? []) as Job[]);
    const tripsByQ: Record<string, { has: boolean; completed: boolean; tripQuotationId?: string; status?: string }> = {};
    ((tqRes.data ?? []) as any[]).forEach((tq) => {
      const qid = tq.quotation_id as string;
      const tStatus = tq.trips?.status as string | undefined;
      const cur = tripsByQ[qid] ?? { has: false, completed: false, tripQuotationId: tq.id, status: undefined as string | undefined };
      cur.has = true;
      cur.tripQuotationId = tq.id;
      cur.status = tStatus;
      if (tStatus === "completed" || tq.delivered_at) cur.completed = true;
      tripsByQ[qid] = cur;
    });

    const jobsByQ: Record<string, { total: number; done: number }> = {};
    jobs.forEach((j) => {
      if (!j.quotation_id) return;
      const cur = jobsByQ[j.quotation_id] ?? { total: 0, done: 0 };
      cur.total += 1;
      if (j.status === "completed" || j.status === "done") cur.done += 1;
      jobsByQ[j.quotation_id] = cur;
    });

    const builtQ: BoardCard[] = ((qRes.data ?? []) as any[]).map((q) => {
      const j = jobsByQ[q.id];
      const t = tripsByQ[q.id];
      const info = computeStage({
        status: q.status,
        advance_amount: q.advance_amount,
        submitted_for_pricing_at: q.submitted_for_pricing_at,
        is_direct_order: q.is_direct_order,
        source_task_id: q.source_task_id,
        jobs_total: j?.total ?? 0,
        jobs_completed: j?.done ?? 0,
        has_trip: t?.has ?? false,
        trip_completed: t?.completed ?? false,
      });
      const next = nextActionFor(info.stage, { advance: Number(q.advance_amount ?? 0), hasJobs: (j?.total ?? 0) > 0, jobsDone: (j?.total ?? 0) > 0 && (j?.done ?? 0) >= (j?.total ?? 0), hasTrip: t?.has ?? false });
      return {
        key: `q-${q.id}`,
        stage: info.stage,
        title: q.party_name,
        subtitle: q.party_place,
        meta: q.quotation_id,
        total: Number(q.total),
        href: `/admin/quotations/${q.id}`,
        quotationId: q.id,
        tripQuotationId: t?.tripQuotationId,
        canAdvance: !!next,
        nextLabel: next ?? undefined,
        phone: q.party_phone,
        address: q.party_address,
        advance: Number(q.advance_amount ?? 0),
        jobsTotal: j?.total ?? 0,
        jobsDone: j?.done ?? 0,
        hasTrip: t?.has ?? false,
        tripStatus: t?.status,
      };
    });

    // Stage 1 also pulls measurement tasks that haven't created a quotation yet
    const taskCards: BoardCard[] = ((tRes.data ?? []) as any[])
      .filter((t) => !t.draft_quotation_id)
      .map((t) => ({
        key: `t-${t.id}`,
        stage: 1 as PipelineStage,
        title: t.customer_name,
        subtitle: t.customer_place,
        meta: "Measurement task",
        href: `/admin/measurement-tasks`,
        taskId: t.id,
        phone: t.customer_phone,
        address: t.customer_address,
      }));

    setCards([...taskCards, ...builtQ]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const byStage = useMemo(() => {
    const m: Record<PipelineStage, BoardCard[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    cards.forEach((c) => m[c.stage].push(c));
    return m;
  }, [cards]);

  // Move a card to its next stage with one click.
  const advance = async (card: BoardCard) => {
    try {
      if (card.stage === 4 && card.tripQuotationId) {
        // Mark as delivered
        await supabase.from("trip_quotations").update({ delivered_at: new Date().toISOString() }).eq("id", card.tripQuotationId);
        if (card.quotationId) await supabase.from("quotations").update({ status: "delivered" }).eq("id", card.quotationId);
        toast({ title: "Marked as delivered" });
      } else if (card.stage === 2 && card.quotationId) {
        // Already finalized → nothing here; advancing means moving to production via advance
        toast({ title: "Open the quotation to record advance / send", description: "Production starts once advance is taken." });
        return;
      } else if (card.stage === 1 && card.quotationId) {
        // Drafted quotation waiting for pricing → admin opens to finalize
        toast({ title: "Open the quotation to set price & finalize" });
        return;
      } else if (card.stage === 3 && card.quotationId) {
        toast({ title: "Mark all jobs complete in Workers to advance" });
        return;
      }
      await load();
    } catch (e: any) {
      toast({ title: "Could not advance", description: e.message, variant: "destructive" });
    }
  };

  return (
    <AdminOnly>
      <AdminShell>
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl">Workflow Pipeline</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              All active orders across the 5 stages, on one screen.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="mr-2 h-4 w-4" /> Refresh</>}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="-mx-2 grid grid-flow-col auto-cols-[88vw] gap-3 overflow-x-auto pb-3 sm:auto-cols-[60vw] md:auto-cols-[40vw] lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-5 lg:overflow-visible">
            {ALL_STAGES.map((s) => {
              const def = STAGE_DEFS[s];
              const list = byStage[s];
              return (
                <div
                  key={s}
                  className={cn(
                    "mx-1 flex min-h-[200px] flex-col rounded-xl border-t-4 bg-muted/30 p-2 lg:mx-0",
                    COLUMN_ACCENT[s],
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", stageToneClasses(def.tone))}>{STAGE_ICON[s]}</span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stage {s}</p>
                        <p className="truncate text-sm font-semibold">{def.label}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={stageToneClasses(def.tone)}>{list.length}</Badge>
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    {list.length === 0 ? (
                      <p className="px-2 py-6 text-center text-xs text-muted-foreground">Empty</p>
                    ) : (
                      list.map((card) => (
                        <Card
                          key={card.key}
                          role="button"
                          tabIndex={0}
                          onClick={() => openDetail(card)}
                          onKeyDown={(e) => { if (e.key === "Enter") openDetail(card); }}
                          className="cursor-pointer border bg-card transition-smooth hover:shadow-product hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <CardContent className="space-y-2 p-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{card.title}</p>
                              <p className="truncate text-xs text-muted-foreground">{card.subtitle}</p>
                              {card.meta && <p className="truncate font-mono text-[10px] text-muted-foreground">{card.meta}</p>}
                            </div>
                            {typeof card.total === "number" && (
                              <p className="font-display text-sm font-semibold">{formatINR(card.total)}</p>
                            )}
                            {card.canAdvance && card.nextLabel && (
                              <Button
                                size="sm"
                                className="h-7 w-full text-xs"
                                onClick={(e) => { e.stopPropagation(); advance(card); }}
                              >
                                {card.nextLabel} <ArrowRight className="ml-1 h-3 w-3" />
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* In-pipeline detail drawer — opens inside the page, no route change */}
        <Sheet open={!!detailKey} onOpenChange={(o) => { if (!o) setDetailKey(null); }}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
            {detailCard && (
              <>
                <SheetHeader>
                  <div className="flex items-center gap-2">
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", stageToneClasses(STAGE_DEFS[detailCard.stage].tone))}>
                      {STAGE_ICON[detailCard.stage]}
                    </span>
                    <Badge variant="outline" className={stageToneClasses(STAGE_DEFS[detailCard.stage].tone)}>
                      Stage {detailCard.stage} · {STAGE_DEFS[detailCard.stage].label}
                    </Badge>
                  </div>
                  <SheetTitle className="text-left text-xl">{detailCard.title}</SheetTitle>
                  <SheetDescription className="text-left">
                    {detailCard.meta} {detailCard.subtitle ? `· ${detailCard.subtitle}` : ""}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-5 space-y-4">
                  {/* Contact */}
                  <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                    <p className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> {detailCard.title}</p>
                    {detailCard.phone && (
                      <a href={`tel:${detailCard.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                        <Phone className="h-4 w-4" /> {detailCard.phone}
                      </a>
                    )}
                    {detailCard.address && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detailCard.address)}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-start gap-2 text-primary hover:underline"
                      >
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> <span>{detailCard.address}</span>
                      </a>
                    )}
                  </div>

                  {/* Money */}
                  {typeof detailCard.total === "number" && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-border bg-card p-2 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                        <p className="font-display text-sm font-semibold">{formatINR(detailCard.total)}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-card p-2 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Advance</p>
                        <p className="font-display text-sm font-semibold">{formatINR(detailCard.advance ?? 0)}</p>
                      </div>
                      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-center">
                        <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          <Wallet className="h-3 w-3" /> Balance
                        </p>
                        <p className="font-display text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                          {formatINR(Math.max((detailCard.total ?? 0) - (detailCard.advance ?? 0), 0))}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Production / delivery progress */}
                  {(detailCard.jobsTotal ?? 0) > 0 && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                      <p className="flex items-center gap-2 font-semibold"><Hammer className="h-4 w-4" /> Production</p>
                      <p className="mt-1 text-muted-foreground">
                        {detailCard.jobsDone}/{detailCard.jobsTotal} jobs completed
                      </p>
                    </div>
                  )}
                  {detailCard.hasTrip && (
                    <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 p-3 text-sm">
                      <p className="flex items-center gap-2 font-semibold text-indigo-700 dark:text-indigo-300"><Truck className="h-4 w-4" /> Trip</p>
                      <p className="mt-1 text-indigo-700/80 dark:text-indigo-300/80">
                        Status: {detailCard.tripStatus ?? "scheduled"}
                      </p>
                    </div>
                  )}

                  {/* Items */}
                  {detailCard.quotationId && (
                    <div>
                      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <Package className="h-4 w-4" /> Items
                      </p>
                      {detailLoading ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                      ) : detailItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No items.</p>
                      ) : (
                        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                          {detailItems.map((it) => (
                            <li key={it.id} className="flex items-start justify-between gap-2 p-2 text-sm">
                              <span className="flex-1 leading-snug">{it.description}</span>
                              <span className="shrink-0 font-mono text-xs text-muted-foreground">× {Number(it.quantity)}</span>
                              <span className="shrink-0 font-mono text-xs">{formatINR(Number(it.amount))}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="sticky bottom-0 -mx-6 flex flex-wrap gap-2 border-t border-border bg-background px-6 pb-2 pt-3">
                    {detailCard.canAdvance && detailCard.nextLabel && (
                      <Button className="flex-1" onClick={() => { advance(detailCard); setDetailKey(null); }}>
                        {detailCard.nextLabel} <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    )}
                    {detailCard.href && (
                      <Button asChild variant="outline" className="flex-1">
                        <Link to={detailCard.href}>
                          <ExternalLink className="mr-1.5 h-4 w-4" /> Full editor
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </AdminShell>
    </AdminOnly>
  );
};

// Decide if the current stage has a one-click forward action.
function nextActionFor(
  stage: PipelineStage,
  ctx: { advance: number; hasJobs: boolean; jobsDone: boolean; hasTrip: boolean },
): string | null {
  switch (stage) {
    case 4:
      // Ready for delivery → mark delivered (only if a trip stop exists)
      return ctx.hasTrip ? "Mark Delivered" : null;
    default:
      return null;
  }
}

export default AdminPipelineMonitor;