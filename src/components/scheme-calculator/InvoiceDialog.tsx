import { SchemeTargetSelect } from "./SchemeTargetSelect";
import { receiptBenefit } from "./settlements";
import { SchemePeriodPicker } from "./SchemePeriodPicker";
import { monthRef, refId, refEndMonth, targetCatalog } from "./schemeAttribution";
import type { PeriodBenefitRecord } from "./periodBenefits";
import { invoiceRows } from "./periodBenefits";
import { monthKey, rewardRulesForMonth } from "./invoiceRewards";
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
import { parseInvoiceText, parseInvoiceFooterDiscount } from "./invoiceParser";
import type { BenefitReceipt, Invoice, Row, VendorMonth } from "./types";

type VendorItemMrp = { id: string; item_name: string; mrp: number };
const norm = (v: unknown) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");

export function InvoiceDialog({ open, invoice, partyId, onClose, onSave, schemeMonths = [], schemePeriods = [] }: {
  schemePeriods?: PeriodBenefitRecord[];
  schemeMonths?: VendorMonth[];
  open: boolean;
  invoice: Invoice | null;
  partyId: string;
  onClose: () => void;
  onSave: (inv: Invoice) => void | Promise<void>;
}) {
  const [credits,setCredits]=useState<BenefitReceipt[]>([]);
  const [footerDiscount, setFooterDiscount] = useState(0);
  const [label, setLabel] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [paste, setPaste] = useState("");
  const [vendorItems, setVendorItems] = useState<VendorItemMrp[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!invoice) return;
    setFooterDiscount(Number(invoice.discount_amount)||0);
    setCredits(invoice.benefit_receipts||[]);
    setLabel(invoice.label || "");
    setInvoiceNo(invoice.invoice_no || "");
    setDate(invoice.date || "");
    setRows((invoice.rows || []).map((r) => ({ ...r, mrp: Number(r.mrp) || 0 })));
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
      if (!cancelled && !error) setVendorItems((data || []).map((x: any) => ({ id: x.id, item_name: x.item_name, mrp: Number(x.mrp) || 0 })));
    })();
    return () => { cancelled = true; };
  }, [open, partyId]);

  const masterMap = useMemo(() => new Map(vendorItems.map((x) => [norm(x.item_name), x])), [vendorItems]);
  const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const grossCost = rows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
  const totalCost = grossCost-footerDiscount;
  const valuedRows = invoiceRows([{id:invoice?.id||'preview',label:'Preview',rows,discount_amount:footerDiscount}]);
  const totalMrpValue = valuedRows.filter(r=>!r.reward).reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
  const rewardValue=valuedRows.filter(r=>r.reward).reduce((s,r)=>s+r.mrp*r.qty,0);
  const creditBenefit=credits.reduce((s,r)=>s+receiptBenefit(r).net,0);
  const discountAmount = totalMrpValue + rewardValue - totalCost + creditBenefit;
  const discountPct = totalMrpValue > 0 ? (discountAmount / totalMrpValue) * 100 : 0;
  const invalidRows = rows.filter((r) => !String(r.item || "").trim() || Number(r.qty) <= 0 || Number(r.amountWithTax) < 0 || Number(r.mrp) < 0);

  if (!invoice) return null;

  const withMasterMrp = (r: Row): Row => {
    const saved = masterMap.get(norm(r.item));
    return { ...r, mrp: Number(r.mrp) > 0 ? Number(r.mrp) : (saved?.mrp || 0) };
  };

  const append = (extra: Row[], mode: "append" | "replace") => {
    if (!extra.length) {
      toast({ title: "No valid item rows found", description: "Need item name, quantity and rate/total.", variant: "destructive" });
      return;
    }
    const clean = extra.map(withMasterMrp);
    setRows(mode === "replace" ? clean : [...rows, ...clean]);
    setPaste("");
    toast({ title: `${mode === "replace" ? "Replaced with" : "Added"} ${clean.length} item rows`, description: "Now enter or edit MRP directly in each item row." });
  };

  const parseLocal = (mode: "append" | "replace") => {
    const parsed = parseInvoiceText(paste);
    const discount = parseInvoiceFooterDiscount(paste);
    if(parsed.length && discount !== null) setFooterDiscount(mode === "append" ? footerDiscount+discount : discount);
    append(parsed, mode);
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    try {
      let txt = "";
      if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".ods")) {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        txt = wb.SheetNames.map((sn) => XLSX.utils.sheet_to_csv(wb.Sheets[sn], { FS: "\t", blankrows: false })).join("\n");
      } else if (name.endsWith(".pdf")) {
        const pdfjs: any = await import("pdfjs-dist");
        try { pdfjs.GlobalWorkerOptions.workerSrc = ""; } catch {}
        const buf = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf, disableWorker: true }).promise;
        const lines: string[] = [];
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          const content = await page.getTextContent();
          const byY = new Map<number, { x: number; s: string }[]>();
          for (const it of content.items as any[]) {
            const y = Math.round((it.transform?.[5] ?? 0) * 2) / 2;
            const x = it.transform?.[4] ?? 0;
            const s = String(it.str ?? "").trim();
            if (!s) continue;
            if (!byY.has(y)) byY.set(y, []);
            byY.get(y)!.push({ x, s });
          }
          for (const y of [...byY.keys()].sort((a, b) => b - a)) {
            lines.push(byY.get(y)!.sort((a, b) => a.x - b.x).map((c) => c.s).join("\t"));
          }
        }
        txt = lines.join("\n");
      } else txt = await file.text();
      setPaste(txt);
      toast({ title: `Loaded ${file.name}`, description: "Tap Read & add items, then enter MRP item by item." });
    } catch (e: any) {
      toast({ title: "File read failed", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((current) => current.map((r) => {
      if (r.id !== id) return r;
      const merged = { ...r, ...patch };
      if (patch.item !== undefined) {
        const saved = masterMap.get(norm(patch.item));
        if (saved && Number(r.mrp) <= 0) merged.mrp = saved.mrp;
      }
      if ((patch.qty !== undefined || patch.price !== undefined) && patch.amountWithTax === undefined) {
        merged.amountWithTax = (Number(merged.qty) || 0) * (Number(merged.price) || 0);
      }
      if(patch.amountWithTax!==undefined&&merged.qty>0)merged.price=merged.amountWithTax/merged.qty;
      return merged;
    }));
  };

  const addBlankRow = () => setRows((current) => [...current, { id: crypto.randomUUID(), item: "", qty: 1, price: 0, amountWithTax: 0, mrp: 0 }]);
  const removeRow = (id: string) => setRows((current) => current.filter((r) => r.id !== id));

  const saveVendorMrpMaster = async () => {
    if (!partyId || invoice.document_kind === "purchase_return") return;
    const payload = rows
      .filter((r) => String(r.item || "").trim() && Number(r.mrp) > 0)
      .map((r) => ({
        party_id: partyId,
        item_name: String(r.item).trim(),
        item_key: norm(r.item),
        mrp: Number(r.mrp),
        is_active: true,
      }));
    if (!payload.length) return;
    const unique = Array.from(new Map(payload.map((x) => [x.item_key, x])).values());
    const { error } = await (supabase as any).from("scheme_vendor_items").upsert(unique, { onConflict: "party_id,item_key" });
    if (error) throw error;
  };

  const commit = async () => {
    if (!rows.length) return toast({ title: "Add at least one item", variant: "destructive" });
    if (invalidRows.length) return toast({ title: "Check invoice items", description: `${invalidRows.length} row${invalidRows.length === 1 ? "" : "s"} need valid item, quantity and amount.`, variant: "destructive" });
    if (!Number.isFinite(footerDiscount) || footerDiscount<0 || footerDiscount>grossCost) return toast({title:"Discount must be between zero and the invoice item total",variant:"destructive"});
    if (rows.some(r=>r.reward&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.reward.scheme_month))) return toast({title:"Choose the scheme month for each reward item",variant:"destructive"});
    if(credits.some(c=>Number(c.replaces_free_qty)>0&&(!c.scheme_rule_key||!Number.isInteger(Number(c.replaces_free_qty)))))return toast({title:"Choose the scheme and enter a whole free quantity for replacement credits",variant:"destructive"});
    if(credits.some(c=>!(Number(c.amount)>0)))return toast({title:"Enter the credit note amount or remove the empty entry",variant:"destructive"});
    if (saving) return;
    setSaving(true);
    const savedInvoice = { ...invoice, label: label.trim() || invoice.label, invoice_no: invoiceNo.trim(), date, rows, discount_amount:footerDiscount, benefit_receipts:credits };
    try { await onSave(savedInvoice); } catch (e: any) { setSaving(false); toast({title:"Could not save document",description:e?.message,variant:"destructive"}); return; }
    try {
      await saveVendorMrpMaster();
      toast({ title: "Invoice saved", description: "MRP values are saved and will auto-fill for the same vendor item next time." });
    } catch (e: any) {
      toast({ title: "Invoice saved; vendor MRP master needs retry", description: e?.message || String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[95vh] w-[calc(100vw-0.75rem)] max-w-7xl flex-col gap-0 p-0 sm:w-[97vw]">
        <DialogHeader className="shrink-0 border-b px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
          <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> {invoice.document_kind === "purchase_return" ? "Debit note · Purchase return / സാധനം തിരികെ നൽകിയത്" : invoice.rows.length ? "Edit invoice" : "Add invoice"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label className="text-xs">Invoice label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Invoice 1" /></div>
            <div><Label className="text-xs">Invoice no.</Label><Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Optional" /></div>
            <div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>

          <div className="space-y-2 rounded-xl border bg-muted/15 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><Label className="text-xs font-semibold">Paste or upload invoice</Label><p className="mt-0.5 text-[11px] text-muted-foreground">After items are loaded, click the MRP field on each row and enter the MRP. Saved vendor MRP will auto-fill only for exact item matches.</p></div>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border bg-background px-3 py-2 text-xs hover:bg-muted"><Upload className="h-3.5 w-3.5" /> Upload invoice<input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls,.ods,.pdf,text/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
            </div>
            <Textarea rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Paste invoice rows here. Example:\nComfobond 75x60\t10\t1250\t12500"} />
            <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => parseLocal("append")} disabled={!paste.trim()}><Plus className="h-3.5 w-3.5" /> Read & add items</Button>{rows.length > 0 && <Button size="sm" variant="outline" onClick={() => parseLocal("replace")} disabled={!paste.trim()}>Replace current items</Button>}</div>
          </div>

          <datalist id="scheme-vendor-items">{vendorItems.map((x) => <option key={x.id} value={x.item_name}>{`MRP ₹${fmt(x.mrp)}`}</option>)}</datalist>

          <div className="rounded-xl border bg-background">
            <div className="border-b px-3 py-2 text-xs font-medium text-foreground">Invoice Items <span className="ml-1 font-normal text-muted-foreground">— MRP is directly editable for every item</span></div>
            <div className="overflow-x-auto">
              <Table className="min-w-[720px] table-fixed">
                <TableHeader><TableRow className="bg-muted/25">
                  <TableHead className="w-[280px]">Item</TableHead>
                  <TableHead className="w-[130px]">Type</TableHead><TableHead className="w-[90px] text-right">Qty</TableHead>
                  <TableHead className="w-[140px] text-right">MRP / Unit</TableHead>
                  <TableHead className="w-[160px] text-right">Amount incl. Tax</TableHead>
                  <TableHead className="w-[110px] text-right">Discount</TableHead>
                  <TableHead className="w-[55px]"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">No items yet. Paste/upload the invoice or add one manually.</TableCell></TableRow>}
                  {rows.map((r) => {
                    const mrpValue = (Number(r.mrp) || 0) * (Number(r.qty) || 0);
                    const cost = Number(r.amountWithTax) || 0;
                    const disc = mrpValue > 0 ? ((mrpValue - cost) / mrpValue) * 100 : 0;
                    const invalid = !String(r.item || "").trim() || Number(r.qty) <= 0;
                    return <TableRow key={r.id} className={invalid ? "bg-destructive/5" : r.reward ? "bg-amber-50/40" : undefined}>
                      <TableCell className="space-y-2"><Input list="scheme-vendor-items" value={r.item} onChange={(e) => updateRow(r.id, { item: e.target.value })} className="h-9" placeholder="Item name" />

                      {r.reward&&<SchemeTargetSelect goodsOnly source={r.reward.scheme_period||monthRef(r.reward.scheme_month||date)} ruleKey={r.reward.scheme_rule_key} months={schemeMonths} periods={schemePeriods} onChange={(scheme_period,scheme_rule_key,scheme_label)=>updateRow(r.id,{reward:{scheme_period,scheme_month:refEndMonth(scheme_period),scheme_rule_key,scheme_label}})}/>}
                      </TableCell>
                      <TableCell>{invoice.document_kind==="purchase_return"?<span className="text-xs">Purchase return</span>:<select aria-label={"Item type for "+r.item} className={"h-9 w-full rounded-md border px-2 text-xs "+(r.reward?"border-amber-300 bg-amber-50 text-amber-900":"bg-background")} value={r.reward?"free":"purchase"} onChange={e=>updateRow(r.id,{reward:e.target.value==="free"?{scheme_month:date.slice(0,7)}:undefined})}><option value="purchase">Purchase</option><option value="free">Free / scheme</option></select>}</TableCell>
                      <TableCell><Input type="number" min={0} value={r.qty} onChange={(e) => updateRow(r.id, { qty: Number(e.target.value) || 0 })} className="h-9 text-right" /></TableCell>
                      <TableCell><Input type="number" min={0} inputMode="decimal" value={r.mrp || ""} onChange={(e) => updateRow(r.id, { mrp: e.target.value === "" ? 0 : Number(e.target.value) })} className="h-9 border-primary/30 bg-primary/[0.03] text-right font-semibold" placeholder="Enter MRP" /></TableCell>
                      <TableCell><Input type="number" min={0} value={r.amountWithTax} onChange={(e) => updateRow(r.id, { amountWithTax: Number(e.target.value) || 0 })} className="h-9 text-right" /></TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{mrpValue > 0 ? `${fmt(disc)}%` : "—"}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => removeRow(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="rounded-xl border p-3 space-y-2">
            <Label>Invoice footer discount / ബില്ലിന്റെ അടിയിലെ മൊത്തം discount ₹</Label>
            <Input aria-label="Invoice footer discount" type="number" min={0} max={grossCost} value={footerDiscount||""} onChange={e=>setFooterDiscount(Number(e.target.value))} placeholder="0"/>
            <p className="text-xs text-muted-foreground">Item amounts-ൽ ഇതിനകം കുറച്ച discount വീണ്ടും ചേർക്കരുത്. Reward items-ന്റെ offset ഉൾപ്പെടെ footer-ലെ discount ഒരിക്കൽ മാത്രം നൽകുക; Additional benefits-ൽ വീണ്ടും ചേർക്കേണ്ടതില്ല. Free item MRP നൽകിയില്ലെങ്കിൽ അതിന്റെ ബിൽ value ആണ് valuation.</p>
            <p className="text-xs text-muted-foreground">ഈ invoice-ൽ ലഭിച്ച benefit ഇവിടെ കാണാം; പഴയ schemes-ന്റെ benefit ബന്ധപ്പെട്ട period report-ലേക്ക് പോകും.</p><p className="font-semibold text-sm">Items ₹{fmt(grossCost)} − Discount ₹{fmt(footerDiscount)} = Payable ₹{fmt(totalCost)}</p>
          </div>
          {invoice.document_kind!=="purchase_return"&&<div className="space-y-3">
            {credits.map(c=><div key={c.id} className="rounded-xl border bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between"><b className="text-sm">Credit note / തുക കുറച്ചുതന്നത്</b><Button size="icon" variant="ghost" aria-label="Remove invoice credit" onClick={()=>setCredits(cs=>cs.filter(x=>x.id!==c.id))}><Trash2 className="h-4 w-4"/></Button></div>
              <div className="grid gap-2 sm:grid-cols-3"><Input aria-label="Invoice credit amount" type="number" min={0} placeholder="Amount ₹" value={c.amount||""} onChange={e=>setCredits(cs=>cs.map(x=>x.id===c.id?{...x,amount:Number(e.target.value)}:x))}/><Input aria-label="Invoice credit reference" placeholder="Credit note reference" value={c.reference||""} onChange={e=>setCredits(cs=>cs.map(x=>x.id===c.id?{...x,reference:e.target.value}:x))}/><Input aria-label="Invoice credit date" type="date" value={c.date||date} onChange={e=>setCredits(cs=>cs.map(x=>x.id===c.id?{...x,date:e.target.value}:x))}/></div>
              <SchemeTargetSelect source={c.scheme_period||monthRef(date)} ruleKey={c.scheme_rule_key} months={schemeMonths} periods={schemePeriods} onChange={(scheme_period,scheme_rule_key,scheme_label)=>setCredits(cs=>cs.map(x=>x.id===c.id?{...x,scheme_period,scheme_rule_key,scheme_label}:x))}/>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!c.included_in_invoice} onChange={e=>setCredits(cs=>cs.map(x=>x.id===c.id?{...x,included_in_invoice:e.target.checked}:x))}/>മുകളിലെ invoice discount-ൽ ഈ തുക ഉൾപ്പെട്ടിട്ടുണ്ട്</label>
              <details><summary className="cursor-pointer text-xs">Free items-ന് പകരമാണോ?</summary><Input aria-label="Invoice credit replaces quantity" type="number" min={0} placeholder="Free quantity settled" value={c.replaces_free_qty||""} onChange={e=>setCredits(cs=>cs.map(x=>x.id===c.id?{...x,replaces_free_qty:Number(e.target.value)}:x))}/></details>
            </div>)}
            <Button variant="outline" size="sm" onClick={()=>setCredits(cs=>[...cs,{id:crypto.randomUUID(),kind:"credit_note",date,scheme_period:monthRef(date),amount:0}])}><Plus className="h-4 w-4"/>Add credit note with this invoice</Button>
          </div>}
          <div className="grid gap-2 rounded-xl border bg-muted/15 p-3 sm:grid-cols-3 lg:grid-cols-5">
            <div><Button size="sm" variant="outline" onClick={addBlankRow}><Plus className="h-3.5 w-3.5" /> Add item</Button>{invalidRows.length > 0 && <div className="mt-2 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> {invalidRows.length} row needs checking</div>}</div>

            <Stat label="Total purchase MRP" value={`₹${fmt(totalMrpValue)}`} />
            <Stat label="Invoice payable" value={`₹${fmt(totalCost)}`} />
            <Stat label="Benefit received ₹" value={`₹${fmt(discountAmount)}`} /><Stat label="Benefit / purchase MRP" value={totalMrpValue>0?discountPct.toFixed(2)+"%":"—"}/>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t bg-background px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={commit} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save invoice"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
