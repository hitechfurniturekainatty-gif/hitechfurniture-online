import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, Clock3, FileText, Hammer, Loader2, Search, UserRound, Warehouse } from "lucide-react";

type Worker = { id: string; name: string; trade: string | null; is_active: boolean | null };
type Job = {
  id: string;
  worker_id: string | null;
  quotation_id: string | null;
  status: string;
  warehouse_status: string | null;
  due_at: string | null;
  created_at: string;
};
type JobItem = {
  id: string;
  job_id: string;
  quotation_item_id: string;
  assigned_qty: number;
  completed_qty: number;
  received_qty: number;
};
type Quote = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string;
  expected_delivery_date: string | null;
};
type QuoteItem = {
  id: string;
  quotation_id: string;
  description: string;
  quantity: number;
  fulfillment_route: string | null;
};

const finished = (s: string) => ["ready","delivered"].includes(s);
const statusLabel = (s: string) => ({
  assigned: "Assigned",
  started: "Started",
  in_progress: "Working",
  ready: "Completed / Ready",
  delivered: "Delivered"
}[s] ?? s);

export default function AdminWorkerReports() {
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobItems, setJobItems] = useState<JobItem[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [wRes, jRes, jiRes, qRes, qiRes] = await Promise.all([
      supabase.from("workers").select("id,name,trade,is_active").is("deleted_at", null).order("name"),
      supabase.from("job_work_orders").select("id,worker_id,quotation_id,status,warehouse_status,due_at,created_at").is("deleted_at", null),
      supabase.from("job_work_order_items").select("id,job_id,quotation_item_id,assigned_qty,completed_qty,received_qty"),
      supabase.from("quotations").select("id,quotation_id,party_name,party_place,expected_delivery_date").is("deleted_at", null),
      supabase.from("quotation_items").select("id,quotation_id,description,quantity,fulfillment_route")
    ]);
    setWorkers((wRes.data ?? []) as Worker[]);
    setJobs((jRes.data ?? []) as Job[]);
    setJobItems(((jiRes.data ?? []) as any[]).map(r => ({
      ...r,
      assigned_qty: Number(r.assigned_qty ?? 0),
      completed_qty: Number(r.completed_qty ?? 0),
      received_qty: Number(r.received_qty ?? 0)
    })));
    setQuotes((qRes.data ?? []) as Quote[]);
    setQuoteItems(((qiRes.data ?? []) as any[]).map(r => ({ ...r, quantity: Number(r.quantity ?? 0) })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("worker-reports-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "job_work_orders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_work_order_items" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_status_updates" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const qMap = useMemo(() => new Map(quotes.map(q => [q.id, q])), [quotes]);
  const qiMap = useMemo(() => new Map(quoteItems.map(i => [i.id, i])), [quoteItems]);

  const workerCards = useMemo(() => workers.map(w => {
    const wJobs = jobs.filter(j => j.worker_id === w.id);
    const wJobIds = new Set(wJobs.map(j => j.id));
    const items = jobItems.filter(i => wJobIds.has(i.job_id));
    const assigned = items.reduce((s,i) => s + i.assigned_qty, 0);
    const completed = items.reduce((s,i) => s + i.completed_qty, 0);
    const received = items.reduce((s,i) => s + i.received_qty, 0);
    const pending = Math.max(0, assigned - completed);
    const working = wJobs.filter(j => ["started","in_progress"].includes(j.status)).length;
    const overdue = wJobs.filter(j => j.due_at && !finished(j.status) && new Date(j.due_at).getTime() < Date.now()).length;
    return { worker: w, jobs: wJobs.length, assigned, completed, received, pending, working, overdue };
  }), [workers, jobs, jobItems]);

  const selected = selectedWorker ? workers.find(w => w.id === selectedWorker) ?? null : null;

  const detailRows = useMemo(() => {
    if (!selected) return [];
    const wJobs = jobs.filter(j => j.worker_id === selected.id);
    const rows: Array<{
      job: Job;
      quote: Quote | null;
      items: Array<JobItem & { item: QuoteItem | null; pending: number; receivePending: number }>;
    }> = [];
    for (const job of wJobs) {
      const items = jobItems
        .filter(i => i.job_id === job.id)
        .map(i => ({
          ...i,
          item: qiMap.get(i.quotation_item_id) ?? null,
          pending: Math.max(0, i.assigned_qty - i.completed_qty),
          receivePending: Math.max(0, i.completed_qty - i.received_qty)
        }));
      rows.push({ job, quote: job.quotation_id ? qMap.get(job.quotation_id) ?? null : null, items });
    }
    return rows.sort((a,b) => {
      const ad = a.job.due_at ? new Date(a.job.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.job.due_at ? new Date(b.job.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
  }, [selected, jobs, jobItems, qiMap, qMap]);

  const filteredCards = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return workerCards;
    return workerCards.filter(x => x.worker.name.toLowerCase().includes(s) || (x.worker.trade ?? "").toLowerCase().includes(s));
  }, [workerCards, search]);

  return (
    <AdminShell>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Worker / Carpenter Reports</h1>
            <p className="mt-1 text-sm text-muted-foreground">Quotation-item-wise live progress for each worker.</p>
          </div>
          <div className="relative min-w-[250px]">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search worker / carpenter" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : selected ? (
          <div className="space-y-4">
            <Button variant="ghost" className="px-1" onClick={() => setSelectedWorker(null)}>← All workers</Button>

            <Card className="border-primary/30 bg-primary/[0.03]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"><UserRound className="h-5 w-5 text-primary" /></span>
                  <div>
                    <h2 className="font-display text-xl font-bold">{selected.name}</h2>
                    <p className="text-sm text-muted-foreground">{selected.trade ?? "Worker / Carpenter"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {detailRows.map(({job, quote, items}) => {
                const overdue = !!job.due_at && !finished(job.status) && new Date(job.due_at).getTime() < Date.now();
                return (
                  <Card key={job.id}>
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold">{quote?.quotation_id ?? "No quotation"}</span>
                            <Badge variant={finished(job.status) ? "secondary" : "outline"}>{statusLabel(job.status)}</Badge>
                            {overdue && <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Overdue</Badge>}
                          </div>
                          {quote && <div className="mt-1 font-semibold">{quote.party_name} · {quote.party_place}</div>}
                          <div className="mt-1 text-xs text-muted-foreground">
                            Work due: {job.due_at ? new Date(job.due_at).toLocaleDateString("en-IN") : "Not set"}
                            {quote?.expected_delivery_date ? ` · Customer delivery: ${new Date(quote.expected_delivery_date).toLocaleDateString("en-IN")}` : ""}
                          </div>
                        </div>
                        {quote && <Button asChild size="sm" variant="outline"><Link to={`/admin/quotations/${quote.id}`}><FileText className="mr-1 h-4 w-4" />Open Quotation</Link></Button>}
                      </div>

                      <div className="mt-4 space-y-2">
                        {items.length === 0 ? (
                          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No item-level quantity rows linked to this job.</div>
                        ) : items.map(i => (
                          <div key={i.id} className="rounded-xl border bg-muted/20 p-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <div className="font-semibold">{i.item?.description ?? "Quotation item"}</div>
                                <div className="text-xs text-muted-foreground">
                                  Assigned {i.assigned_qty} · Completed {i.completed_qty} · Worker pending {i.pending} · Received {i.received_qty}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {i.pending > 0 ? <Badge variant="outline"><Clock3 className="mr-1 h-3 w-3" />Pending {i.pending}</Badge> : <Badge className="bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" />Work complete</Badge>}
                                {i.receivePending > 0 && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300"><Warehouse className="mr-1 h-3 w-3" />Receive pending {i.receivePending}</Badge>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {detailRows.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No jobs assigned to this worker.</div>}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCards.map(c => (
              <button key={c.worker.id} type="button" onClick={() => setSelectedWorker(c.worker.id)} className="text-left">
                <Card className="h-full border-2 border-primary/15 transition hover:border-primary/40 hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"><Hammer className="h-5 w-5 text-primary" /></span>
                      <div className="min-w-0">
                        <div className="truncate font-display text-lg font-bold">{c.worker.name}</div>
                        <div className="text-xs text-muted-foreground">{c.worker.trade ?? "Worker / Carpenter"}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border p-2"><div className="text-[10px] text-muted-foreground">Jobs</div><div className="font-semibold">{c.jobs}</div></div>
                      <div className="rounded-lg border bg-amber-50/60 p-2 dark:bg-amber-950/20"><div className="text-[10px] text-muted-foreground">Working</div><div className="font-semibold">{c.working}</div></div>
                      <div className="rounded-lg border bg-red-50/60 p-2 dark:bg-red-950/20"><div className="text-[10px] text-muted-foreground">Item Pending</div><div className="font-semibold">{c.pending}</div></div>
                      <div className="rounded-lg border bg-emerald-50/60 p-2 dark:bg-emerald-950/20"><div className="text-[10px] text-muted-foreground">Completed</div><div className="font-semibold">{c.completed}/{c.assigned}</div></div>
                    </div>
                    {c.overdue > 0 && <div className="mt-2"><Badge variant="destructive">{c.overdue} overdue job{c.overdue === 1 ? "" : "s"}</Badge></div>}
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
