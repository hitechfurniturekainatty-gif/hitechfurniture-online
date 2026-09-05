import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Plus, Receipt, Save, Trash2, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Stat } from "./Stat";
import { fmt } from "./utils";
import { parseInvoiceText } from "./invoiceParser";
import type { Invoice, Row } from "./types";

type VendorItemMrp = { id: string; item_name: string; mrp: number };
const norm = (v: unknown) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");

export function InvoiceDialog({ open, invoice, partyId, onClose, onSave }: {
  open: boolean;
  invoice: Invoice | null;
  partyId: string;
  onClose: () => void;
  onSave: (inv: Invoice) => void;
}) {
  const [label, setLabel] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [paste, setPaste] = useState("");
  const [vendorItems, setVendorItems] = useState<VendorItemMrp[]>([]);

  useEffect(() => {
    if (!invoice) return;
    setLabel(invoice.label || "");
    setInvoiceNo(invoice.invoice_no || "");
    setDate(invoice.date || "");
    setRows(invoice.rows ? invoice.rows.map((r) => ({ ...r })) : []);
    setPaste("");
  }, [invoice, open]);

  useEffect(() => {
    if (!open || !partyId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("scheme_vendor_items")
        .select("id,item_name,mrp")
        .eq("party_id", partyId)
        .eq("is_active", true)
        .order("item_name");
      if (!cancelled && !error) setVendorItems((data || []).map((x: any) => ({ ...x, mrp: Number(x.mrp) || 0 })));
    })();
    return () => { cancelled = true; };
  }, [open, partyId]);

  const masterMap = useMemo(() => new Map(vendorItems.map((x) => [norm(x.item_name), x])), [vendorItems]);
  const totalCost = rows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
  const totalMrpValue = rows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
  const discountAmount = Math.max(0, totalMrpValue - totalCost);
  const discountPct = totalMrpValue > 0 ? (discountAmount / totalMrpValue) * 100 : 0;
  const invalidRows = rows.filter((r) => !String(r.item || "").trim() || Number(r.qty) <= 0 || Number(r.amountWithTax) < 0 || Number(r.mrp) < 0);

  if (!invoice) return null;

  const withMasterMrp = (r: Row): Row => {
    const saved = masterMap.get(norm(r.item));
    return { ...r, mrp: Number(r.mrp) > 0 ? Number(r.mrp) : (saved?.mrp || 0) };
  };

  const append = (extra: Row[], mode: "append" | "replace") => {
    if (!extra.length) {
      toast({ title: "No valid item rows found", description: "Need item name, quantity and rate/total. Headers, GST totals and summary rows are ignored automatically.", variant: "destructive" });
      return;
    }
    const clean = extra.map(withMasterMrp);
    setRows(mode === "replace" ? clean : [...rows, ...clean]);
    setPaste("");
    toast({ title: `${mode === "replace" ? "Replaced with" : "Added"} ${clean.length} item rows`, description: "Saved vendor MRP is filled automatically for exact item-name matches." });
  };

  const parseLocal = (mode: "append" | "replace") => append(parseInvoiceText(paste), mode);

  const onFile = async (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    try {
      let txt = "";
      if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".ods")) {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const parts: string[] = [];
        for (const sn of wb.SheetNames) parts.push(XLSX.utils.sheet_to_csv(wb.Sheets[sn], { FS: "\t", blankrows: false }));
        txt = parts.join("\n");
      } else if (name.endsWith(".pdf")) {
        const pdfjs: any = await import("pdfjs-dist");
        try { pdfjs.GlobalWorkerOptions.workerSrc = ""; } catch {}
        const buf = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf, disableWorker: true }).promise;
        const lines: string[] = [];
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p); const content = await page.getTextContent(); const byY = new Map<number, { x: number; s: string }[]>();
          for (const it of content.items as any[]) { const y = Math.round((it.transform?.[5] ?? 0) * 2) / 2; const x = it.transform?.[4] ?? 0; const s = String(it.str ?? "").trim(); if (!s) continue; if (!byY.has(y)) byY.set(y, []); byY.get(y)!.push({ x, s }); }
          for (const y of [...byY.keys()].sort((a, b) => b - a)) { const row = byY.get(y)!.sort((a, b) => a.x - b.x); let line = "", prevX = -Infinity; for (const c of row) { if (line && c.x - prevX > 15) line += "\t"; else if (line) line += " "; line += c.s; prevX = c.x + c.s.length * 4; } lines.push(line); }
        }
        txt = lines.join("\n");
      } else txt = await file.text();
      setPaste(txt); toast({ title: `Loaded ${file.name}`, description: "Tap Read invoice rows after checking the text." });
    } catch (e: any) { toast({ title: "File read failed", description: e?.message || String(e), variant: "destructive" }); }
  };

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows(rows.map((r) => {
      if (r.id !== id) return r;
      const merged = { ...r, ...patch };
      if (patch.item !== undefined) {
        const saved = masterMap.get(norm(patch.item));
        if (saved && Number(r.mrp) <= 0) merged.mrp = saved.mrp;
      }
      if ((patch.qty !== undefined || patch.price !== undefined) && patch.amountWithTax === undefined) merged.amountWithTax = (Number(merged.qty) || 0) * (Number(merged.price) || 0);
      return merged;
    }));
  };

  const addBlankRow = () => setRows([...rows, { id: crypto.randomUUID(), item: "", qty: 1, price: 0, amountWithTax: 0, mrp: 0 }]);
  const removeRow = (id: string) => setRows(rows.filter((r) => r.id !== id));

  const saveVendorMrpMaster = async () => {
    const payload = rows.filter((r) => String(r.item || "").trim() && Number(r.mrp) > 0).map((r) => ({ party_id: partyId, item_name: String(r.item).trim(), mrp: Number(r.mrp), is_active: true }));
    if (!payload.length) return;
    const unique = Array.from(new Map(payload.map((x) => [norm(x.item_name), x])).values());
    const { error } = await (supabase as any).from("scheme_vendor_items").upsert(unique, { onConflict: "party_id,item_key" });
    if (error) throw error;
  };

  const commit = async () => {
    if (!rows.length) return toast({ title: "Add at least one item", variant: "destructive" });
    if (invalidRows.length) return toast({ title: "Check invoice items", description: `${invalidRows.length} row${invalidRows.length === 1 ? "" : "s"} need valid item, quantity and amounts.`, variant: "destructive" });
    try {
      await saveVendorMrpMaster();
      onSave({ ...invoice, label: label.trim() || invoice.label, invoice_no: invoiceNo.trim(), date, rows });
      toast({ title: "Invoice saved", description: "Entered MRP values are also saved under this vendor for future exact item matches." });
    } catch (e: any) { toast({ title: "MRP master save failed", description: e?.message || String(e), variant: "destructive" }); }
  };

  return <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
    <DialogContent className="max-w-6xl w-[calc(100vw-1rem)] sm:w-[96vw] max-h-[95vh] sm:max-h-[90vh] p-0 gap-0 flex flex-col">
      <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 shrink-0 border-b"><DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> {invoice.rows.length ? "Edit invoice" : "Add invoice"}</DialogTitle></DialogHeader>
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3"><div><Label className="text-xs">Invoice label</Label><Input value={label} onChange={(e)=>setLabel(e.target.value)} placeholder="Invoice 1"/></div><div><Label className="text-xs">Invoice no.</Label><Input value={invoiceNo} onChange={(e)=>setInvoiceNo(e.target.value)} placeholder="Optional"/></div><div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e)=>setDate(e.target.value)}/></div></div>
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><div><Label className="text-xs font-semibold">Paste or upload invoice</Label><p className="mt-0.5 text-[11px] text-muted-foreground">All invoice items stay here. MRP is vendor-wise: once saved, the same exact item gets that MRP automatically next time.</p></div><label className="inline-flex cursor-pointer items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"><Upload className="h-3.5 w-3.5"/> Upload invoice<input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls,.ods,.pdf,text/*" className="hidden" onChange={(e)=>onFile(e.target.files?.[0]??null)}/></label></div><Textarea rows={4} value={paste} onChange={(e)=>setPaste(e.target.value)} placeholder={"Paste invoice rows here. Example:\nComfobond 75x60\t10\t1250\t12500"}/><div className="flex flex-wrap gap-2"><Button size="sm" onClick={()=>parseLocal("append")} disabled={!paste.trim()}><Plus className="h-3.5 w-3.5"/> Read & add items</Button>{rows.length>0&&<Button size="sm" variant="outline" onClick={()=>parseLocal("replace")} disabled={!paste.trim()}>Replace current items</Button>}</div></div>
        <datalist id="scheme-vendor-items">{vendorItems.map(x=><option key={x.id} value={x.item_name}>{`MRP ₹${fmt(x.mrp)}`}</option>)}</datalist>
        <div className="overflow-auto rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/30"><TableHead className="min-w-[210px]">Item</TableHead><TableHead className="w-20">Qty</TableHead><TableHead className="w-28">MRP / Unit</TableHead><TableHead className="w-28">Purchase / Unit</TableHead><TableHead className="w-32">Total incl. Tax</TableHead><TableHead className="w-28">MRP Value</TableHead><TableHead className="w-24">Discount</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader><TableBody>
          {rows.length===0&&<TableRow><TableCell colSpan={8} className="text-center text-xs text-muted-foreground">No items yet. Paste/upload the invoice or add one manually.</TableCell></TableRow>}
          {rows.map(r=>{const mrpValue=(Number(r.mrp)||0)*(Number(r.qty)||0);const cost=Number(r.amountWithTax)||0;const disc=mrpValue>0?Math.max(0,(mrpValue-cost)/mrpValue*100):0;const invalid=!String(r.item||"").trim()||Number(r.qty)<=0;return <TableRow key={r.id} className={invalid?"bg-destructive/5":undefined}><TableCell><Input list="scheme-vendor-items" value={r.item} onChange={(e)=>updateRow(r.id,{item:e.target.value})} className="h-8" placeholder="Item name"/></TableCell><TableCell><Input type="number" min={0} value={r.qty} onChange={(e)=>updateRow(r.id,{qty:Number(e.target.value)||0})} className="h-8"/></TableCell><TableCell><Input type="number" min={0} value={r.mrp} onChange={(e)=>updateRow(r.id,{mrp:Number(e.target.value)||0})} className="h-8" placeholder="MRP"/></TableCell><TableCell><Input type="number" min={0} value={r.price} onChange={(e)=>updateRow(r.id,{price:Number(e.target.value)||0})} className="h-8"/></TableCell><TableCell><Input type="number" min={0} value={r.amountWithTax} onChange={(e)=>updateRow(r.id,{amountWithTax:Number(e.target.value)||0})} className="h-8"/></TableCell><TableCell className="text-right text-xs font-medium">₹{fmt(mrpValue)}</TableCell><TableCell className="text-right text-xs font-semibold">{mrpValue>0?`${fmt(disc)}%`:"—"}</TableCell><TableCell><Button size="icon" variant="ghost" onClick={()=>removeRow(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button></TableCell></TableRow>})}
        </TableBody></Table></div>
        <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 text-xs sm:grid-cols-2 lg:grid-cols-5"><div><Button size="sm" variant="ghost" onClick={addBlankRow}><Plus className="h-3.5 w-3.5"/> Add item manually</Button>{invalidRows.length>0&&<div className="mt-1 flex items-center gap-1 text-destructive"><AlertTriangle className="h-3.5 w-3.5"/> {invalidRows.length} row needs checking</div>}</div><Stat label="Items" value={String(rows.length)}/><Stat label="Total MRP" value={`₹${fmt(totalMrpValue)}`}/><Stat label="Invoice Cost incl. Tax" value={`₹${fmt(totalCost)}`}/><Stat label="Vendor Discount" value={totalMrpValue>0?`${fmt(discountPct)}% · ₹${fmt(discountAmount)}`:"Add MRP"}/></div>
      </div>
      <DialogFooter className="px-4 sm:px-6 py-3 border-t shrink-0 bg-background gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={commit}><Save className="h-4 w-4"/> Save invoice</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
