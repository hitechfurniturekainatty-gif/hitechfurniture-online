import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, CalendarClock, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { MarkDeliveredButton } from "@/components/admin/MarkDeliveredDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/brand";
import { indiaDateKey } from "@/lib/deliveryPlanning";
import { followUpInDays, LOST_REASONS } from "@/lib/leadSource";

// Clean-up: one page to clear the three old piles that make lists untrustworthy —
// draft quotations older than 30 days, open leads with no next call, and confirmed
// orders whose delivery date has passed (or was never set). Every action here is
// a normal app action (reject quotation, set follow-up date / lost, mark delivered,
// new delivery date); nothing is deleted.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- some columns/functions are newer than the generated types
const db = supabase as any;

type Quote = { id: string; quotation_id: string | null; party_name: string | null; party_place: string | null; party_phone: string | null; total: number | null; created_at: string };
type Lead = { id: string; lead_code: string | null; customer_name: string; customer_place: string | null; customer_phone: string | null; requirement: string | null; status: string; created_at: string };
type Order = { id: string; quotation_id: string | null; party_name: string | null; party_place: string | null; total: number | null; advance_amount: number | null; expected_delivery_date: string | null };

const daysAgo = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86_400_000));
const fmtDate = (d: string | null) => d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "No date";

function CleanupPage() {
  const today = indiaDateKey();
  const [tab, setTab] = useState<"quotes" | "leads" | "orders">("quotes");
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState<string>(LOST_REASONS[2]);
  const [busy, setBusy] = useState(false);
  const [newDate, setNewDate] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [q, l, o] = await Promise.all([
      db.from("quotations").select("id,quotation_id,party_name,party_place,party_phone,total,created_at")
        .is("deleted_at", null).eq("status", "drafted").lt("created_at", cutoff).order("created_at", { ascending: true }).limit(500),
      db.from("sales_leads").select("id,lead_code,customer_name,customer_place,customer_phone,requirement,status,created_at")
        .in("status", ["pending", "contacted"]).is("next_follow_up_at", null).order("created_at", { ascending: true }).limit(500),
      db.from("quotations").select("id,quotation_id,party_name,party_place,total,advance_amount,expected_delivery_date,status,commercial_status,document_type")
        .is("deleted_at", null).not("status", "in", "(delivered,rejected)")
        .or("status.in.(finalized,completed),commercial_status.in.(confirmed,payment_pending)")
        .order("expected_delivery_date", { ascending: true, nullsFirst: true }).limit(500),
    ]);
    if (q.error) toast.error(q.error.message); else setQuotes(q.data ?? []);
    if (l.error) toast.error(l.error.message); else setLeads(l.data ?? []);
    if (o.error) toast.error(o.error.message);
    else setOrders(((o.data ?? []) as (Order & { document_type?: string | null })[])
      .filter((r) => (r.document_type ?? "quotation") !== "po" && (!r.expected_delivery_date || r.expected_delivery_date.slice(0, 10) < today)));
    setPicked(new Set());
    setLoading(false);
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = tab === "quotes" ? quotes : tab === "leads" ? leads : orders;
  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const switchTab = (t: typeof tab) => { setTab(t); setPicked(new Set()); };
  const ids = useMemo(() => Array.from(picked), [picked]);

  const run = async (label: string, work: () => Promise<{ ok: number; fail: number }>) => {
    if (!ids.length) return toast.error("ആദ്യം rows tick ചെയ്യുക");
    if (!window.confirm(`${ids.length} എണ്ണം: ${label}?`)) return;
    setBusy(true);
    const { ok, fail } = await work();
    setBusy(false);
    if (fail) toast.error(`${ok} done, ${fail} failed`); else toast.success(`${ok} done`);
    void load();
  };

  const rejectQuotes = () => run("Lost ആക്കുക (quotation reject)", async () => {
    let ok = 0, fail = 0;
    for (const id of ids) { const r = await db.rpc("reject_quotation", { _quotation_id: id }); if (r.error) fail++; else ok++; }
    return { ok, fail };
  });
  const leadsNext = (days: number) => run(`അടുത്ത call ${days} ദിവസം കഴിഞ്ഞ്`, async () => {
    const at = new Date(followUpInDays(days)).toISOString();
    const r = await db.from("sales_leads").update({ next_follow_up_at: at }).in("id", ids);
    return r.error ? { ok: 0, fail: ids.length } : { ok: ids.length, fail: 0 };
  });
  const leadsLost = () => run(`Lost ആക്കുക (${reason.split(" · ")[1] ?? reason})`, async () => {
    const r = await db.from("sales_leads").update({ status: "lost", lost_reason: reason }).in("id", ids);
    return r.error ? { ok: 0, fail: ids.length } : { ok: ids.length, fail: 0 };
  });
  const setOrderDate = async (o: Order) => {
    const d = newDate[o.id];
    if (!d) return;
    if (d < today) return toast.error("പുതിയ തീയതി ഇന്നോ അതിന് ശേഷമോ ആകണം");
    const r = await db.from("quotations").update({ expected_delivery_date: d }).eq("id", o.id);
    if (r.error) return toast.error(r.error.message);
    toast.success("Delivery date saved"); void load();
  };

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="admin-page-head flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="admin-accent-tile admin-accent-blush flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"><Sparkles className="h-5 w-5" /></div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl">Clean-up</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">പഴയതും തീരുമാനമാകാത്തതുമായ records ഇവിടെ ഒറ്റയടിക്ക് തീർക്കാം. ഒന്നും delete ആകില്ല. Lists വൃത്തിയായാൽ My work-ഉം alerts-ഉം ശരിയായ കാര്യങ്ങൾ മാത്രം കാണിക്കും.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="mr-2 h-4 w-4" />Refresh</>}</Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => switchTab(v as typeof tab)}>
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="quotes">Old quotations ({quotes.length})</TabsTrigger>
            <TabsTrigger value="leads">Leads without next call ({leads.length})</TabsTrigger>
            <TabsTrigger value="orders">Orders past date ({orders.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        <p className="text-sm text-muted-foreground">
          {tab === "quotes" && "30 ദിവസത്തിൽ കൂടുതൽ പഴക്കമുള്ള, confirm ആകാത്ത quotations. Customer ഇനി വാങ്ങില്ലെങ്കിൽ tick ചെയ്ത് Lost ആക്കുക. വാങ്ങാൻ സാധ്യതയുണ്ടെങ്കിൽ തുറന്ന് follow-up ചെയ്യുക."}
          {tab === "leads" && "അടുത്ത call date ഇല്ലാത്ത open leads. ആരും ഇവരെ വിളിക്കില്ല. Tick ചെയ്ത് call date ഇടുക, അല്ലെങ്കിൽ കാരണം സഹിതം Lost ആക്കുക."}
          {tab === "orders" && "Delivery date കഴിഞ്ഞിട്ടും Delivered ആക്കാത്തതോ date ഇല്ലാത്തതോ ആയ confirmed orders. Deliver ചെയ്തതാണെങ്കിൽ Mark delivered, ഇല്ലെങ്കിൽ പുതിയ date ഇടുക."}
        </p>

        {tab !== "orders" && rows.length > 0 && (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={allPicked} onCheckedChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.id)))} />All ({picked.size} ticked)</label>
            {tab === "quotes" && <Button size="sm" variant="destructive" disabled={busy || !picked.size} onClick={() => void rejectQuotes()}><XCircle className="mr-1 h-4 w-4" />Lost ആക്കുക</Button>}
            {tab === "leads" && <>
              <Button size="sm" variant="outline" disabled={busy || !picked.size} onClick={() => void leadsNext(1)}><CalendarClock className="mr-1 h-4 w-4" />നാളെ വിളിക്കുക</Button>
              <Button size="sm" variant="outline" disabled={busy || !picked.size} onClick={() => void leadsNext(3)}>3 ദിവസം</Button>
              <Button size="sm" variant="outline" disabled={busy || !picked.size} onClick={() => void leadsNext(7)}>1 ആഴ്ച</Button>
              <select aria-label="Lost reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <Button size="sm" variant="destructive" disabled={busy || !picked.size} onClick={() => void leadsLost()}><XCircle className="mr-1 h-4 w-4" />Lost ആക്കുക</Button>
            </>}
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        )}

        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          : rows.length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 h-6 w-6" />ഇവിടെ തീർക്കാൻ ഒന്നുമില്ല.</div>
          : (
            <div className="divide-y rounded-xl border bg-card">
              {tab === "quotes" && quotes.map((q) => (
                <label key={q.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                  <Checkbox checked={picked.has(q.id)} onCheckedChange={() => toggle(q.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{q.party_name ?? "Customer"}{q.party_place ? ` · ${q.party_place}` : ""}</p>
                    <p className="truncate text-xs text-muted-foreground">{q.quotation_id ?? ""}{q.party_phone ? ` · ${q.party_phone}` : ""} · {daysAgo(q.created_at)} days old</p>
                  </div>
                  <span className="shrink-0 font-medium">{formatINR(Number(q.total ?? 0))}</span>
                  <Button asChild size="sm" variant="ghost" onClick={(e) => e.stopPropagation()}><Link to={`/admin/quotations/${q.id}`}>Open</Link></Button>
                </label>
              ))}
              {tab === "leads" && leads.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                  <Checkbox checked={picked.has(l.id)} onCheckedChange={() => toggle(l.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.customer_name}{l.customer_place ? ` · ${l.customer_place}` : ""} <Badge variant="outline" className="ml-1">{l.status}</Badge></p>
                    <p className="truncate text-xs text-muted-foreground">{l.lead_code ?? ""}{l.customer_phone ? ` · ${l.customer_phone}` : ""} · {daysAgo(l.created_at)} days old{l.requirement ? ` · ${l.requirement}` : ""}</p>
                  </div>
                  <Button asChild size="sm" variant="ghost" onClick={(e) => e.stopPropagation()}><Link to={`/admin/leads?open=${l.id}`}>Open</Link></Button>
                </label>
              ))}
              {tab === "orders" && orders.map((o) => {
                const balance = Math.max(Number(o.total ?? 0) - Number(o.advance_amount ?? 0), 0);
                return (
                  <div key={o.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{o.party_name ?? "Customer"}{o.party_place ? ` · ${o.party_place}` : ""}</p>
                      <p className="truncate text-xs text-muted-foreground">{o.quotation_id ?? ""} · balance {formatINR(balance)}</p>
                    </div>
                    <Badge variant={o.expected_delivery_date ? "destructive" : "outline"}>{o.expected_delivery_date ? `Due ${fmtDate(o.expected_delivery_date)}` : "No date"}</Badge>
                    <MarkDeliveredButton quotationId={o.id} onDone={() => void load()} />
                    <Input type="date" min={today} className="h-9 w-40" aria-label="New delivery date" value={newDate[o.id] ?? ""} onChange={(e) => setNewDate((m) => ({ ...m, [o.id]: e.target.value }))} />
                    <Button size="sm" variant="outline" disabled={!newDate[o.id]} onClick={() => void setOrderDate(o)}>New date</Button>
                    <Button asChild size="sm" variant="ghost"><Link to={`/admin/quotations/${o.id}`}>Open</Link></Button>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </AdminShell>
  );
}

export default CleanupPage;
