import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SingleImagePicker } from "@/components/admin/SingleImagePicker";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, ArrowLeft, Plus, Trash2, Save, Download, MessageCircle,
  Package, HardHat, Send, FileText, Search,
} from "lucide-react";
import { generateQuotationPdf, generateJobWorkPdf } from "@/lib/quotationPdf";
import { formatINR } from "@/lib/brand";

type QItem = {
  id: string;
  description: string;
  item_image_url: string | null;
  measurement: string | null;
  measurement_image_url: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
  display_order: number;
  product_id: string | null;
  _isNew?: boolean;
  _dirty?: boolean;
};

type Quotation = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string;
  party_phone: string | null;
  party_address: string | null;
  quotation_date: string;
  expected_delivery_date: string | null;
  gst_percent: number;
  subtotal: number;
  gst_amount: number;
  total: number;
  status: string;
  notes: string | null;
};

type Worker = { id: string; name: string; whatsapp_number: string; trade: string | null };
type Product = { id: string; product_name: string; product_code: string; mrp: number; offer_price: number | null; product_images: { image_url: string }[] };

const GST_OPTIONS = [0, 5, 12, 18, 28];
const STATUS_OPTIONS = ["draft", "sent", "accepted", "rejected", "expired"];

const AdminQuotationEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isOfficeStaff, isMeasurementStaff } = useAuth();

  const [q, setQ] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [headerDirty, setHeaderDirty] = useState(false);

  // dialogs
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const [jobOpen, setJobOpen] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [selectedWorker, setSelectedWorker] = useState<string>("");
  const [jobNotes, setJobNotes] = useState("");
  const [generatingJob, setGeneratingJob] = useState(false);

  const canEditPrice = isOfficeStaff;
  const isFieldOnly = isMeasurementStaff && !isOfficeStaff;

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: quote, error: e1 }, { data: lines, error: e2 }] = await Promise.all([
      supabase.from("quotations").select("*").eq("id", id).maybeSingle(),
      supabase.from("quotation_items").select("*").eq("quotation_id", id).order("display_order", { ascending: true }),
    ]);
    if (e1 || !quote) {
      toast({ title: "Quotation not found", variant: "destructive" });
      navigate("/admin/quotations");
      return;
    }
    if (e2) toast({ title: "Items load failed", description: e2.message, variant: "destructive" });
    setQ(quote as Quotation);
    setItems(((lines ?? []) as QItem[]).map((x) => ({ ...x })));
    setHeaderDirty(false);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0), [items]);
  const gstAmount = useMemo(() => Math.round(subtotal * ((q?.gst_percent ?? 0) / 100) * 100) / 100, [subtotal, q?.gst_percent]);
  const total = subtotal + gstAmount;

  const updateHeader = (patch: Partial<Quotation>) => {
    setQ((prev) => (prev ? { ...prev, ...patch } : prev));
    setHeaderDirty(true);
  };

  const addBlankItem = () => {
    const next: QItem = {
      id: `tmp-${crypto.randomUUID()}`,
      description: "",
      item_image_url: null,
      measurement: null,
      measurement_image_url: null,
      quantity: 1,
      unit_price: 0,
      amount: 0,
      display_order: items.length,
      product_id: null,
      _isNew: true,
      _dirty: true,
    };
    setItems((p) => [...p, next]);
  };

  const updateItem = (id: string, patch: Partial<QItem>) => {
    setItems((p) => p.map((it) => (it.id === id ? { ...it, ...patch, _dirty: true } : it)));
  };

  const removeItem = async (item: QItem) => {
    if (!item._isNew) {
      const { error } = await supabase.from("quotation_items").delete().eq("id", item.id);
      if (error) {
        toast({ title: "Delete failed", description: error.message, variant: "destructive" });
        return;
      }
    }
    setItems((p) => p.filter((i) => i.id !== item.id));
  };

  const loadProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, product_name, product_code, mrp, offer_price, product_images(image_url)")
      .eq("is_published", true)
      .order("product_name", { ascending: true })
      .limit(200);
    setProducts((data ?? []) as Product[]);
  };

  const openProductPicker = async () => {
    await loadProducts();
    setProductPickerOpen(true);
  };

  const addFromProduct = (p: Product) => {
    const next: QItem = {
      id: `tmp-${crypto.randomUUID()}`,
      description: `${p.product_name} (${p.product_code})`,
      item_image_url: p.product_images?.[0]?.image_url ?? null,
      measurement: null,
      measurement_image_url: null,
      quantity: 1,
      unit_price: Number(p.offer_price ?? p.mrp ?? 0),
      amount: Number(p.offer_price ?? p.mrp ?? 0),
      display_order: items.length,
      product_id: p.id,
      _isNew: true,
      _dirty: true,
    };
    setItems((prev) => [...prev, next]);
    setProductPickerOpen(false);
    toast({ title: "Item added" });
  };

  const saveAll = async () => {
    if (!q) return;
    setSaving(true);
    // 1. update header if dirty
    if (headerDirty) {
      const { error } = await supabase.from("quotations").update({
        party_name: q.party_name,
        party_place: q.party_place,
        party_phone: q.party_phone,
        party_address: q.party_address,
        quotation_date: q.quotation_date,
        expected_delivery_date: q.expected_delivery_date,
        gst_percent: q.gst_percent,
        status: q.status,
        notes: q.notes,
      }).eq("id", q.id);
      if (error) {
        setSaving(false);
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return;
      }
    }
    // 2. items
    for (const it of items) {
      if (!it._dirty) continue;
      if (!it.description.trim()) continue;
      const payload = {
        quotation_id: q.id,
        description: it.description,
        item_image_url: it.item_image_url,
        measurement: it.measurement,
        measurement_image_url: it.measurement_image_url,
        quantity: Number(it.quantity) || 0,
        unit_price: canEditPrice ? Number(it.unit_price) || 0 : 0,
        display_order: it.display_order,
        product_id: it.product_id,
      };
      if (it._isNew) {
        const { data, error } = await supabase.from("quotation_items").insert(payload).select("id").single();
        if (error) { setSaving(false); toast({ title: "Item save failed", description: error.message, variant: "destructive" }); return; }
        // map tmp id -> real
        setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, id: data!.id, _isNew: false, _dirty: false } : p)));
      } else {
        const { error } = await supabase.from("quotation_items").update(payload).eq("id", it.id);
        if (error) { setSaving(false); toast({ title: "Item update failed", description: error.message, variant: "destructive" }); return; }
      }
    }
    setSaving(false);
    toast({ title: "Saved" });
    load();
  };

  // ---- PDF & WhatsApp ----

  const buildPdfData = () => {
    if (!q) return null;
    return {
      quotation_id: q.quotation_id,
      party_name: q.party_name,
      party_place: q.party_place,
      party_phone: q.party_phone,
      party_address: q.party_address,
      quotation_date: new Date(q.quotation_date).toLocaleDateString("en-IN"),
      expected_delivery_date: q.expected_delivery_date ? new Date(q.expected_delivery_date).toLocaleDateString("en-IN") : null,
      gst_percent: q.gst_percent,
      subtotal,
      gst_amount: gstAmount,
      total,
      notes: q.notes,
      items: items.map((it) => ({
        description: it.description,
        item_image_url: it.item_image_url,
        measurement: it.measurement,
        measurement_image_url: it.measurement_image_url,
        quantity: it.quantity,
        unit_price: it.unit_price,
        amount: (it.quantity || 0) * (it.unit_price || 0),
      })),
    };
  };

  const downloadPdf = async () => {
    const data = buildPdfData();
    if (!data) return;
    if (items.length === 0) { toast({ title: "Add at least one item", variant: "destructive" }); return; }
    const blob = await generateQuotationPdf(data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.quotation_id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareWhatsApp = async () => {
    if (!q) return;
    if (!q.party_phone) { toast({ title: "No party phone on file", variant: "destructive" }); return; }
    await downloadPdf();
    const phone = q.party_phone.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(
      `Dear ${q.party_name},\n\nPlease find attached our quotation ${q.quotation_id} from Hitech Furniture & Interiors.\n\nTotal: ${formatINR(total)}\n\nThank you.`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  // ---- Job Work ----

  const openJobDialog = async () => {
    if (selectedItemIds.size === 0) {
      toast({ title: "Select items first", description: "Tick the checkbox next to items to assign.", variant: "destructive" });
      return;
    }
    const { data } = await supabase.from("workers").select("id, name, whatsapp_number, trade").eq("is_active", true).order("name");
    setWorkers((data ?? []) as Worker[]);
    setSelectedWorker("");
    setJobNotes("");
    setJobOpen(true);
  };

  const generateAndSendJob = async () => {
    if (!q || !selectedWorker) { toast({ title: "Select a worker", variant: "destructive" }); return; }
    const worker = workers.find((w) => w.id === selectedWorker);
    if (!worker) return;
    const chosenItems = items.filter((it) => selectedItemIds.has(it.id) && !it._isNew);
    if (chosenItems.length === 0) {
      toast({ title: "Save items before assigning", description: "Save your changes first.", variant: "destructive" });
      return;
    }
    setGeneratingJob(true);
    // create job_work_orders row
    const { error } = await supabase.from("job_work_orders").insert({
      quotation_id: q.id,
      worker_id: worker.id,
      item_ids: chosenItems.map((c) => c.id),
      notes: jobNotes || null,
      created_by: user?.id ?? null,
    });
    if (error) {
      setGeneratingJob(false);
      toast({ title: "Failed to create job", description: error.message, variant: "destructive" });
      return;
    }
    // generate worker-safe PDF
    const blob = await generateJobWorkPdf({
      quotation_id: q.quotation_id,
      worker_name: worker.name,
      date: new Date().toLocaleDateString("en-IN"),
      notes: jobNotes || null,
      items: chosenItems.map((it) => ({
        description: it.description,
        item_image_url: it.item_image_url,
        measurement: it.measurement,
        measurement_image_url: it.measurement_image_url,
        quantity: it.quantity,
      })),
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `JobWork-${q.quotation_id}-${worker.name.replace(/\s+/g, "_")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);

    const phone = worker.whatsapp_number.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(
      `Hi ${worker.name},\n\nNew job work assigned. Reference: ${q.quotation_id}\nItems: ${chosenItems.length}\n\nPDF attached (please attach the downloaded file).\n\n— Hitech Furniture & Interiors`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");

    setGeneratingJob(false);
    setJobOpen(false);
    setSelectedItemIds(new Set());
    toast({ title: "Job work sent", description: `${chosenItems.length} item(s) assigned to ${worker.name}` });
  };

  const toggleItemSelect = (id: string, checked: boolean) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  if (loading || !q) {
    return (
      <AdminShell>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/admin/quotations"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <p className="font-mono text-sm text-muted-foreground">{q.quotation_id}</p>
            <h1 className="font-display text-2xl">{q.party_name} <span className="text-muted-foreground font-normal">· {q.party_place}</span></h1>
          </div>
          <Badge variant={q.status === "draft" ? "outline" : "secondary"} className="ml-2">{q.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={saveAll} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save
          </Button>
          {canEditPrice && (
            <>
              <Button variant="outline" onClick={downloadPdf}><Download className="mr-2 h-4 w-4" />PDF</Button>
              <Button variant="outline" onClick={shareWhatsApp}><MessageCircle className="mr-2 h-4 w-4 text-primary" />WhatsApp</Button>
              <Button variant="secondary" onClick={openJobDialog}><HardHat className="mr-2 h-4 w-4" />Assign job</Button>
            </>
          )}
        </div>
      </div>

      {/* Header form */}
      <Card className="mb-4">
        <CardHeader className="pb-3"><CardTitle className="text-base">Party & Quotation Details</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5"><Label>Party name *</Label><Input value={q.party_name} onChange={(e) => updateHeader({ party_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Place *</Label><Input value={q.party_place} onChange={(e) => updateHeader({ party_place: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={q.party_phone ?? ""} onChange={(e) => updateHeader({ party_phone: e.target.value })} /></div>
          <div className="space-y-1.5 md:col-span-3"><Label>Address</Label><Textarea rows={2} value={q.party_address ?? ""} onChange={(e) => updateHeader({ party_address: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Quotation date</Label><Input type="date" value={q.quotation_date} onChange={(e) => updateHeader({ quotation_date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Expected delivery</Label><Input type="date" value={q.expected_delivery_date ?? ""} onChange={(e) => updateHeader({ expected_delivery_date: e.target.value || null })} /></div>
          {canEditPrice && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={q.status} onValueChange={(v) => updateHeader({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Items</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openProductPicker}><Package className="mr-1.5 h-3.5 w-3.5" />From catalog</Button>
            <Button size="sm" onClick={addBlankItem}><Plus className="mr-1.5 h-3.5 w-3.5" />Blank row</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No items yet. Add from catalog or create a blank row.</p>}
          {items.map((it, idx) => (
            <div key={it.id} className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {canEditPrice && !it._isNew && (
                    <Checkbox
                      checked={selectedItemIds.has(it.id)}
                      onCheckedChange={(v) => toggleItemSelect(it.id, !!v)}
                      aria-label="Select for job work"
                    />
                  )}
                  <span className="text-xs font-semibold text-muted-foreground">SL {idx + 1}</span>
                  {it.product_id && <Badge variant="outline" className="text-[10px]">Catalog</Badge>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeItem(it)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_140px_140px_100px_120px_120px]">
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea rows={2} value={it.description} onChange={(e) => updateItem(it.id, { description: e.target.value })} placeholder="Item name & details" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Item image</Label>
                  <SingleImagePicker value={it.item_image_url} onChange={(v) => updateItem(it.id, { item_image_url: v })} folder="items" compact />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Measurement</Label>
                  <Textarea rows={2} value={it.measurement ?? ""} onChange={(e) => updateItem(it.id, { measurement: e.target.value })} placeholder="W x H x D" />
                  <SingleImagePicker value={it.measurement_image_url} onChange={(v) => updateItem(it.id, { measurement_image_url: v })} folder="measurements" compact />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Qty</Label>
                  <Input type="number" min={0} step="0.01" value={it.quantity}
                    onChange={(e) => updateItem(it.id, { quantity: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Unit price</Label>
                  <Input type="number" min={0} step="0.01" value={it.unit_price}
                    onChange={(e) => updateItem(it.id, { unit_price: Number(e.target.value) })}
                    disabled={!canEditPrice} />
                  {!canEditPrice && <p className="text-[10px] text-muted-foreground">Set by office</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount</Label>
                  <div className="flex h-10 items-center justify-end rounded-md border bg-muted px-3 font-mono text-sm">
                    {formatINR((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={q.notes ?? ""} onChange={(e) => updateHeader({ notes: e.target.value })} /></div>
            {canEditPrice && (
              <div className="space-y-1.5">
                <Label>GST %</Label>
                <Select value={String(q.gst_percent)} onValueChange={(v) => updateHeader({ gst_percent: Number(v) })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{GST_OPTIONS.map((g) => <SelectItem key={g} value={String(g)}>{g}%</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="ml-auto w-full max-w-sm space-y-2 rounded-lg border bg-card p-4">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatINR(subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">GST ({q.gst_percent}%)</span><span className="font-medium">{formatINR(gstAmount)}</span></div>
            <Separator />
            <div className="flex justify-between"><span className="font-display text-base">Total</span><span className="font-display text-xl font-semibold text-primary">{formatINR(total)}</span></div>
          </div>
        </CardContent>
      </Card>

      {isFieldOnly && (
        <p className="text-center text-xs text-muted-foreground">Submit this draft and office staff will add prices and finalize.</p>
      )}

      {/* Product picker */}
      <Dialog open={productPickerOpen} onOpenChange={setProductPickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Add from product catalog</DialogTitle></DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search products..." className="pl-9" />
          </div>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {products
              .filter((p) => !productSearch || `${p.product_name} ${p.product_code}`.toLowerCase().includes(productSearch.toLowerCase()))
              .map((p) => (
                <button key={p.id} type="button" onClick={() => addFromProduct(p)}
                  className="flex w-full items-center gap-3 rounded-md border bg-card p-2 text-left transition-smooth hover:bg-muted">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                    {p.product_images?.[0] && <img src={p.product_images[0].image_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{p.product_name}</p>
                    <p className="text-xs text-muted-foreground">{p.product_code}</p>
                  </div>
                  <span className="font-mono text-sm">{formatINR(p.offer_price ?? p.mrp)}</span>
                </button>
              ))}
            {products.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No products in catalog yet.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Job Work dialog */}
      <Dialog open={jobOpen} onOpenChange={setJobOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Job Work</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{selectedItemIds.size} item(s) selected. Worker PDF will exclude prices, GST and customer phone.</p>
            <div className="space-y-1.5">
              <Label>Worker *</Label>
              <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                <SelectTrigger><SelectValue placeholder="Choose worker" /></SelectTrigger>
                <SelectContent>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}{w.trade ? ` (${w.trade})` : ""} — {w.whatsapp_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workers.length === 0 && (
                <p className="text-xs text-muted-foreground">No active workers. <Link to="/admin/workers" className="text-primary underline">Add one</Link>.</p>
              )}
            </div>
            <div className="space-y-1.5"><Label>Notes (optional)</Label><Textarea rows={2} value={jobNotes} onChange={(e) => setJobNotes(e.target.value)} placeholder="e.g. priority, finish type..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJobOpen(false)}>Cancel</Button>
            <Button onClick={generateAndSendJob} disabled={generatingJob || !selectedWorker}>
              {generatingJob ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Generate PDF + WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default AdminQuotationEditor;
