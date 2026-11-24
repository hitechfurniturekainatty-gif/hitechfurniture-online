import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, PackagePlus, RefreshCw, Truck, XCircle } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { indiaDateKey } from "@/lib/deliveryPlanning";
import { addDays, lateness, type SupplierOrderStatus } from "@/lib/supplierOrders";

// Supplier Orders: every custom piece (and stock purchase) ordered from a supplier, with the
// date the supplier promised. "Not ordered yet" lists confirmed custom items nobody has
// ordered. A daily 10 AM check alerts the office about late orders.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are newer than the generated types
const db = supabase as any;

type NotOrdered = {
  item_id: string; quotation_id: string; quotation_code: string | null; party_name: string | null; party_place: string | null;
  description: string | null; quantity: number | null; image_url: string | null; expected_delivery_date: string | null;
};
type Order = {
  id: string; quotation_id: string | null; quotation_item_id: string | null; product_id: string | null;
  supplier_name: string; item_text: string | null; qty: number; ordered_on: string; expected_on: string;
  status: SupplierOrderStatus; received_on: string | null; note: string | null; created_at: string;
  quotations: { quotation_id: string | null; party_name: string | null; party_place: string | null } | null;
  quotation_items: { description: string | null; item_image_url: string | null; catalog_image_url: string | null; sketch_url: string | null } | null;
  products: { product_name: string | null; primary_image_url: string | null } | null;
};
type Draft = {
  quotation_id: string | null; quotation_item_id: string | null; product_id: string | null;
  title: string; item_text: string; qty: string; supplier: string; ordered_on: string; expected_on: string; note: string;
};

const fmt = (d: string | null) => d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
const orderWhat = (o: Order) => o.item_text || o.quotation_items?.description || o.products?.product_name || "Item";
const orderImage = (o: Order) => o.quotation_items?.item_image_url || o.quotation_items?.sketch_url || o.quotation_items?.catalog_image_url || o.products?.primary_image_url || null;

function Thumb({ src }: { src: string | null }) {
  return src
    ? <img src={src} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg border object-cover" />
    : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border bg-muted text-[10px] text-muted-foreground">No photo</div>;
}

function SupplierOrdersPage() {
  const [params, setParams] = useSearchParams();
  const onlyQuote = params.get("q");
  const today = indiaDateKey();
  const [tab, setTab] = useState<"todo" | "waiting" | "done">(params.get("tab") === "waiting" ? "waiting" : "todo");
  const [loading, setLoading] = useState(true);
  const [todo, setTodo] = useState<NotOrdered[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newDate, setNewDate] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const since = addDays(today, -60);
    const [a, b] = await Promise.all([
      db.rpc("custom_items_not_ordered"),
      db.from("supplier_orders")
        .select("id,quotation_id,quotation_item_id,product_id,supplier_name,item_text,qty,ordered_on,expected_on,status,received_on,note,created_at,quotations(quotation_id,party_name,party_place),quotation_items(description,item_image_url,catalog_image_url,sketch_url),products(product_name,primary_image_url)")
        .or(`status.eq.ordered,updated_at.gte.${since}`)
        .order("expected_on", { ascending: true }).limit(500),
    ]);
    if (a.error) toast.error(a.error.message); else setTodo(a.data ?? []);
    if (b.error) toast.error(b.error.message); else setOrders(b.data ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Opened from the Reorder Report: start a stock purchase for that product.
  useEffect(() => {
    const productId = params.get("product");
    if (!productId) return;
    (async () => {
      const { data } = await db.from("products").select("id,product_name,product_code").eq("id", productId).maybeSingle();
      if (data) setDraft({ quotation_id: null, quotation_item_id: null, product_id: data.id, title: `Stock purchase · ${data.product_name}`,
        item_text: `${data.product_name}${data.product_code ? ` (${data.product_code})` : ""}`, qty: params.get("qty") || "1",
        supplier: "", ordered_on: today, expected_on: addDays(today, 7), note: "" });
      const next = new URLSearchParams(params); next.delete("product"); next.delete("qty"); setParams(next, { replace: true });
    })();
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const suppliers = useMemo(() => Array.from(new Set(orders.map((o) => o.supplier_name.trim()))).sort(), [orders]);
  const inQuote = <T extends { quotation_id: string | null }>(rows: T[]) => onlyQuote ? rows.filter((r) => r.quotation_id === onlyQuote) : rows;
  const todoRows = inQuote(todo);
  const waiting = inQuote(orders.filter((o) => o.status === "ordered"));
  const done = inQuote(orders.filter((o) => o.status !== "ordered")).sort((x, y) => (y.received_on ?? y.created_at).localeCompare(x.received_on ?? x.created_at));
  const late = waiting.filter((o) => o.expected_on < today).length;

  const startFromItem = (r: NotOrdered) => setDraft({
    quotation_id: r.quotation_id, quotation_item_id: r.item_id, product_id: null,
    title: `${r.party_name ?? "Customer"}${r.quotation_code ? ` · ${r.quotation_code}` : ""}`,
    item_text: "", qty: String(Number(r.quantity) || 1), supplier: "", ordered_on: today,
    // Default: two days before the customer's delivery date, else one week.
    expected_on: r.expected_delivery_date && addDays(r.expected_delivery_date, -2) > today ? addDays(r.expected_delivery_date, -2) : addDays(today, 7),
    note: "",
  });
  const startBlank = () => setDraft({ quotation_id: null, quotation_item_id: null, product_id: null, title: "Stock purchase / other", item_text: "",
    qty: "1", supplier: "", ordered_on: today, expected_on: addDays(today, 7), note: "" });

  const save = async () => {
    if (!draft) return;
    if (!draft.supplier.trim()) return toast.error("Supplier-ന്റെ പേര് എഴുതുക");
    if (!draft.quotation_item_id && !draft.item_text.trim()) return toast.error("എന്താണ് order ചെയ്തത് എന്ന് എഴുതുക");
    if (!(Number(draft.qty) > 0)) return toast.error("Quantity ശരിയല്ല");
    if (draft.expected_on < draft.ordered_on) return toast.error("വരേണ്ട തീയതി order തീയതിക്ക് മുമ്പാകരുത്");
    if (draft.ordered_on > today) return toast.error("Order തീയതി ഭാവിയിലാകരുത്");
    setBusy("save");
    const { error } = await db.from("supplier_orders").insert({
      quotation_id: draft.quotation_id, quotation_item_id: draft.quotation_item_id, product_id: draft.product_id,
      supplier_name: draft.supplier.trim(), item_text: draft.item_text.trim() || null, qty: Number(draft.qty),
      ordered_on: draft.ordered_on, expected_on: draft.expected_on, note: draft.note.trim() || null,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Saved. ${fmt(draft.expected_on)} കഴിഞ്ഞിട്ടും വന്നില്ലെങ്കിൽ alert വരും.`);
    setDraft(null); setTab("waiting"); void load();
  };

  const update = async (o: Order, patch: Partial<Pick<Order, "status" | "expected_on">>, ok: string) => {
    setBusy(o.id);
    const { error } = await db.from("supplier_orders").update(patch).eq("id", o.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(ok); void load();
  };

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="admin-page-head flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="admin-accent-tile admin-accent-blush flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"><Truck className="h-5 w-5" /></div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl">Supplier Orders</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Custom item supplier-ന് order ചെയ്താൽ ഇവിടെ എഴുതുക: ആർക്ക്, എന്ന്, എന്ന് വരും. തീയതി കഴിഞ്ഞാൽ രാവിലെ 10-ന് alert വരും.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="mr-2 h-4 w-4" />Refresh</>}</Button>
            <Button onClick={startBlank}><PackagePlus className="mr-2 h-4 w-4" />New supplier order</Button>
          </div>
        </div>

        {onlyQuote && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <span>Showing one order only.</span>
            <Button variant="ghost" size="sm" onClick={() => { const n = new URLSearchParams(params); n.delete("q"); setParams(n); }}>Show all</Button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => setTab("todo")} className={`rounded-xl border p-3 text-left ${todoRows.length ? "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20" : ""}`}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Not ordered yet</p><p className="mt-1 text-2xl font-semibold">{todoRows.length}</p>
          </button>
          <button type="button" onClick={() => setTab("waiting")} className="rounded-xl border p-3 text-left">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Waiting from supplier</p><p className="mt-1 text-2xl font-semibold">{waiting.length}</p>
          </button>
          <button type="button" onClick={() => setTab("waiting")} className={`rounded-xl border p-3 text-left ${late ? "border-destructive/30 bg-destructive/10" : ""}`}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Late</p><p className="mt-1 text-2xl font-semibold">{late}</p>
          </button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="todo">Not ordered yet ({todoRows.length})</TabsTrigger>
            <TabsTrigger value="waiting">Waiting ({waiting.length})</TabsTrigger>
            <TabsTrigger value="done">Received ({done.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
          <div className="space-y-2">
            {tab === "todo" && (todoRows.length === 0
              ? <Empty text="എല്ലാ custom item-ഉം order ചെയ്തിട്ടുണ്ട്." />
              : todoRows.map((r) => (
                <div key={r.item_id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                  <Thumb src={r.image_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.description || "Custom item"} <span className="text-muted-foreground">× {Number(r.quantity) || 1}</span></p>
                    <p className="truncate text-xs text-muted-foreground">
                      <Link to={`/admin/quotations/${r.quotation_id}`} className="text-primary hover:underline">{r.party_name ?? "Customer"}{r.quotation_code ? ` · ${r.quotation_code}` : ""}</Link>
                      {r.party_place ? ` · ${r.party_place}` : ""}
                    </p>
                    <p className={`text-xs ${r.expected_delivery_date && r.expected_delivery_date < today ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                      Customer delivery: {r.expected_delivery_date ? fmt(r.expected_delivery_date) : "date not set"}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => startFromItem(r)}>Ordered from…</Button>
                </div>
              )))}

            {tab === "waiting" && (waiting.length === 0
              ? <Empty text="Supplier-ൽ നിന്ന് വരാനുള്ള ഒന്നുമില്ല." />
              : waiting.map((o) => {
                const lt = lateness(o.status, o.expected_on, today);
                return (
                  <div key={o.id} className={`rounded-xl border bg-card p-3 ${lt.kind === "late" ? "border-destructive/40" : ""}`}>
                    <div className="flex items-center gap-3">
                      <Thumb src={orderImage(o)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{orderWhat(o)} <span className="text-muted-foreground">× {Number(o.qty)}</span></p>
                        <p className="truncate text-xs text-muted-foreground">
                          <b className="text-foreground">{o.supplier_name}</b> · ordered {fmt(o.ordered_on)}
                          {o.quotation_id ? <> · for <Link to={`/admin/quotations/${o.quotation_id}`} className="text-primary hover:underline">{o.quotations?.party_name ?? "customer"}</Link></> : " · stock"}
                        </p>
                        {o.note && <p className="truncate text-xs text-muted-foreground">{o.note}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium">{fmt(o.expected_on)}</p>
                        <Badge variant={lt.kind === "late" ? "destructive" : "secondary"} className="mt-1">
                          {lt.kind === "late" ? <AlertTriangle className="mr-1 h-3 w-3" /> : <Clock3 className="mr-1 h-3 w-3" />}{lt.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
                      <Button size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800" disabled={busy === o.id}
                        onClick={() => void update(o, { status: "received" }, o.quotation_id ? "Received. ഇനി customer-ന്റെ delivery plan ചെയ്യുക." : "Received.")}>
                        <CheckCircle2 className="mr-1 h-4 w-4" />Received
                      </Button>
                      <Input type="date" min={o.ordered_on} className="h-9 w-40" value={newDate[o.id] ?? ""} onChange={(e) => setNewDate((m) => ({ ...m, [o.id]: e.target.value }))} aria-label="New promised date" />
                      <Button size="sm" variant="outline" disabled={!newDate[o.id] || busy === o.id}
                        onClick={() => void update(o, { expected_on: newDate[o.id] }, "New date saved.")}>New date</Button>
                      <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" disabled={busy === o.id}
                        onClick={() => { if (window.confirm("ഈ supplier order cancel ചെയ്യണോ?")) void update(o, { status: "cancelled" }, "Cancelled."); }}>
                        <XCircle className="mr-1 h-4 w-4" />Cancel
                      </Button>
                    </div>
                  </div>
                );
              }))}

            {tab === "done" && (done.length === 0
              ? <Empty text="കഴിഞ്ഞ 60 ദിവസത്തിൽ ഒന്നുമില്ല." />
              : done.map((o) => (
                <div key={o.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm">
                  <Thumb src={orderImage(o)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{orderWhat(o)} <span className="text-muted-foreground">× {Number(o.qty)}</span></p>
                    <p className="truncate text-xs text-muted-foreground">{o.supplier_name}{o.quotations?.party_name ? ` · for ${o.quotations.party_name}` : ""}</p>
                  </div>
                  <Badge variant={o.status === "received" ? "secondary" : "outline"}>
                    {o.status === "received" ? `Received ${fmt(o.received_on)}${o.received_on && o.received_on > o.expected_on ? " (late)" : ""}` : "Cancelled"}
                  </Badge>
                </div>
              )))}
          </div>
        )}
      </div>

      <Dialog open={!!draft} onOpenChange={(open) => { if (!open && busy !== "save") setDraft(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supplier order</DialogTitle>
            <DialogDescription>{draft?.title}</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3 text-sm">
              <div>
                <Label htmlFor="so-supplier">Supplier</Label>
                <Input id="so-supplier" list="so-suppliers" autoFocus value={draft.supplier} maxLength={120} placeholder="Supplier / creditor name"
                  onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} />
                <datalist id="so-suppliers">{suppliers.map((s) => <option key={s} value={s} />)}</datalist>
              </div>
              <div>
                <Label htmlFor="so-what">{draft.quotation_item_id ? "Extra detail (optional)" : "What was ordered"}</Label>
                <Input id="so-what" value={draft.item_text} maxLength={300} placeholder={draft.quotation_item_id ? "e.g. walnut finish, 6×7 ft" : "e.g. 3-door wardrobe, white"}
                  onChange={(e) => setDraft({ ...draft, item_text: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label htmlFor="so-qty">Qty</Label><Input id="so-qty" type="number" min="1" inputMode="decimal" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} /></div>
                <div className="col-span-2"><Label htmlFor="so-on">Ordered on</Label><Input id="so-on" type="date" max={today} value={draft.ordered_on} onChange={(e) => setDraft({ ...draft, ordered_on: e.target.value })} /></div>
              </div>
              <div>
                <Label htmlFor="so-exp">Supplier promised by</Label>
                <Input id="so-exp" type="date" min={draft.ordered_on} value={draft.expected_on} onChange={(e) => setDraft({ ...draft, expected_on: e.target.value })} />
                <div className="mt-1 flex gap-1">
                  {[7, 15, 30].map((d) => <Button key={d} type="button" size="sm" variant="outline" className="h-7 px-2 text-xs"
                    onClick={() => setDraft({ ...draft, expected_on: addDays(draft.ordered_on, d) })}>+{d} days</Button>)}
                </div>
              </div>
              <div><Label htmlFor="so-note">Note (optional)</Label><Input id="so-note" value={draft.note} maxLength={500} placeholder="e.g. advance paid ₹2,000, phone 98…" onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDraft(null)} disabled={busy === "save"}>Cancel</Button>
            <Button onClick={() => void save()} disabled={busy === "save"}>{busy === "save" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 h-6 w-6" />{text}</div>;
}

export default SupplierOrdersPage;
