import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/brand";
import { CalendarClock, CheckCircle2, Clock3, ExternalLink, PhoneCall, RefreshCw, UserCheck } from "lucide-react";

type CommercialStatus =
  | "lead"
  | "quote_preparation"
  | "quote_sent"
  | "follow_up"
  | "confirmed"
  | "delivered"
  | "payment_pending"
  | "closed"
  | "lost";

type Row = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string;
  party_phone: string | null;
  salesperson_name: string | null;
  total: number;
  advance_amount: number | null;
  status: string;
  commercial_status: CommercialStatus;
  next_follow_up_at: string | null;
  last_follow_up_at: string | null;
  confirmed_at: string | null;
  created_at: string;
};

type Bucket = "today" | "overdue" | "unscheduled" | "all";

const commercialLabel: Record<CommercialStatus, string> = {
  lead: "Lead",
  quote_preparation: "Quote Preparation",
  quote_sent: "Quote Sent",
  follow_up: "Follow-up",
  confirmed: "Confirmed",
  delivered: "Delivered",
  payment_pending: "Payment Pending",
  closed: "Closed",
  lost: "Lost",
};

const activeCommercial = new Set<CommercialStatus>(["lead", "quote_preparation", "quote_sent", "follow_up"]);

const localDateKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const isToday = (iso: string | null) => !!iso && localDateKey(iso) === todayKey();
const isOverdue = (iso: string | null) => !!iso && localDateKey(iso) < todayKey();

export const SalesFollowupPanel = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("today");
  const [scheduleFor, setScheduleFor] = useState<Row | null>(null);
  const [confirmFor, setConfirmFor] = useState<Row | null>(null);
  const [followupAt, setFollowupAt] = useState("");
  const [followupNote, setFollowupNote] = useState("");
  const [advance, setAdvance] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("quotations")
      .select("id,quotation_id,party_name,party_place,party_phone,salesperson_name,total,advance_amount,status,commercial_status,next_follow_up_at,last_follow_up_at,confirmed_at,created_at")
      .is("deleted_at", null)
      .eq("document_type", "quotation")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      toast({ title: "Sales follow-up load failed", description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeRows = useMemo(() => rows.filter((r) => activeCommercial.has(r.commercial_status)), [rows]);
  const todayRows = useMemo(() => activeRows.filter((r) => isToday(r.next_follow_up_at)), [activeRows]);
  const overdueRows = useMemo(() => activeRows.filter((r) => isOverdue(r.next_follow_up_at)), [activeRows]);
  const unscheduledRows = useMemo(() => activeRows.filter((r) => !r.next_follow_up_at), [activeRows]);

  const visible = useMemo(() => {
    if (bucket === "today") return todayRows;
    if (bucket === "overdue") return overdueRows;
    if (bucket === "unscheduled") return unscheduledRows;
    return activeRows;
  }, [bucket, todayRows, overdueRows, unscheduledRows, activeRows]);

  const openSchedule = (r: Row) => {
    setScheduleFor(r);
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(11, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    setFollowupAt(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`);
    setFollowupNote("");
  };

  const saveFollowup = async () => {
    if (!scheduleFor || !followupAt) return;
    setSaving(true);
    const { error } = await (supabase as any).from("quotation_followups").insert({
      quotation_id: scheduleFor.id,
      scheduled_for: new Date(followupAt).toISOString(),
      note: followupNote.trim() || null,
      status: "pending",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Follow-up save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Follow-up scheduled", description: `${scheduleFor.party_name} · ${new Date(followupAt).toLocaleString("en-IN")}` });
    setScheduleFor(null);
    load();
  };

  const markContacted = async (r: Row) => {
    setSaving(true);
    const { data: pending } = await (supabase as any)
      .from("quotation_followups")
      .select("id")
      .eq("quotation_id", r.id)
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true })
      .limit(1)
      .maybeSingle();

    let error: any = null;
    if (pending?.id) {
      const res = await (supabase as any)
        .from("quotation_followups")
        .update({ status: "completed", completed_at: new Date().toISOString(), outcome: "contacted" })
        .eq("id", pending.id);
      error = res.error;
    } else {
      const res = await (supabase as any).from("quotations").update({ last_follow_up_at: new Date().toISOString() }).eq("id", r.id);
      error = res.error;
    }
    setSaving(false);
    if (error) return toast({ title: "Couldn't mark contacted", description: error.message, variant: "destructive" });
    toast({ title: "Contact logged", description: r.party_name });
    load();
  };

  const openConfirm = (r: Row) => {
    setConfirmFor(r);
    setAdvance(r.advance_amount ? String(r.advance_amount) : "0");
  };

  const confirmOrder = async () => {
    if (!confirmFor) return;
    const adv = Math.max(0, Number(advance || 0));
    setSaving(true);
    const { error } = await (supabase as any)
      .from("quotations")
      .update({
        commercial_status: "confirmed",
        confirmed_at: new Date().toISOString(),
        advance_amount: adv,
        status: "finalized",
        next_follow_up_at: null,
      })
      .eq("id", confirmFor.id);
    setSaving(false);
    if (error) {
      toast({ title: "Order confirmation failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Order confirmed",
      description: adv > 0 ? `Advance received ${formatINR(adv)}` : "Confirmed without advance",
    });
    setConfirmFor(null);
    load();
  };

  return (
    <section>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl sm:text-2xl">Sales Follow-up Center</h2>
          <p className="mt-1 text-sm text-muted-foreground">Leads, quotation follow-ups and order confirmation — action list for sales staff.</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button onClick={() => setBucket("today")} className="text-left">
          <Card className={bucket === "today" ? "border-primary shadow-sm" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between"><span className="text-xs font-medium uppercase text-muted-foreground">Follow-up Today</span><CalendarClock className="h-4 w-4 text-primary" /></div>
              <p className="mt-2 text-3xl font-bold">{todayRows.length}</p>
            </CardContent>
          </Card>
        </button>
        <button onClick={() => setBucket("overdue")} className="text-left">
          <Card className={`${bucket === "overdue" ? "border-destructive shadow-sm" : ""} ${overdueRows.length ? "bg-destructive/5" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between"><span className="text-xs font-medium uppercase text-muted-foreground">Overdue</span><Clock3 className="h-4 w-4 text-destructive" /></div>
              <p className="mt-2 text-3xl font-bold">{overdueRows.length}</p>
            </CardContent>
          </Card>
        </button>
        <button onClick={() => setBucket("unscheduled")} className="text-left">
          <Card className={bucket === "unscheduled" ? "border-amber-500 shadow-sm" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between"><span className="text-xs font-medium uppercase text-muted-foreground">No Follow-up Set</span><PhoneCall className="h-4 w-4 text-amber-600" /></div>
              <p className="mt-2 text-3xl font-bold">{unscheduledRows.length}</p>
            </CardContent>
          </Card>
        </button>
        <button onClick={() => setBucket("all")} className="text-left">
          <Card className={bucket === "all" ? "border-primary shadow-sm" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between"><span className="text-xs font-medium uppercase text-muted-foreground">Active Leads</span><UserCheck className="h-4 w-4 text-muted-foreground" /></div>
              <p className="mt-2 text-3xl font-bold">{activeRows.length}</p>
            </CardContent>
          </Card>
        </button>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading sales follow-ups…</div>
          ) : visible.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No items in this follow-up bucket.</div>
          ) : (
            <div className="divide-y divide-border">
              {visible.slice(0, 20).map((r) => (
                <div key={r.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold">{r.quotation_id}</span>
                      <Badge variant="outline">{commercialLabel[r.commercial_status]}</Badge>
                      {isOverdue(r.next_follow_up_at) && <Badge variant="destructive">Overdue</Badge>}
                      {isToday(r.next_follow_up_at) && <Badge>Today</Badge>}
                    </div>
                    <p className="mt-1 font-semibold">{r.party_name} <span className="font-normal text-muted-foreground">· {r.party_place}</span></p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {r.salesperson_name && <span>Sales: {r.salesperson_name}</span>}
                      {r.party_phone && <span>{r.party_phone}</span>}
                      <span>{formatINR(Number(r.total || 0))}</span>
                      <span>{r.next_follow_up_at ? `Next: ${new Date(r.next_follow_up_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : "Next follow-up not set"}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => markContacted(r)} disabled={saving}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Contacted
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openSchedule(r)}>
                      <CalendarClock className="mr-1.5 h-3.5 w-3.5" /> Schedule
                    </Button>
                    <Button size="sm" onClick={() => openConfirm(r)}>
                      <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Confirm Order
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={`/admin/quotations/${r.id}`}>Open <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!scheduleFor} onOpenChange={(v) => !v && setScheduleFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Schedule follow-up</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><p className="font-medium">{scheduleFor?.party_name}</p><p className="text-sm text-muted-foreground">{scheduleFor?.quotation_id}</p></div>
            <div className="space-y-1.5"><Label>Date & time</Label><Input type="datetime-local" value={followupAt} onChange={(e) => setFollowupAt(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Note</Label><Textarea rows={3} value={followupNote} onChange={(e) => setFollowupNote(e.target.value)} placeholder="Customer asked to call after 3 days, discuss finish/price…" /></div>
          </div>
          <DialogFooter><Button onClick={saveFollowup} disabled={saving || !followupAt}>{saving ? "Saving…" : "Save Follow-up"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmFor} onOpenChange={(v) => !v && setConfirmFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirm Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><p className="font-medium">{confirmFor?.party_name}</p><p className="text-sm text-muted-foreground">{confirmFor?.quotation_id} · Total {formatINR(Number(confirmFor?.total || 0))}</p></div>
            <div className="space-y-1.5">
              <Label>Advance received (₹)</Label>
              <Input type="number" min="0" step="1" inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} />
              <p className="text-xs text-muted-foreground">Enter 0 to confirm without advance. Both flows are supported.</p>
            </div>
          </div>
          <DialogFooter><Button onClick={confirmOrder} disabled={saving}>{saving ? "Confirming…" : Number(advance || 0) > 0 ? "Confirm with Advance" : "Confirm without Advance"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default SalesFollowupPanel;
