import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CalendarClock, CheckCircle2, Clock3, PhoneCall, RefreshCw, XCircle } from "lucide-react";

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

type CommercialRow = {
  id: string;
  commercial_status: CommercialStatus;
  next_follow_up_at: string | null;
  last_follow_up_at: string | null;
  confirmed_at: string | null;
  lost_reason: string | null;
  total: number;
  advance_amount: number;
  status: string;
};

const labels: Record<CommercialStatus, string> = {
  lead: "Lead",
  quote_preparation: "Quote Preparation",
  quote_sent: "Quote Sent",
  follow_up: "Follow-up",
  confirmed: "Confirmed Order",
  delivered: "Delivered",
  payment_pending: "Payment Pending",
  closed: "Closed",
  lost: "Lost",
};

const activeStatuses: CommercialStatus[] = ["lead", "quote_preparation", "quote_sent", "follow_up"];

export const QuotationCommercialPanel = ({ quotationId, editable = true }: { quotationId: string; editable?: boolean }) => {
  const [row, setRow] = useState<CommercialRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [followDate, setFollowDate] = useState("");
  const [followNote, setFollowNote] = useState("");
  const [advance, setAdvance] = useState("0");
  const [lostReason, setLostReason] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("quotations")
      .select("id, commercial_status, next_follow_up_at, last_follow_up_at, confirmed_at, lost_reason, total, advance_amount, status")
      .eq("id", quotationId)
      .maybeSingle();
    if (error) toast({ title: "Sales status load failed", description: error.message, variant: "destructive" });
    setRow((data as CommercialRow | null) ?? null);
    setLoading(false);
  }, [quotationId]);

  useEffect(() => { load(); }, [load]);

  const dueTone = useMemo(() => {
    if (!row?.next_follow_up_at) return "none" as const;
    const now = new Date();
    const due = new Date(row.next_follow_up_at);
    if (due.getTime() < now.getTime()) return "overdue" as const;
    if (due.toDateString() === now.toDateString()) return "today" as const;
    return "future" as const;
  }, [row?.next_follow_up_at]);

  const updateCommercial = async (commercial_status: CommercialStatus) => {
    if (!row || !editable) return;
    setSaving(true);
    const { error } = await supabase.from("quotations").update({ commercial_status }).eq("id", row.id);
    setSaving(false);
    if (error) return toast({ title: "Status update failed", description: error.message, variant: "destructive" });
    setRow((r) => r ? { ...r, commercial_status } : r);
    toast({ title: `Sales status: ${labels[commercial_status]}` });
  };

  const scheduleFollowup = async () => {
    if (!row || !followDate) return;
    setSaving(true);
    const scheduled = new Date(followDate).toISOString();
    const { error } = await supabase.from("quotation_followups").insert({
      quotation_id: row.id,
      scheduled_for: scheduled,
      note: followNote.trim() || null,
      status: "pending",
    } as any);
    setSaving(false);
    if (error) return toast({ title: "Follow-up schedule failed", description: error.message, variant: "destructive" });
    setScheduleOpen(false);
    setFollowDate("");
    setFollowNote("");
    toast({ title: "Follow-up scheduled" });
    await load();
  };

  const markContacted = async () => {
    if (!row) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { data: pending } = await supabase
      .from("quotation_followups")
      .select("id")
      .eq("quotation_id", row.id)
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true })
      .limit(1);
    let error: any = null;
    if (pending?.[0]?.id) {
      ({ error } = await supabase.from("quotation_followups").update({ status: "completed", completed_at: now, outcome: "Contacted" } as any).eq("id", pending[0].id));
    } else {
      ({ error } = await supabase.from("quotation_followups").insert({ quotation_id: row.id, scheduled_for: now, status: "completed", completed_at: now, outcome: "Contacted" } as any));
    }
    setSaving(false);
    if (error) return toast({ title: "Couldn't save follow-up", description: error.message, variant: "destructive" });
    toast({ title: "Contact recorded" });
    await load();
  };

  const confirmOrder = async () => {
    if (!row) return;
    const advanceNum = Math.max(0, Number(advance) || 0);
    if (advanceNum > Number(row.total || 0)) {
      return toast({ title: "Advance cannot exceed quotation total", variant: "destructive" });
    }
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("quotations")
      .update({ commercial_status: "confirmed", confirmed_at: now, advance_amount: advanceNum, status: "finalized" } as any)
      .eq("id", row.id);
    if (!error) {
      await supabase
        .from("quotation_followups")
        .update({ status: "cancelled" } as any)
        .eq("quotation_id", row.id)
        .eq("status", "pending");
    }
    setSaving(false);
    if (error) return toast({ title: "Order confirmation failed", description: error.message, variant: "destructive" });
    setConfirmOpen(false);
    toast({ title: advanceNum > 0 ? "Order confirmed — advance recorded" : "Order confirmed — no advance" });
    await load();
  };

  const markLost = async () => {
    if (!row || !lostReason.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("quotations")
      .update({ commercial_status: "lost", lost_reason: lostReason.trim() } as any)
      .eq("id", row.id);
    if (!error) {
      await supabase.from("quotation_followups").update({ status: "cancelled" } as any).eq("quotation_id", row.id).eq("status", "pending");
    }
    setSaving(false);
    if (error) return toast({ title: "Couldn't mark lost", description: error.message, variant: "destructive" });
    setLostOpen(false);
    toast({ title: "Marked as Lost" });
    await load();
  };

  if (loading || !row) return null;
  const active = activeStatuses.includes(row.commercial_status);

  return (
    <Card className="mb-4 border-primary/20 bg-primary/[0.025]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PhoneCall className="h-4 w-4" /> Sales & Follow-up
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={row.commercial_status === "lost" ? "destructive" : row.commercial_status === "confirmed" ? "default" : "outline"}>
              {labels[row.commercial_status]}
            </Badge>
            {dueTone === "overdue" && <Badge variant="destructive">Follow-up overdue</Badge>}
            {dueTone === "today" && <Badge className="bg-amber-500 text-white">Follow-up today</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-lg border bg-background px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Next follow-up</p>
            <p className="mt-0.5 font-medium">{row.next_follow_up_at ? new Date(row.next_follow_up_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Not scheduled"}</p>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last contact</p>
            <p className="mt-0.5 font-medium">{row.last_follow_up_at ? new Date(row.last_follow_up_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "No contact logged"}</p>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Advance</p>
            <p className="mt-0.5 font-medium">₹{Number(row.advance_amount || 0).toLocaleString("en-IN")} / ₹{Number(row.total || 0).toLocaleString("en-IN")}</p>
          </div>
        </div>

        {editable && (
          <div className="flex flex-wrap gap-2">
            {active && (
              <Select value={row.commercial_status} onValueChange={(v) => updateCommercial(v as CommercialStatus)} disabled={saving}>
                <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="quote_preparation">Quote Preparation</SelectItem>
                  <SelectItem value="quote_sent">Quote Sent</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            )}
            {active && <Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)}><CalendarClock className="mr-1.5 h-4 w-4" /> Schedule</Button>}
            {active && <Button size="sm" variant="outline" onClick={markContacted} disabled={saving}><CheckCircle2 className="mr-1.5 h-4 w-4" /> Contacted</Button>}
            {active && <Button size="sm" onClick={() => { setAdvance(String(row.advance_amount || 0)); setConfirmOpen(true); }}><CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirm Order</Button>}
            {active && <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setLostOpen(true)}><XCircle className="mr-1.5 h-4 w-4" /> Lost</Button>}
            <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="mr-1.5 h-4 w-4" /> Refresh</Button>
          </div>
        )}

        {row.commercial_status === "lost" && row.lost_reason && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">Lost reason: <strong>{row.lost_reason}</strong></div>
        )}
      </CardContent>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule customer follow-up</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Date & time</Label><Input type="datetime-local" value={followDate} onChange={(e) => setFollowDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Note</Label><Textarea value={followNote} onChange={(e) => setFollowNote(e.target.value)} placeholder="e.g. Customer asked to call after Friday" /></div>
          </div>
          <DialogFooter><Button onClick={scheduleFollowup} disabled={!followDate || saving}><Clock3 className="mr-2 h-4 w-4" />Save reminder</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm order</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Advance received (₹)</Label>
            <Input type="number" min="0" max={row.total} value={advance} onChange={(e) => setAdvance(e.target.value)} />
            <p className="text-xs text-muted-foreground">Enter 0 to confirm without advance. Both flows are supported.</p>
          </div>
          <DialogFooter><Button onClick={confirmOrder} disabled={saving}>Confirm Order</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark lead as lost</DialogTitle></DialogHeader>
          <div className="space-y-1.5"><Label>Reason *</Label><Textarea value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Price, postponed, bought elsewhere, no response…" /></div>
          <DialogFooter><Button variant="destructive" onClick={markLost} disabled={!lostReason.trim() || saving}>Mark Lost</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default QuotationCommercialPanel;
