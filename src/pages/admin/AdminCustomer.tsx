import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { OfficeStaffOnly } from "@/components/admin/OfficeStaffOnly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { leadSourceLabel } from "@/lib/leadSource";

type Row = Record<string, any>;
type History = { ok: boolean; error?: string; phone_key?: string; leads: Row[]; quotations: Row[]; complaints: Row[]; services: Row[]; receivables: Row[] };

const money = (n: unknown) => `₹${Number(n ?? 0).toLocaleString("en-IN")}`;
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const waLink = (phone: string) => { const d = phone.replace(/\D/g, ""); return `https://wa.me/${d.length === 10 ? `91${d}` : d}`; };

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <section className="rounded-xl border bg-card p-3">
    <h2 className="mb-2 font-semibold">{title} <span className="text-sm text-muted-foreground">({count})</span></h2>
    {count ? <div className="space-y-2">{children}</div> : <p className="text-sm text-muted-foreground">ഒന്നുമില്ല</p>}
  </section>;
}

function CustomerPage() {
  const [params, setParams] = useSearchParams();
  const [phone, setPhone] = useState(params.get("phone") ?? "");
  const [data, setData] = useState<History | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = async (p: string) => {
    if (!p.replace(/\D/g, "")) return;
    setLoading(true); setError(""); setData(null);
    const r = await (supabase as any).rpc("customer_history", { p_phone: p });
    setLoading(false);
    if (r.error) return setError(r.error.message);
    if (!r.data?.ok) return setError(r.data?.error || "Could not load");
    setData(r.data);
  };
  useEffect(() => { const p = params.get("phone"); if (p) void search(p); }, []);

  const names = data ? [...new Set([...data.leads.map(x => x.customer_name), ...data.quotations.map(x => x.party_name), ...data.complaints.map(x => x.customer_name), ...data.services.map(x => x.customer_name), ...data.receivables.map(x => x.customer_name)].filter(Boolean))] : [];
  const place = data ? (data.leads.find(x => x.customer_place)?.customer_place || data.quotations.find(x => x.party_place)?.party_place) : null;
  const orderValue = data ? data.quotations.filter(q => !["lead", "lost", "quote_preparation", "quote_sent", "follow_up"].includes(q.commercial_status)).reduce((s, q) => s + Number(q.total || 0), 0) : 0;
  const pending = data ? data.receivables.filter(r => !r.closed_at).reduce((s, r) => s + Number(r.pending_amount || 0), 0) : 0;
  const empty = data && !data.leads.length && !data.quotations.length && !data.complaints.length && !data.services.length && !data.receivables.length;

  return <AdminShell><div className="space-y-4">
    <div><h1 className="font-display text-2xl">Customer history</h1><p className="text-sm text-muted-foreground">Phone number അടിച്ചാൽ ആ customer-ന്റെ leads, quotations, complaints, service, payment എല്ലാം ഒരിടത്ത്.</p></div>
    <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setParams(phone ? { phone } : {}, { replace: true }); void search(phone); }}>
      <Input className="sm:w-64" inputMode="tel" aria-label="Customer phone" placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)} />
      <Button type="submit" disabled={loading}>{loading ? "Searching…" : "Search"}</Button>
    </form>
    {error && <div role="alert" className="rounded-lg border border-red-300 p-3 text-sm">{error}</div>}
    {empty && <p className="text-sm">ഈ number-ൽ ഒരു record-ഉം ഇല്ല. <Link className="underline" to={`/admin/leads?new=1&phone=${encodeURIComponent(phone)}`}>പുതിയ lead ഉണ്ടാക്കുക</Link></p>}
    {data && !empty && <>
      <div className="rounded-xl border-2 bg-card p-4">
        <h2 className="text-xl font-semibold">{names[0] || "Customer"}{place ? ` · ${place}` : ""}</h2>
        {names.length > 1 && <p className="text-xs text-muted-foreground">മറ്റ് പേരുകൾ: {names.slice(1).join(", ")}</p>}
        <p className="text-sm">{phone}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">Leads {data.leads.length}</Badge><Badge variant="outline">Quotations {data.quotations.length}</Badge>
          {orderValue > 0 && <Badge>Orders {money(orderValue)}</Badge>}{pending > 0 && <Badge variant="destructive">Pending {money(pending)}</Badge>}
          {data.complaints.length > 0 && <Badge variant="secondary">Complaints {data.complaints.length}</Badge>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline"><a href={`tel:${phone}`}>Call</a></Button>
          <Button asChild size="sm" variant="outline"><a href={waLink(phone)} target="_blank" rel="noreferrer">WhatsApp</a></Button>
          <Button asChild size="sm"><Link to={`/admin/leads?new=1&phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(names[0] || "")}`}>+ New lead</Link></Button>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="Leads" count={data.leads.length}>{data.leads.map(l => <Link key={l.id} to={`/admin/leads?open=${l.id}`} className="block rounded-lg border p-2 text-sm hover:bg-muted">
          <div className="flex flex-wrap gap-1"><b>{l.lead_code}</b><Badge variant="outline">{l.status}</Badge><Badge variant="secondary">{leadSourceLabel(l.source)}</Badge></div>
          <p className="line-clamp-2 text-muted-foreground">{l.requirement}</p>
          <p className="text-xs text-muted-foreground">{day(l.created_at)} · {l.followups} follow-ups{l.lost_reason ? ` · ${l.lost_reason}` : ""}</p></Link>)}</Section>
        <Section title="Quotations & orders" count={data.quotations.length}>{data.quotations.map(q => <Link key={q.id} to={`/admin/quotations/${q.id}`} className="block rounded-lg border p-2 text-sm hover:bg-muted">
          <div className="flex flex-wrap justify-between gap-1"><b>{q.quotation_id}</b><span>{money(q.total)}</span></div>
          <p className="text-xs text-muted-foreground">{day(q.created_at)} · {q.commercial_status?.replace(/_/g, " ")} · stage {q.pipeline_stage}</p></Link>)}</Section>
        <Section title="Payments due" count={data.receivables.length}>{data.receivables.map(r => <div key={r.id} className="rounded-lg border p-2 text-sm">
          <div className="flex justify-between gap-1"><b>{r.bill_no || "Bill"}</b><span>{r.closed_at ? "Closed" : `Pending ${money(r.pending_amount)}`}</span></div>
          <p className="text-xs text-muted-foreground">Total {money(r.original_amount)}{r.next_follow_up_at ? ` · next call ${day(r.next_follow_up_at)}` : ""}</p></div>)}</Section>
        <Section title="Complaints & service" count={data.complaints.length + data.services.length}>
          {data.complaints.map(c => <div key={c.id} className="rounded-lg border p-2 text-sm"><div className="flex gap-1"><b>{c.complaint_code}</b><Badge variant="outline">{c.status}</Badge></div><p className="line-clamp-2 text-muted-foreground">{c.issue_description}</p><p className="text-xs text-muted-foreground">{day(c.created_at)}</p></div>)}
          {data.services.map(s => <div key={s.id} className="rounded-lg border p-2 text-sm"><div className="flex gap-1"><b>{s.service_code}</b><Badge variant="outline">{s.status}</Badge></div><p className="line-clamp-2 text-muted-foreground">{s.work_needed}</p><p className="text-xs text-muted-foreground">{day(s.created_at)}</p></div>)}
        </Section>
      </div>
    </>}
  </div></AdminShell>;
}

export default function AdminCustomer() { return <OfficeStaffOnly><CustomerPage /></OfficeStaffOnly>; }
