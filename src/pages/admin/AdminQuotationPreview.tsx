import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { formatINR, formatINRNumber } from "@/lib/brand";
import { COMPANY, BANK_DETAILS } from "@/lib/companyInfo";
import { openWhatsAppApp } from "@/lib/whatsapp";
import {
  Loader2, ArrowLeft, Pencil, MessageCircle, Check, Download, HardHat, Image as ImageIcon,
} from "lucide-react";
import { isPO, type DocType } from "@/lib/docType";
import { DownloadShareMenu } from "@/components/admin/DownloadShareMenu";
import { AttachedNotesButton } from "@/components/admin/AttachedNotesButton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { shareFilesNative } from "@/lib/nativeShare";
import { Share2 } from "lucide-react";

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
  display_order: number;
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
  advance_amount: number;
  discount_amount: number;
  status: string;
  notes: string | null;
  terms: string | null;
  created_by: string | null;
  document_type: DocType;
};

type Worker = {
  id: string;
  name: string;
  whatsapp_number: string;
  trade: string | null;
};

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const AdminQuotationPreview = () => {
  // Aggressive compression for WhatsApp share — photos display tiny in the PDF,
  // so 700px / q=0.6 stays sharp while cutting file size ~60%.
  const COMPRESSED_PDF_OPTIONS = { image: { maxSide: 700, jpegQuality: 0.6 } } as const;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isOfficeStaff } = useAuth();
  const canShare = isOfficeStaff;

  const [q, setQ] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [createdByName, setCreatedByName] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [jobNotes, setJobNotes] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [generatingJob, setGeneratingJob] = useState(false);
  // "saved" = pick a registered worker (existing flow).
  // "direct" = skip worker selection and trigger native share sheet so the
  // admin can send the worker-safe file to ANY contact / WhatsApp group.
  const [assignMode, setAssignMode] = useState<"saved" | "direct">("saved");

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [{ data: quote }, { data: lines }] = await Promise.all([
        supabase.from("quotations").select("*").eq("id", id).maybeSingle(),
        supabase.from("quotation_items").select("*").eq("quotation_id", id).order("display_order", { ascending: true }),
      ]);
      if (!quote) {
        toast({ title: "Quotation not found", variant: "destructive" });
        navigate("/admin/quotations");
        return;
      }
      setQ(quote as Quotation);
      setItems((lines ?? []) as QItem[]);
      const cb = (quote as Quotation).created_by;
      if (cb) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name, email")
          .eq("user_id", cb)
          .maybeSingle();
        setCreatedByName(prof?.display_name || prof?.email || "Staff");
      } else {
        setCreatedByName(null);
      }
      setLoading(false);
    })();
  }, [id, navigate]);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0),
    [items]
  );
  const discount = Math.min(Math.max(0, Number(q?.discount_amount) || 0), subtotal);
  const taxable = Math.max(0, subtotal - discount);
  const gstAmount = Math.round(taxable * ((q?.gst_percent ?? 0) / 100) * 100) / 100;
  const grandTotal = taxable + gstAmount;
  const advance = Math.max(0, Number(q?.advance_amount) || 0);
  const balance = Math.max(0, grandTotal - advance);

  const showDiscount = discount > 0;
  const showGst = (q?.gst_percent ?? 0) > 0 && gstAmount > 0;
  const showAdvance = advance > 0;
  const hasAnyPrice = items.some((i) => Number(i.unit_price) > 0);

  const handleEdit = () => navigate(`/admin/quotations/${id}`);
  const handleDone = () => navigate("/admin/quotations");

  const po = isPO(q?.document_type);

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

  const markSent = async () => {
    // No-op under the simplified 4-status workflow. Sharing a PDF/JPG no
    // longer advances the status — only Advance Received or an admin's manual
    // change does. Kept as a stub so existing call sites compile.
    return;
  };

  // Share one or more JPG pages (page-by-page sequence). Tries the native
  // Web Share sheet first (WhatsApp picks all files in one bubble); on
  // unsupported devices we fall back to downloading every page and opening
  // the WhatsApp chat so the admin can attach them via the paperclip.
  const shareJpgPagesViaWhatsApp = async (
    blobs: Blob[],
    baseName: string,
    phone: string | null,
    message: string,
  ) => {
    const cleanPhone = (phone ?? "").replace(/[^0-9]/g, "");
    const isMulti = blobs.length > 1;
    const files = blobs.map((b, i) =>
      new File(
        [b],
        isMulti ? `${baseName}_Page${i + 1}.jpg` : `${baseName}.jpg`,
        { type: "image/jpeg" },
      ),
    );
    const navAny = navigator as any;

    if (navAny.canShare && navAny.canShare({ files })) {
      try {
        await navAny.share({ files, title: baseName, text: message });
        return;
      } catch (e) {
        console.warn("Share cancelled, falling back", e);
      }
    }

    files.forEach((f, idx) => {
      setTimeout(() => downloadBlob(f, f.name), idx * 250);
    });
    toast({
      title: isMulti ? `${files.length} images downloaded` : "Image downloaded",
      description: cleanPhone
        ? "Opening WhatsApp app now. Tap the paperclip and attach the downloaded images in order."
        : "Saved to this device.",
      duration: 8000,
    });
    if (cleanPhone) {
      setTimeout(() => openWhatsAppApp(cleanPhone, message), 400 + files.length * 250);
    }
  };

  const buildAndShare = async (mode: "share" | "download") => {
    if (!q) return;
    if (mode === "share" && !q.party_phone) {
      toast({ title: "No party phone on file", variant: "destructive" });
      return;
    }
    setSharing(true);
    try {
      // Lazy-load heavy PDF + rasteriser libs only when sharing
      const { generateQuotationPdf } = await import("@/lib/quotationPdf");
      const data = {
        quotation_id: q.quotation_id,
        party_name: q.party_name,
        party_place: q.party_place,
        party_phone: q.party_phone,
        party_address: q.party_address,
        quotation_date: new Date(q.quotation_date).toLocaleDateString("en-IN"),
        expected_delivery_date: q.expected_delivery_date
          ? new Date(q.expected_delivery_date).toLocaleDateString("en-IN")
          : null,
        gst_percent: q.gst_percent,
        subtotal,
        discount_amount: discount,
        gst_amount: gstAmount,
        total: grandTotal,
        advance_amount: advance,
        balance_due: balance,
        notes: q.notes,
        terms: q.terms,
        is_po: isPO(q.document_type),
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
      const pdfBlob = await generateQuotationPdf(data, COMPRESSED_PDF_OPTIONS);
      const { pdfBlobToJpgPages } = await import("@/lib/pdfToJpg");
      // Page-by-page output: high-resolution (3×) sequence so each page
      // stays sharp on its own and items are never split across two images.
      const blobs = await pdfBlobToJpgPages(pdfBlob);
      const baseName = q.quotation_id;
      const isMulti = blobs.length > 1;

      if (mode === "download") {
        blobs.forEach((b, i) => {
          const fn = isMulti ? `${baseName}_Page${i + 1}.jpg` : `${baseName}.jpg`;
          setTimeout(() => downloadBlob(b, fn), i * 250);
        });
        toast({ title: isMulti ? `${blobs.length} images downloaded` : "Image downloaded" });
        return;
      }

      const balanceLine = advance > 0
        ? `Total: ${formatINR(grandTotal)}\nAdvance Received: ${formatINR(advance)}\nBalance Due: ${formatINR(balance)}`
        : `Total: ${formatINR(grandTotal)}`;
      const msg = po
        ? `Hi ${q.party_name},\n\nPurchase Order ${q.quotation_id} attached.\nItems: ${items.length}\n\n— Hitech Furniture & Interiors`
        : `Dear ${q.party_name},\n\nPlease find attached our quotation ${q.quotation_id} from Hitech Furniture & Interiors.\n\n${balanceLine}\n\nThank you.`;

      await shareJpgPagesViaWhatsApp(blobs, baseName, q.party_phone, msg);
      await markSent();
    } catch (e: any) {
      console.error("Image share failed:", e);
      toast({ title: "Image generation failed", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  // Build the raw multi-page PDF (no JPG rasterization). Used by the unified
  // Download/Share menu so admins can pick the format that matches who they
  // are sending it to (PDF for customers, JPG for workers/WhatsApp).
  const downloadPdf = async () => {
    if (!q) return;
    setSharing(true);
    try {
      const { generateQuotationPdf } = await import("@/lib/quotationPdf");
      const data = {
        quotation_id: q.quotation_id,
        party_name: q.party_name,
        party_place: q.party_place,
        party_phone: q.party_phone,
        party_address: q.party_address,
        quotation_date: new Date(q.quotation_date).toLocaleDateString("en-IN"),
        expected_delivery_date: q.expected_delivery_date
          ? new Date(q.expected_delivery_date).toLocaleDateString("en-IN")
          : null,
        gst_percent: q.gst_percent,
        subtotal,
        discount_amount: discount,
        gst_amount: gstAmount,
        total: grandTotal,
        advance_amount: advance,
        balance_due: balance,
        notes: q.notes,
        terms: q.terms,
        is_po: isPO(q.document_type),
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
      const pdfBlob = await generateQuotationPdf(data);
      downloadBlob(pdfBlob, `${q.quotation_id}.pdf`);
      toast({ title: "PDF downloaded" });
    } catch (e: any) {
      console.error("PDF generation failed:", e);
      toast({
        title: "PDF generation failed",
        description: e?.message ?? "Try again.",
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  };

  const toggleItemSelection = (itemId: string, checked: boolean) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  };

  const openAssignDialog = async () => {
    if (!q) return;
    if (items.length === 0) {
      toast({ title: "No items to assign", description: "Add at least one saved item first.", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase
      .from("workers")
      .select("id, name, whatsapp_number, trade")
      .eq("is_active", true)
      .order("name");
    if (error) {
      toast({ title: "Workers load failed", description: error.message, variant: "destructive" });
      return;
    }
    setWorkers((data ?? []) as Worker[]);
    setSelectedWorker("");
    setJobNotes("");
    setSelectedItemIds(new Set(items.map((item) => item.id)));
    setAssignMode("saved");
    setAssignOpen(true);
  };

  // Shortcut from the action bar — open the dialog already in "Direct Share"
  // mode so admins don't have to switch tabs.
  const openDirectShareDialog = async () => {
    await openAssignDialog();
    setAssignMode("direct");
  };

  const generateAndAssignJob = async (format: "jpg" | "pdf" = "jpg") => {
    if (!q) return;
    const isDirect = assignMode === "direct";
    let worker: Worker | undefined;
    if (!isDirect) {
      if (!selectedWorker) {
        toast({ title: "Select a worker", variant: "destructive" });
        return;
      }
      worker = workers.find((entry) => entry.id === selectedWorker);
      if (!worker) {
        toast({ title: "Worker not found", variant: "destructive" });
        return;
      }
      if (format === "jpg" && !worker.whatsapp_number?.trim()) {
        toast({ title: "Worker WhatsApp missing", description: `Add a WhatsApp number for ${worker.name} first.`, variant: "destructive" });
        return;
      }
    }

    const chosenItems = items.filter((item) => selectedItemIds.has(item.id));
    if (chosenItems.length === 0) {
      toast({ title: "Select at least one item", description: "Choose which quotation items to assign.", variant: "destructive" });
      return;
    }

    setGeneratingJob(true);
    try {
      // Only log a job_work_orders row when assigning to a saved worker.
      // Direct shares are intentionally not tied to any worker profile.
      if (worker) {
        const { error } = await supabase.from("job_work_orders").insert({
          quotation_id: q.id,
          worker_id: worker.id,
          item_ids: chosenItems.map((item) => item.id),
          notes: jobNotes.trim() || null,
          status: "assigned",
          created_by: user?.id ?? null,
        });
        if (error) {
          toast({ title: "Failed to create job", description: error.message, variant: "destructive" });
          return;
        }
      }

      const { generateJobWorkPdf } = await import("@/lib/quotationPdf");
      // Worker-safe PDF: generateJobWorkPdf strips prices, GST and customer
      // contact details by design, so the same blob is safe whether we deliver
      // it as PDF or rasterised JPG.
      const pdfBlob = await generateJobWorkPdf({
        quotation_id: q.quotation_id,
        worker_name: worker?.name ?? "Job Work",
        date: new Date().toLocaleDateString("en-IN"),
        notes: jobNotes.trim() || null,
        items: chosenItems.map((item) => ({
          description: item.description,
          item_image_url: item.item_image_url,
          measurement: item.measurement,
          measurement_image_url: item.measurement_image_url,
          catalog_text: item.catalog_text,
          catalog_image_url: item.catalog_image_url,
          sketch_url: item.sketch_url,
          site_photos: item.site_photos,
          quantity: item.quantity,
        })),
      }, format === "jpg" ? COMPRESSED_PDF_OPTIONS : undefined);

      const baseFilename = worker
        ? `JobWork-${q.quotation_id}-${worker.name.replace(/\s+/g, "_")}`
        : `JobWork-${q.quotation_id}`;
      const greeting = worker ? `Hi ${worker.name},` : "Hi,";
      const msg = `${greeting}\n\nNew job work assigned. Reference: ${q.quotation_id}\nItems: ${chosenItems.length}\n\n— Hitech Furniture & Interiors`;

      if (isDirect) {
        // Direct WhatsApp / native share sheet — let the admin pick any
        // contact or WhatsApp group from their phone.
        if (format === "pdf") {
          await shareFilesNative([pdfBlob], baseFilename, msg, "pdf");
        } else {
          const { pdfBlobToJpgPages } = await import("@/lib/pdfToJpg");
          const blobs = await pdfBlobToJpgPages(pdfBlob);
          await shareFilesNative(blobs, baseFilename, msg, "jpg");
        }
        toast({
          title: "Ready to share",
          description: "Pick the contact or WhatsApp group from your phone's share sheet.",
        });
      } else if (format === "pdf") {
        downloadBlob(pdfBlob, `${baseFilename}.pdf`);
        toast({
          title: "Job PDF downloaded",
          description: `${chosenItems.length} item(s) assigned to ${worker!.name}. Attach the PDF on WhatsApp manually.`,
        });
      } else {
        const { pdfBlobToJpgPages } = await import("@/lib/pdfToJpg");
        const blobs = await pdfBlobToJpgPages(pdfBlob);
        await shareJpgPagesViaWhatsApp(blobs, baseFilename, worker!.whatsapp_number, msg);
        toast({
          title: "Job work sent",
          description: `${chosenItems.length} item(s) assigned to ${worker!.name}${blobs.length > 1 ? ` (${blobs.length} pages)` : ""}`,
        });
      }
      setAssignOpen(false);
      setSelectedItemIds(new Set());
    } catch (e: any) {
      console.error("Job image generation failed:", e);
      toast({ title: "Image generation failed", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setGeneratingJob(false);
    }
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
      {/* Top action row (back) */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={handleDone} className="h-9">
          <ArrowLeft className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">{po ? "Purchase Orders" : "Quotations"}</span>
        </Button>
        <span className="text-xs text-muted-foreground">{po ? "PO Preview" : "Digital Preview"}</span>
      </div>

      {/* Document */}
      <article className="mx-auto max-w-4xl rounded-lg border border-border bg-white text-slate-900 shadow-sm print:border-0 print:shadow-none">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b-2 border-slate-200 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <div className="flex items-start gap-3">
            <Logo className="h-14 w-auto sm:h-16" />
            <div>
              <h1 className="font-display text-xl font-bold leading-tight sm:text-2xl">{COMPANY.name}</h1>
              <p className="text-xs text-slate-600 sm:text-sm">{COMPANY.address}</p>
              <p className="text-xs text-slate-600 sm:text-sm">{COMPANY.phone}</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className={`text-[11px] uppercase tracking-wider ${po ? "font-bold text-blue-600" : "text-slate-500"}`}>
              {po ? "PURCHASE ORDER" : "Quotation"}
            </p>
            <p className="font-mono text-base font-semibold sm:text-lg">{q.quotation_id}</p>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">Date: {fmtDate(q.quotation_date)}</p>
            {q.expected_delivery_date && (
              <p className="text-xs text-slate-600 sm:text-sm">Delivery: {fmtDate(q.expected_delivery_date)}</p>
            )}
          </div>
        </header>

        {/* Party */}
        <section className="border-b border-slate-200 p-5 sm:p-8">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">{po ? "Worker / Supplier" : "Quotation For"}</p>
          <p className="text-base font-semibold sm:text-lg">{q.party_name}</p>
          <p className="text-sm text-slate-700">{q.party_place}</p>
          {q.party_address && <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{q.party_address}</p>}
          {q.party_phone && <p className="mt-0.5 text-sm text-slate-700">Phone: {q.party_phone}</p>}
        </section>

        {/* Items — table on sm+, stacked cards on mobile */}
        <section className="p-5 sm:p-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Items</h2>

          {/* Mobile: stacked cards */}
          <div className="space-y-3 sm:hidden">
            {items.map((it, idx) => {
              const amt = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
              return (
                <div key={it.id} className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-xs font-medium text-slate-500">#{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{it.description}</p>
                      {it.measurement && (
                        <p className="mt-0.5 text-xs text-slate-600">Measurement: {it.measurement}</p>
                      )}
                      {it.catalog_text && (
                        <p className="text-xs text-slate-600">Ref: {it.catalog_text}</p>
                      )}
                    </div>
                  </div>
                  {(it.item_image_url || it.measurement_image_url || it.catalog_image_url || it.sketch_url || it.site_photos) && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {it.item_image_url && (
                        <div className="aspect-square overflow-hidden rounded border border-slate-200 bg-slate-50">
                          <img src={it.item_image_url} alt="Item" loading="lazy" className="h-full w-full object-contain" />
                        </div>
                      )}
                      {it.measurement_image_url && (
                        <div className="aspect-square overflow-hidden rounded border border-slate-200 bg-slate-50">
                          <img src={it.measurement_image_url} alt="Measurement" loading="lazy" className="h-full w-full object-contain" />
                        </div>
                      )}
                      {it.catalog_image_url && (
                        <div className="aspect-square overflow-hidden rounded border border-slate-200 bg-slate-50">
                          <img src={it.catalog_image_url} alt="Catalog" loading="lazy" className="h-full w-full object-contain" />
                        </div>
                      )}
                      {it.sketch_url && (
                        <div className="aspect-square overflow-hidden rounded border border-slate-200 bg-white">
                          <img src={it.sketch_url} alt="Sketch" loading="lazy" className="h-full w-full object-contain" />
                        </div>
                      )}
                      {(it.site_photos ?? "")
                        .split(/\r?\n/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .slice(0, 3)
                        .map((u, k) => (
                          <div key={`site-${k}`} className="aspect-square overflow-hidden rounded border border-slate-200 bg-slate-50">
                            <img src={u} alt={`Site ${k + 1}`} loading="lazy" className="h-full w-full object-contain" />
                          </div>
                        ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
                    <span className="text-slate-600">Qty: <span className="font-medium text-slate-900 tabular-nums">{it.quantity}</span></span>
                    {hasAnyPrice && (
                      <>
                        <span className="text-slate-600">Price: <span className="font-mono tabular-nums text-slate-900">{formatINRNumber(it.unit_price)}</span></span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900">{formatINRNumber(amt)}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-md border border-slate-200 sm:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="w-10 px-3 py-2 text-left">Sl No</th>
                  <th className="px-3 py-2 text-left">Image</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Measurement</th>
                  <th className="w-20 px-3 py-2 text-right">Qty</th>
                  {hasAnyPrice && <th className="w-28 px-3 py-2 text-right">Price (INR)</th>}
                  {hasAnyPrice && <th className="w-32 px-3 py-2 text-right">Amount (INR)</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const amt = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
                  return (
                    <tr key={it.id} className="border-t border-slate-200 align-top odd:bg-white even:bg-slate-50/60">
                      <td className="px-3 py-3 text-left text-slate-500 tabular-nums">{idx + 1}</td>
                      <td className="px-3 py-3">
                        {it.item_image_url ? (
                          <div className="h-16 w-16 overflow-hidden rounded border border-slate-200 bg-slate-50">
                            <img src={it.item_image_url} alt="" loading="lazy" className="h-full w-full object-contain" />
                          </div>
                        ) : (
                          <div className="h-16 w-16 rounded border border-dashed border-slate-200 bg-slate-50" />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-900">{it.description}</p>
                        {it.catalog_text && <p className="mt-0.5 text-xs text-slate-500">Ref: {it.catalog_text}</p>}
                        {(it.measurement_image_url || it.catalog_image_url) && (
                          <div className="mt-2 flex gap-2">
                            {it.measurement_image_url && (
                              <div className="h-12 w-12 overflow-hidden rounded border border-slate-200 bg-slate-50">
                                <img src={it.measurement_image_url} alt="Measurement" loading="lazy" className="h-full w-full object-contain" />
                              </div>
                            )}
                            {it.catalog_image_url && (
                              <div className="h-12 w-12 overflow-hidden rounded border border-slate-200 bg-slate-50">
                                <img src={it.catalog_image_url} alt="Catalog" loading="lazy" className="h-full w-full object-contain" />
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{it.measurement || "—"}</td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">{it.quantity}</td>
                      {hasAnyPrice && <td className="px-3 py-3 text-right font-mono tabular-nums">{formatINRNumber(it.unit_price)}</td>}
                      {hasAnyPrice && <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold">{formatINRNumber(amt)}</td>}
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={hasAnyPrice ? 7 : 5} className="px-3 py-8 text-center text-slate-500">No items added.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Totals */}
        {hasAnyPrice && !po && (
          <section className="border-t-2 border-slate-300 bg-slate-50/70 p-5 sm:p-8">
            <div className="ml-auto w-full max-w-sm overflow-hidden rounded-md border border-slate-200 bg-white text-sm shadow-sm">
              <div className="flex justify-between px-4 py-2">
                <span className="text-slate-600">Subtotal (INR)</span>
                <span className="font-mono tabular-nums">{formatINRNumber(subtotal)}</span>
              </div>
              {showDiscount && (
                <div className="flex justify-between border-t border-slate-100 px-4 py-2">
                  <span className="text-slate-600">Discount (INR)</span>
                  <span className="font-mono tabular-nums text-emerald-700">− {formatINRNumber(discount)}</span>
                </div>
              )}
              {showGst && (
                <div className="flex justify-between border-t border-slate-100 px-4 py-2">
                  <span className="text-slate-600">GST {q.gst_percent}% (INR)</span>
                  <span className="font-mono tabular-nums">{formatINRNumber(gstAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t-2 border-slate-300 bg-slate-900 px-4 py-3 text-base font-semibold text-white">
                <span>Grand Total</span>
                <span className="font-mono tabular-nums">{formatINR(grandTotal)}</span>
              </div>
              {showAdvance && (
                <>
                  <div className="flex justify-between border-t border-slate-100 px-4 py-2">
                    <span className="text-slate-600">Advance Received (INR)</span>
                    <span className="font-mono tabular-nums">{formatINRNumber(advance)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 bg-amber-50 px-4 py-2 font-semibold">
                    <span>Balance Due</span>
                    <span className="font-mono tabular-nums">{formatINR(balance)}</span>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* Notes */}
        {q.notes && (
          <section className="border-t border-slate-200 p-5 sm:p-8">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</h3>
            <p className="whitespace-pre-line text-sm text-slate-700">{q.notes}</p>
          </section>
        )}

        {/* Bank + Terms (collapsed compactly) */}
        <section className="grid gap-4 border-t border-slate-200 p-5 text-xs sm:grid-cols-2 sm:p-8">
          {!po && (
            <div>
              <h3 className="mb-1 font-semibold uppercase tracking-wider text-slate-500">Bank Details</h3>
              <p className="text-slate-700">{BANK_DETAILS.bankName} — {BANK_DETAILS.branch}</p>
              <p className="text-slate-700">A/C: {BANK_DETAILS.accountName}</p>
              <p className="font-mono text-slate-700">{BANK_DETAILS.accountNumber} · IFSC {BANK_DETAILS.ifsc}</p>
            </div>
          )}
          {!po && q.terms && (
            <div>
              <h3 className="mb-1 font-semibold uppercase tracking-wider text-slate-500">Terms</h3>
              <p className="whitespace-pre-line text-[11px] leading-snug text-slate-600">{q.terms}</p>
            </div>
          )}
        </section>

        <footer className="border-t border-slate-200 p-4 text-center text-[11px] text-slate-500 sm:p-6">
          {createdByName && (
            <p className="mb-1">Created By: <span className="font-medium text-slate-700">{createdByName}</span></p>
          )}
          Thank you for your business — {COMPANY.name}
        </footer>
      </article>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 left-0 right-0 z-20 mt-4 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <div className="mx-auto flex max-w-4xl flex-wrap gap-2">
          <Button variant="outline" onClick={handleEdit} className="h-11 flex-1 sm:flex-initial">
            <Pencil className="mr-2 h-4 w-4" />Edit
          </Button>
          {canShare && (
            <Button
              variant="secondary"
              onClick={openAssignDialog}
              disabled={sharing || generatingJob || items.length === 0}
              className="h-11 flex-1 sm:flex-initial"
            >
              {generatingJob ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HardHat className="mr-2 h-4 w-4" />}
              Assign Job
            </Button>
          )}
          {canShare && (
            <Button
              variant="outline"
              onClick={openDirectShareDialog}
              disabled={sharing || generatingJob || items.length === 0}
              className="h-11 flex-1 sm:flex-initial"
              title="Share job work directly to any contact or WhatsApp group"
            >
              <Share2 className="mr-2 h-4 w-4 text-primary" />
              Direct Share
            </Button>
          )}
          {canShare && (
            <Button
              onClick={() => buildAndShare("share")}
              disabled={sharing}
              className="h-11 flex-1 sm:flex-initial"
            >
              {sharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
              Share via WhatsApp
            </Button>
          )}
          {canShare && (
            <DownloadShareMenu
              busy={sharing}
              onPdf={downloadPdf}
              onJpg={() => buildAndShare("download")}
              triggerClassName="h-11 flex-1 sm:flex-initial"
              pdfTooltip="PDF — full quotation for customer"
              jpgTooltip="JPG — high-res images for WhatsApp"
            />
          )}
          {canShare && q && (
            <AttachedNotesButton quotationId={q.id} className="h-11 flex-1 sm:flex-initial" />
          )}
          <Button variant="secondary" onClick={handleDone} className="h-11 flex-1 sm:flex-initial">
            <Check className="mr-2 h-4 w-4" />Done
          </Button>
        </div>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle className="font-display text-xl sm:text-2xl">Assign job work</DialogTitle>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            {/* Mode picker — Saved Worker vs Direct WhatsApp / native share */}
            <div className="space-y-2">
              <Label>Send to</Label>
              <RadioGroup
                value={assignMode}
                onValueChange={(v) => setAssignMode(v as "saved" | "direct")}
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${assignMode === "saved" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value="saved" id="mode-saved" className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Saved Worker</p>
                    <p className="text-xs text-muted-foreground">Pick from your registered workers list.</p>
                  </div>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${assignMode === "direct" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value="direct" id="mode-direct" className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Direct WhatsApp Share</p>
                    <p className="text-xs text-muted-foreground">Send to any contact or WhatsApp group via your phone.</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {assignMode === "saved" && (
            <div className="space-y-1.5">
              <Label>Worker</Label>
              <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a worker" />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.name}{worker.trade ? ` · ${worker.trade}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workers.length === 0 && (
                <p className="text-xs text-destructive">
                  No active workers found. Add a worker (with WhatsApp number) under Admin → Workers first.
                </p>
              )}
              {selectedWorker && (() => {
                const w = workers.find((x) => x.id === selectedWorker);
                if (!w) return null;
                const wa = (w.whatsapp_number ?? "").replace(/[^0-9]/g, "");
                return (
                  <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                    <p className="font-semibold">{w.name}</p>
                    {w.trade && <p className="text-xs text-muted-foreground">{w.trade}</p>}
                    {wa ? (
                      <p className="mt-1 font-mono text-xs">WhatsApp: +{wa}</p>
                    ) : (
                      <p className="mt-1 text-xs text-destructive">
                        ⚠ No WhatsApp number on file. Add one before assigning.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
            )}

            {assignMode === "direct" && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                <p className="font-medium">Direct WhatsApp / Native Share</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  We'll generate the worker-safe file (no prices, no customer phone)
                  and open your phone's share sheet so you can pick any contact or
                  WhatsApp group. No worker profile is needed.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Items to assign</Label>
              <div className="max-h-64 space-y-2 overflow-auto rounded-md border border-border p-3">
                {items.map((item, index) => (
                  <label key={item.id} className="flex items-start gap-3 rounded-md border border-border/60 p-3">
                    <Checkbox
                      checked={selectedItemIds.has(item.id)}
                      onCheckedChange={(checked) => toggleItemSelection(item.id, !!checked)}
                      aria-label={`Select item ${index + 1}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Item #{index + 1}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      <p className="text-xs text-muted-foreground">Qty {item.quantity}{item.catalog_text ? ` · ${item.catalog_text}` : ""}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes for worker</Label>
              <Textarea
                rows={4}
                value={jobNotes}
                onChange={(event) => setJobNotes(event.target.value)}
                placeholder="Material, finish, deadline, special instructions..."
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:px-6 sm:py-4">
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={generatingJob} className="w-full sm:w-auto">Cancel</Button>
            <DownloadShareMenu
              busy={generatingJob}
              disabled={assignMode === "saved" && (workers.length === 0 || !selectedWorker)}
              onPdf={() => generateAndAssignJob("pdf")}
              onJpg={() => generateAndAssignJob("jpg")}
              triggerVariant="default"
              label={assignMode === "direct" ? "Generate & Share" : "Assign & send"}
              pdfTooltip="PDF — worker-safe (no prices / no customer phone)"
              jpgTooltip="JPG — send via WhatsApp to worker now"
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default AdminQuotationPreview;
