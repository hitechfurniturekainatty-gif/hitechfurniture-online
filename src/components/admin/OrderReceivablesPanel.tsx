import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { FileText, History, IndianRupee, Loader2, MessageCircle, ReceiptIndianRupee, RefreshCw } from "lucide-react";
import { formatINR } from "@/lib/brand";
import { openWhatsAppApp } from "@/lib/whatsapp";
import { generateReceivableReceiptPdf } from "@/lib/receivableReceiptPdf";
import { shareFilesNative } from "@/lib/nativeShare";

type Row = {
  id: string;
  quotation_id: string | null;
  bill_no: string | null;
  customer_name: string | null;
  place: string | null;
  phone: string | null;
  pending_amount: number;
  original_amount: number | null;
  source: string | null;
  closed_at: string | null;
  updated_at: string;
};

type Payment = {
  id: string;
  receivable_id: string;
  amount: number;
  payment_method: string | null;
  reference_no: string | null;
  note: string | null;
  received_at: string;
};

type PaymentAllocation = {
  payment_id: string;
  amount: number;
  quotation_item_id: string;
  description: string;
};

type PaymentItem = {
  id: string;
  description: string;
  quantity: number;
  ordered_qty: number;
  unit_price: number;
  amount: number;
  allocated_to_date?: number;
};

const methodLabel = (v: string | null) =>
  ({ cash: "Cash", upi: "UPI / GPay", card: "Card", bank: "Bank Transfer", cheque: "Cheque", other: "Other" }[v || ""] || v || "—");

export default function OrderReceivablesPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pay, setPay] = useState<Row | null>(null);
  const [historyFor, setHistoryFor] = useState<Row | null>(null);
  const [history, setHistory] = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState<string | null>(null);
  const [paymentItems, setPaymentItems] = useState<PaymentItem[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [itemsLoading, setItemsLoading] = useState(false);
  const [historyAllocations, setHistoryAllocations] = useState<PaymentAllocation[]>([]);
  const paymentRequestKeyRef = useRef<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("receivables")
      .select("id,quotation_id,bill_no,customer_name,place,phone,pending_amount,original_amount,source,closed_at,updated_at")
      .eq("source", "quotation")
      .is("closed_at", null)
      .gt("pending_amount", 0)
      .order("pending_amount", { ascending: false });
    if (error) toast({ title: "Receivables load failed", description: error.message, variant: "destructive" });
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.pending_amount || 0), 0), [rows]);
  const allocatedTotal = useMemo(
    () => Object.values(allocations).reduce((sum, value) => sum + (Number(value) || 0), 0),
    [allocations],
  );

  const openReceive = async (row: Row) => {
    setPay(row);
    setAmount(String(row.pending_amount));
    setReference("");
    setAllocations({});
    setPaymentItems([]);
    paymentRequestKeyRef.current = crypto.randomUUID();
    if (!row.quotation_id) return;

    setItemsLoading(true);
    const [{ data, error }, { data: priorAllocationRows }] = await Promise.all([
      (supabase as any)
        .from("quotation_items")
        .select("id,description,quantity,ordered_qty,unit_price,amount")
        .eq("quotation_id", row.quotation_id)
        .order("display_order", { ascending: true }),
      (supabase as any)
        .from("quotation_item_payment_allocations")
        .select("quotation_item_id,amount")
        .eq("quotation_id", row.quotation_id),
    ]);
    setItemsLoading(false);

    if (error) {
      toast({ title: "Order items load failed", description: error.message, variant: "destructive" });
      return;
    }

    const paidByItem = new Map<string, number>();
    for (const allocation of (priorAllocationRows ?? []) as Array<{ quotation_item_id: string; amount: number }>) {
      paidByItem.set(
        allocation.quotation_item_id,
        (paidByItem.get(allocation.quotation_item_id) ?? 0) + Number(allocation.amount || 0),
      );
    }

    setPaymentItems(
      ((data ?? []) as PaymentItem[])
        .filter((item) => Number(item.ordered_qty || 0) > 0)
        .map((item) => ({ ...item, allocated_to_date: paidByItem.get(item.id) ?? 0 })),
    );
  };

  const receive = async () => {
    if (!pay) return;
    const n = Number(amount);
    if (!n || n <= 0 || n > Number(pay.pending_amount)) {
      toast({ title: "Enter a valid received amount", variant: "destructive" });
      return;
    }
    if (allocatedTotal > n) {
      toast({
        title: "Item allocation is more than payment",
        description: `Allocated ${formatINR(allocatedTotal)} but received amount is ${formatINR(n)}.`,
        variant: "destructive",
      });
      return;
    }

    const itemAllocations = paymentItems
      .map((item) => ({ item_id: item.id, amount: Number(allocations[item.id] || 0) }))
      .filter((entry) => entry.amount > 0);

    setSaving(true);
    const requestKey = paymentRequestKeyRef.current ?? crypto.randomUUID();
    paymentRequestKeyRef.current = requestKey;

    const { data, error } = await (supabase as any).rpc("record_order_payment", {
      _receivable_id: pay.id,
      _amount: n,
      _payment_method: method,
      _reference_no: reference.trim() || null,
      _note: null,
      _allocations: itemAllocations,
      _request_key: requestKey,
    });
    setSaving(false);

    if (error || !data?.ok) {
      const message =
        data?.error === "amount_exceeds_pending"
          ? `Payment is above the current pending balance (${formatINR(Number(data.pending_amount || 0))}). Refresh and try again.`
          : data?.error === "allocation_item_not_ordered"
            ? "Payment can only be allocated to quantities already converted to an order."
            : data?.error === "allocations_exceed_payment"
              ? "Item allocations cannot exceed the received amount."
              : data?.error || error?.message;
      toast({ title: "Payment save failed", description: message, variant: "destructive" });
      return;
    }

    paymentRequestKeyRef.current = null;
    toast({
      title: data.already_recorded ? "Payment already recorded" : "Amount received",
      description: itemAllocations.length
        ? `${formatINR(n)} recorded atomically; ${formatINR(Number(data.allocated_total ?? allocatedTotal))} allocated to order items.`
        : `${formatINR(n)} recorded from ${pay.customer_name || "customer"}.`,
    });
    setPay(null);
    setAmount("");
    setReference("");
    setAllocations({});
    setPaymentItems([]);
    load();
  };

  const showHistory = async (r: Row) => {
    setHistoryFor(r);
    setHistoryLoading(true);
    setHistoryAllocations([]);

    const { data, error } = await supabase
      .from("receivable_payments")
      .select("id,receivable_id,amount,payment_method,reference_no,note,received_at")
      .eq("receivable_id", r.id)
      .order("received_at", { ascending: false });

    if (error) {
      toast({ title: "History load failed", description: error.message, variant: "destructive" });
      setHistory([]);
      setHistoryLoading(false);
      return;
    }

    const payments = (data ?? []) as Payment[];
    setHistory(payments);

    if (payments.length > 0) {
      const paymentIds = payments.map((p) => p.id);
      const { data: allocationRows } = await (supabase as any)
        .from("quotation_item_payment_allocations")
        .select("payment_id,amount,quotation_item_id")
        .in("payment_id", paymentIds);

      const rawAllocations = (allocationRows ?? []) as Array<{
        payment_id: string;
        amount: number;
        quotation_item_id: string;
      }>;

      if (rawAllocations.length > 0) {
        const itemIds = Array.from(new Set(rawAllocations.map((a) => a.quotation_item_id)));
        const { data: itemRows } = await (supabase as any)
          .from("quotation_items")
          .select("id,description")
          .in("id", itemIds);
        const names = new Map<string, string>(
          ((itemRows ?? []) as Array<{ id: string; description: string }>).map((item) => [item.id, item.description]),
        );
        setHistoryAllocations(rawAllocations.map((a) => ({
          ...a,
          description: names.get(a.quotation_item_id) || "Order item",
        })));
      }
    }

    setHistoryLoading(false);
  };

  const remind = (r: Row) => {
    if (!r.phone) return toast({ title: "Customer phone missing", variant: "destructive" });
    openWhatsAppApp(
      r.phone,
      `Hi ${r.customer_name || ""}, this is a reminder from Hitech Furniture & Interiors. Balance to receive for ${r.bill_no || "your order"}: ${formatINR(Number(r.pending_amount || 0))}. Thank you.`,
    );
  };

  const shareReceipt = async (p: Payment) => {
    if (!historyFor) return;
    setReceiptBusy(p.id);
    try {
      const receiptNo = `RCPT-${p.id.slice(0, 8).toUpperCase()}`;
      const blob = generateReceivableReceiptPdf({
        receiptNo,
        orderNo: historyFor.bill_no,
        customerName: historyFor.customer_name,
        place: historyFor.place,
        phone: historyFor.phone,
        amount: Number(p.amount),
        paymentMethod: p.payment_method,
        referenceNo: p.reference_no,
        receivedAt: p.received_at,
        currentBalance: Number(historyFor.pending_amount || 0),
      });
      await shareFilesNative(
        [blob],
        `${receiptNo}-${historyFor.bill_no || "Payment"}`,
        `Payment receipt ${receiptNo}${historyFor.bill_no ? ` for ${historyFor.bill_no}` : ""} — Hitech Furniture & Interiors.`,
        "pdf",
      );
    } catch (e: any) {
      toast({ title: "Receipt generation failed", description: e?.message || "Try again", variant: "destructive" });
    } finally {
      setReceiptBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold">Order Receivables</h2>
          <p className="text-xs text-muted-foreground">Customer → Hitech: balance still to receive after delivery.</p>
        </div>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="mr-1 h-4 w-4" />Refresh</Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Customers to Collect</p><p className="text-2xl font-bold">{rows.length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total Balance to Receive</p><p className="text-2xl font-bold">{formatINR(total)}</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">No delivered-order balance pending.</p>
      ) : rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5"><Badge>Auto from Order</Badge><span className="font-mono text-xs font-semibold">{r.bill_no}</span></div>
                <p className="mt-1 font-medium">{r.customer_name}<span className="font-normal text-muted-foreground"> · {r.place}</span></p>
                {r.phone && <p className="text-xs text-muted-foreground">{r.phone}</p>}
              </div>
              <div className="sm:text-right">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance to Receive</p>
                <p className="font-display text-xl font-bold">{formatINR(Number(r.pending_amount))}</p>
                {r.original_amount != null && <p className="text-[10px] text-muted-foreground">Original {formatINR(Number(r.original_amount))}</p>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" onClick={() => openReceive(r)}><IndianRupee className="mr-1 h-4 w-4" />Receive</Button>
                <Button size="sm" variant="outline" onClick={() => showHistory(r)}><History className="mr-1 h-4 w-4" />History</Button>
                {r.phone && <Button size="sm" variant="outline" onClick={() => remind(r)}><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</Button>}
                {r.quotation_id && <Button asChild size="sm" variant="ghost"><Link to={`/admin/quotations/${r.quotation_id}`}><ReceiptIndianRupee className="mr-1 h-4 w-4" />Order</Link></Button>}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!pay} onOpenChange={(o) => { if (!o) { setPay(null); setAllocations({}); setPaymentItems([]); paymentRequestKeyRef.current = null; } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Receive from Customer</DialogTitle></DialogHeader>
          {pay && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-3">
                <p className="font-medium">{pay.customer_name}</p>
                <p className="text-xs text-muted-foreground">Balance: {formatINR(Number(pay.pending_amount))}</p>
              </div>
              <div><Label>Amount received</Label><Input type="number" min="0" max={pay.pending_amount} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div><Label>Payment method</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI / GPay</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="bank">Bank Transfer</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
              <div><Label>Reference / receipt no. (optional)</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI ref, receipt no..." /></div>

              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Allocate payment by item</p>
                    <p className="text-[11px] text-muted-foreground">Optional. Leave blank for an unallocated/general payment.</p>
                  </div>
                  <Badge variant={allocatedTotal > Number(amount || 0) ? "destructive" : "secondary"}>
                    {formatINR(allocatedTotal)} / {formatINR(Number(amount || 0))}
                  </Badge>
                </div>
                {itemsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                ) : paymentItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No order items available for allocation.</p>
                ) : (
                  <div className="max-h-56 space-y-2 overflow-y-auto">
                    {paymentItems.map((item) => (
                      <div key={item.id} className="grid grid-cols-[1fr_120px] items-center gap-3 rounded-md bg-muted/40 p-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">{item.description || "Unnamed item"}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Ordered {Number(item.ordered_qty || 0)}/{Number(item.quantity || 0)} · Item total {formatINR(Number(item.amount || 0))} · Allocated {formatINR(Number(item.allocated_to_date || 0))}
                          </p>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="₹ amount"
                          value={allocations[item.id] ?? ""}
                          onChange={(e) => setAllocations((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPay(null)}>Cancel</Button>
            <Button onClick={receive} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save Received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Collection History · {historyFor?.customer_name}</DialogTitle></DialogHeader>
          {historyFor && <div className="rounded-lg border p-3"><div className="flex justify-between gap-3"><div><p className="text-xs text-muted-foreground">Order</p><p className="font-mono text-sm font-semibold">{historyFor.bill_no}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Current Balance</p><p className="font-semibold">{formatINR(Number(historyFor.pending_amount))}</p></div></div></div>}
          {historyLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No collection entries yet.</p>
          ) : (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {history.map((p, i) => (
                <div key={p.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{formatINR(Number(p.amount))}</p>
                      <p className="text-xs text-muted-foreground">{methodLabel(p.payment_method)}{p.reference_no ? ` · Ref: ${p.reference_no}` : ""}</p>
                      {p.note && <p className="mt-1 text-xs">{p.note}</p>}
                      {historyAllocations.filter((a) => a.payment_id === p.id).length > 0 && (
                        <div className="mt-2 space-y-1 rounded-md bg-muted/50 p-2">
                          {historyAllocations.filter((a) => a.payment_id === p.id).map((a) => (
                            <div key={a.quotation_item_id} className="flex justify-between gap-3 text-[11px]">
                              <span className="truncate text-muted-foreground">{a.description}</span>
                              <span className="shrink-0 font-semibold">{formatINR(Number(a.amount))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1"><Badge variant="secondary">Payment {history.length - i}</Badge><p className="text-[10px] text-muted-foreground">{new Date(p.received_at).toLocaleString("en-IN")}</p><Button size="sm" variant="outline" disabled={receiptBusy === p.id} onClick={() => shareReceipt(p)}>{receiptBusy === p.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1 h-3.5 w-3.5" />}Receipt PDF</Button></div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setHistoryFor(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
