import { handoffItemEligible } from "@/lib/deliveryHandoffSelection";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, Download, IndianRupee, Loader2, MapPin, Phone, Printer, Route, Share2, Truck } from "lucide-react";
import { COMPANY } from "@/lib/companyInfo";
import { firstUrl } from "@/lib/firstUrl";
import { formatINR } from "@/lib/brand";
import { downloadBlob } from "@/lib/downloadBlob";
import { shareFilesNative } from "@/lib/nativeShare";
import { createDeliveryHandoffPdf } from "@/lib/deliveryHandoffPdf";

type Item = {
  delivered_at: string | null; ordered_qty?: number | null; cancelled_qty?: number | null;
  id: string; description: string; quantity: number; measurement: string | null; catalog_text: string | null;
  item_image_url: string | null; catalog_image_url: string | null; measurement_image_url: string | null; display_order: number;
};
type Quote = {
  id: string; quotation_id: string; party_name: string; party_place: string; party_phone: string | null; party_address: string | null;
  delivery_place: string | null; expected_delivery_date: string | null; notes: string | null; status: string; delivery_route_id: string | null;
  advance_amount: number | null; total: number; dispatch_vehicle: string | null; dispatch_vehicle_number: string | null;
  dispatch_driver_name: string | null; dispatch_driver_phone: string | null;
};

const DeliveryNote = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, isOfficeStaff, isDelivery, loading: authLoading } = useAuth();
  const [ledgerBalance, setLedgerBalance] = useState<number | null>(null);
  const [q, setQ] = useState<Quote | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [eligibleIds, setEligibleIds] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [routeName, setRouteName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth", { replace: true }); return; }
    if (!isOfficeStaff && !isDelivery) {
      toast({ title: "Access denied", description: "Delivery team or office only.", variant: "destructive" });
      navigate("/", { replace: true }); return;
    }
    if (id) void load(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isOfficeStaff, isDelivery, id]);

  const load = async (quoteId: string) => {
    setLoading(true);
    const [{ data: quote, error: e1 }, { data: lines, error: e2 }, ledger, readiness] = await Promise.all([
      (supabase as any).from("quotations").select("id,quotation_id,party_name,party_place,party_phone,party_address,delivery_place,expected_delivery_date,notes,status,commercial_status,document_type,deleted_at,delivery_route_id,advance_amount,total,dispatch_vehicle,dispatch_vehicle_number,dispatch_driver_name,dispatch_driver_phone").eq("id", quoteId).maybeSingle(),
      (supabase as any).from("quotation_items").select("id,description,quantity,measurement,catalog_text,item_image_url,catalog_image_url,measurement_image_url,display_order,delivered_at,ordered_qty,cancelled_qty").eq("quotation_id", quoteId).order("display_order", { ascending: true }),
      supabase.from("receivables").select("pending_amount").eq("quotation_id", quoteId).eq("source", "quotation").maybeSingle(),
      supabase.from("warehouse_order_items").select("id,warehouse_ready,order_confirmed,delivered_at").eq("quotation_id",quoteId),
    ]);
    if (ledger.error) { toast({ title: "Could not verify collection balance", description: ledger.error.message, variant: "destructive" }); setLoading(false); navigate(-1); return; }
    setLedgerBalance(ledger.data ? Math.max(Number(ledger.data.pending_amount), 0) : null);
    if (e1 || !quote) { toast({ title: "Delivery note not found", variant: "destructive" }); navigate(-1); return; }
    if (e2 || readiness.error) { toast({ title: "Could not verify delivery items", description: e2?.message || readiness.error?.message, variant: "destructive" }); setQ(null);setLoading(false);return; }
    const readyIds=(lines??[]).filter((item: Item)=>handoffItemEligible(quote,item,(readiness.data??[]).find(r=>r.id===item.id))).map((item: Item)=>item.id);
    setEligibleIds(readyIds);setSelectedIds(readyIds);
    setQ(quote as Quote); setItems((lines ?? []) as Item[]);
    if (quote.delivery_route_id) {
      const { data: route } = await supabase.from("delivery_routes").select("name").eq("id", quote.delivery_route_id).maybeSingle();
      setRouteName(route?.name ?? null);
    } else setRouteName(null);
    setLoading(false);
  };

  if (authLoading || loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!q) return null;

  const selectedItems = items.filter(item=>selectedIds.includes(item.id));
  const totalQty = selectedItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const advance = Number(q.advance_amount ?? 0);
  const balance = ledgerBalance ?? Math.max(Number(q.total ?? 0) - advance, 0);
  const vehicle = q.dispatch_vehicle === "outside" ? `Outside${q.dispatch_vehicle_number ? ` · ${q.dispatch_vehicle_number}` : ""}` : (q.dispatch_vehicle_number || "Own vehicle");
  const pdfData = () => ({
    quotationNumber: q.quotation_id, customerName: q.party_name, phone: q.party_phone, address: q.party_address, place: q.party_place,
    deliveryPlace: q.delivery_place, expectedDeliveryDate: q.expected_delivery_date, routeName, vehicle, driverName: q.dispatch_driver_name,
    driverPhone: q.dispatch_driver_phone, advanceAmount: advance, balanceToCollect: balance, notes: q.notes, items: selectedItems,
  });
  const buildPdf = async () => {
    if (!selectedItems.length) { toast({ title: "Select at least one ready item", variant: "destructive" }); return null; }
    setPdfBusy(true);
    try { return await createDeliveryHandoffPdf(pdfData()); }
    catch (e: any) { toast({ title: "PDF creation failed", description: e?.message || "Please try again.", variant: "destructive" }); return null; }
    finally { setPdfBusy(false); }
  };
  const downloadPdf = async () => { const blob = await buildPdf(); if (blob) downloadBlob(blob, `Delivery_${q.quotation_id.replace(/[^a-z0-9-]/gi, "_")}.pdf`); };
  const sharePdf = async () => {
    const blob = await buildPdf(); if (!blob) return;
    const msg = `Delivery handoff · ${q.quotation_id}\n${q.party_name} · ${q.delivery_place || q.party_place}\n${selectedItems.length} item lines · Qty ${totalQty}\nOrder balance outstanding: ${formatINR(balance)}${routeName ? `\nRoute: ${routeName}` : ""}`;
    await shareFilesNative([blob], `Delivery_${q.quotation_id.replace(/[^a-z0-9-]/gi, "_")}`, msg, "pdf");
  };

  return <div className="min-h-screen bg-[#f8faf8] print:bg-white">
    <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-3 py-2 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /><span className="ml-1 hidden sm:inline">Back</span></Button>
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-mono font-semibold">{q.quotation_id}</p><p className="truncate text-[11px] text-muted-foreground">Delivery team handoff</p></div>
        {q.party_phone && <Button asChild size="icon" variant="outline"><a href={`tel:${q.party_phone}`}><Phone className="h-4 w-4" /></a></Button>}
        <Button size="sm" variant="outline" onClick={downloadPdf} disabled={pdfBusy || !selectedItems.length}>{pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}<span className="ml-1 hidden md:inline">PDF</span></Button>
        <Button size="sm" onClick={sharePdf} disabled={pdfBusy || !selectedItems.length}>{pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}<span className="ml-1 hidden sm:inline">Share PDF</span></Button>
        <Button disabled={!selectedItems.length} size="icon" variant="ghost" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
      </div>
    </div>

    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm print:hidden"><b>ഈ delivery-യിൽ അയക്കേണ്ട items തിരഞ്ഞെടുക്കുക.</b><p>PDF / Share PDF / Print include selected items only. Already delivered, unconfirmed, not-ready or partially cancelled/ordered rows cannot be selected. Split partial rows before dispatch. Balance is for the whole order, not just these items.</p></div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
        <div className="border-b border-slate-200 bg-[#f4f7f2] px-4 py-4 text-slate-900 print:bg-white">
          <div className="flex justify-between gap-3"><div><h1 className="font-display text-xl sm:text-2xl">{COMPANY.name}</h1><p className="text-xs text-slate-600">{COMPANY.address} · {COMPANY.phone}</p></div><div className="text-right"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Delivery Handoff</p><p className="font-mono text-sm font-bold">{q.quotation_id}</p></div></div>
        </div>

        <div className="grid gap-4 border-b border-slate-200 p-4 sm:grid-cols-2">
          <div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Deliver to</p><p className="mt-1 font-display text-lg">{q.party_name}</p>{q.party_address && <p className="mt-1 flex items-start gap-1 text-sm"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{q.party_address}</p>}<p className="mt-1 text-sm text-muted-foreground">{q.delivery_place || q.party_place}</p>{q.party_phone && <p className="mt-1 text-sm font-medium">{q.party_phone}</p>}</div>
          <div className="space-y-2 sm:text-right">
            <p className="inline-flex items-center gap-1.5 text-sm"><Calendar className="h-4 w-4 text-slate-500" />{q.expected_delivery_date ? new Date(q.expected_delivery_date).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "Delivery date not set"}</p>
            <p className="flex items-center gap-1.5 text-sm sm:justify-end"><Route className="h-4 w-4 text-slate-500" />{routeName || "Route not assigned"}</p>
            <p className="flex items-center gap-1.5 text-sm sm:justify-end"><Truck className="h-4 w-4 text-slate-500" />{vehicle}{q.dispatch_driver_name ? ` · ${q.dispatch_driver_name}` : ""}</p>
            {q.dispatch_driver_phone && <p className="text-xs text-muted-foreground">Driver {q.dispatch_driver_phone}</p>}
            <Badge variant="secondary" className="capitalize">{q.status}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-slate-200 bg-[#fbfcfa]">
          <div className="border-r border-slate-200 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Advance Received</p><p className="mt-1 font-display text-xl font-semibold text-slate-800">{formatINR(advance)}</p></div>
          <div className="bg-[#fbf6ea] p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#7a6542]">Order balance outstanding</p><p className="mt-1 flex items-center gap-1 font-display text-2xl font-bold text-[#5f5038]"><IndianRupee className="h-5 w-5" />{new Intl.NumberFormat("en-IN", { maximumFractionDigits:0 }).format(balance)}</p></div>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-base">Load checklist</h2><span className="text-xs text-muted-foreground">{selectedItems.length} selected lines · Total qty {totalQty}</span></div>
          {items.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No items on this order.</p> : <ol className="space-y-3">{items.map((it, idx) => {
            const img = firstUrl(it.item_image_url) || firstUrl(it.catalog_image_url) || firstUrl(it.measurement_image_url);
            return <li key={it.id} className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${!selectedIds.includes(it.id) ? "print:hidden" : ""}`}><div className="flex items-center gap-3 p-3"><Checkbox className="print:hidden" aria-label={`Include ${it.description}`} disabled={!eligibleIds.includes(it.id)} checked={selectedIds.includes(it.id)} onCheckedChange={checked=>setSelectedIds(ids=>checked?[...ids,it.id]:ids.filter(id=>id!==it.id))}/><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef4ea] text-xs font-bold text-[#53634b]">{idx+1}</span>{img && <button type="button" onClick={() => setZoomImage(img)} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 print:h-16 print:w-16"><img src={img} alt={it.description} loading="lazy" className="h-full w-full object-contain p-1" /></button>}<div className="min-w-0 flex-1"><p className="font-medium">{it.description}</p><p className="text-xs text-muted-foreground print:hidden">{it.delivered_at ? "Already delivered" : eligibleIds.includes(it.id) ? "Ready for delivery" : "Not ready / confirmation pending"}</p>{it.catalog_text && <p className="font-mono text-[11px] text-muted-foreground">{it.catalog_text}</p>}{it.measurement && <p className="mt-1 whitespace-pre-line rounded-md bg-slate-50 px-2 py-1 text-xs"><b>Size:</b> {it.measurement}</p>}</div><div className="shrink-0 text-right"><p className="text-[10px] uppercase text-muted-foreground">Qty</p><p className="font-display text-2xl font-semibold">{Number(it.quantity)||0}</p></div></div></li>;
          })}</ol>}
          {q.notes && <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</p><p className="mt-1 whitespace-pre-line">{q.notes}</p></div>}
        </div>

        <div className="border-t border-slate-200 px-4 py-8"><div className="grid gap-8 sm:grid-cols-2"><div><div className="h-12 border-b border-slate-300" /><p className="mt-1 text-[11px] text-muted-foreground">Delivered by / Driver</p></div><div><div className="h-12 border-b border-slate-300" /><p className="mt-1 text-[11px] text-muted-foreground">Customer signature & date</p></div></div></div>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground print:hidden">Delivery-team document: item selling prices and cost prices are intentionally omitted.</p>
    </div>

    {zoomImage && <button type="button" onClick={() => setZoomImage(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4 print:hidden"><img src={zoomImage} alt="" className="max-h-full max-w-full object-contain" /></button>}
    <style>{`@media print { @page { margin: 12mm; } html,body { background:#fff !important; } }`}</style>
  </div>;
};

export default DeliveryNote;
