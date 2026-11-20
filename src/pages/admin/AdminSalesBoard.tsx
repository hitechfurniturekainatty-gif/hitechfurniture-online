import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DndContext, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { AdminShell } from "@/components/admin/AdminShell";
import { OfficeStaffOnly } from "@/components/admin/OfficeStaffOnly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { indiaDateKey } from "@/lib/deliveryPlanning";
import { leadSourceLabel, LOST_REASONS, followUpInDays } from "@/lib/leadSource";

type Lead = { id: string; lead_code: string; customer_name: string; customer_phone: string | null; customer_place: string | null; requirement: string | null; source: string; status: string; stage: string; assigned_to: string | null; next_follow_up_at: string | null; converted_quotation_id: string | null; lost_reason: string | null; updated_at: string; created_at: string };
type Col = "new" | "contacted" | "showroom_visit" | "quotation" | "order" | "lost";
type Move = { lead: Lead; to: Col };

const COLUMNS: { id: Col; title: string; hint: string; tone: string }[] = [
  { id: "new", title: "🆕 പുതിയത്", hint: "ഇതുവരെ വിളിച്ചിട്ടില്ല", tone: "border-sky-300" },
  { id: "contacted", title: "📞 വിളിച്ചു", hint: "സംസാരിച്ചു, follow-up നടക്കുന്നു", tone: "border-indigo-300" },
  { id: "showroom_visit", title: "🏬 Showroom visit", hint: "വരാമെന്ന് പറഞ്ഞു / വന്നു", tone: "border-amber-300" },
  { id: "quotation", title: "📄 Quotation", hint: "Quotation ഉണ്ടാക്കി", tone: "border-purple-300" },
  { id: "order", title: "✅ Order", hint: "Order confirm ആയി (തനിയെ വരും)", tone: "border-green-400" },
  { id: "lost", title: "❌ Lost", hint: "കാരണം രേഖപ്പെടുത്തിയവ", tone: "border-red-300" },
];
const ORDER_STATUSES = ["confirmed", "payment_pending", "closed"];
const RECENT_DAYS = 45; // Order and Lost columns show only recent leads so the board stays light
const waLink = (phone: string | null) => { const d = String(phone ?? "").replace(/\D/g, ""); return d ? `https://wa.me/${d.length === 10 ? `91${d}` : d}` : null; };
const isOpen = (l: Lead) => ["pending", "contacted"].includes(l.status);

function Card({ lead, col, names, today }: { lead: Lead; col: Col; names: Record<string, string>; today: string }) {
  const locked = col === "quotation" || col === "order";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id, disabled: locked });
  const due = lead.next_follow_up_at ? indiaDateKey(new Date(lead.next_follow_up_at)) : null;
  const overdue = isOpen(lead) && due !== null && due < today;
  const dueToday = isOpen(lead) && due === today;
  return <div ref={setNodeRef} style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : undefined}
    className={`rounded-lg border bg-card p-2 text-sm shadow-sm ${isDragging ? "opacity-70 ring-2 ring-primary" : ""} ${locked ? "" : "cursor-grab touch-none"}`} {...(locked ? {} : listeners)} {...attributes}>
    <div className="flex items-start justify-between gap-1">
      <p className="font-semibold leading-tight">{lead.customer_name}</p>
      <span className="shrink-0 text-[10px] text-muted-foreground">{lead.lead_code.replace(/^LD-\d{4}-/, "#")}</span>
    </div>
    <p className="text-xs text-muted-foreground">{[lead.customer_place, lead.customer_phone].filter(Boolean).join(" · ")}</p>
    {lead.requirement && <p className="mt-1 line-clamp-2 text-xs">{lead.requirement}</p>}
    <div className="mt-1 flex flex-wrap gap-1">
      <Badge variant="secondary" className="text-[10px]">{leadSourceLabel(lead.source).split(" ·")[0]}</Badge>
      {lead.assigned_to && <Badge variant="outline" className="text-[10px]">{(names[lead.assigned_to] || "Staff").split(" ")[0]}</Badge>}
      {overdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
      {dueToday && <Badge className="bg-amber-500 text-[10px]">ഇന്ന്</Badge>}
      {col === "lost" && lead.lost_reason && <Badge variant="outline" className="text-[10px]">{lead.lost_reason.split(" ·")[0]}</Badge>}
    </div>
    <div className="mt-2 flex gap-1" onPointerDown={e => e.stopPropagation()}>
      {lead.customer_phone && <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs"><a href={`tel:${lead.customer_phone}`}>Call</a></Button>}
      {waLink(lead.customer_phone) && <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs"><a href={waLink(lead.customer_phone)!} target="_blank" rel="noreferrer">WA</a></Button>}
      {lead.converted_quotation_id
        ? <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs"><Link to={`/admin/quotations/${lead.converted_quotation_id}`}>Quote</Link></Button>
        : <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs"><Link to={`/admin/leads?open=${lead.id}`}>Open</Link></Button>}
    </div>
  </div>;
}

function Column({ col, leads, names, today, dropDisabled }: { col: typeof COLUMNS[number]; leads: Lead[]; names: Record<string, string>; today: string; dropDisabled: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id, disabled: dropDisabled });
  return <div ref={setNodeRef} className={`flex w-64 shrink-0 flex-col rounded-xl border-t-4 bg-muted/40 p-2 ${col.tone} ${isOver ? "ring-2 ring-primary" : ""}`}>
    <div className="mb-2"><p className="font-semibold">{col.title} <span className="text-muted-foreground">({leads.length})</span></p><p className="text-[11px] text-muted-foreground">{col.hint}</p></div>
    <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1">{leads.map(l => <Card key={l.id} lead={l} col={col.id} names={names} today={today} />)}{!leads.length && <p className="py-4 text-center text-xs text-muted-foreground">ഇവിടേക്ക് card വലിച്ചിടുക</p>}</div>
  </div>;
}

function SalesBoard() {
  const { user } = useAuth(); const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]); const [orderIds, setOrderIds] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({}); const [staff, setStaff] = useState<{ user_id: string; display_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [owner, setOwner] = useState("all"); const [search, setSearch] = useState("");
  const [move, setMove] = useState<Move | null>(null); const [note, setNote] = useState(""); const [next, setNext] = useState(followUpInDays(1)); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false);
  const today = indiaDateKey();
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }), useSensor(KeyboardSensor));

  const load = async () => {
    setLoading(true); setError("");
    try {
      const all: Lead[] = [];
      for (let offset = 0; ; offset += 500) {
        const r = await (supabase as any).from("sales_leads").select("id,lead_code,customer_name,customer_phone,customer_place,requirement,source,status,stage,assigned_to,next_follow_up_at,converted_quotation_id,lost_reason,updated_at,created_at,duplicate_of").is("deleted_at", null).is("duplicate_of", null).order("created_at", { ascending: false }).range(offset, offset + 499);
        if (r.error) throw r.error; all.push(...r.data); if (r.data.length < 500) break;
      }
      const qids = all.map(l => l.converted_quotation_id).filter(Boolean) as string[];
      const won = new Set<string>();
      for (let i = 0; i < qids.length; i += 200) {
        const q = await supabase.from("quotations").select("id,commercial_status").in("id", qids.slice(i, i + 200));
        if (q.error) throw q.error; for (const row of q.data ?? []) if (ORDER_STATUSES.includes((row as any).commercial_status)) won.add(row.id);
      }
      const [p, r] = await Promise.all([supabase.from("profiles").select("user_id,display_name"), supabase.from("user_roles").select("user_id,role").in("role", ["admin", "staff"])]);
      if (p.error || r.error) throw p.error || r.error;
      setNames(Object.fromEntries((p.data ?? []).map(x => [x.user_id, x.display_name || "Staff"])));
      const eligible = new Set((r.data ?? []).map(x => x.user_id)); setStaff((p.data ?? []).filter(x => eligible.has(x.user_id)));
      setLeads(all); setOrderIds(won);
    } catch (e: any) { setError(e.message || "Could not load the board"); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const colOf = (l: Lead): Col => (l.converted_quotation_id && orderIds.has(l.converted_quotation_id)) ? "order" : (l.stage as Col);
  const recent = (l: Lead) => (Date.now() - new Date(l.updated_at).getTime()) / 86400000 <= RECENT_DAYS;
  const visible = useMemo(() => leads.filter(l => (owner === "all" || (owner === "me" ? l.assigned_to === user?.id : owner === "none" ? !l.assigned_to : l.assigned_to === owner))
    && [l.lead_code, l.customer_name, l.customer_phone, l.customer_place].some(x => String(x ?? "").toLowerCase().includes(search.toLowerCase()))), [leads, owner, search, user?.id]);
  const byCol = useMemo(() => {
    const m: Record<Col, Lead[]> = { new: [], contacted: [], showroom_visit: [], quotation: [], order: [], lost: [] };
    for (const l of visible) { const c = colOf(l); if ((c === "order" || c === "lost") && !recent(l)) continue; m[c]?.push(l); }
    // Open leads: soonest follow-up first, so today's calls sit on top.
    for (const c of ["new", "contacted", "showroom_visit"] as Col[]) m[c].sort((a, b) => (a.next_follow_up_at ?? "9999").localeCompare(b.next_follow_up_at ?? "9999"));
    return m;
  }, [visible, orderIds]);

  const onDragEnd = (e: DragEndEvent) => {
    const to = e.over?.id as Col | undefined; const lead = leads.find(l => l.id === e.active.id);
    if (!to || !lead || colOf(lead) === to) return;
    if (to === "order") return toast.info("Order column തനിയെ നിറയും: quotation confirm ചെയ്യുമ്പോൾ");
    if (to === "quotation" && lead.converted_quotation_id) return;
    if (to === "new" && (lead.status === "contacted" || lead.stage !== "new") && isOpen(lead)) return toast.info("ഈ customer-നെ ഇതിനകം വിളിച്ചതാണ്: New-ലേക്ക് തിരിച്ച് ഇടാൻ പറ്റില്ല");
    setNote(""); setNext(followUpInDays(1)); setReason(""); setMove({ lead, to });
  };

  const confirmMove = async () => {
    if (!move || busy) return; const { lead, to } = move; setBusy(true);
    try {
      if (to === "lost") {
        if (!reason) { toast.error("Lost ആയതിന്റെ കാരണം തിരഞ്ഞെടുക്കുക"); return; }
        const r = await (supabase as any).from("sales_leads").update({ status: "lost", lost_reason: reason, updated_at: new Date().toISOString() }).eq("id", lead.id).is("converted_quotation_id", null);
        if (r.error) throw r.error;
        if (note.trim()) await (supabase as any).rpc("log_sales_lead_followup", { p_lead_id: lead.id, p_outcome: "not_interested", p_note: note.trim(), p_next_follow_up_at: null });
        toast.success("Lost ആക്കി");
      } else if (to === "quotation") {
        const r = await (supabase as any).rpc("convert_sales_lead_to_quotation", { p_lead_id: lead.id });
        if (r.error || !r.data?.ok) throw new Error(r.error?.message || r.data?.error || "Conversion failed");
        toast.success("Quotation ഉണ്ടാക്കി", { action: { label: "Open", onClick: () => navigate(`/admin/quotations/${r.data.quotation_id}`) } });
      } else {
        if (!next) { toast.error("അടുത്ത ഫോളോ അപ്പ് തീയതി ഇടുക"); return; }
        if (!isOpen(lead)) { // reopening a lost lead
          const r = await (supabase as any).from("sales_leads").update({ status: to === "new" ? "pending" : "contacted", lost_reason: null, updated_at: new Date().toISOString() }).eq("id", lead.id);
          if (r.error) throw r.error;
        }
        const outcome = to === "showroom_visit" ? "showroom_visit" : to === "contacted" ? "interested" : "note";
        const r = await (supabase as any).rpc("log_sales_lead_followup", { p_lead_id: lead.id, p_outcome: outcome, p_note: note.trim() || (to === "new" ? "Moved back to New on Sales Board" : null), p_next_follow_up_at: new Date(next).toISOString() });
        if (r.error || !r.data?.ok) throw new Error(r.error?.message || r.data?.error || "Could not save");
        const s = await (supabase as any).from("sales_leads").update({ stage: to }).eq("id", lead.id);
        if (s.error) throw s.error;
        toast.success("Saved");
      }
      setMove(null); void load();
    } catch (e: any) { toast.error(e.message || "Could not move"); } finally { setBusy(false); }
  };

  const target = move ? COLUMNS.find(c => c.id === move.to) : null;
  const open = visible.filter(isOpen); const overdue = open.filter(l => l.next_follow_up_at && indiaDateKey(new Date(l.next_follow_up_at)) < today).length;
  const dueToday = open.filter(l => l.next_follow_up_at && indiaDateKey(new Date(l.next_follow_up_at)) === today).length;

  return <AdminShell><div className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><h1 className="font-display text-2xl">Sales Board</h1><p className="text-sm text-muted-foreground">Card വലിച്ച് അടുത്ത column-ലേക്ക് ഇടുക. ഓരോ നീക്കവും follow-up history-യിൽ സേവ് ആകും.</p></div>
      <div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">Open {open.length}</Badge><Badge className="bg-amber-500">ഇന്ന് {dueToday}</Badge><Badge variant="destructive">Overdue {overdue}</Badge></div>
    </div>
    <div className="flex flex-wrap gap-2">
      <Input className="sm:w-56" aria-label="Search" placeholder="Name / phone / place" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Salesman" className="h-10 rounded-md border bg-background px-2 text-sm" value={owner} onChange={e => setOwner(e.target.value)}>
        <option value="all">എല്ലാ salesmen</option><option value="me">എന്റെ leads</option><option value="none">Not assigned</option>
        {staff.map(s => <option key={s.user_id} value={s.user_id}>{s.display_name || "Staff"}</option>)}
      </select>
      <Button variant="ghost" onClick={load}>Refresh</Button>
      <Button asChild variant="outline"><Link to="/admin/leads?new=1">+ Add lead</Link></Button>
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-300 p-3 text-sm">{error} <Button variant="outline" size="sm" onClick={load}>Retry</Button></div>}
    {loading ? <p>Loading board…</p> :
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-3">{COLUMNS.map(c => <Column key={c.id} col={c} leads={byCol[c.id]} names={names} today={today} dropDisabled={c.id === "order"} />)}</div>
      </DndContext>}
    <p className="text-xs text-muted-foreground">Order, Lost columns-ൽ കഴിഞ്ഞ {RECENT_DAYS} ദിവസത്തേത് മാത്രം. Quotation / Order card-കൾ നീക്കാൻ പറ്റില്ല: അവ quotation-ൽ നിന്ന് തനിയെ മാറും.</p>
  </div>
  <Dialog open={!!move} onOpenChange={o => !o && !busy && setMove(null)}><DialogContent>
    <DialogHeader><DialogTitle>{move?.lead.customer_name} → {target?.title}</DialogTitle></DialogHeader>
    {move?.to === "quotation" ? <p className="text-sm">കസ്റ്റമർ quotation ആവശ്യപ്പെട്ടോ? Quotation ഉണ്ടാക്കും. Final order confirmation quotation-ൽ ചെയ്യണം.</p>
      : move?.to === "lost" ? <label className="block text-sm">Lost ആയതിന്റെ കാരണം *<select aria-label="Lost reason" className="mt-1 h-10 w-full rounded-md border bg-background px-2" value={reason} onChange={e => setReason(e.target.value)}><option value="">കാരണം തിരഞ്ഞെടുക്കുക…</option>{LOST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
      : <div className="space-y-1"><p className="text-sm">അടുത്ത call / meeting *</p>
        <div className="flex flex-wrap gap-1">{([[1, "നാളെ"], [3, "3 ദിവസം"], [7, "1 ആഴ്ച"]] as const).map(([d, l]) => <Button key={d} type="button" size="sm" variant="ghost" onClick={() => setNext(followUpInDays(d))}>{l}</Button>)}</div>
        <Input aria-label="Next follow-up" type="datetime-local" value={next} onChange={e => setNext(e.target.value)} /></div>}
    {move?.to !== "quotation" && <Textarea aria-label="Note" placeholder="എന്ത് സംസാരിച്ചു? (ഐച്ഛികം)" value={note} onChange={e => setNote(e.target.value)} />}
    <Button disabled={busy} onClick={confirmMove} className="w-full">{busy ? "Saving…" : move?.to === "quotation" ? "Quotation ഉണ്ടാക്കുക" : "Save & move"}</Button>
  </DialogContent></Dialog>
  </AdminShell>;
}

export default function AdminSalesBoard() { return <OfficeStaffOnly><SalesBoard /></OfficeStaffOnly>; }
