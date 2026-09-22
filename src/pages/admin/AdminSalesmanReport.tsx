import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/brand";
import { AlertTriangle, CalendarDays, ChevronLeft, FileText, IndianRupee, Loader2, Search, UserRound, WalletCards } from "lucide-react";

type Q = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string;
  party_phone: string | null;
  quotation_date: string;
  expected_delivery_date: string | null;
  salesperson_name: string | null;
  total: number | null;
  advance_amount: number | null;
  status: string | null;
  commercial_status: string | null;
  document_type: string | null;
};

type Receivable = {
  id: string;
  quotation_id: string | null;
  pending_amount: number;
  original_amount: number | null;
  closed_at: string | null;
};

type Payment = {
  id: string;
  receivable_id: string;
  amount: number;
  payment_method: string | null;
  reference_no: string | null;
  note: string | null;
  received_at: string;
};

const methodLabel = (v: string | null) =>
  ({ cash: "Cash", upi: "UPI / GPay", card: "Card", bank: "Bank Transfer", cheque: "Cheque", other: "Other" }[v || ""] || v || "—");

const localDate = (v: string | null) => v ? new Date(v).toLocaleDateString("en-IN") : "—";

export default function AdminSalesmanReport() {
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState<Q[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [deliveredIds, setDeliveredIds] = useState<Set<string>>(new Set());
  const [selectedSalesman, setSelectedSalesman] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<"all" | "month">("all");
  const [staffOptions, setStaffOptions] = useState<string[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [qRes, rRes, pRes, tripRes] = await Promise.all([
        supabase
          .from("quotations")
          .select("id, quotation_id, party_name, party_place, party_phone, quotation_date, expected_delivery_date, salesperson_name, total, advance_amount, status, commercial_status, document_type")
          .is("deleted_at", null),
        supabase
          .from("receivables")
          .select("id, quotation_id, pending_amount, original_amount, closed_at")
          .eq("source", "quotation"),
        supabase
          .from("receivable_payments")
          .select("id, receivable_id, amount, payment_method, reference_no, note, received_at")
          .order("received_at", { ascending: false }),
        supabase
          .from("trip_quotations")
          .select("quotation_id, delivered_at, trips:trip_id(status)")
      ]);

      if (!active) return;

      const delivered = new Set<string>();
      for (const x of (tripRes.data ?? []) as any[]) {
        if (x.delivered_at || x.trips?.status === "delivered") delivered.add(x.quotation_id);
      }

      setQuotations(((qRes.data ?? []) as Q[]).filter(q => (q.document_type ?? "quotation") !== "po"));
      setReceivables((rRes.data ?? []) as Receivable[]);
      setPayments((pRes.data ?? []) as Payment[]);
      setDeliveredIds(delivered);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke("list-staff-users");
      if (cancelled || error) return;
      const users = (data?.users ?? []) as Array<{ display_name?: string | null; email?: string | null; role?: string | null }>;
      const names = users
        .filter((u) => u.role && u.role !== "delivery")
        .map((u) => (u.display_name || u.email || "").trim())
        .filter(Boolean);
      setStaffOptions(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)));
    })();
    return () => { cancelled = true; };
  }, []);

  const assignSalesman = async (quotationId: string, name: string) => {
    if (!name) return;
    setAssigningId(quotationId);
    const { error } = await supabase
      .from("quotations")
      .update({ salesperson_name: name, updated_at: new Date().toISOString() })
      .eq("id", quotationId);
    if (error) {
      toast({ title: "Salesman assign failed", description: error.message, variant: "destructive" });
      setAssigningId(null);
      return;
    }
    setQuotations((prev) => prev.map((q) => q.id === quotationId ? { ...q, salesperson_name: name } : q));
    toast({ title: "Salesman assigned", description: name });
    setAssigningId(null);
  };

  const monthPrefix = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const scopedQuotes = useMemo(() => {
    let out = quotations;
    if (period === "month") out = out.filter(q => (q.quotation_date ?? "").startsWith(monthPrefix));
    const s = search.trim().toLowerCase();
    if (s) {
      out = out.filter(q =>
        q.quotation_id.toLowerCase().includes(s) ||
        q.party_name.toLowerCase().includes(s) ||
        q.party_place.toLowerCase().includes(s) ||
        (q.salesperson_name ?? "").toLowerCase().includes(s)
      );
    }
    return out;
  }, [quotations, period, monthPrefix, search]);

  const recByQuote = useMemo(() => {
    const m = new Map<string, Receivable>();
    for (const r of receivables) if (r.quotation_id) m.set(r.quotation_id, r);
    return m;
  }, [receivables]);

  const paymentsByReceivable = useMemo(() => {
    const m = new Map<string, Payment[]>();
    for (const p of payments) m.set(p.receivable_id, [...(m.get(p.receivable_id) ?? []), p]);
    return m;
  }, [payments]);

  const quotePayment = (q: Q) => {
    const r = recByQuote.get(q.id);
    const total = Number(q.total || 0);
    const advance = Math.max(0, Number(q.advance_amount || 0));
    if (r) {
      const original = Number(r.original_amount ?? total);
      const pending = Math.max(0, Number(r.pending_amount || 0));
      return { received: Math.max(0, original - pending), pending, receivable: r };
    }
    return { received: Math.min(total, advance), pending: Math.max(0, total - advance), receivable: null as Receivable | null };
  };

  const groups = useMemo(() => {
    const map = new Map<string, Q[]>();
    for (const q of scopedQuotes) {
      const name = (q.salesperson_name || "Unassigned").trim() || "Unassigned";
      map.set(name, [...(map.get(name) ?? []), q]);
    }
    return Array.from(map.entries()).map(([name, qs]) => {
      let sales = 0, received = 0, pending = 0, deliveryPending = 0;
      for (const q of qs) {
        sales += Number(q.total || 0);
        const p = quotePayment(q);
        received += p.received;
        pending += p.pending;
        if (q.expected_delivery_date && !deliveredIds.has(q.id)) deliveryPending++;
      }
      return { name, qs, sales, received, pending, deliveryPending };
    }).sort((a,b) => a.name.localeCompare(b.name));
  }, [scopedQuotes, recByQuote, deliveredIds]);

  const selected = useMemo(
    () => selectedSalesman ? groups.find(g => g.name === selectedSalesman) ?? null : null,
    [groups, selectedSalesman]
  );

  useEffect(() => {
    if (selectedSalesman && !groups.some(g => g.name === selectedSalesman)) setSelectedSalesman(null);
  }, [groups, selectedSalesman]);

  const selectedPayments = useMemo(() => {
    if (!selected) return [];
    const quoteById = new Map(selected.qs.map(q => [q.id, q]));
    const rows: Array<{ payment: Payment; quote: Q }> = [];
    for (const r of receivables) {
      if (!r.quotation_id) continue;
      const q = quoteById.get(r.quotation_id);
      if (!q) continue;
      for (const p of paymentsByReceivable.get(r.id) ?? []) rows.push({ payment: p, quote: q });
    }
    return rows.sort((a,b) => new Date(b.payment.received_at).getTime() - new Date(a.payment.received_at).getTime());
  }, [selected, receivables, paymentsByReceivable]);

  return (
    <AdminShell>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Salesman-wise Reports</h1>
            <p className="mt-1 text-sm text-muted-foreground">Quotation, delivery and payment status grouped by salesperson.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search salesman / quotation / customer" className="pl-9" />
            </div>
            <div className="flex rounded-lg border p-1">
              <Button size="sm" variant={period === "all" ? "default" : "ghost"} onClick={() => setPeriod("all")}>All</Button>
              <Button size="sm" variant={period === "month" ? "default" : "ghost"} onClick={() => setPeriod("month")}>This Month</Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : selected ? (
          <div className="space-y-4">
            <Button variant="ghost" className="px-1" onClick={() => setSelectedSalesman(null)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> All salesmen
            </Button>

            <Card className="border-primary/30 bg-primary/[0.03]">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold">{selected.name}</h2></div>
                    <p className="mt-1 text-sm text-muted-foreground">{selected.qs.length} quotations in current filter</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border bg-background p-3"><div className="text-[11px] text-muted-foreground">Sales</div><div className="font-semibold">{formatINR(selected.sales)}</div></div>
                    <div className="rounded-lg border bg-emerald-50/60 p-3 dark:bg-emerald-950/20"><div className="text-[11px] text-muted-foreground">Received</div><div className="font-semibold text-emerald-700 dark:text-emerald-300">{formatINR(selected.received)}</div></div>
                    <div className="rounded-lg border bg-red-50/60 p-3 dark:bg-red-950/20"><div className="text-[11px] text-muted-foreground">Payment Pending</div><div className="font-semibold text-red-700 dark:text-red-300">{formatINR(selected.pending)}</div></div>
                    <div className="rounded-lg border bg-amber-50/60 p-3 dark:bg-amber-950/20"><div className="text-[11px] text-muted-foreground">Delivery Pending</div><div className="font-semibold">{selected.deliveryPending}</div></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="quotations">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="quotations"><FileText className="mr-2 h-4 w-4" /> Quotations</TabsTrigger>
                <TabsTrigger value="payments"><WalletCards className="mr-2 h-4 w-4" /> Payments</TabsTrigger>
              </TabsList>

              <TabsContent value="quotations" className="mt-4">
                <div className="grid gap-3">
                  {selected.qs
                    .slice()
                    .sort((a,b) => (b.quotation_date ?? "").localeCompare(a.quotation_date ?? ""))
                    .map(q => {
                      const pay = quotePayment(q);
                      const deliveryPending = !!q.expected_delivery_date && !deliveredIds.has(q.id);
                      return (
                        <Card key={q.id}>
                          <CardContent className="p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-bold">{q.quotation_id}</span>
                                  {deliveryPending && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300"><CalendarDays className="mr-1 h-3 w-3" />Delivery Pending</Badge>}
                                  {pay.pending > 0 && <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Payment Pending</Badge>}
                                </div>
                                <div className="mt-1 font-semibold">{q.party_name} · {q.party_place}</div>
                                <div className="mt-1 text-xs text-muted-foreground">Quotation: {localDate(q.quotation_date)} · Delivery: {localDate(q.expected_delivery_date)}</div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-right text-sm lg:min-w-[420px]">
                                <div className="rounded-lg border p-2"><div className="text-[10px] text-muted-foreground">Total</div><div className="font-semibold">{formatINR(Number(q.total || 0))}</div></div>
                                <div className="rounded-lg border bg-emerald-50/50 p-2 dark:bg-emerald-950/20"><div className="text-[10px] text-muted-foreground">Received</div><div className="font-semibold">{formatINR(pay.received)}</div></div>
                                <div className="rounded-lg border bg-red-50/50 p-2 dark:bg-red-950/20"><div className="text-[10px] text-muted-foreground">Pending</div><div className="font-semibold">{formatINR(pay.pending)}</div></div>
                              </div>
                              <div className="flex flex-col gap-2 sm:flex-row">
                                {selected.name === "Unassigned" && (
                                  <div className="min-w-[210px]">
                                    <SearchableSelect
                                      value=""
                                      onChange={(v) => assignSalesman(q.id, v)}
                                      options={staffOptions.map((s) => ({ value: s, label: s }))}
                                      placeholder={assigningId === q.id ? "Assigning…" : "Assign salesman…"}
                                      emptyText="No staff found"
                                    />
                                  </div>
                                )}
                                <Button asChild size="sm" variant="outline"><Link to={`/admin/quotations/${q.id}/preview`}>Preview</Link></Button>
                                <Button asChild size="sm"><Link to={`/admin/quotations/${q.id}`}>Open</Link></Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </TabsContent>

              <TabsContent value="payments" className="mt-4">
                <div className="grid gap-3">
                  {selected.qs.map(q => {
                    const pay = quotePayment(q);
                    return (
                      <Card key={q.id}>
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="font-mono text-xs font-bold">{q.quotation_id}</div>
                              <div className="font-semibold">{q.party_name}</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">Received {formatINR(pay.received)}</Badge>
                              <Badge variant={pay.pending > 0 ? "destructive" : "secondary"}>Pending {formatINR(pay.pending)}</Badge>
                              <Button asChild size="sm" variant="outline"><Link to={`/admin/quotations/${q.id}`}>Open Quotation</Link></Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  <div className="pt-2">
                    <h3 className="mb-3 font-display text-lg font-semibold">Payment History</h3>
                    {selectedPayments.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No payment entries recorded for this salesman in the current view.</div>
                    ) : selectedPayments.map(({payment, quote}) => (
                      <div key={payment.id} className="mb-2 flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-semibold">{quote.party_name} <span className="font-mono text-xs text-muted-foreground">· {quote.quotation_id}</span></div>
                          <div className="text-xs text-muted-foreground">{localDate(payment.received_at)} · {methodLabel(payment.payment_method)}{payment.reference_no ? ` · Ref: ${payment.reference_no}` : ""}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-300">{formatINR(Number(payment.amount || 0))}</span>
                          <Button asChild size="sm" variant="ghost"><Link to={`/admin/quotations/${quote.id}`}>Open</Link></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map(g => (
                <button key={g.name} type="button" onClick={() => setSelectedSalesman(g.name)} className="text-left">
                  <Card className="h-full border-2 border-primary/15 transition hover:border-primary/40 hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10"><UserRound className="h-4 w-4 text-primary" /></span>
                          <div className="min-w-0">
                            <div className="truncate font-display text-lg font-bold">{g.name}</div>
                            <div className="text-xs text-muted-foreground">{g.qs.length} quotations</div>
                          </div>
                        </div>
                        <IndianRupee className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border p-2"><div className="text-[10px] text-muted-foreground">Total Sales</div><div className="font-semibold">{formatINR(g.sales)}</div></div>
                        <div className="rounded-lg border bg-red-50/60 p-2 dark:bg-red-950/20"><div className="text-[10px] text-muted-foreground">Payment Pending</div><div className="font-semibold text-red-700 dark:text-red-300">{formatINR(g.pending)}</div></div>
                        <div className="rounded-lg border bg-emerald-50/60 p-2 dark:bg-emerald-950/20"><div className="text-[10px] text-muted-foreground">Received</div><div className="font-semibold">{formatINR(g.received)}</div></div>
                        <div className="rounded-lg border bg-amber-50/60 p-2 dark:bg-amber-950/20"><div className="text-[10px] text-muted-foreground">Delivery Pending</div><div className="font-semibold">{g.deliveryPending}</div></div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
            {groups.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No salesman report data found for this filter.</div>}
          </>
        )}
      </div>
    </AdminShell>
  );
}
