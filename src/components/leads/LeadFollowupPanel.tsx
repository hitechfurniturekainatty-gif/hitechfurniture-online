import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LEAD_OUTCOMES, leadOutcomeLabel, followUpInDays, type LeadOutcome } from "@/lib/leadSource";

type Followup = { id: string; outcome: string; note: string | null; next_follow_up_at: string | null; created_by: string | null; created_at: string };

/**
 * Follow-up history for one lead plus a "log this call" form.
 * Each entry is a separate row in sales_lead_followups, so nothing is overwritten.
 */
export function LeadFollowupPanel({ leadId, open, names, onLogged }: {
  leadId: string;
  /** Lead is pending/contacted: a next follow-up date is required. */
  open: boolean;
  names: Record<string, string>;
  onLogged: () => void;
}) {
  const [items, setItems] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState<LeadOutcome | "">("");
  const [note, setNote] = useState("");
  const [next, setNext] = useState(followUpInDays(1));
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await (supabase as any).from("sales_lead_followups")
      .select("id,outcome,note,next_follow_up_at,created_by,created_at")
      .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(100);
    if (r.error) toast.error(r.error.message); else setItems(r.data ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [leadId]);

  const needsDate = open && outcome !== "not_interested";
  const save = async () => {
    if (busy) return;
    if (!outcome) return toast.error("Call-ന്റെ result തിരഞ്ഞെടുക്കുക");
    if (outcome === "note" && !note.trim()) return toast.error("Note എഴുതുക");
    if (needsDate && !next) return toast.error("അടുത്ത ഫോളോ അപ്പ് തീയതി ഇടുക");
    setBusy(true);
    const r = await (supabase as any).rpc("log_sales_lead_followup", {
      p_lead_id: leadId, p_outcome: outcome, p_note: note.trim() || null,
      p_next_follow_up_at: needsDate && next ? new Date(next).toISOString() : null,
    });
    setBusy(false);
    if (r.error || !r.data?.ok) return toast.error(r.error?.message || r.data?.error || "Could not save");
    toast.success(outcome === "not_interested" ? "Saved · lead Lost ആക്കാൻ Status മാറ്റുക" : "Follow-up saved");
    setOutcome(""); setNote(""); setNext(followUpInDays(1));
    void load(); onLogged();
  };

  return <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
    {open && <div className="space-y-2">
      <p className="text-sm font-semibold">ഇപ്പോൾ വിളിച്ചോ? Result രേഖപ്പെടുത്തുക</p>
      <div className="flex flex-wrap gap-1.5">{LEAD_OUTCOMES.map(([v, l]) =>
        <Button key={v} type="button" size="sm" variant={outcome === v ? "default" : "outline"} onClick={() => setOutcome(v)}>{l}</Button>)}</div>
      <Textarea aria-label="Follow-up note" placeholder="എന്ത് സംസാരിച്ചു? (size, budget, എപ്പോൾ വരും…)" value={note} onChange={e => setNote(e.target.value)} />
      {needsDate && <div className="space-y-1">
        <p className="text-xs text-muted-foreground">അടുത്ത call / meeting</p>
        <div className="flex flex-wrap gap-1.5">{[[0, "ഇന്ന്"], [1, "നാളെ"], [3, "3 ദിവസം"], [7, "1 ആഴ്ച"]].map(([d, l]) =>
          <Button key={d} type="button" size="sm" variant="ghost" onClick={() => setNext(d === 0 ? (() => { const t = new Date(Date.now() + 2 * 3600e3); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`; })() : followUpInDays(d as number))}>{l}</Button>)}</div>
        <Input aria-label="Next follow-up" type="datetime-local" value={next} onChange={e => setNext(e.target.value)} />
      </div>}
      <Button type="button" className="w-full" disabled={busy || !outcome} onClick={save}>{busy ? "Saving…" : "Save follow-up"}</Button>
    </div>}
    <div>
      <p className="mb-2 text-sm font-semibold">Follow-up history</p>
      {loading ? <p className="text-xs">Loading…</p> : !items.length ? <p className="text-xs text-muted-foreground">ഇതുവരെ follow-up ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.</p> :
        <ol className="space-y-2 border-l-2 pl-3">{items.map(f => <li key={f.id} className="text-sm">
          <p className="font-medium">{leadOutcomeLabel(f.outcome)}</p>
          {f.note && <p className="whitespace-pre-wrap text-muted-foreground">{f.note}</p>}
          <p className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {f.created_by ? names[f.created_by] || "Staff" : "Not recorded"}
            {f.next_follow_up_at ? ` · Next: ${new Date(f.next_follow_up_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}</p>
        </li>)}</ol>}
    </div>
  </div>;
}
