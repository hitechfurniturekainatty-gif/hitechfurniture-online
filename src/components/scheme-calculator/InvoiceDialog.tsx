import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Receipt, Save, Trash2, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Stat } from "./Stat";
import { fmt, parseInvoiceText } from "./utils";
import type { Invoice, Row } from "./types";

export function InvoiceDialog({ open, invoice, onClose, onSave }: {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSave: (inv: Invoice) => void;
}) {
  const [label, setLabel] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [paste, setPaste] = useState("");

  useEffect(() => {
    if (!invoice) return;
    setLabel(invoice.label || "");
    setInvoiceNo(invoice.invoice_no || "");
    setDate(invoice.date || "");
    setRows(invoice.rows ? invoice.rows.map((r) => ({ ...r })) : []);
    setPaste("");
  }, [invoice, open]);

  if (!invoice) return null;

  const totalCost = rows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
  const totalMrpValue = rows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
  const avgDiscount = totalMrpValue > 0 ? ((totalMrpValue - totalCost) / totalMrpValue) * 100 : 0;

  const append = (extra: Row[], mode: "append" | "replace") => {
    if (!extra.length) { toast({ title: "No rows found in pasted text", variant: "destructive" }); return; }
    setRows(mode === "replace" ? extra : [...rows, ...extra]);
    setPaste("");
    toast({ title: `${mode === "replace" ? "Replaced with" : "Added"} ${extra.length} rows` });
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
        for (const sn of wb.SheetNames) {
          const ws = wb.Sheets[sn];
          parts.push(XLSX.utils.sheet_to_csv(ws, { FS: "\t", blankrows: false }));
        }
        txt = parts.join("\n");
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
          const ys = [...byY.keys()].sort((a, b) => b - a);
          for (const y of ys) {
            const row = byY.get(y)!.sort((a, b) => a.x - b.x);
            let line = "";
            let prevX = -Infinity;
            for (const c of row) {
              if (line && c.x - prevX > 15) line += "\t";
              else if (line) line += " ";
              line += c.s;
              prevX = c.x + c.s.length * 4;
            }
            lines.push(line);
          }
        }
        txt = lines.join("\n");
      } else {
        txt = await file.text();
      }
      setPaste(txt);
      toast({ title: `Loaded ${file.name}` });
    } catch (e: any) {
      toast({ title: "File read failed", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows(rows.map((r) => {
      if (r.id !== id) return r;
      const merged = { ...r, ...patch };
      if ((patch.qty !== undefined || patch.price !== undefined) && patch.amountWithTax === undefined) {
        merged.amountWithTax = (Number(merged.qty) || 0) * (Number(merged.price) || 0);
      }
      return merged;
    }));
  };
  const addBlankRow = () => setRows([...rows, { id: crypto.randomUUID(), item: "", qty: 1, price: 0, amountWithTax: 0, mrp: 0 }]);
  const removeRow = (id: string) => setRows(rows.filter((r) => r.id !== id));

  const commit = () => {
    onSave({ ...invoice, label: label.trim() || invoice.label, invoice_no: invoiceNo, date, rows });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl w-[calc(100vw-1rem)] sm:w-[95vw] max-h-[95vh] sm:max-h-[90vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> {invoice.rows.length ? "Edit invoice" : "Add invoice"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Invoice 1" />
          </div>
          <div>
            <Label className="text-xs">Invoice no.</Label>
            <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="e.g. INV/2025/001" />
          </div>
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-xs font-semibold">
              Bulk paste — strict 4-column format: <span className="font-mono">Item · Qty · Unit Price · Total Cost (incl. tax)</span>
            </Label>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent">
              <Upload className="h-3.5 w-3.5" /> Upload .xlsx / .pdf / .csv
              <input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls,.ods,.pdf,text/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <Textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)}
            placeholder={"Tabs / pipes / commas / spaces all OK. Examples:\nComfobond 75x60x6\t10\t1250\t12500\nComfobond 72x60x6,10,1180,11800"} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => parseLocal("append")} disabled={!paste.trim()}>
              <Plus className="h-3.5 w-3.5" /> Parse & append
            </Button>
            <Button size="sm" variant="outline" onClick={() => parseLocal("replace")} disabled={!paste.trim()}>
              Parse & replace
            </Button>
          </div>
        </div>

        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="min-w-[200px]">Item Name</TableHead>
                <TableHead className="w-20">Qty</TableHead>
                <TableHead className="w-28">Unit Price</TableHead>
                <TableHead className="w-32">Total Cost</TableHead>
                <TableHead className="w-28">MRP / Unit</TableHead>
                <TableHead className="w-24 text-right">Discount %</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground">No rows yet — paste above or add manually.</TableCell></TableRow>
              )}
              {rows.map((r) => {
                const mrpVal = (Number(r.mrp) || 0) * (Number(r.qty) || 0);
                const disc = mrpVal > 0 ? ((mrpVal - (Number(r.amountWithTax) || 0)) / mrpVal) * 100 : 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell><Input value={r.item} onChange={(e) => updateRow(r.id, { item: e.target.value })} className="h-8" /></TableCell>
                    <TableCell><Input type="number" min={0} value={r.qty} onChange={(e) => updateRow(r.id, { qty: Number(e.target.value) || 0 })} className="h-8" /></TableCell>
                    <TableCell><Input type="number" min={0} value={r.price} onChange={(e) => updateRow(r.id, { price: Number(e.target.value) || 0 })} className="h-8" /></TableCell>
                    <TableCell><Input type="number" min={0} value={r.amountWithTax} onChange={(e) => updateRow(r.id, { amountWithTax: Number(e.target.value) || 0 })} className="h-8" /></TableCell>
                    <TableCell>
                      <Input type="number" min={0} value={r.mrp || ""} placeholder="—"
                        onChange={(e) => updateRow(r.id, { mrp: Number(e.target.value) || 0 })} className="h-8" />
                    </TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${r.mrp > 0 ? (disc > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400") : "text-muted-foreground"}`}>
                      {r.mrp > 0 ? `${disc.toFixed(2)}%` : "—"}
                    </TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => removeRow(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-2 text-xs">
          <Button size="sm" variant="ghost" onClick={addBlankRow}><Plus className="h-3.5 w-3.5" /> Add row manually</Button>
          <div className="ml-auto flex flex-wrap items-center gap-4">
            <Stat label="Rows" value={String(rows.length)} />
            <Stat label="Total Cost" value={`₹${fmt(totalCost)}`} />
            <Stat label="Total MRP" value={`₹${fmt(totalMrpValue)}`} />
            <Stat label="Avg Discount" value={`${avgDiscount.toFixed(2)}%`} tone={avgDiscount > 0 ? "success" : undefined} />
          </div>
        </div>
        </div>

        <DialogFooter className="px-4 sm:px-6 py-3 border-t shrink-0 bg-background gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={commit}><Save className="h-4 w-4" /> Save invoice</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
