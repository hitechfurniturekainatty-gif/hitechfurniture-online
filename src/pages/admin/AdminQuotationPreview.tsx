import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { formatINR, formatINRNumber } from "@/lib/brand";
import { COMPANY, BANK_DETAILS } from "@/lib/companyInfo";
import {
  Loader2, ArrowLeft, Pencil, MessageCircle, Check, Download,
} from "lucide-react";
import { isPO, type DocType } from "@/lib/docType";

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

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const AdminQuotationPreview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOfficeStaff } = useAuth();
  const canShare = isOfficeStaff;

  const [q, setQ] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [createdByName, setCreatedByName] = useState<string | null>(null);

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

  const buildAndShare = async (mode: "share" | "download") => {
    if (!q) return;
    if (mode === "share" && !q.party_phone) {
      toast({ title: "No party phone on file", variant: "destructive" });
      return;
    }
    setSharing(true);
    try {
      // Lazy-load heavy PDF lib only when sharing
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
      const blob = await generateQuotationPdf(data);
      const filename = `${q.quotation_id}.pdf`;

      if (mode === "download") {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast({ title: "PDF downloaded" });
        return;
      }

      const file = new File([blob], filename, { type: "application/pdf" });
      const navAny = navigator as any;
      const cleanPhone = q.party_phone!.replace(/[^0-9]/g, "");
      const balanceLine = advance > 0
        ? `Total: ${formatINR(grandTotal)}\nAdvance Received: ${formatINR(advance)}\nBalance Due: ${formatINR(balance)}`
        : `Total: ${formatINR(grandTotal)}`;
      const msg = `Dear ${q.party_name},\n\nPlease find attached our quotation ${q.quotation_id} from Hitech Furniture & Interiors.\n\n${balanceLine}\n\nThank you.`;

      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        try {
          await navAny.share({ files: [file], title: filename, text: msg });
          // mark sent
          if (q.status === "draft" || q.status === "drafted" || q.status === "finalized") {
            await supabase.from("quotations").update({ status: "sent" }).eq("id", q.id);
            setQ({ ...q, status: "sent" });
          }
          return;
        } catch (e) {
          console.warn("Share cancelled, falling back", e);
        }
      }
      // Fallback: download then open WhatsApp
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({
        title: "PDF downloaded",
        description: "Attach it manually in WhatsApp once it opens.",
        duration: 8000,
      });
      setTimeout(() => {
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
      }, 600);
      if (q.status === "draft" || q.status === "drafted" || q.status === "finalized") {
        await supabase.from("quotations").update({ status: "sent" }).eq("id", q.id);
        setQ({ ...q, status: "sent" });
      }
    } catch (e: any) {
      console.error("PDF share failed:", e);
      toast({ title: "PDF generation failed", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setSharing(false);
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
          <span className="hidden sm:inline">Quotations</span>
        </Button>
        <span className="text-xs text-muted-foreground">Digital Preview</span>
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
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Quotation</p>
            <p className="font-mono text-base font-semibold sm:text-lg">{q.quotation_id}</p>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">Date: {fmtDate(q.quotation_date)}</p>
            {q.expected_delivery_date && (
              <p className="text-xs text-slate-600 sm:text-sm">Delivery: {fmtDate(q.expected_delivery_date)}</p>
            )}
          </div>
        </header>

        {/* Party */}
        <section className="border-b border-slate-200 p-5 sm:p-8">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Quotation For</p>
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
        {hasAnyPrice && (
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
          <div>
            <h3 className="mb-1 font-semibold uppercase tracking-wider text-slate-500">Bank Details</h3>
            <p className="text-slate-700">{BANK_DETAILS.bankName} — {BANK_DETAILS.branch}</p>
            <p className="text-slate-700">A/C: {BANK_DETAILS.accountName}</p>
            <p className="font-mono text-slate-700">{BANK_DETAILS.accountNumber} · IFSC {BANK_DETAILS.ifsc}</p>
          </div>
          {q.terms && (
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
              onClick={() => buildAndShare("share")}
              disabled={sharing}
              className="h-11 flex-1 sm:flex-initial"
            >
              {sharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
              Share via WhatsApp
            </Button>
          )}
          {canShare && (
            <Button
              variant="outline"
              onClick={() => buildAndShare("download")}
              disabled={sharing}
              className="h-11 flex-1 sm:flex-initial"
            >
              <Download className="mr-2 h-4 w-4" />PDF
            </Button>
          )}
          <Button variant="secondary" onClick={handleDone} className="h-11 flex-1 sm:flex-initial">
            <Check className="mr-2 h-4 w-4" />Done
          </Button>
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminQuotationPreview;
