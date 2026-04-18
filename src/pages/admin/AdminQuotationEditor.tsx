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
  terms: string | null;
};

const DEFAULT_TERMS = `1. 50% advance payment required to confirm the order. Balance to be paid before/at delivery.
2. Delivery within 15-30 working days from advance receipt and final design approval.
3. Prices are valid for 15 days from quotation date.
4. GST as applicable will be charged extra (where shown).
5. Transportation and installation charges (if any) are extra unless specified.
6. Goods once sold will not be taken back or exchanged.
7. Any changes after order confirmation may attract additional charges.
8. Warranty as per manufacturer terms; does not cover misuse or natural wear.`;

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

  // Returns map of tmp id -> real id (and updated item list) so callers can remap selections
  const saveAll = async (): Promise<{ idMap: Record<string, string>; savedItems: QItem[] } | null> => {
    if (!q) return null;
    setSaving(true);
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
        return null;
      }
    }
    const idMap: Record<string, string> = {};
    const updated: QItem[] = [...items];
    for (let i = 0; i < updated.length; i++) {
      const it = updated[i];
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
        if (error) { setSaving(false); toast({ title: "Item save failed", description: error.message, variant: "destructive" }); return null; }
        idMap[it.id] = data!.id;
        updated[i] = { ...it, id: data!.id, _isNew: false, _dirty: false };
      } else {
        const { error } = await supabase.from("quotation_items").update(payload).eq("id", it.id);
        if (error) { setSaving(false); toast({ title: "Item update failed", description: error.message, variant: "destructive" }); return null; }
        updated[i] = { ...it, _dirty: false };
      }
    }
    setItems(updated);
    setHeaderDirty(false);
    setSaving(false);
    toast({ title: "Saved" });
    return { idMap, savedItems: updated };
  };

  const ensureSaved = async (): Promise<QItem[] | null> => {
    const hasPending = headerDirty || items.some((i) => i._dirty || i._isNew);
    if (!hasPending) return items;
    const result = await saveAll();
    if (!result) return null;
    if (Object.keys(result.idMap).length > 0) {
      setSelectedItemIds((prev) => {
        const next = new Set<string>();
        prev.forEach((id) => next.add(result.idMap[id] ?? id));
        return next;
      });
    }
    return result.savedItems;
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
    if (items.length === 0) { toast({ title: "Add at least one item", variant: "destructive" }); return; }
    const saved = await ensureSaved();
    if (!saved) return;
    const data = buildPdfData();
    if (!data) return;
    const blob = await generateQuotationPdf(data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.quotation_id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "PDF downloaded", description: "Attach it in WhatsApp using the paperclip icon." });
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
    // Auto-save any pending changes so newly added items get real IDs
    const saved = await ensureSaved();
    if (!saved) return;
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
      toast({ title: "No saved items selected", description: "Save the quotation, then re-tick the items.", variant: "destructive" });
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
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link to="/admin/quotations"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground truncate">{q.quotation_id}</p>
            <h1 className="font-display text-lg leading-tight sm:text-2xl truncate">
              {q.party_name} <span className="text-muted-foreground font-normal">· {q.party_place}</span>
            </h1>
          </div>
          <Badge variant={q.status === "draft" ? "outline" : "secondary"} className="shrink-0">{q.status}</Badge>
        </div>
        {/* Desktop / tablet action buttons (hidden on mobile — sticky bar below) */}
        <div className="hidden flex-wrap gap-2 sm:flex">
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
        <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div className="space-y-1.5"><Label>Party name *</Label><Input className="h-11" value={q.party_name} onChange={(e) => updateHeader({ party_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Place *</Label><Input className="h-11" value={q.party_place} onChange={(e) => updateHeader({ party_place: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input className="h-11" inputMode="tel" value={q.party_phone ?? ""} onChange={(e) => updateHeader({ party_phone: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2 md:col-span-3"><Label>Address</Label><Textarea rows={2} value={q.party_address ?? ""} onChange={(e) => updateHeader({ party_address: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Quotation date</Label><Input className="h-11" type="date" value={q.quotation_date} onChange={(e) => updateHeader({ quotation_date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Expected delivery</Label><Input className="h-11" type="date" value={q.expected_delivery_date ?? ""} onChange={(e) => updateHeader({ expected_delivery_date: e.target.value || null })} /></div>
          {canEditPrice && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={q.status} onValueChange={(v) => updateHeader({ status: v })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="mb-4">
        <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Items ({items.length})</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 sm:flex-initial" onClick={openProductPicker}>
              <Package className="mr-1.5 h-4 w-4" />From catalog
            </Button>
            <Button size="sm" className="flex-1 sm:flex-initial" onClick={addBlankItem}>
              <Plus className="mr-1.5 h-4 w-4" />Add item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-3 sm:px-6">
          {items.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No items yet. Tap "Add item" to begin.</p>
          )}
          {items.map((it, idx) => (
            <div key={it.id} className="rounded-lg border bg-card p-3 shadow-sm">
              {/* Row header: SL, badges, delete */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {canEditPrice && !it._isNew && (
                    <Checkbox
                      className="h-5 w-5"
                      checked={selectedItemIds.has(it.id)}
                      onCheckedChange={(v) => toggleItemSelect(it.id, !!v)}
                      aria-label="Select for job work"
                    />
                  )}
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">#{idx + 1}</span>
                  {it.product_id && <Badge variant="outline" className="text-[10px]">Catalog</Badge>}
                  <span className="ml-auto font-mono text-sm font-semibold text-primary sm:hidden">
                    {formatINR((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
                  </span>
                </div>
                <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => removeItem(it)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              {/* Mobile-first stacked layout, with desktop grid above lg */}
              <div className="grid gap-3 lg:grid-cols-[1fr_140px_180px_90px_120px_120px]">
                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</Label>
                  <Textarea rows={2} value={it.description} onChange={(e) => updateItem(it.id, { description: e.target.value })} placeholder="Item name & details" />
                </div>

                {/* Item image */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item photo</Label>
                  <SingleImagePicker value={it.item_image_url} onChange={(v) => updateItem(it.id, { item_image_url: v })} folder="items" compact />
                </div>

                {/* Measurement */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Measurement</Label>
                  <Textarea rows={2} value={it.measurement ?? ""} onChange={(e) => updateItem(it.id, { measurement: e.target.value })} placeholder="W x H x D" />
                  <SingleImagePicker value={it.measurement_image_url} onChange={(v) => updateItem(it.id, { measurement_image_url: v })} folder="measurements" compact />
                </div>

                {/* Qty + Unit price + Amount: side-by-side row on mobile */}
                <div className="grid grid-cols-3 gap-3 lg:contents">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Qty</Label>
                    <Input className="h-11" type="number" inputMode="decimal" min={0} step="0.01" value={it.quantity}
                      onChange={(e) => updateItem(it.id, { quantity: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unit ₹</Label>
                    <Input className="h-11" type="number" inputMode="decimal" min={0} step="0.01" value={it.unit_price}
                      onChange={(e) => updateItem(it.id, { unit_price: Number(e.target.value) })}
                      disabled={!canEditPrice} />
                    {!canEditPrice && <p className="text-[10px] text-muted-foreground">Set by office</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</Label>
                    <div className="flex h-11 items-center justify-end rounded-md border bg-muted px-3 font-mono text-sm font-semibold">
                      {formatINR((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Mobile-friendly add-more button at bottom of list */}
          {items.length > 0 && (
            <Button variant="outline" className="h-12 w-full border-dashed" onClick={addBlankItem}>
              <Plus className="mr-2 h-4 w-4" />Add another item
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="mb-4">
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <div className="space-y-3 order-2 md:order-1">
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={q.notes ?? ""} onChange={(e) => updateHeader({ notes: e.target.value })} placeholder="Terms, delivery info, special instructions..." /></div>
            {canEditPrice && (
              <div className="space-y-1.5">
                <Label>GST %</Label>
                <Select value={String(q.gst_percent)} onValueChange={(v) => updateHeader({ gst_percent: Number(v) })}>
                  <SelectTrigger className="h-11 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{GST_OPTIONS.map((g) => <SelectItem key={g} value={String(g)}>{g}%</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="order-1 w-full space-y-2 rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4 md:order-2 md:ml-auto md:max-w-sm">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatINR(subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">GST ({q.gst_percent}%)</span><span className="font-medium">{formatINR(gstAmount)}</span></div>
            <Separator />
            <div className="flex items-baseline justify-between"><span className="font-display text-base">Total</span><span className="font-display text-2xl font-bold text-primary">{formatINR(total)}</span></div>
          </div>
        </CardContent>
      </Card>

      {isFieldOnly && (
        <p className="mb-24 text-center text-xs text-muted-foreground sm:mb-4">Submit this draft and office staff will add prices and finalize.</p>
      )}

      {/* Sticky mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-3 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden">
        <div className="flex gap-2">
          <Button onClick={saveAll} disabled={saving} className="h-12 flex-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-1.5 h-4 w-4" />Save</>}
          </Button>
          {canEditPrice && (
            <>
              <Button variant="outline" onClick={downloadPdf} className="h-12 flex-1">
                <Download className="mr-1.5 h-4 w-4" />PDF
              </Button>
              <Button variant="outline" onClick={shareWhatsApp} className="h-12 flex-1">
                <MessageCircle className="mr-1.5 h-4 w-4 text-primary" />WhatsApp
              </Button>
              <Button variant="secondary" onClick={openJobDialog} className="h-12 px-3" aria-label="Assign job">
                <HardHat className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </div>
      {/* Spacer so content isn't hidden behind sticky bar on mobile */}
      <div className="h-16 sm:hidden" aria-hidden />

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
