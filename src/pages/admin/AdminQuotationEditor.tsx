import { useEffect, useMemo, useRef, useState } from "react";
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
import { MultiImagePicker } from "@/components/admin/MultiImagePicker";
import { ContactPicker } from "@/components/admin/ContactPicker";
import { SketchField } from "@/components/admin/SketchField";
import { CollapsibleField } from "@/components/admin/CollapsibleField";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useRealtimeQuotation } from "@/hooks/useRealtimeQuotations";
import { DeliveryRoutePicker } from "@/components/logistics/DeliveryRoutePicker";
import {
  Loader2, ArrowLeft, Plus, Trash2, Save, Download, MessageCircle, Image as ImageIcon,
  Package, HardHat, Send, FileText, Search, ShoppingCart,
} from "lucide-react";
// PDF renderer is heavy (~600KB). Lazy-load on first share/download instead
// of blocking initial page paint on mobile.
const loadPdfLib = () => import("@/lib/quotationPdf");
const loadJpgLib = () => import("@/lib/pdfToJpg");
import { formatINR } from "@/lib/brand";
import { scrollFocusedIntoView } from "@/lib/mobileFocusScroll";
import { handleEnterAsNext } from "@/lib/enterKeyNav";
import { AutoSuggestInput, type Suggestion } from "@/components/admin/AutoSuggestInput";
import { type DocType, isPO, docLabel, docLabelShort, docPartyLabel } from "@/lib/docType";
import { ShoppingCart as ShoppingCartIcon } from "lucide-react";
import { openWhatsAppApp } from "@/lib/whatsapp";
import { DownloadShareMenu } from "@/components/admin/DownloadShareMenu";
import { AttachedNotesButton } from "@/components/admin/AttachedNotesButton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { shareFilesNative } from "@/lib/nativeShare";

type QItem = {
  id: string;
  description: string;
  item_image_url: string | null;
  measurement: string | null;
  measurement_image_url: string | null;
  catalog_text: string | null;
  catalog_image_url: string | null;
  sketch_url: string | null;
  site_photos: string | null;
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
  advance_amount: number;
  discount_amount: number;
  status: string;
  notes: string | null;
  terms: string | null;
  delivery_route_id: string | null;
  delivery_place: string | null;
  document_type: DocType;
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
type Product = {
  id: string;
  product_name: string;
  product_code: string;
  mrp: number;
  offer_price: number | null;
  main_category_id: string;
  sub_category_id: string | null;
  product_images: { image_url: string }[];
};
type MainCat = { id: string; name: string; image_url: string | null };
type SubCat = { id: string; main_category_id: string; name: string };

const GST_OPTIONS = [0, 5, 9, 12, 18, 28];
// Full quotation lifecycle (kept lowercase to match DB defaults)
const STATUS_OPTIONS = [
  "draft",        // just created, no items / not measured
  "drafted",      // measurement done, awaiting price
  "finalized",    // price + GST added, ready to send
  "sent",         // shared with customer (WhatsApp)
  "accepted",     // customer confirmed
  "completed",    // delivered / done
  "rejected",     // not moving forward
];

export const statusBadgeVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (s) {
    case "accepted":
    case "completed":
      return "default";
    case "sent":
    case "finalized":
      return "secondary";
    case "rejected":
      return "destructive";
    default:
      return "outline"; // draft, drafted
  }
};

const ProductRow = ({
  p,
  onPick,
}: {
  p: Product;
  onPick: (p: Product) => void;
}) => (
  <button
    type="button"
    onClick={() => onPick(p)}
    className="flex w-full items-center gap-3 rounded-md border bg-card p-2 text-left transition-smooth hover:border-primary hover:bg-muted"
  >
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
      {p.product_images?.[0] && (
        <img
          src={p.product_images[0].image_url}
          alt=""
          className="h-full w-full object-contain p-0.5"
        />
      )}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{p.product_name}</p>
      <p className="text-xs text-muted-foreground">{p.product_code}</p>
    </div>
    <span className="font-mono text-sm">{formatINR(p.offer_price ?? p.mrp)}</span>
  </button>
);

export const statusLabel = (s: string) => {
  const map: Record<string, string> = {
    draft: "Pending",
    drafted: "Drafted",
    finalized: "Finalized",
    sent: "Sent",
    accepted: "Accepted",
    completed: "Completed",
    rejected: "Rejected",
  };
  return map[s] ?? s;
};

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
  const [mainCats, setMainCats] = useState<MainCat[]>([]);
  const [subCats, setSubCats] = useState<SubCat[]>([]);
  // Catalog picker drill-down: null → main grid; mainId set + subId null → sub grid;
  // both set → models grid. A search overrides the drill-down and shows results flat.
  const [pickerMainId, setPickerMainId] = useState<string | null>(null);
  const [pickerSubId, setPickerSubId] = useState<string | null>(null);

  const [jobOpen, setJobOpen] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [selectedWorker, setSelectedWorker] = useState<string>("");
  const [jobNotes, setJobNotes] = useState("");
  const [generatingJob, setGeneratingJob] = useState(false);

  const canEditPrice = isOfficeStaff;
  const isFieldOnly = isMeasurementStaff && !isOfficeStaff;
  // Document type drives major UI changes: PO mode hides all pricing,
  // GST, advance, discount, terms, totals, and bank info — POs only
  // describe the work / materials sent to a worker or supplier.
  const po = isPO(q?.document_type);
  const showPricing = !po;

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

  // Preload published products once so the description autosuggest is instant.
  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live sync: when another user edits this quotation, reload silently if the
  // local form is clean. If the user has unsaved edits, show a soft toast with
  // a "Reload" action so we never overwrite their work mid-typing.
  useRealtimeQuotation(id, () => {
    const hasUnsavedItems = items.some((it) => it._dirty || it._isNew);
    if (!headerDirty && !hasUnsavedItems && !saving) {
      load();
    } else {
      toast({
        title: "Updated by another user",
        description: "Save your changes, then reload to see the latest version.",
      });
    }
  });

  const subtotal = useMemo(() => items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0), [items]);
  const discountAmount = Math.min(Math.max(0, Number(q?.discount_amount) || 0), subtotal);
  const taxableBase = Math.max(0, subtotal - discountAmount);
  const gstAmount = useMemo(() => Math.round(taxableBase * ((q?.gst_percent ?? 0) / 100) * 100) / 100, [taxableBase, q?.gst_percent]);
  const grandTotal = taxableBase + gstAmount;
  const advanceAmount = Math.max(0, Number(q?.advance_amount) || 0);
  const balanceDue = Math.max(0, grandTotal - advanceAmount);
  // Kept for legacy references / WhatsApp message — represents grand total
  const total = grandTotal;

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
      catalog_text: null,
      catalog_image_url: null,
      sketch_url: null,
      site_photos: null,
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
    const [{ data: pr }, { data: mc }, { data: sc }] = await Promise.all([
      supabase
        .from("products")
        .select("id, product_name, product_code, mrp, offer_price, main_category_id, sub_category_id, product_images(image_url)")
        .eq("is_published", true)
        .is("deleted_at", null)
        .order("product_name", { ascending: true })
        .limit(500),
      supabase
        .from("main_categories")
        .select("id, name, image_url")
        .is("deleted_at", null)
        .order("display_order"),
      supabase
        .from("sub_categories")
        .select("id, main_category_id, name")
        .is("deleted_at", null)
        .order("display_order"),
    ]);
    setProducts((pr ?? []) as Product[]);
    setMainCats((mc ?? []) as MainCat[]);
    setSubCats((sc ?? []) as SubCat[]);
  };

  const openProductPicker = async () => {
    await loadProducts();
    // Always open at Step 1 — the "View All" main-category grid.
    setPickerMainId(null);
    setPickerSubId(null);
    setProductSearch("");
    setProductPickerOpen(true);
  };

  const addFromProduct = (p: Product) => {
    const next: QItem = {
      id: `tmp-${crypto.randomUUID()}`,
      description: `${p.product_name} (${p.product_code})`,
      item_image_url: p.product_images?.[0]?.image_url ?? null,
      measurement: null,
      measurement_image_url: null,
      catalog_text: p.product_code ?? null,
      catalog_image_url: null,
      sketch_url: null,
      site_photos: null,
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
        advance_amount: Math.max(0, Number(q.advance_amount) || 0),
        discount_amount: Math.max(0, Number(q.discount_amount) || 0),
        status: q.status,
        notes: q.notes,
        terms: q.terms,
      }).eq("id", q.id);
      if (error) {
        setSaving(false);
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return null;
      }
    }
    const idMap: Record<string, string> = {};
    const updated: QItem[] = [...items];

    // Build the work list of dirty rows to insert/update in parallel.
    type Job = { index: number; payload: any; isNew: boolean; tmpId: string; existingId: string };
    const jobs: Job[] = [];
    for (let i = 0; i < updated.length; i++) {
      const it = updated[i];
      if (!it._dirty) continue;
      if (!it.description.trim()) continue;
      jobs.push({
        index: i,
        isNew: !!it._isNew,
        tmpId: it.id,
        existingId: it.id,
        payload: {
          quotation_id: q.id,
          description: it.description,
          item_image_url: it.item_image_url,
          measurement: it.measurement,
          measurement_image_url: it.measurement_image_url,
          catalog_text: it.catalog_text,
          catalog_image_url: it.catalog_image_url,
          sketch_url: it.sketch_url,
          site_photos: it.site_photos,
          quantity: Number(it.quantity) || 0,
          unit_price: canEditPrice ? Number(it.unit_price) || 0 : 0,
          amount: (Number(it.quantity) || 0) * (canEditPrice ? Number(it.unit_price) || 0 : 0),
          display_order: it.display_order,
          product_id: it.product_id,
        },
      });
    }

    // Run all row writes concurrently — dramatically faster on quotations with many items.
    const results = await Promise.all(
      jobs.map((j) =>
        j.isNew
          ? supabase.from("quotation_items").insert(j.payload).select("id").single()
          : supabase.from("quotation_items").update(j.payload).eq("id", j.existingId).select("id").single()
      )
    );

    for (let k = 0; k < jobs.length; k++) {
      const j = jobs[k];
      const res: any = results[k];
      if (res.error) {
        setSaving(false);
        toast({ title: "Item save failed", description: res.error.message, variant: "destructive" });
        return null;
      }
      const newId = res.data?.id ?? j.existingId;
      if (j.isNew) idMap[j.tmpId] = newId;
      updated[j.index] = { ...updated[j.index], id: newId, _isNew: false, _dirty: false };
    }

    setItems(updated);
    setHeaderDirty(false);

    // Always recompute and persist header totals from the freshly saved items.
    // Without this, the quotations list (which reads `total`) shows stale
    // amounts when items are added/edited without touching header fields.
    {
      const newSubtotal = updated.reduce(
        (s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0),
        0,
      );
      const newDiscount = Math.min(
        Math.max(0, Number(q.discount_amount) || 0),
        newSubtotal,
      );
      const taxable = Math.max(0, newSubtotal - newDiscount);
      const newGst = taxable * ((Number(q.gst_percent) || 0) / 100);
      const newTotal = taxable + newGst;
      const { error: totErr } = await supabase
        .from("quotations")
        .update({
          subtotal: newSubtotal,
          gst_amount: newGst,
          total: newTotal,
        })
        .eq("id", q.id);
      if (totErr) {
        setSaving(false);
        toast({ title: "Total update failed", description: totErr.message, variant: "destructive" });
        return null;
      }
      setQ((prev) =>
        prev ? { ...prev, subtotal: newSubtotal, gst_amount: newGst, total: newTotal } : prev,
      );
    }

    setSaving(false);

    // Auto-advance status based on content + role
    const hasItems = updated.length > 0 && updated.some((it) => it.description.trim());
    const hasPricing = updated.some((it) => Number(it.unit_price) > 0);
    let nextStatus: string | null = null;
    if (po) {
      // POs don't have a "finalized" pricing step — once items exist, it's drafted/finalized.
      if (q.status === "draft" && hasItems) nextStatus = "finalized";
    } else {
      if (q.status === "draft" && hasItems && !canEditPrice) nextStatus = "drafted";
      if ((q.status === "draft" || q.status === "drafted") && hasItems && hasPricing && canEditPrice) nextStatus = "finalized";
    }
    if (nextStatus) {
      const { error: stErr } = await supabase.from("quotations").update({ status: nextStatus }).eq("id", q.id);
      if (!stErr) setQ((prev) => (prev ? { ...prev, status: nextStatus! } : prev));
    }

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

  // ---- Auto-save on image attach ----
  // When the user adds/removes any item photo (item, measurement, site,
  // catalog, sketch), auto-save 1.2s later so they never lose uploaded
  // images by closing the page or navigating away.
  // We hash only the image URLs so typing into description/qty/price
  // does NOT trigger auto-save (those still use the manual Save button).
  const imageFingerprint = useMemo(
    () => items.map((it) =>
      [
        it.id,
        it.item_image_url ?? "",
        it.measurement_image_url ?? "",
        it.site_photos ?? "",
        it.catalog_image_url ?? "",
        it.sketch_url ?? "",
      ].join("|")
    ).join("\n"),
    [items]
  );
  const lastSavedFingerprintRef = useRef<string>("");
  useEffect(() => {
    // Skip first render and while loading
    if (loading) {
      lastSavedFingerprintRef.current = imageFingerprint;
      return;
    }
    if (imageFingerprint === lastSavedFingerprintRef.current) return;
    // Only auto-save items that have a description (skip blank rows)
    const hasSavable = items.some((it) => it._dirty && it.description.trim());
    if (!hasSavable || saving) return;
    const t = setTimeout(async () => {
      const result = await saveAll();
      if (result) {
        lastSavedFingerprintRef.current = imageFingerprint;
        if (Object.keys(result.idMap).length > 0) {
          setSelectedItemIds((prev) => {
            const next = new Set<string>();
            prev.forEach((id) => next.add(result.idMap[id] ?? id));
            return next;
          });
        }
      }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFingerprint, loading]);

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
      discount_amount: discountAmount,
      gst_amount: gstAmount,
      total: grandTotal,
      advance_amount: advanceAmount,
      balance_due: balanceDue,
      notes: q.notes,
      terms: q.terms ?? DEFAULT_TERMS,
      is_po: po,
      items: items.map((it) => ({
        description: it.description,
        item_image_url: it.item_image_url,
        measurement: it.measurement,
        measurement_image_url: it.measurement_image_url,
        catalog_text: it.catalog_text,
        catalog_image_url: it.catalog_image_url,
        sketch_url: it.sketch_url,
        site_photos: it.site_photos,
        quantity: it.quantity,
        unit_price: it.unit_price,
        amount: (it.quantity || 0) * (it.unit_price || 0),
      })),
    };
  };

  // Aggressive compression for WhatsApp / job-work share: photos display at
  // 44–88px in the PDF, so 700px / q=0.6 stays sharp while cutting file size ~60%.
  const SHARE_PDF_OPTIONS = { image: { maxSide: 700, jpegQuality: 0.6 } } as const;

  // Build the multi-page JPG sequence (one image per PDF page) at 3× scale.
  // Each page contains atomic items (no item is split across pages) because
  // the source PDF uses `wrap={false}` on every row.
  const buildJpgPages = async (
    mode: "download" | "share" = "download"
  ): Promise<{ blobs: Blob[]; baseName: string } | null> => {
    if (items.length === 0) { toast({ title: "Add at least one item", variant: "destructive" }); return null; }
    const saved = await ensureSaved();
    if (!saved) return null;
    const data = buildPdfData();
    if (!data) return null;
    try {
      const { generateQuotationPdf } = await loadPdfLib();
      const pdfBlob = await generateQuotationPdf(data, mode === "share" ? SHARE_PDF_OPTIONS : undefined);
      const { pdfBlobToJpgPages } = await loadJpgLib();
      const blobs = await pdfBlobToJpgPages(pdfBlob);
      return { blobs, baseName: data.quotation_id };
    } catch (e: any) {
      console.error("Image generation failed:", e);
      toast({ title: "Image generation failed", description: e?.message ?? "An image may be blocked. Re-upload item/measurement images.", variant: "destructive" });
      return null;
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadJpg = async (): Promise<boolean> => {
    const r = await buildJpgPages("download");
    if (!r) return false;
    const isMulti = r.blobs.length > 1;
    r.blobs.forEach((b, i) => {
      const fn = isMulti ? `${r.baseName}_Page${i + 1}.jpg` : `${r.baseName}.jpg`;
      setTimeout(() => downloadBlob(b, fn), i * 250);
    });
    toast({
      title: isMulti ? `${r.blobs.length} images downloaded` : "Image downloaded",
      description: "Check your Downloads folder.",
    });
    return true;
  };

  // Generates the *raw* multi-page PDF (no JPG rasterization). Used by the
  // unified Download/Share menu so admins can pick the format that matches
  // who they're sending it to (PDF for customers, JPG for workers/WhatsApp).
  const downloadPdf = async (): Promise<boolean> => {
    if (items.length === 0) {
      toast({ title: "Add at least one item", variant: "destructive" });
      return false;
    }
    const saved = await ensureSaved();
    if (!saved) return false;
    const data = buildPdfData();
    if (!data) return false;
    try {
      const { generateQuotationPdf } = await loadPdfLib();
      const pdfBlob = await generateQuotationPdf(data);
      downloadBlob(pdfBlob, `${data.quotation_id}.pdf`);
      toast({ title: "PDF downloaded", description: "Check your Downloads folder." });
      return true;
    } catch (e: any) {
      console.error("PDF generation failed:", e);
      toast({
        title: "PDF generation failed",
        description: e?.message ?? "Try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Save → navigate to the structured digital preview page.
  // No PDF rendering happens here anymore — the preview is a fast HTML
  // page that loads instantly on every device. PDF is generated on-demand
  // from the preview page when the user taps "Share via WhatsApp" or "PDF".
  const saveAndPreview = async () => {
    const result = await saveAll();
    if (!result) return;
    if (result.savedItems.length === 0) return;
    navigate(`/admin/quotations/${q!.id}/preview`);
  };

  // Persist a status change immediately (used by quick actions and auto-transitions)
  const setStatus = async (newStatus: string, opts: { silent?: boolean } = {}) => {
    if (!q || q.status === newStatus) return;
    const { error } = await supabase.from("quotations").update({ status: newStatus }).eq("id", q.id);
    if (error) {
      toast({ title: "Status update failed", description: error.message, variant: "destructive" });
      return;
    }
    setQ((prev) => (prev ? { ...prev, status: newStatus } : prev));
    if (!opts.silent) toast({ title: `Marked ${statusLabel(newStatus)}` });
  };

  // Shared helper: try native share with file(s) (WhatsApp attaches the JPGs
  // directly). Falls back to downloading every page + opening the chat link
  // if the device doesn't support multi-file sharing.
  const shareJpgPagesViaWhatsApp = async (
    blobs: Blob[],
    baseName: string,
    phone: string | null,
    message: string,
  ): Promise<"shared" | "fallback"> => {
    const isMulti = blobs.length > 1;
    const files = blobs.map((b, i) =>
      new File(
        [b],
        isMulti ? `${baseName}_Page${i + 1}.jpg` : `${baseName}.jpg`,
        { type: "image/jpeg" },
      ),
    );
    const navAny = navigator as any;
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, "") : "";

    if (navAny.canShare && navAny.canShare({ files })) {
      try {
        await navAny.share({ files, title: baseName, text: message });
        return "shared";
      } catch (e) {
        console.warn("Web Share cancelled/failed, falling back:", e);
      }
    }

    // Fallback: download every page + open WhatsApp chat
    files.forEach((f, idx) => {
      setTimeout(() => downloadBlob(f, f.name), idx * 250);
    });
    toast({
      title: isMulti ? `${files.length} images downloaded` : "Image downloaded",
      description: cleanPhone
        ? "Opening WhatsApp app now. Tap the paperclip and attach the downloaded images in order."
        : undefined,
      duration: 8000,
    });
    if (cleanPhone) {
      setTimeout(() => openWhatsAppApp(cleanPhone, message), 400 + files.length * 250);
    }
    return "fallback";
  };

  const shareWhatsApp = async () => {
    if (!q) return;
    if (!q.party_phone) { toast({ title: "No party phone on file", variant: "destructive" }); return; }
    const r = await buildJpgPages("share");
    if (!r) return;

    const msg = po
      ? `Hi ${q.party_name},\n\nPurchase Order ${q.quotation_id} attached.\nItems: ${items.length}\n\n— Hitech Furniture & Interiors`
      : (() => {
          const balanceLine = advanceAmount > 0
            ? `Total: ${formatINR(grandTotal)}\nAdvance Received: ${formatINR(advanceAmount)}\nBalance Due: ${formatINR(balanceDue)}`
            : `Total: ${formatINR(grandTotal)}`;
          return `Dear ${q.party_name},\n\nPlease find attached our quotation ${q.quotation_id} from Hitech Furniture & Interiors.\n\n${balanceLine}\n\nThank you.`;
        })();

    await shareJpgPagesViaWhatsApp(r.blobs, r.baseName, q.party_phone, msg);

    if (q.status === "draft" || q.status === "drafted" || q.status === "finalized") {
      await setStatus("sent", { silent: true });
    }
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

  const generateAndSendJob = async (format: "jpg" | "pdf" = "jpg") => {
    if (!q || !selectedWorker) { toast({ title: "Select a worker", variant: "destructive" }); return; }
    const worker = workers.find((w) => w.id === selectedWorker);
    if (!worker) return;
    const chosenItems = items.filter((it) => selectedItemIds.has(it.id) && !it._isNew);
    if (chosenItems.length === 0) {
      toast({ title: "No saved items selected", description: "Save the quotation, then re-tick the items.", variant: "destructive" });
      return;
    }
    setGeneratingJob(true);
    try {
      // create job_work_orders row
      const { error } = await supabase.from("job_work_orders").insert({
        quotation_id: q.id,
        worker_id: worker.id,
        item_ids: chosenItems.map((c) => c.id),
        notes: jobNotes || null,
        created_by: user?.id ?? null,
      });
      if (error) {
        toast({ title: "Failed to create job", description: error.message, variant: "destructive" });
        return;
      }
      // generate worker-safe JPG (NO prices, NO bank, NO customer phone)
      const { generateJobWorkPdf } = await loadPdfLib();
      const pdfBlob = await generateJobWorkPdf({
        quotation_id: q.quotation_id,
        worker_name: worker.name,
        date: new Date().toLocaleDateString("en-IN"),
        notes: jobNotes || null,
        items: chosenItems.map((it) => ({
          description: it.description,
          item_image_url: it.item_image_url,
          measurement: it.measurement,
          measurement_image_url: it.measurement_image_url,
          catalog_text: it.catalog_text,
          catalog_image_url: it.catalog_image_url,
          sketch_url: it.sketch_url,
          site_photos: it.site_photos,
          quantity: it.quantity,
        })),
      }, format === "jpg" ? SHARE_PDF_OPTIONS : undefined);
      const baseFilename = `JobWork-${q.quotation_id}-${worker.name.replace(/\s+/g, "_")}`;
      const msg = `Hi ${worker.name},\n\nNew job work assigned. Reference: ${q.quotation_id}\nItems: ${chosenItems.length}\n\n— Hitech Furniture & Interiors`;

      if (format === "pdf") {
        downloadBlob(pdfBlob, `${baseFilename}.pdf`);
        toast({
          title: "Job PDF downloaded",
          description: `${chosenItems.length} item(s) assigned to ${worker.name}. Attach the PDF on WhatsApp manually.`,
        });
      } else {
        const { pdfBlobToJpgPages } = await loadJpgLib();
        const blobs = await pdfBlobToJpgPages(pdfBlob);
        await shareJpgPagesViaWhatsApp(blobs, baseFilename, worker.whatsapp_number, msg);
        toast({
          title: "Job work sent",
          description: `${chosenItems.length} item(s) assigned to ${worker.name}${blobs.length > 1 ? ` (${blobs.length} pages)` : ""}`,
        });
      }

      setJobOpen(false);
      setSelectedItemIds(new Set());
    } catch (e: any) {
      console.error("Job image generation failed:", e);
      toast({ title: "Image generation failed", description: e?.message ?? "An image may be blocked. Try re-uploading the item/measurement images.", variant: "destructive" });
    } finally {
      setGeneratingJob(false);
    }
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
      {/*
        Editor surface: white background with primary-color text for
        comfortable, low-eye-strain reading while building a quotation.
        Wraps the whole editor; cards inside inherit the white surface.
      */}
      <div className="-mx-2 -my-2 rounded-xl bg-white p-3 text-primary shadow-card-soft sm:-mx-4 sm:-my-4 sm:p-5 [&_.text-muted-foreground]:text-primary/60 [&_label]:text-primary">
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
          <Button variant="outline" size="sm" asChild className="h-10 shrink-0 px-2.5 sm:h-9">
            <Link to="/admin/quotations" aria-label="Back to quotations">
              <ArrowLeft className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-muted-foreground truncate">{q.quotation_id}</p>
            <h1 className="font-display text-lg leading-tight sm:text-2xl truncate">
              {q.party_name} <span className="text-muted-foreground font-normal">· {q.party_place}</span>
            </h1>
            <Badge variant={statusBadgeVariant(q.status)} className="mt-1 sm:hidden">{statusLabel(q.status)}</Badge>
          </div>
          <Badge variant={statusBadgeVariant(q.status)} className="hidden shrink-0 sm:inline-flex">{statusLabel(q.status)}</Badge>
          {canEditPrice && q.status === "sent" && (
            <div className="hidden gap-1 sm:flex">
              <Button size="sm" variant="outline" className="h-8" onClick={() => setStatus("accepted")}>Mark accepted</Button>
              <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => setStatus("rejected")}>Reject</Button>
            </div>
          )}
          {canEditPrice && q.status === "accepted" && (
            <Button size="sm" variant="outline" className="hidden h-8 sm:inline-flex" onClick={() => setStatus("completed")}>Mark completed</Button>
          )}
        </div>
        {/* Desktop / tablet action buttons (hidden on mobile — sticky bar below) */}
        <div className="hidden flex-wrap gap-2 sm:flex">
          <Button onClick={saveAndPreview} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save
          </Button>
          {canEditPrice && (
            <>
              <DownloadShareMenu
                onPdf={downloadPdf}
                onJpg={downloadJpg}
                pdfTooltip="PDF — full quotation for customer"
                jpgTooltip="JPG — high-res images for WhatsApp"
              />
              <Button variant="outline" onClick={shareWhatsApp}><MessageCircle className="mr-2 h-4 w-4 text-primary" />WhatsApp</Button>
              <Button variant="secondary" onClick={openJobDialog}><HardHat className="mr-2 h-4 w-4" />Assign job</Button>
              <AttachedNotesButton quotationId={q.id} />
            </>
          )}
        </div>
      </div>

      {/* Header form */}
      <Card className="mb-4">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            {po && <ShoppingCartIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            {po ? "Purchase Order Details" : "Party & Quotation Details"}
          </CardTitle>
          <ContactPicker
            label="From Contacts"
            onPick={({ name, tel, place, address }) =>
              updateHeader({
                party_name: name || q.party_name,
                party_phone: tel || q.party_phone || "",
                party_place: place || q.party_place,
                party_address: address || q.party_address || "",
              })
            }
          />
        </CardHeader>
        <CardContent
          className="grid gap-3 sm:grid-cols-2 md:grid-cols-3"
          onKeyDown={(e) => handleEnterAsNext(e, () => { if (!saving) saveAndPreview(); })}
        >
          <div className="space-y-1.5"><Label>{po ? "Worker / Supplier *" : "Party name *"}</Label><Input className="h-11" value={q.party_name} onChange={(e) => updateHeader({ party_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Place *</Label><Input className="h-11" value={q.party_place} onChange={(e) => updateHeader({ party_place: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input className="h-11" inputMode="tel" value={q.party_phone ?? ""} onChange={(e) => updateHeader({ party_phone: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2 md:col-span-3"><Label>Address</Label><Textarea rows={2} value={q.party_address ?? ""} onChange={(e) => updateHeader({ party_address: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>{po ? "PO date" : "Quotation date"}</Label><Input className="h-11" type="date" value={q.quotation_date} onChange={(e) => updateHeader({ quotation_date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Expected delivery</Label><Input className="h-11" type="date" value={q.expected_delivery_date ?? ""} onChange={(e) => updateHeader({ expected_delivery_date: e.target.value || null })} /></div>
          {canEditPrice && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={q.status} onValueChange={(v) => updateHeader({ status: v })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {!po && (
            <div className="sm:col-span-2 md:col-span-3">
              <DeliveryRoutePicker
                place={q.delivery_place ?? ""}
                routeId={q.delivery_route_id ?? null}
                onChange={(v) => updateHeader({ delivery_place: v.place || null, delivery_route_id: v.routeId })}
              />
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
            <div key={it.id} className="overflow-hidden rounded-lg border bg-card shadow-sm">
              {/* Row header: SL, badges, delete */}
              <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  {canEditPrice && !it._isNew && (
                    <Checkbox
                      className="h-5 w-5"
                      checked={selectedItemIds.has(it.id)}
                      onCheckedChange={(v) => toggleItemSelect(it.id, !!v)}
                      aria-label="Select for job work"
                    />
                  )}
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">Item #{idx + 1}</span>
                  {it.product_id && <Badge variant="outline" className="text-[10px]">Catalog</Badge>}
                  {showPricing && ((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)) > 0 && (
                    <span className="ml-2 font-mono text-sm font-semibold text-primary">
                      {formatINR((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
                    </span>
                  )}
                </div>
                <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => removeItem(it)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="space-y-4 p-3 sm:p-4">
                {/* SECTION 1: Product / Description */}
                <section className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Product</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-medium">Description *</Label>
                  <AutoSuggestInput
                    value={it.description}
                    onChange={(v) => updateItem(it.id, { description: v })}
                    placeholder="Item name & details — type to search catalog"
                    fetchSuggestions={(query) => {
                      const qq = query.toLowerCase();
                      return products
                        .filter(
                          (p) =>
                            p.product_name.toLowerCase().includes(qq) ||
                            p.product_code.toLowerCase().includes(qq),
                        )
                        .map<Suggestion<Product>>((p) => ({
                          label: `${p.product_name} (${p.product_code})`,
                          sub: formatINR(p.offer_price ?? p.mrp ?? 0),
                          image: p.product_images?.[0]?.image_url ?? null,
                          data: p,
                        }));
                    }}
                    onPick={(s) => {
                      const p = s.data as Product;
                      if (!p) return;
                      updateItem(it.id, {
                        description: `${p.product_name} (${p.product_code})`,
                        item_image_url: p.product_images?.[0]?.image_url ?? it.item_image_url,
                        catalog_text: (p.product_code ?? it.catalog_text ?? "").toUpperCase(),
                        unit_price: canEditPrice
                          ? Number(p.offer_price ?? p.mrp ?? it.unit_price)
                          : it.unit_price,
                        product_id: p.id,
                      });
                    }}
                  />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Catalog name / code</Label>
                      <Input
                        className="h-11"
                        value={it.catalog_text ?? ""}
                        onChange={(e) => updateItem(it.id, { catalog_text: e.target.value.toUpperCase() })}
                        placeholder="e.g. SKU-1234"
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        style={{ textTransform: "uppercase" }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Item photo</Label>
                      <SingleImagePicker
                        value={it.item_image_url}
                        onChange={(v) => updateItem(it.id, { item_image_url: v })}
                        folder="items"
                      />
                    </div>
                  </div>
                </section>

                {/* SECTION 2: Measurement & Sketches */}
                <section className="space-y-2 rounded-md border border-dashed bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Measurement &amp; Site</h3>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Dimensions</Label>
                    <Textarea
                      rows={2}
                      value={it.measurement ?? ""}
                      onChange={(e) => updateItem(it.id, { measurement: e.target.value })}
                      placeholder="W x H x D"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <CollapsibleField label="Measurement photos" hasValue={!!it.measurement_image_url}>
                      <MultiImagePicker
                        value={it.measurement_image_url}
                        onChange={(v) => updateItem(it.id, { measurement_image_url: v })}
                        folder="measurements"
                        label="Measurement photos"
                      />
                    </CollapsibleField>
                    <CollapsibleField label="Site photos" hasValue={!!it.site_photos}>
                      <MultiImagePicker
                        value={it.site_photos}
                        onChange={(v) => updateItem(it.id, { site_photos: v })}
                        folder="site-photos"
                        label="Site photos (location context)"
                      />
                    </CollapsibleField>
                    <CollapsibleField label="Catalog / cloth photos" hasValue={!!it.catalog_image_url}>
                      <MultiImagePicker
                        value={it.catalog_image_url}
                        onChange={(v) => updateItem(it.id, { catalog_image_url: v })}
                        folder="catalog"
                        label="Catalog / cloth photos"
                      />
                    </CollapsibleField>
                  </div>
                  <SketchField
                    value={it.sketch_url}
                    onChange={(v) => updateItem(it.id, { sketch_url: v })}
                    label="Hand-drawn sketch"
                  />
                </section>

                {/* SECTION 3: Quantity & Pricing */}
                <section className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {showPricing ? "Quantity & Pricing" : "Quantity"}
                    </h3>
                  </div>
                  <div className={`grid gap-3 ${showPricing ? "grid-cols-3" : "grid-cols-1 sm:max-w-[160px]"}`}>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Qty</Label>
                    <Input
                      className="h-11"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={it.quantity || ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const n = raw === "" ? 0 : Math.max(1, Math.floor(Number(raw)));
                        updateItem(it.id, { quantity: Number.isFinite(n) ? n : 1 });
                      }}
                      onFocus={(e) => e.currentTarget.select()}
                      placeholder="1"
                    />
                  </div>
                  {showPricing && (
                  <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Unit price (₹)</Label>
                    <Input
                      className="h-11"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={it.unit_price || ""}
                      onChange={(e) => updateItem(it.id, { unit_price: Number(e.target.value) || 0 })}
                      disabled={!canEditPrice}
                      onFocus={(e) => e.currentTarget.select()}
                      placeholder="0"
                    />
                    {!canEditPrice && <p className="text-[10px] text-muted-foreground">Set by office</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Amount</Label>
                    <div className="flex h-11 items-center justify-end rounded-md border bg-primary/5 px-3 font-mono text-sm font-semibold text-primary">
                      {((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)) > 0
                        ? formatINR((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))
                        : <span className="font-normal text-muted-foreground">—</span>}
                    </div>
                  </div>
                  </>
                  )}
                  </div>
                </section>
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
      {!po && (
      <Card className="mb-4">
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <div className="space-y-3 order-2 md:order-1">
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={q.notes ?? ""} onChange={(e) => updateHeader({ notes: e.target.value })} placeholder="Internal notes, delivery info, special instructions..." /></div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Terms & Conditions</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateHeader({ terms: DEFAULT_TERMS })}>
                  Reset to default
                </Button>
              </div>
              <Textarea
                rows={8}
                value={q.terms ?? DEFAULT_TERMS}
                onChange={(e) => updateHeader({ terms: e.target.value })}
                placeholder="50% advance, delivery timeline, validity, GST, warranty..."
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Shown at the bottom of the quotation PDF. Edit per quote as needed.</p>
            </div>
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
            {/* Subtotal — always visible */}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatINR(subtotal)}</span>
            </div>

            {/* Discount — input shown to staff so they can enter; read-only row only when > 0 */}
            {canEditPrice ? (
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="discount-amt" className="shrink-0 text-sm text-muted-foreground">Discount</Label>
                <Input
                  id="discount-amt"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="h-9 w-24 min-w-0 text-right sm:w-32"
                  value={q.discount_amount ?? 0}
                  onChange={(e) => updateHeader({ discount_amount: Number(e.target.value) || 0 })}
                />
              </div>
            ) : discountAmount > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium">- {formatINR(discountAmount)}</span>
              </div>
            ) : null}

            {/* GST — only when % > 0 AND amount > 0 */}
            {(q.gst_percent ?? 0) > 0 && gstAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">GST ({q.gst_percent}%)</span>
                <span className="font-medium">{formatINR(gstAmount)}</span>
              </div>
            )}

            {/* Advance Received — input shown to staff; read-only row only when > 0 */}
            {canEditPrice ? (
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="advance-amt" className="shrink-0 text-sm text-muted-foreground">Advance Received</Label>
                <Input
                  id="advance-amt"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="h-9 w-24 min-w-0 text-right sm:w-32"
                  value={q.advance_amount ?? 0}
                  onChange={(e) => updateHeader({ advance_amount: Number(e.target.value) || 0 })}
                />
              </div>
            ) : advanceAmount > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Advance Received</span>
                <span className="font-medium">- {formatINR(advanceAmount)}</span>
              </div>
            ) : null}

            <Separator />

            {/* Grand Total — always visible. Becomes Balance Due if advance was paid. */}
            <div className="flex items-baseline justify-between">
              <span className="font-display text-base">{advanceAmount > 0 ? "Balance Due" : "Grand Total"}</span>
              <span className="font-display text-2xl font-bold text-primary">
                {formatINR(advanceAmount > 0 ? balanceDue : grandTotal)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      )}
      {po && (
        <Card className="mb-4">
          <CardContent className="space-y-3 p-4">
            <div className="space-y-1.5">
              <Label>Notes for worker / supplier</Label>
              <Textarea rows={3} value={q.notes ?? ""} onChange={(e) => updateHeader({ notes: e.target.value })} placeholder="Material specs, delivery date, priority, finish type..." />
            </div>
            <p className="text-xs text-muted-foreground">
              No prices, GST, bank details or customer terms are shown on a Purchase Order.
              Use the <span className="font-semibold">Assign</span> button below to send this PO to a worker on WhatsApp.
            </p>
          </CardContent>
        </Card>
      )}

      {isFieldOnly && (
        <p className="mb-24 text-center text-xs text-muted-foreground sm:mb-4">Submit this draft and office staff will add prices and finalize.</p>
      )}

      {/* Sticky mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-3 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden">
        {/* Row 1 (top): secondary actions — equal thirds so the Assign button is
            fully visible on narrow screens (was being clipped to a sliver before). */}
        {canEditPrice && (
          <div className="mb-2 grid grid-cols-3 gap-2">
            <DownloadShareMenu
              onPdf={downloadPdf}
              onJpg={downloadJpg}
              triggerClassName="h-11 px-2 w-full"
              label="Save"
              pdfTooltip="PDF — full quotation"
              jpgTooltip="JPG — for WhatsApp"
            />
            <Button variant="outline" onClick={shareWhatsApp} className="h-11 px-2">
              <MessageCircle className="mr-1.5 h-4 w-4 text-primary" />WhatsApp
            </Button>
            <Button variant="secondary" onClick={openJobDialog} className="h-11 px-2">
              <HardHat className="mr-1.5 h-4 w-4" />Assign
            </Button>
          </div>
        )}
        {canEditPrice && (
          <div className="mb-2">
            <AttachedNotesButton quotationId={q.id} className="h-11 w-full" />
          </div>
        )}
        {/* Row 2 (bottom): primary Save action sits closest to thumb. */}
        <Button onClick={saveAndPreview} disabled={saving} className="h-12 w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-1.5 h-4 w-4" />Save</>}
        </Button>
      </div>
      {/* Spacer so content isn't hidden behind sticky bar on mobile */}
      <div className={canEditPrice ? "h-32 sm:hidden" : "h-16 sm:hidden"} aria-hidden />

      {/* Product picker */}
      <Dialog open={productPickerOpen} onOpenChange={setProductPickerOpen}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle className="flex items-center gap-2">
              {(pickerMainId || pickerSubId) && !productSearch && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="-ml-2 h-8 px-2"
                  onClick={() => {
                    if (pickerSubId) setPickerSubId(null);
                    else setPickerMainId(null);
                  }}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              )}
              <span>
                {productSearch
                  ? "Search results"
                  : pickerSubId
                    ? subCats.find((s) => s.id === pickerSubId)?.name ?? "Models"
                    : pickerMainId
                      ? mainCats.find((m) => m.id === pickerMainId)?.name ?? "Sub-categories"
                      : "Pick from catalog"}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div
            className="flex flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6"
            onFocusCapture={scrollFocusedIntoView}
          >
            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search by name or code (or browse below)…"
                className="pl-9"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* SEARCH MODE — flat results across catalog */}
              {productSearch ? (
                <div className="space-y-2">
                  {products
                    .filter((p) =>
                      `${p.product_name} ${p.product_code}`
                        .toLowerCase()
                        .includes(productSearch.toLowerCase()),
                    )
                    .map((p) => (
                      <ProductRow key={p.id} p={p} onPick={addFromProduct} />
                    ))}
                  {products.filter((p) =>
                    `${p.product_name} ${p.product_code}`
                      .toLowerCase()
                      .includes(productSearch.toLowerCase()),
                  ).length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No matches.
                    </p>
                  )}
                </div>
              ) : !pickerMainId ? (
                /* STEP 1 — Main categories grid (the "View All" landing) */
                mainCats.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No categories yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {mainCats.map((m) => {
                      const count = products.filter((p) => p.main_category_id === m.id).length;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPickerMainId(m.id)}
                          className="group relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-border bg-card p-3 text-center transition-smooth hover:border-primary hover:shadow"
                        >
                          {m.image_url ? (
                            <img
                              src={m.image_url}
                              alt={m.name}
                              loading="lazy"
                              className="absolute inset-0 h-full w-full object-contain p-3 opacity-90"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10" />
                          )}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/0 to-transparent" />
                          <span className="relative z-10 mt-auto font-display text-sm font-semibold text-background">
                            {m.name}
                          </span>
                          <span className="relative z-10 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : !pickerSubId ? (
                /* STEP 2 — Sub-categories of the chosen main */
                (() => {
                  const subs = subCats.filter((s) => s.main_category_id === pickerMainId);
                  return (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => setPickerSubId("__all__")}
                        className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-3 text-center transition-smooth hover:border-primary"
                      >
                        <span className="font-display text-base text-primary">All</span>
                        <span className="text-[11px] text-muted-foreground">
                          {products.filter((p) => p.main_category_id === pickerMainId).length} models
                        </span>
                      </button>
                      {subs.map((s) => {
                        const count = products.filter(
                          (p) => p.sub_category_id === s.id,
                        ).length;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setPickerSubId(s.id)}
                            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card p-3 text-center transition-smooth hover:border-primary hover:shadow"
                          >
                            <span className="font-display text-sm">{s.name}</span>
                            <span className="text-[11px] text-muted-foreground">{count} models</span>
                          </button>
                        );
                      })}
                      {subs.length === 0 && (
                        <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
                          No sub-categories — tap "All" to browse models.
                        </p>
                      )}
                    </div>
                  );
                })()
              ) : (
                /* STEP 3 — Models in the chosen sub (or all under main) */
                (() => {
                  const list = products.filter((p) => {
                    if (p.main_category_id !== pickerMainId) return false;
                    if (pickerSubId !== "__all__" && p.sub_category_id !== pickerSubId) return false;
                    return true;
                  });
                  return (
                    <div className="space-y-2">
                      {list.map((p) => (
                        <ProductRow key={p.id} p={p} onPick={addFromProduct} />
                      ))}
                      {list.length === 0 && (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          No models in this section yet.
                        </p>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Job Work dialog */}
      <Dialog open={jobOpen} onOpenChange={setJobOpen}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle>Assign Job Work</DialogTitle>
          </DialogHeader>
          <div
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6"
            onFocusCapture={scrollFocusedIntoView}
          >
            <p className="text-sm text-muted-foreground">{selectedItemIds.size} item(s) selected. Worker image will exclude prices, GST and customer phone.</p>
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
          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:px-6 sm:py-4">
            <Button variant="outline" onClick={() => setJobOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <DownloadShareMenu
              busy={generatingJob}
              disabled={!selectedWorker}
              onPdf={() => generateAndSendJob("pdf")}
              onJpg={() => generateAndSendJob("jpg")}
              triggerVariant="default"
              triggerClassName="w-full sm:w-auto"
              label="Assign & send"
              pdfTooltip="PDF — worker-safe (no prices / no customer phone)"
              jpgTooltip="JPG — send via WhatsApp to worker now"
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </AdminShell>
  );
};

export default AdminQuotationEditor;
