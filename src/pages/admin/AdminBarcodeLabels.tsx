import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Printer, Plus, Trash2, Settings2, RotateCcw } from "lucide-react";

/* Label format copied from old Busy setup:
   40×25 mm label, 2 per row, continuous roll, left margin 6 mm.
   Item name top (8), barcode CODE-128 with code under it (7), "MRP:" bottom (14, 2 decimals). */

type Prod = { id: string; product_name: string; product_code: string; mrp: number | null };
type Line = { key: string; name: string; code: string; mrp: number; qty: number };
type Cfg = {
  labelW: number; labelH: number; cols: number; left: number; gap: number; top: number;
  nameSize: number; codeSize: number; mrpSize: number; barH: number;
};
const DEFAULT: Cfg = { labelW: 40, labelH: 25, cols: 2, left: 6, gap: 2, top: 1.5, nameSize: 8, codeSize: 7, mrpSize: 14, barH: 9 };
const CFG_KEY = "hitech_barcode_cfg_v1";

const loadCfg = (): Cfg => {
  try { const s = localStorage.getItem(CFG_KEY); if (s) return { ...DEFAULT, ...JSON.parse(s) }; } catch { /* ignore */ }
  return DEFAULT;
};

const barcodePng = (code: string) => {
  const c = document.createElement("canvas");
  JsBarcode(c, code, { format: "CODE128", displayValue: false, margin: 0, width: 3, height: 90 });
  return c.toDataURL("image/png");
};

// Shrink font until text fits width; if still too long, wrap to 2 lines (long names must print).
const fitText = (doc: jsPDF, text: string, maxW: number, size: number) => {
  let s = size;
  doc.setFontSize(s);
  while (doc.getTextWidth(text) > maxW && s > 5.5) { s -= 0.5; doc.setFontSize(s); }
  if (doc.getTextWidth(text) <= maxW) return { size: s, lines: [text] };
  return { size: s, lines: (doc.splitTextToSize(text, maxW) as string[]).slice(0, 2) };
};

export const buildLabelsPdf = (lines: Line[], cfg: Cfg) => {
  const pageW = cfg.left + cfg.cols * cfg.labelW + (cfg.cols - 1) * cfg.gap;
  const doc = new jsPDF({ unit: "mm", format: [pageW, cfg.labelH], orientation: pageW > cfg.labelH ? "landscape" : "portrait" });
  const items: Line[] = [];
  lines.forEach((l) => { for (let i = 0; i < l.qty; i++) items.push(l); });
  const cache: Record<string, string> = {};
  items.forEach((it, idx) => {
    const col = idx % cfg.cols;
    if (idx > 0 && col === 0) doc.addPage([pageW, cfg.labelH], pageW > cfg.labelH ? "landscape" : "portrait");
    const x0 = cfg.left + col * (cfg.labelW + cfg.gap);
    const cx = x0 + cfg.labelW / 2;
    const inner = cfg.labelW - 2;
    let y = cfg.top;
    // Item name
    doc.setFont("helvetica", "bold");
    const nm = fitText(doc, it.name, inner, cfg.nameSize);
    const lh = nm.size * 0.3528 * 1.05;
    nm.lines.forEach((t) => { y += lh; doc.text(t, cx, y, { align: "center" }); });
    y += 0.8;
    // Barcode
    const bw = Math.min(inner, 34);
    const bh = nm.lines.length > 1 ? cfg.barH - 1.5 : cfg.barH;
    cache[it.code] ||= barcodePng(it.code);
    doc.addImage(cache[it.code], "PNG", cx - bw / 2, y, bw, bh);
    y += bh;
    // Code
    doc.setFont("helvetica", "normal");
    doc.setFontSize(cfg.codeSize);
    y += cfg.codeSize * 0.3528;
    doc.text(it.code, cx, y, { align: "center" });
    // MRP at bottom
    doc.setFont("helvetica", "bold");
    doc.setFontSize(cfg.mrpSize);
    doc.text(`MRP: ${it.mrp.toFixed(2)}`, cx, cfg.labelH - 1.2, { align: "center" });
  });
  return doc;
};

const AdminBarcodeLabels = () => {
  const [products, setProducts] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [cfg, setCfg] = useState<Cfg>(loadCfg);
  const [showCfg, setShowCfg] = useState(false);
  const [manual, setManual] = useState({ name: "", code: "", mrp: "" });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("products").select("id, product_name, product_code, mrp").is("deleted_at", null).order("product_name");
      setProducts(((data ?? []) as Prod[]).filter((p) => p.product_code));
      setLoading(false);
    })();
  }, []);

  useEffect(() => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* ignore */ } }, [cfg]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.product_name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q)).slice(0, 15);
  }, [search, products]);

  const add = (name: string, code: string, mrp: number) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.code === code);
      if (i >= 0) { const n = [...prev]; n[i] = { ...n[i], qty: n[i].qty + 1 }; return n; }
      return [...prev, { key: crypto.randomUUID(), name, code, mrp, qty: 1 }];
    });
    setSearch("");
  };
  const upd = (key: string, patch: Partial<Line>) => setLines((p) => p.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + (l.qty || 0), 0);

  const print = () => {
    const doc = buildLabelsPdf(lines.filter((l) => l.qty > 0), cfg);
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  };
  const download = () => buildLabelsPdf(lines.filter((l) => l.qty > 0), cfg).save(`labels-${new Date().toISOString().slice(0, 10)}.pdf`);
  const testPrint = () => {
    const doc = buildLabelsPdf([{ key: "t", name: "Test Item Name Long Example", code: "KAI14D", mrp: 12500, qty: 2 }], cfg);
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  };

  const num = (k: keyof Cfg, label: string) => (
    <label className="text-xs space-y-1">
      <span className="text-muted-foreground">{label}</span>
      <Input type="number" step="0.5" value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) || 0 })} />
    </label>
  );

  return (
    <AdminShell>
      <div className="p-4 md:p-6 space-y-4 max-w-4xl">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Barcode Labels</h1>
            <p className="text-sm text-muted-foreground">40×25 mm · 2 per row · TVS LP 46 NEO</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCfg((v) => !v)}><Settings2 className="h-4 w-4 mr-1" />Label setup</Button>
            <Button variant="outline" size="sm" onClick={testPrint}>Test print</Button>
          </div>
        </div>

        {showCfg && (
          <Card><CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {num("labelW", "Label width mm")}{num("labelH", "Label height mm")}{num("cols", "Labels per row")}
              {num("left", "Left margin mm")}{num("gap", "Gap between mm")}{num("top", "Top margin mm")}
              {num("nameSize", "Name font")}{num("codeSize", "Code font")}{num("mrpSize", "MRP font")}{num("barH", "Barcode height mm")}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Printer paper size: {(cfg.left + cfg.cols * cfg.labelW + (cfg.cols - 1) * cfg.gap).toFixed(1)} × {cfg.labelH} mm · Print scale: Actual size / 100%</span>
              <Button variant="ghost" size="sm" onClick={() => setCfg(DEFAULT)}><RotateCcw className="h-3 w-3 mr-1" />Reset</Button>
            </div>
          </CardContent></Card>
        )}

        <Card><CardContent className="p-4 space-y-3">
          <div className="relative">
            <Input placeholder={loading ? "Loading items…" : "Search item name or code"} value={search} onChange={(e) => setSearch(e.target.value)} />
            {results.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-lg max-h-72 overflow-auto">
                {results.map((p) => (
                  <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-muted flex justify-between gap-2 text-sm" onClick={() => add(p.product_name, p.product_code, Number(p.mrp) || 0)}>
                    <span className="truncate">{p.product_name} <span className="text-muted-foreground">({p.product_code})</span></span>
                    <span className="shrink-0">₹{Number(p.mrp || 0).toLocaleString("en-IN")}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-[1fr_7rem_6rem_auto] gap-2">
            <Input placeholder="Item name (not on site)" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
            <Input placeholder="Code" value={manual.code} onChange={(e) => setManual({ ...manual, code: e.target.value.toUpperCase() })} />
            <Input placeholder="MRP" type="number" value={manual.mrp} onChange={(e) => setManual({ ...manual, mrp: e.target.value })} />
            <Button variant="outline" size="icon" disabled={!manual.name || !manual.code} onClick={() => { add(manual.name, manual.code, Number(manual.mrp) || 0); setManual({ name: "", code: "", mrp: "" }); }}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-0">
          {loading ? <div className="p-6 flex justify-center"><Loader2 className="animate-spin" /></div> : lines.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Search and add items to print labels.</p>
          ) : (
            <div className="divide-y">
              {lines.map((l) => (
                <div key={l.key} className="p-3 grid grid-cols-[1fr_6rem_5rem_auto] gap-2 items-center">
                  <div className="min-w-0">
                    <Input value={l.name} onChange={(e) => upd(l.key, { name: e.target.value })} className="h-8" />
                    <div className="text-xs text-muted-foreground mt-1">{l.code}</div>
                  </div>
                  <Input type="number" value={l.mrp} onChange={(e) => upd(l.key, { mrp: Number(e.target.value) || 0 })} className="h-8" title="MRP" />
                  <Input type="number" min={0} value={l.qty} onChange={(e) => upd(l.key, { qty: Math.max(0, parseInt(e.target.value) || 0) })} className="h-8" title="Qty" />
                  <Button variant="ghost" size="icon" onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>

        <div className="flex gap-2 justify-end sticky bottom-2">
          <Button variant="outline" disabled={!total} onClick={download}>Download PDF</Button>
          <Button disabled={!total} onClick={print}><Printer className="h-4 w-4 mr-1" />Print {total} label{total === 1 ? "" : "s"}</Button>
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminBarcodeLabels;
