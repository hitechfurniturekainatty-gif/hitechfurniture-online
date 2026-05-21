import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, FileDown, Trash2, ClipboardPaste, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { titleCaseTrim } from "@/lib/textCase";
import { compressProductImage } from "@/lib/imageCompression";

type Row = {
  id: string;
  product_name: string;
  product_code: string;
  description: string;
  mrp: number;
  offer_price: number | null;
  cost_price: number | null;
  material: string;
  dimensions: string;
  stock_quantity: number;
  category: string;
  image_hint: string | null;
  image_file?: File | null;
  image_preview?: string | null;
};

const HEADERS = ["Product Name", "Code", "Description", "MRP", "Offer Price", "Cost Price", "Material", "Dimensions", "Stock", "Category", "Image File"];
const SAMPLE: (string | number)[][] = [
  ["Recliner Sofa", "RS-101", "Brown leather 3-seater", 35000, 29999, 21000, "Leather", "180x90x85 cm", 4, "Sofas", "recliner.jpg"],
  ["Dining Table 6S", "DT-220", "Solid teak with glass top", 48000, 42000, 31000, "Teak", "180x90 cm", 2, "Dining", "dining.jpg"],
];

const uid = () => Math.random().toString(36).slice(2, 10);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const num = (v: any) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };

const triggerDownload = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const downloadExcel = () => {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...SAMPLE]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Products");
  XLSX.writeFile(wb, "products-sample.xlsx");
};
const downloadCsv = () => {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...SAMPLE]);
  triggerDownload(new Blob([XLSX.utils.sheet_to_csv(ws)], { type: "text/csv" }), "products-sample.csv");
};
const downloadWord = () => {
  const rows = SAMPLE.map(r => `<tr>${r.map(c => `<td style="border:1px solid #999;padding:6px">${c}</td>`).join("")}</tr>`).join("");
  const html = `<!DOCTYPE html><html><body><h2>Products — Sample</h2><table style="border-collapse:collapse"><thead><tr>${HEADERS.map(h=>`<th style="border:1px solid #999;padding:6px;background:#eee">${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
  triggerDownload(new Blob([html], { type: "application/msword" }), "products-sample.doc");
};
const downloadPdf = () => {
  const w = window.open("", "_blank"); if (!w) return;
  w.document.write(`<html><head><title>Products — Sample</title><style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px}th{background:#eee}</style></head><body><h2>Products — Sample</h2><table><thead><tr>${HEADERS.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${SAMPLE.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table><script>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
};

const rowFromArr = (h: string[], r: any[]): Row | null => {
  const idx = (keys: string[]) => h.findIndex((x) => keys.some((k) => x.includes(k)));
  const name = String(r[idx(["productname","name","item","product"])] ?? "").trim();
  if (!name) return null;
  return {
    id: uid(),
    product_name: name,
    product_code: String(r[idx(["code","sku"])] ?? "").trim(),
    description: String(r[idx(["description","details"])] ?? "").trim(),
    mrp: num(r[idx(["mrp","price"])]),
    offer_price: (() => { const i = idx(["offerprice","offer","sale"]); return i >= 0 && r[i] !== "" ? num(r[i]) : null; })(),
    cost_price: (() => { const i = idx(["costprice","cost"]); return i >= 0 && r[i] !== "" ? num(r[i]) : null; })(),
    material: String(r[idx(["material"])] ?? "").trim(),
    dimensions: String(r[idx(["dimension","size","measurement"])] ?? "").trim(),
    stock_quantity: Math.max(0, Math.round(num(r[idx(["stock","qty","quantity"])]))),
    category: String(r[idx(["category"])] ?? "").trim(),
    image_hint: (() => { const i = idx(["image","photo","picture","file"]); const v = i >= 0 ? String(r[i] ?? "").trim() : ""; return v || null; })(),
    image_file: null, image_preview: null,
  };
};

const parseRows = (matrix: any[][]): Row[] => {
  if (matrix.length === 0) return [];
  let hi = 0;
  for (let i = 0; i < Math.min(matrix.length, 5); i++) {
    const j = matrix[i].join("|").toLowerCase();
    if (j.includes("product") || j.includes("name") || j.includes("item")) { hi = i; break; }
  }
  const headers = matrix[hi].map((h: any) => norm(String(h ?? "")));
  return matrix.slice(hi + 1)
    .filter((r) => r && r.some((c: any) => String(c ?? "").trim()))
    .map((r) => rowFromArr(headers, r))
    .filter((x): x is Row => !!x);
};

const extractDocxText = async (file: File) => {
  const mammoth = await import("mammoth/mammoth.browser");
  return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value ?? "";
};
const extractPdfText = async (file: File) => {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url" as string)).default;
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await (pdfjs as any).getDocument({ data: await file.arrayBuffer() }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const pg = await doc.getPage(p);
    out += (await pg.getTextContent()).items.map((it: any) => it.str).join(" ") + "\n";
  }
  return out;
};
const extractViaAI = async (text: string): Promise<Row[]> => {
  const { data, error } = await supabase.functions.invoke("bulk-extract-items", { body: { text, kind: "product" } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return ((data?.items ?? []) as any[]).map((it) => ({
    id: uid(),
    product_name: it.product_name ?? it.name ?? "",
    product_code: it.product_code ?? "",
    description: it.description ?? "",
    mrp: num(it.mrp),
    offer_price: it.offer_price != null ? num(it.offer_price) : null,
    cost_price: it.cost_price != null ? num(it.cost_price) : null,
    material: it.material ?? "",
    dimensions: it.dimensions ?? "",
    stock_quantity: Math.max(0, Math.round(num(it.stock_quantity))),
    category: it.category ?? "",
    image_hint: it.image_hint ?? null,
    image_file: null, image_preview: null,
  })).filter((r) => r.product_name);
};

const AdminProductBulkCreate = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [pasted, setPasted] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("main_categories").select("id, name").is("deleted_at", null).order("display_order")
      .then(({ data }) => setCats((data ?? []) as any));
  }, []);

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const ext = file.name.toLowerCase().split(".").pop() ?? "";
      let parsed: Row[] = [];
      if (["xlsx","xls","csv"].includes(ext)) {
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const matrix: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
        parsed = parseRows(matrix);
      } else if (ext === "docx") parsed = await extractViaAI(await extractDocxText(file));
      else if (ext === "pdf") parsed = await extractViaAI(await extractPdfText(file));
      else { toast({ title: "Unsupported file", description: "Use .xlsx, .csv, .docx or .pdf", variant: "destructive" }); return; }
      if (parsed.length === 0) { toast({ title: "No products found", variant: "destructive" }); return; }
      setRows((p) => [...p, ...parsed]);
      toast({ title: `Loaded ${parsed.length} products` });
    } catch (e: any) { toast({ title: "Parse failed", description: e?.message, variant: "destructive" }); }
    finally { setParsing(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const handlePaste = async () => {
    const t = pasted.trim(); if (!t) return;
    const delim = t.includes("\t") ? "\t" : ",";
    const matrix = t.split(/\r?\n/).map((l) => l.split(delim).map((c) => c.trim()));
    let parsed = parseRows(matrix);
    if (parsed.length === 0) {
      setParsing(true);
      try { parsed = await extractViaAI(t); }
      catch (e: any) { toast({ title: "Parse failed", description: e?.message, variant: "destructive" }); setParsing(false); return; }
      setParsing(false);
    }
    if (parsed.length === 0) return toast({ title: "No products detected", variant: "destructive" });
    setRows((p) => [...p, ...parsed]); setPasted("");
    toast({ title: `Loaded ${parsed.length} products` });
  };

  const handleImages = (files: FileList | null) => {
    if (!files?.length) return;
    setRows((prev) => {
      const next = [...prev]; const leftover: File[] = [];
      Array.from(files).forEach((file) => {
        const base = norm(file.name.replace(/\.[^.]+$/, ""));
        const i = next.findIndex((r) => !r.image_file && (
          (r.image_hint && norm(r.image_hint.replace(/\.[^.]+$/, "")) === base) ||
          norm(r.product_name).includes(base) || base.includes(norm(r.product_name).slice(0, 10))
        ));
        if (i >= 0) next[i] = { ...next[i], image_file: file, image_preview: URL.createObjectURL(file) };
        else leftover.push(file);
      });
      leftover.forEach((file) => {
        const i = next.findIndex((r) => !r.image_file);
        if (i >= 0) next[i] = { ...next[i], image_file: file, image_preview: URL.createObjectURL(file) };
      });
      return next;
    });
    if (imgRef.current) imgRef.current.value = "";
  };

  const updateRow = (id: string, patch: Partial<Row>) => setRows((p) => p.map((r) => r.id === id ? { ...r, ...patch } : r));
  const removeRow = (id: string) => setRows((p) => p.filter((r) => r.id !== id));

  const approveAll = async () => {
    if (rows.length === 0) return toast({ title: "Add at least one product", variant: "destructive" });
    if (cats.length === 0) return toast({ title: "Create a main category first", variant: "destructive" });
    const fallbackCat = cats[0].id;
    setSaving(true);
    try {
      let created = 0;
      for (const r of rows) {
        const matched = cats.find((c) => norm(c.name) === norm(r.category));
        const payload: any = {
          product_name: titleCaseTrim(r.product_name),
          product_code: r.product_code?.trim() || `Auto-${Date.now().toString(36)}-${uid()}`,
          description: r.description || null,
          mrp: r.mrp || 0,
          offer_price: r.offer_price ?? null,
          cost_price: r.cost_price ?? null,
          material: r.material || null,
          dimensions: r.dimensions || null,
          stock_quantity: r.stock_quantity || 0,
          stock_status: (r.stock_quantity || 0) > 0 ? "in_stock" : "out_of_stock",
          is_published: true,
          main_category_id: matched?.id ?? fallbackCat,
        };
        const { data: p, error: pErr } = await supabase.from("products").insert(payload).select("id").single();
        if (pErr || !p) throw pErr ?? new Error("insert failed");
        if (r.image_file) {
          try {
            const compressed = await compressProductImage(r.image_file);
            const path = `${p.id}/${uid()}-${compressed.name}`;
            const { error: upErr } = await supabase.storage.from("product-images").upload(path, compressed, { contentType: compressed.type });
            if (!upErr) {
              const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
              await supabase.from("product_images").insert({ product_id: p.id, image_url: pub.publicUrl, display_order: 0 });
            }
          } catch (e) { console.warn("img upload failed", e); }
        }
        created++;
      }
      toast({ title: `Created ${created} products` });
      navigate("/admin/products");
    } catch (e: any) { toast({ title: "Save failed", description: e?.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const totalImgs = useMemo(() => rows.filter((r) => r.image_file).length, [rows]);

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl">Bulk Product Creation</h1>
            <p className="text-sm text-muted-foreground">Upload Excel/Word/PDF or paste rows to add many products in one go.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin/products")}>← Back</Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileDown className="h-4 w-4" /> Download sample format</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadExcel}>Excel (.xlsx)</Button>
            <Button variant="outline" size="sm" onClick={downloadCsv}>CSV</Button>
            <Button variant="outline" size="sm" onClick={downloadWord}>Word (.doc)</Button>
            <Button variant="outline" size="sm" onClick={downloadPdf}>PDF (print)</Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Upload file</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.docx,.pdf" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <Button onClick={() => fileRef.current?.click()} disabled={parsing} variant="secondary" className="w-full">
                {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Choose file
              </Button>
              <p className="text-xs text-muted-foreground">PDF & Word are parsed by AI. Excel/CSV is parsed instantly.</p>
              <input ref={imgRef} type="file" multiple accept="image/*" className="hidden"
                onChange={(e) => handleImages(e.target.files)} />
              <Button onClick={() => imgRef.current?.click()} variant="outline" className="w-full">
                <ImageIcon className="mr-2 h-4 w-4" /> Attach product images ({totalImgs}/{rows.length})
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardPaste className="h-4 w-4" /> Paste rows</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Textarea rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)}
                placeholder={`Product Name\tCode\tMRP\tStock\nRecliner Sofa\tRS-101\t29999\t4`} />
              <Button onClick={handlePaste} disabled={parsing || !pasted.trim()} className="w-full">
                {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Parse paste
              </Button>
            </CardContent>
          </Card>
        </div>

        {rows.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Preview ({rows.length})</CardTitle>
              <Button onClick={approveAll} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Approve all
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Img</TableHead><TableHead>Name *</TableHead><TableHead>Code</TableHead>
                    <TableHead className="w-24">MRP</TableHead><TableHead className="w-24">Offer</TableHead>
                    <TableHead className="w-20">Stock</TableHead><TableHead>Category</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.image_preview
                        ? <img src={r.image_preview} alt="" className="h-10 w-10 rounded object-cover" />
                        : <div className="h-10 w-10 rounded bg-muted" />}</TableCell>
                      <TableCell><Input value={r.product_name} onChange={(e) => updateRow(r.id, { product_name: e.target.value })} /></TableCell>
                      <TableCell><Input value={r.product_code} onChange={(e) => updateRow(r.id, { product_code: e.target.value })} /></TableCell>
                      <TableCell><Input type="number" value={r.mrp} onChange={(e) => updateRow(r.id, { mrp: num(e.target.value) })} /></TableCell>
                      <TableCell><Input type="number" value={r.offer_price ?? ""} onChange={(e) => updateRow(r.id, { offer_price: e.target.value === "" ? null : num(e.target.value) })} /></TableCell>
                      <TableCell><Input type="number" value={r.stock_quantity} onChange={(e) => updateRow(r.id, { stock_quantity: Math.max(0, Math.round(num(e.target.value))) })} /></TableCell>
                      <TableCell><Input value={r.category} onChange={(e) => updateRow(r.id, { category: e.target.value })} placeholder={cats[0]?.name ?? ""} /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => removeRow(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminShell>
  );
};

export default AdminProductBulkCreate;