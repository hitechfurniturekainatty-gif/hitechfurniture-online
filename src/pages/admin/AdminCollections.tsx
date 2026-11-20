import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { OfficeStaffOnly } from "@/components/admin/OfficeStaffOnly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatINR } from "@/lib/brand";

type Row = { id: string; quotation_id: string; amount: number; method: string; reference_no: string | null; promise_date: string | null; note: string | null; collected_by: string; collected_at: string; status: string; verified_at: string | null; verify_note: string | null; quotations: { quotation_id: string; party_name: string; party_place: string } | null };
const METHOD_LABEL: Record<string, string> = { cash: "💵 Cash", upi: "📱 UPI", cheque: "🧾 Cheque", card: "💳 Card", none: "❌ കിട്ടിയില്ല" };

function CollectionsPage() {
  const [rows, setRows] = useState<Row[]>([]); const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "done">("pending"); const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const r = await (supabase as any).from("delivery_collections")
      .select("id,quotation_id,amount,method,reference_no,promise_date,note,collected_by,collected_at,status,verified_at,verify_note,quotations(quotation_id,party_name,party_place)")
      .or(`status.eq.pending,collected_at.gte.${since}`).order("collected_at", { ascending: false }).limit(500);
    if (r.error) toast.error(r.error.message); else setRows(r.data ?? []);
    const p = await supabase.from("profiles").select("user_id,display_name");
    if (!p.error) setNames(Object.fromEntries((p.data ?? []).map(x => [x.user_id, x.display_name || "Staff"])));
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const pending = rows.filter(r => r.status === "pending");
  const byDriver = useMemo(() => {
    const m: Record<string, { name: string; total: number; byMethod: Record<string, number>; count: number }> = {};
    for (const r of pending) {
      const k = r.collected_by; m[k] ??= { name: names[k] || "Driver", total: 0, byMethod: {}, count: 0 };
      m[k].total += Number(r.amount); m[k].count++; m[k].byMethod[r.method] = (m[k].byMethod[r.method] ?? 0) + Number(r.amount);
    }
    return Object.values(m);
  }, [pending, names]);

  const act = async (r: Row, accept: boolean) => {
    if (busy) return;
    if (accept && r.method === "cash" && !window.confirm(`${formatINR(Number(r.amount))} cash എണ്ണി കൈയിൽ കിട്ടിയോ?`)) return;
    if (!accept && !(notes[r.id] ?? "").trim()) return toast.error("Reject ചെയ്യുന്നതിന്റെ കാരണം എഴുതുക");
    setBusy(r.id);
    const res = await (supabase as any).rpc("verify_delivery_collection", { p_id: r.id, p_accept: accept, p_note: notes[r.id] ?? null });
    setBusy(null);
    if (res.error || !res.data?.ok) return toast.error(res.error?.message || res.data?.error || "Failed");
    toast.success(accept ? "Verified: customer balance updated" : "Rejected"); void load();
  };

  const list = tab === "pending" ? pending : rows.filter(r => r.status !== "pending");
  return <AdminShell><div className="space-y-4">
    <div><h1 className="font-display text-2xl">Delivery Collections</h1><p className="text-sm text-muted-foreground">Driver delivery-യിൽ രേഖപ്പെടുത്തിയ payment. Cash എണ്ണി / UPI ഉറപ്പാക്കി <b>Verify</b> ചെയ്യുമ്പോൾ മാത്രം customer balance കുറയും.</p></div>
    {byDriver.length > 0 && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{byDriver.map(d =>
      <div key={d.name} className="rounded-xl border-2 border-amber-300 bg-amber-50/50 p-3 text-sm">
        <p className="font-semibold">{d.name} · {d.count} entries</p>
        <p className="text-xl font-bold">{formatINR(d.total)}</p>
        <p className="text-xs">{Object.entries(d.byMethod).filter(([m]) => m !== "none").map(([m, v]) => `${METHOD_LABEL[m] ?? m} ${formatINR(v)}`).join(" · ") || "—"}</p>
      </div>)}</div>}
    <div className="flex gap-2"><Button variant={tab === "pending" ? "default" : "outline"} onClick={() => setTab("pending")}>Verify ചെയ്യാൻ ({pending.length})</Button><Button variant={tab === "done" ? "default" : "outline"} onClick={() => setTab("done")}>കഴിഞ്ഞ 30 ദിവസം</Button><Button variant="ghost" onClick={load}>Refresh</Button></div>
    {loading ? <p>Loading…</p> : !list.length ? <p className="text-sm text-muted-foreground">ഒന്നുമില്ല.</p> :
      <div className="grid gap-3 lg:grid-cols-2">{list.map(r => <div key={r.id} className="space-y-2 rounded-xl border bg-card p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">{r.quotations?.party_name ?? "Customer"} · {r.quotations?.party_place ?? ""}</p>
          <Badge variant={r.status === "verified" ? "default" : r.status === "rejected" ? "destructive" : "outline"}>{r.status}</Badge>
        </div>
        <p className="text-lg font-bold">{r.method === "none" ? "Payment കിട്ടിയില്ല" : formatINR(Number(r.amount))} <span className="text-sm font-normal">{METHOD_LABEL[r.method] ?? r.method}</span></p>
        <p className="text-xs text-muted-foreground">{names[r.collected_by] || "Driver"} · {new Date(r.collected_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{r.reference_no ? ` · Ref ${r.reference_no}` : ""}{r.promise_date ? ` · ബാക്കി promise ${new Date(r.promise_date).toLocaleDateString("en-IN")}` : ""}</p>
        {r.note && <p className="text-xs">📝 {r.note}</p>}
        {r.verify_note && <p className="text-xs text-muted-foreground">Office: {r.verify_note}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline"><Link to={`/admin/quotations/${r.quotation_id}`}>{r.quotations?.quotation_id ?? "Order"}</Link></Button>
          {r.status === "pending" && <>
            <Input className="h-8 flex-1" placeholder="Note (reject-ന് നിർബന്ധം)" value={notes[r.id] ?? ""} onChange={e => setNotes({ ...notes, [r.id]: e.target.value })} />
            <Button size="sm" disabled={busy === r.id} onClick={() => act(r, true)}>✓ Verify</Button>
            <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => act(r, false)}>Reject</Button>
          </>}
        </div>
      </div>)}</div>}
  </div></AdminShell>;
}

export default function AdminCollections() { return <OfficeStaffOnly><CollectionsPage /></OfficeStaffOnly>; }
