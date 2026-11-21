import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/brand";
import { indiaDateKey } from "@/lib/deliveryPlanning";

// One place to mark an order delivered without a Trip: pick the items that went, the date,
// who delivered, and (optionally) what the customer paid at the door. The database step
// mark_quotation_delivered does the rest (status, balance, review request, alerts).

type Item = { id: string; description: string; quantity: number; delivered_at: string | null };
type Person = { user_id: string; display_name: string | null };
type Method = "" | "cash" | "upi" | "cheque" | "card" | "none";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- function and columns are newer than the generated types
const db = supabase as any;

export function MarkDeliveredButton({ quotationId, label = "Mark delivered", size = "sm", onDone }: {
  quotationId: string; label?: string; size?: "sm" | "default"; onDone?: () => void;
}) {
  const { isAdmin, isOfficeStaff, isDelivery } = useAuth();
  const [open, setOpen] = useState(false);
  if (!(isAdmin || isOfficeStaff || isDelivery)) return null;
  return (
    <>
      <Button type="button" size={size} className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}>
        <CheckCircle2 className="mr-1 h-4 w-4" aria-hidden="true" />{label}
      </Button>
      {open && <MarkDeliveredDialog quotationId={quotationId} onClose={() => setOpen(false)} onDone={() => { setOpen(false); onDone?.(); }} />}
    </>
  );
}

function MarkDeliveredDialog({ quotationId, onClose, onDone }: { quotationId: string; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const today = indiaDateKey();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [head, setHead] = useState<{ code: string; name: string; place: string; balance: number } | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [people, setPeople] = useState<Person[]>([]);
  const [on, setOn] = useState(today);
  const [by, setBy] = useState(user?.id ?? "");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<Method>("");
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [promise, setPromise] = useState("");
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    let off = false;
    (async () => {
      const [q, it, pr] = await Promise.all([
        db.from("quotations").select("quotation_id,party_name,party_place,total,advance_amount").eq("id", quotationId).maybeSingle(),
        db.from("quotation_items").select("id,description,quantity,delivered_at").eq("quotation_id", quotationId).order("created_at", { ascending: true }),
        db.from("profiles").select("user_id,display_name"),
      ]);
      if (off) return;
      if (q.error || it.error) { toast.error(q.error?.message || it.error?.message || "Could not load the order"); closeRef.current(); return; }
      const rows = (it.data ?? []) as Item[];
      setHead({ code: q.data?.quotation_id ?? "", name: q.data?.party_name ?? "Customer", place: q.data?.party_place ?? "",
        balance: Math.max(Number(q.data?.total ?? 0) - Number(q.data?.advance_amount ?? 0), 0) });
      setItems(rows);
      setPicked(new Set(rows.filter((r) => !r.delivered_at).map((r) => r.id)));
      setPeople(((pr.data ?? []) as Person[]).filter((p) => p.user_id).sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? "")));
      setLoading(false);
    })();
    return () => { off = true; };
  }, [quotationId]);

  const pending = items.filter((i) => !i.delivered_at);
  const allPicked = pending.length > 0 && pending.every((i) => picked.has(i.id));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const save = async () => {
    if (!picked.size) return toast.error("Tick at least one item that was delivered");
    if (method && method !== "none" && !(Number(amount) > 0)) return toast.error("Enter the amount the customer paid");
    if (method === "none" && !promise) return toast.error("Enter the date the customer promised to pay");
    setBusy(true);
    const res = await db.rpc("mark_quotation_delivered", {
      p_quotation_id: quotationId,
      p_item_ids: allPicked ? null : Array.from(picked),
      p_delivered_on: on || null,
      p_delivered_by: by || null,
      p_note: note || null,
      p_amount: method && method !== "none" ? Number(amount) : null,
      p_method: method || null,
      p_reference: ref || null,
      p_promise_date: method === "none" ? promise : null,
    });
    setBusy(false);
    if (res.error || !res.data?.ok) return toast.error(res.error?.message || "Could not mark delivery");
    toast.success(res.data.items_left > 0
      ? `Part delivered: ${res.data.delivered_items} item(s). ${res.data.items_left} still pending.`
      : "Delivered ✓ Balance and review request created.");
    onDone();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark delivered</DialogTitle>
          <DialogDescription>{head ? `${head.code ? head.code + " · " : ""}${head.name}${head.place ? " · " + head.place : ""}` : "Loading…"}</DialogDescription>
        </DialogHeader>

        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label>Items delivered</Label>
                {pending.length > 1 && <button type="button" className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setPicked(allPicked ? new Set() : new Set(pending.map((i) => i.id)))}>{allPicked ? "Untick all" : "Tick all"}</button>}
              </div>
              {!pending.length ? <p className="text-muted-foreground">All items are already delivered.</p> : (
                <ul className="divide-y rounded-lg border">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 px-3 py-2">
                      {i.delivered_at
                        ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="already delivered" />
                        : <Checkbox id={`it-${i.id}`} checked={picked.has(i.id)} onCheckedChange={() => toggle(i.id)} />}
                      <label htmlFor={`it-${i.id}`} className={`min-w-0 flex-1 truncate ${i.delivered_at ? "text-muted-foreground line-through" : ""}`}>{i.description || "Item"}</label>
                      <span className="shrink-0 text-xs text-muted-foreground">× {Number(i.quantity)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="dl-on">Delivered on</Label><Input id="dl-on" type="date" max={today} value={on} onChange={(e) => setOn(e.target.value)} /></div>
              <div><Label htmlFor="dl-by">Delivered by</Label>
                <select id="dl-by" value={by} onChange={(e) => setBy(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {people.map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name || "Staff"}{p.user_id === user?.id ? " (me)" : ""}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="dl-pay">Payment at delivery (optional)</Label>
              <select id="dl-pay" value={method} onChange={(e) => setMethod(e.target.value as Method)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Nothing to record</option>
                <option value="cash">💵 Cash collected</option>
                <option value="upi">📱 UPI received</option>
                <option value="cheque">🧾 Cheque received</option>
                <option value="card">💳 Card</option>
                <option value="none">❌ Payment കിട്ടിയില്ല (promised later)</option>
              </select>
              {head && head.balance > 0 && <p className="mt-1 text-xs text-muted-foreground">Order balance (before payments): {formatINR(head.balance)}</p>}
              {method && method !== "none" && <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Input type="number" inputMode="decimal" min="1" placeholder="Amount ₹" value={amount} onChange={(e) => setAmount(e.target.value)} />
                {method !== "cash" && <Input placeholder="UPI / cheque ref (optional)" value={ref} onChange={(e) => setRef(e.target.value)} />}
              </div>}
              {method === "none" && <div className="mt-2"><Label htmlFor="dl-promise">Customer promised to pay on</Label><Input id="dl-promise" type="date" min={today} value={promise} onChange={(e) => setPromise(e.target.value)} /></div>}
              {method && <p className="mt-1 text-xs text-muted-foreground">Office verifies this in Delivery Collections before the balance changes.</p>}
            </div>

            <div><Label htmlFor="dl-note">Note (optional)</Label><Input id="dl-note" maxLength={300} placeholder="e.g. fitted, customer happy" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={save} disabled={busy || loading || !pending.length}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
            {allPicked ? "Mark order delivered" : "Mark ticked items delivered"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
