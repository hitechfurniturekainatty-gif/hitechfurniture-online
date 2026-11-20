import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/brand";

type Method = "cash" | "upi" | "cheque" | "card" | "none";
type Entry = { id: string; amount: number; method: Method; reference_no: string | null; promise_date: string | null; status: string; collected_at: string };
const METHODS: [Method, string][] = [["cash", "💵 Cash"], ["upi", "📱 UPI / GPay"], ["cheque", "🧾 Cheque"], ["card", "💳 Card"], ["none", "❌ കിട്ടിയില്ല"]];
const tomorrow = () => { const d = new Date(Date.now() + 86400000); return d.toISOString().slice(0, 10); };

/**
 * Driver records what the customer paid at the door. The entry waits for the office to
 * verify (count cash / check UPI); only then does the customer's balance change.
 */
export function DeliveryPaymentDialog({ open, onClose, quotationId, tripId, partyName, balance }: {
  open: boolean; onClose: () => void; quotationId: string; tripId: string | null; partyName: string; balance: number;
}) {
  const [method, setMethod] = useState<Method>("cash");
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [promise, setPromise] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);

  const load = async () => {
    const r = await (supabase as any).from("delivery_collections").select("id,amount,method,reference_no,promise_date,status,collected_at").eq("quotation_id", quotationId).order("collected_at", { ascending: false }).limit(20);
    if (!r.error) setEntries(r.data ?? []);
  };
  useEffect(() => { if (open) { setMethod("cash"); setAmount(balance > 0 ? String(Math.round(balance)) : ""); setRef(""); setPromise(""); setNote(""); void load(); } }, [open, quotationId]);

  const pending = entries.filter(e => e.status === "pending").reduce((s, e) => s + Number(e.amount), 0);
  const amt = method === "none" ? 0 : Number(amount) || 0;
  const short = method !== "none" && balance > 0 && amt < balance;

  const save = async () => {
    if (busy) return;
    if (method !== "none" && amt <= 0) return toast({ title: "കിട്ടിയ തുക ഇടുക", variant: "destructive" });
    if (method === "upi" && !ref.trim()) return toast({ title: "UPI reference / last 4 digits ഇടുക", variant: "destructive" });
    if ((method === "none" || short) && !promise) return toast({ title: "ബാക്കി എന്ന് തരുമെന്ന് പറഞ്ഞു? (promise date)", variant: "destructive" });
    if (amt > balance && balance > 0 && !window.confirm(`Balance ${formatINR(balance)}-നേക്കാൾ കൂടുതലാണ് (${formatINR(amt)}). ശരിയാണോ?`)) return;
    setBusy(true);
    const { error } = await (supabase as any).from("delivery_collections").insert({
      quotation_id: quotationId, trip_id: tripId, amount: amt, method, reference_no: ref.trim() || null,
      promise_date: promise || null, note: note.trim() || null,
    });
    setBusy(false);
    if (error) return toast({ title: "Save ചെയ്യാൻ പറ്റിയില്ല", description: error.message, variant: "destructive" });
    toast({ title: method === "none" ? "രേഖപ്പെടുത്തി: payment കിട്ടിയില്ല" : `${formatINR(amt)} രേഖപ്പെടുത്തി`, description: "Office verify ചെയ്യുമ്പോൾ balance കുറയും. Cash ഇന്ന് തന്നെ office-ൽ ഏൽപ്പിക്കുക." });
    onClose();
  };

  return <Dialog open={open} onOpenChange={o => !o && !busy && onClose()}><DialogContent className="max-w-md">
    <DialogHeader><DialogTitle>Payment · {partyName}</DialogTitle></DialogHeader>
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm">
      Balance to collect: <b>{formatINR(balance)}</b>
      {pending > 0 && <p className="text-xs text-amber-800">ഇതിനകം രേഖപ്പെടുത്തിയത് (verify ആകാൻ ബാക്കി): {formatINR(pending)}</p>}
    </div>
    <div className="grid grid-cols-2 gap-2">{METHODS.map(([v, l]) =>
      <Button key={v} type="button" variant={method === v ? "default" : "outline"} onClick={() => setMethod(v)} className={v === "none" ? "col-span-2" : ""}>{l}</Button>)}</div>
    {method !== "none" && <label className="block text-sm">കിട്ടിയ തുക (₹)<Input inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))} /></label>}
    {(method === "upi" || method === "cheque" || method === "card") && <label className="block text-sm">{method === "cheque" ? "Cheque number" : "UPI / transaction ref (last 4+ digits)"}<Input value={ref} onChange={e => setRef(e.target.value)} /></label>}
    {(method === "none" || short) && <label className="block text-sm">ബാക്കി എന്ന് തരും? (promise date) *<Input type="date" min={tomorrow()} value={promise} onChange={e => setPromise(e.target.value)} /></label>}
    <Textarea placeholder={method === "none" ? "എന്തുകൊണ്ട് കിട്ടിയില്ല?" : "Note (ഐച്ഛികം)"} value={note} onChange={e => setNote(e.target.value)} />
    <Button disabled={busy} onClick={save} className="w-full">{busy ? "Saving…" : "Save payment"}</Button>
    {entries.length > 0 && <div className="space-y-1 border-t pt-2 text-xs">
      <p className="font-semibold">ഈ order-ൽ രേഖപ്പെടുത്തിയവ</p>
      {entries.map(e => <div key={e.id} className="flex items-center justify-between gap-2">
        <span>{new Date(e.collected_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })} · {e.method === "none" ? `കിട്ടിയില്ല (promise ${e.promise_date ?? "-"})` : `${formatINR(Number(e.amount))} ${e.method.toUpperCase()}`}</span>
        <Badge variant={e.status === "verified" ? "default" : e.status === "rejected" ? "destructive" : "outline"}>{e.status === "pending" ? "verify ആകാൻ" : e.status}</Badge>
      </div>)}
    </div>}
  </DialogContent></Dialog>;
}
