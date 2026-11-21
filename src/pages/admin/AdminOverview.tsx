import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, Boxes, CalendarClock, ClipboardList, FileText, IndianRupee,
  ListTodo, Loader2, PhoneCall, Plus, Truck, Wallet, Wrench,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Home dashboard: what needs doing today, how the pipeline looks, and quick ways in.
// Every number links to the page where it can be acted on.

type Kind = "lead" | "quote" | "payment" | "task" | "collection";
type WorkItem = { id: string; kind: Kind; when: string | null; title: string; sub: string; amount?: number; href: string };
type Recent = { id: string; kind: "lead" | "quote"; at: string; title: string; sub: string; href: string };
type Hot = { id: string; code: string; name: string; place: string; total: number; next: string | null; status: string };
type StageRow = { stage: number; count: number; value: number };
type Data = {
  name: string;
  newLeadsToday: number; openLeads: number;
  followQuotes: number; followValue: number;
  ordersMonth: number; ordersMonthValue: number; ordersLastMonthValue: number;
  pendingAmount: number; overdueAccounts: number;
  deliveries7: number; deliveriesOverdue: number;
  lowStock: number; outStock: number; openServices: number;
  work: WorkItem[]; hot: Hot[]; stages: StageRow[]; recent: Recent[];
};

type LeadRow = { id: string; lead_code: string | null; customer_name: string | null; customer_place: string | null; requirement: string | null; status: string; next_follow_up_at: string | null; created_at: string };
type QuoteRow = { id: string; quotation_id: string | null; party_name: string | null; party_place: string | null; total: number | null; status: string; commercial_status: string | null; pipeline_stage: number | null; next_follow_up_at: string | null; expected_delivery_date: string | null; confirmed_at: string | null; created_at: string };
type RecvRow = { id: string; customer_name: string | null; place: string | null; pending_amount: number | null; next_follow_up_at: string | null };
type TaskRow = { id: string; title: string | null; due_date: string | null; priority: string | null };
type CollRow = { id: string; amount: number | null; method: string; collected_at: string; quotations: { party_name: string | null; party_place: string | null } | null };
type ProdRow = { stock_quantity: number | null; reorder_level: number | null };
type ServRow = { status: string };
// Untyped client: some of these tables/columns are newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const STAGES: Record<number, string> = { 1: "Enquiry", 2: "Measurement", 3: "Order (OPS)", 4: "Production", 5: "Warehouse", 6: "Delivery" };
const FOLLOW_STATUSES = ["follow_up", "quote_preparation", "payment_pending"];

const dayKey = (v?: string | null) => {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const keyOffset = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return dayKey(d.toISOString()); };
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const shortInr = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(n >= 1000000 ? 1 : 2)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : inr(n);
const shortDate = (v?: string | null) => v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

const AdminOverview = () => {
  const { isAdmin, isOfficeStaff, isMeasurementStaff, isDelivery, user, loading: authLoading } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<"overdue" | "today" | "upcoming" | null>(null);
  const office = isAdmin || isOfficeStaff;

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const lastMonthStart = new Date(monthStart); lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
      const [prof, leads, quotes, recv, tasks, colls, prods, servs] = await Promise.all([
        db.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
        office ? db.from("sales_leads").select("id,lead_code,customer_name,customer_place,requirement,status,next_follow_up_at,created_at").is("deleted_at", null) : { data: [] },
        office ? db.from("quotations").select("id,quotation_id,party_name,party_place,total,status,commercial_status,pipeline_stage,next_follow_up_at,expected_delivery_date,confirmed_at,created_at").is("deleted_at", null) : { data: [] },
        office ? db.from("receivables").select("id,customer_name,place,pending_amount,next_follow_up_at,closed_at").is("closed_at", null) : { data: [] },
        db.from("staff_diary_notes").select("id,title,due_date,status,owner_id,priority").is("deleted_at", null).eq("status", "pending").eq("owner_id", user.id),
        office ? db.from("delivery_collections").select("id,amount,method,collected_at,quotations(party_name,party_place)").eq("status", "pending") : { data: [] },
        office ? db.from("products").select("id,stock_quantity,reorder_level").is("deleted_at", null) : { data: [] },
        office ? db.from("customer_services").select("id,status").is("deleted_at", null) : { data: [] },
      ]);
      if (cancelled) return;
      const today = keyOffset(0), in7 = keyOffset(7);
      const L = (leads.data ?? []) as LeadRow[], Q = (quotes.data ?? []) as QuoteRow[], R = (recv.data ?? []) as RecvRow[];
      const T = (tasks.data ?? []) as TaskRow[], C = (colls.data ?? []) as CollRow[], P = (prods.data ?? []) as ProdRow[], S = (servs.data ?? []) as ServRow[];

      const openLeads = L.filter(l => ["pending", "contacted"].includes(l.status));
      const liveQ = Q.filter(q => !["rejected", "delivered"].includes(q.status) && !["lost", "closed"].includes(q.commercial_status));
      const followQ = liveQ.filter(q => FOLLOW_STATUSES.includes(q.commercial_status));
      const confirmedAt = (q: QuoteRow) => q.confirmed_at ? new Date(q.confirmed_at) : null;
      const monthOrders = Q.filter(q => { const d = confirmedAt(q); return d && d >= monthStart; });
      const lastMonthOrders = Q.filter(q => { const d = confirmedAt(q); return d && d >= lastMonthStart && d < monthStart; });
      const deliv = liveQ.filter(q => q.expected_delivery_date && (q.commercial_status === "confirmed" || Number(q.pipeline_stage ?? 0) >= 3));

      const work: WorkItem[] = [
        ...openLeads.filter(l => l.next_follow_up_at).map(l => ({ id: `l${l.id}`, kind: "lead" as const, when: l.next_follow_up_at, title: `Call ${l.customer_name || "customer"}`, sub: [l.customer_place, l.requirement].filter(Boolean).join(" · ").slice(0, 80), href: `/admin/leads?open=${l.id}` })),
        ...followQ.filter(q => q.next_follow_up_at).map(q => ({ id: `q${q.id}`, kind: "quote" as const, when: q.next_follow_up_at, title: `Follow up quotation · ${q.party_name || "customer"}`, sub: q.quotation_id || q.party_place || "", amount: Number(q.total ?? 0), href: `/admin/quotations/${q.id}` })),
        ...R.filter(r => r.next_follow_up_at && Number(r.pending_amount) > 0).map(r => ({ id: `r${r.id}`, kind: "payment" as const, when: r.next_follow_up_at, title: `Collect payment · ${r.customer_name || "customer"}`, sub: r.place ?? "", amount: Number(r.pending_amount ?? 0), href: "/admin/backlog" })),
        ...T.map(t => ({ id: `t${t.id}`, kind: "task" as const, when: t.due_date, title: t.title || "Task", sub: t.priority === "high" ? "High priority" : "My task", href: `/admin/diary?note=${t.id}` })),
        ...C.map(c => ({ id: `c${c.id}`, kind: "collection" as const, when: c.collected_at, title: `Verify ${c.method === "none" ? "unpaid delivery" : "delivery payment"} · ${c.quotations?.party_name ?? "customer"}`, sub: c.quotations?.party_place ?? "", amount: Number(c.amount ?? 0), href: "/admin/collections" })),
      ];

      const stages: StageRow[] = [1, 2, 3, 4, 5, 6].map(s => {
        const rows = liveQ.filter(q => Number(q.pipeline_stage ?? 1) === s);
        return { stage: s, count: rows.length, value: rows.reduce((a, q) => a + Number(q.total ?? 0), 0) };
      });

      const recent: Recent[] = [
        ...L.map(l => ({ id: `l${l.id}`, kind: "lead" as const, at: l.created_at, title: `New enquiry · ${l.customer_name || "customer"}`, sub: [l.lead_code, l.customer_place].filter(Boolean).join(" · "), href: `/admin/leads?open=${l.id}` })),
        ...Q.map(q => ({ id: `q${q.id}`, kind: "quote" as const, at: q.created_at, title: `Quotation · ${q.party_name || "customer"}`, sub: [q.quotation_id, Number(q.total) ? inr(Number(q.total)) : ""].filter(Boolean).join(" · "), href: `/admin/quotations/${q.id}` })),
      ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "")).slice(0, 8);

      setData({
        name: prof.data?.display_name || (user.email ?? "").split("@")[0],
        newLeadsToday: L.filter(l => dayKey(l.created_at) === today).length,
        openLeads: openLeads.length,
        followQuotes: followQ.length,
        followValue: followQ.reduce((a, q) => a + Number(q.total ?? 0), 0),
        ordersMonth: monthOrders.length,
        ordersMonthValue: monthOrders.reduce((a, q) => a + Number(q.total ?? 0), 0),
        ordersLastMonthValue: lastMonthOrders.reduce((a, q) => a + Number(q.total ?? 0), 0),
        pendingAmount: R.reduce((a, r) => a + Number(r.pending_amount ?? 0), 0),
        overdueAccounts: R.filter(r => r.next_follow_up_at && dayKey(r.next_follow_up_at) < today).length,
        deliveries7: deliv.filter(q => { const d = dayKey(q.expected_delivery_date); return d >= today && d <= in7; }).length,
        deliveriesOverdue: deliv.filter(q => dayKey(q.expected_delivery_date) < today).length,
        lowStock: P.filter(p => Number(p.stock_quantity ?? 0) > 0 && Number(p.stock_quantity ?? 0) <= Number(p.reorder_level ?? 0)).length,
        outStock: P.filter(p => Number(p.stock_quantity ?? 0) <= 0).length,
        openServices: S.filter(s => !["resolved", "closed", "completed"].includes(s.status)).length,
        work,
        hot: followQ.slice().sort((a, b) => Number(b.total ?? 0) - Number(a.total ?? 0)).slice(0, 6)
          .map(q => ({ id: q.id, code: q.quotation_id ?? "", name: q.party_name ?? "Customer", place: q.party_place ?? "", total: Number(q.total ?? 0), next: q.next_follow_up_at, status: q.commercial_status })),
        stages, recent,
      });
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, office]);

  const buckets = useMemo(() => {
    const today = keyOffset(0), in7 = keyOffset(7);
    const w = (data?.work ?? []).slice().sort((a, b) => (a.when ?? "").localeCompare(b.when ?? ""));
    return {
      overdue: w.filter(x => x.when && dayKey(x.when) < today && x.kind !== "collection"),
      today: w.filter(x => x.kind === "collection" || (x.when && dayKey(x.when) === today)),
      upcoming: w.filter(x => x.when && dayKey(x.when) > today && dayKey(x.when) <= in7),
    };
  }, [data]);

  if (!authLoading && user && isMeasurementStaff && !isOfficeStaff && !isDelivery) return <Navigate to="/admin/my-work" replace />;

  const loading = !data;
  const growth = data && data.ordersLastMonthValue > 0 ? Math.round(((data.ordersMonthValue - data.ordersLastMonthValue) / data.ordersLastMonthValue) * 100) : null;
  const maxStage = Math.max(1, ...(data?.stages ?? []).map(s => s.count));
  // Open on Today, or on Overdue when today is empty but older work is waiting.
  const activeTab = tab ?? (buckets.today.length === 0 && buckets.overdue.length > 0 ? "overdue" : "today");
  const list = buckets[activeTab];

  return (
    <AdminShell>
      <div className="space-y-5">
        {/* Greeting + quick create */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#2f2925] sm:text-3xl">{greeting()}{data?.name ? `, ${data.name}` : ""}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}{data ? ` · ${buckets.today.length} things for today, ${buckets.overdue.length} overdue` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {office && <QuickBtn to="/admin/leads?new=1" label="Enquiry" />}
            {office && <QuickBtn to="/admin/quotations?new=1" label="Quotation" />}
            <QuickBtn to="/admin/diary?new=1" label="Task" />
            {office && <QuickBtn to="/admin/services" label="Complaint" />}
          </div>
        </div>

        {/* KPI tiles */}
        {office && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Kpi to="/admin/leads" icon={ClipboardList} label="Open enquiries" value={data?.openLeads} note={data ? `${data.newLeadsToday} new today` : ""} loading={loading} />
            <Kpi to="/admin/quotations" icon={FileText} label="Quotations to follow" value={data?.followQuotes} note={data ? `${shortInr(data.followValue)} in play` : ""} loading={loading} />
            <Kpi to="/admin/salesman-reports" icon={IndianRupee} label="Orders this month" value={data ? shortInr(data.ordersMonthValue) : undefined}
              note={data ? `${data.ordersMonth} order${data.ordersMonth === 1 ? "" : "s"}${growth === null ? "" : ` · ${growth >= 0 ? "▲" : "▼"} ${Math.abs(growth)}% vs last month`}` : ""} tone={growth !== null && growth < 0 ? "bad" : "good"} loading={loading} />
            <Kpi to="/admin/backlog" icon={Wallet} label="Payments pending" value={data ? shortInr(data.pendingAmount) : undefined} note={data ? `${data.overdueAccounts} follow-ups overdue` : ""} tone={data && data.overdueAccounts > 0 ? "bad" : undefined} loading={loading} />
            <Kpi to="/admin/delivery" icon={Truck} label="Deliveries · 7 days" value={data?.deliveries7} note={data ? `${data.deliveriesOverdue} past due date` : ""} tone={data && data.deliveriesOverdue > 0 ? "bad" : undefined} loading={loading} />
            <Kpi to="/admin/inventory/reorder" icon={Boxes} label="Out of stock" value={data ? data.outStock : undefined} note={data ? `${data.lowStock} at or below reorder level` : ""} tone={data && data.outStock > 0 ? "bad" : undefined} loading={loading} />
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* Today's work */}
          <Panel title="My work" icon={CalendarClock} action={<Link to="/admin/diary" className="text-xs font-medium text-[#76563f] hover:underline">All tasks</Link>}>
            <div className="mb-3 flex gap-1 rounded-lg bg-[#FBEFE4]/60 p-1 text-sm">
              {(["overdue", "today", "upcoming"] as const).map(k => (
                <button key={k} type="button" onClick={() => setTab(k)}
                  className={`flex-1 rounded-md px-2 py-1.5 font-medium capitalize transition-colors ${activeTab === k ? "bg-white text-[#2f2925] shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {k === "upcoming" ? "Next 7 days" : k} <span className={k === "overdue" && buckets.overdue.length ? "text-red-600" : ""}>({buckets[k].length})</span>
                </button>
              ))}
            </div>
            {loading ? <Spinner /> : !list.length
              ? <p className="py-8 text-center text-sm text-muted-foreground">{activeTab === "overdue" ? "Nothing overdue. 👍" : "Nothing here."}</p>
              : <ul className="max-h-[420px] divide-y divide-[#8b6b4f]/10 overflow-y-auto">
                  {list.slice(0, 40).map(x => <WorkRow key={x.id} item={x} overdue={activeTab === "overdue"} />)}
                </ul>}
          </Panel>

          {/* Pipeline */}
          {office && (
            <Panel title="Order pipeline" icon={FileText} action={<Link to="/admin/quotations" className="text-xs font-medium text-[#76563f] hover:underline">Open</Link>}>
              {loading ? <Spinner /> : (
                <ul className="space-y-2.5">
                  {data!.stages.map(s => (
                    <li key={s.stage}>
                      <Link to="/admin/quotations" className="block rounded-lg px-1 py-0.5 hover:bg-[#FBEFE4]/50">
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="font-medium text-foreground">{s.stage} · {STAGES[s.stage]}</span>
                          <span className="text-muted-foreground"><b className="text-foreground">{s.count}</b>{s.value ? ` · ${shortInr(s.value)}` : ""}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#8b6b4f]/10">
                          <div className="h-full rounded-full bg-[#76563f]" style={{ width: `${Math.max(s.count ? 4 : 0, (s.count / maxStage) * 100)}%` }} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {data && (data.openServices > 0 || data.outStock > 0) && (
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {data.openServices > 0 && <Link to="/admin/services" className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 hover:bg-amber-100"><Wrench className="h-3 w-3" />{data.openServices} open complaints</Link>}
                  {data.outStock > 0 && <Link to="/admin/inventory/reorder" className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-red-700 hover:bg-red-100"><AlertTriangle className="h-3 w-3" />{data.outStock} items out of stock</Link>}
                </div>
              )}
            </Panel>
          )}
        </div>

        {office && (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Biggest quotations waiting for a decision */}
            <Panel title="Biggest quotations to close" icon={IndianRupee}>
              {loading ? <Spinner /> : !data!.hot.length ? <p className="py-6 text-center text-sm text-muted-foreground">No quotations in follow-up.</p> : (
                <ul className="divide-y divide-[#8b6b4f]/10">
                  {data!.hot.map(h => {
                    const late = h.next && dayKey(h.next) < keyOffset(0);
                    return (
                      <li key={h.id}>
                        <Link to={`/admin/quotations/${h.id}`} className="flex items-center gap-3 py-2.5 hover:bg-[#FBEFE4]/40">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{h.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{[h.code || h.place, h.status.replace(/_/g, " ")].filter(Boolean).join(" · ")}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-[#2f2925]">{inr(h.total)}</p>
                            <p className={`text-[11px] ${late ? "font-medium text-red-600" : "text-muted-foreground"}`}>{h.next ? `${late ? "was due" : "follow-up"} ${shortDate(h.next)}` : "no follow-up date"}</p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            {/* Recent activity */}
            <Panel title="Recently added" icon={ListTodo}>
              {loading ? <Spinner /> : (
                <ul className="divide-y divide-[#8b6b4f]/10">
                  {data!.recent.map(r => (
                    <li key={r.id}>
                      <Link to={r.href} className="flex items-center gap-3 py-2.5 hover:bg-[#FBEFE4]/40">
                        <KindIcon kind={r.kind} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.sub}</p>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{shortDate(r.at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        )}
      </div>
    </AdminShell>
  );
};

const QuickBtn = ({ to, label }: { to: string; label: string }) => (
  <Link to={to} className="inline-flex h-9 items-center gap-1 rounded-full border border-[#8b6b4f]/25 bg-white px-3 text-sm font-medium text-[#76563f] shadow-sm hover:bg-[#FBEFE4]">
    <Plus className="h-4 w-4" aria-hidden="true" />{label}
  </Link>
);

const Kpi = ({ to, icon: Icon, label, value, note, tone, loading }: { to: string; icon: ComponentType<{ className?: string }>; label: string; value?: number | string; note: string; tone?: "good" | "bad"; loading: boolean }) => (
  <Link to={to} className="group rounded-2xl border border-[#8b6b4f]/15 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <Icon className="h-4 w-4 text-[#8b6b4f]" aria-hidden="true" />
    </div>
    <div className="mt-1.5 font-display text-2xl font-semibold text-[#2f2925]">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : value}</div>
    <p className={`mt-0.5 truncate text-xs ${tone === "bad" ? "text-red-600" : tone === "good" ? "text-emerald-700" : "text-muted-foreground"}`}>{note}</p>
  </Link>
);

const Panel = ({ title, icon: Icon, action, children }: { title: string; icon: ComponentType<{ className?: string }>; action?: ReactNode; children: ReactNode }) => (
  <section className="rounded-2xl border border-[#8b6b4f]/15 bg-white p-4 shadow-sm sm:p-5">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Icon className="h-4 w-4 text-[#8b6b4f]" />{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const KIND: Record<Kind, { icon: ComponentType<{ className?: string }>; cls: string }> = {
  lead: { icon: PhoneCall, cls: "bg-sky-50 text-sky-700" },
  quote: { icon: FileText, cls: "bg-violet-50 text-violet-700" },
  payment: { icon: Wallet, cls: "bg-amber-50 text-amber-700" },
  task: { icon: ListTodo, cls: "bg-emerald-50 text-emerald-700" },
  collection: { icon: IndianRupee, cls: "bg-rose-50 text-rose-700" },
};
const KindIcon = ({ kind }: { kind: Kind }) => { const k = KIND[kind]; const I = k.icon; return <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${k.cls}`}><I className="h-4 w-4" /></span>; };

const WorkRow = ({ item, overdue }: { item: WorkItem; overdue: boolean }) => (
  <li>
    <Link to={item.href} className="flex items-center gap-3 py-2.5 hover:bg-[#FBEFE4]/40">
      <KindIcon kind={item.kind} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{item.sub}</p>
      </div>
      <div className="shrink-0 text-right">
        {item.amount ? <p className="text-sm font-semibold text-[#2f2925]">{inr(item.amount)}</p> : null}
        <p className={`text-[11px] ${overdue ? "font-medium text-red-600" : "text-muted-foreground"}`}>{item.kind === "collection" ? "to verify" : shortDate(item.when)}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  </li>
);

const Spinner = () => <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

export default AdminOverview;
