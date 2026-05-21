import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, FileDown, Trash2, ClipboardPaste, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { compressProductImage } from "@/lib/imageCompression";

type LinkedProduct = { product_code: string; quantity: number };
type Row = {
  id: string;
  name: string;
  bundle_code: string;
  description: string;
  mrp: number;
  offer_price: number | null;
  cost_price: number | null;
  material: string;
  dimensions: string;
  category: string;
  image_hint: string | null;
  linked_codes: string; // comma-separated "CODE x QTY" tokens for UI editing
  image_file?: File | null;
  image_preview?: string | null;
};

const HEADERS = ["Bundle Name", "Bundle Code", "Description", "MRP", "Offer Price", "Cost Price", "Material", "Dimensions", "Category", "Linked Product Codes (code x qty, comma)", "Image File"];
const SAMPLE: (string | number)[][] = [
  ["Living Room Combo", "BND-101", "Sofa + center table + 2 chairs", 78000, 69000, 52000, "Wood/Fabric", "—", "Living Room", "SOFA-3S x1, CT-22 x1, CH-08 x2", "combo.jpg"],
  ["Bedroom Set", "BND-202", "Bed + side tables + wardrobe", 145000, 129000, 95000, "Teak", "—", "Bedroom", "BED-Q x1, ST-11 x2, WD-3D x1", "bed-set.jpg"],
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
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Bundles");
  XLSX.writeFile(wb, "bundles-sample.xlsx");
};
const downloadCsv = () => {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...SAMPLE]);
  triggerDownload(new Blob([XLSX.utils.sheet_to_csv(ws)], { type: "text/csv" }), "bundles-sample.csv");
};
const downloadWord = () => {
  const rows = SAMPLE.map(r => `<tr>${r.map(c => `<td style="border:1px solid #999;padding:6px">${c}</td>`).join("")}</tr>`).join("");
  const html = `<!DOCTYPE html><html><body><h2>Bundles — Sample</h2><table style="border-collapse:collapse"><thead><tr>${HEADERS.map(h=>`<th style="border:1px solid #999;padding:6px;background:#eee">${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
  triggerDownload(new Blob([html], { type: "application/msword" }), "bundles-sample.doc");
};
const downloadPdf = () => {
  const w = window.open("", "_blank"); if (!w) return;
  w.document.write(`<html><head><title>Bundles — Sample</title><style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px}th{background:#eee}</style></head><body><h2>Bundles — Sample</h2><table><thead><tr>${HEADERS.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${SAMPLE.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table><script>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
};

const parseLinkedString = (s: string): LinkedProduct[] => {
  if (!s?.trim()) return [];
  return s.split(/[,;\n]/).map((p) => {
    const t = p.trim(); if (!t) return null;
    const m = t.match(/^(.+?)\s*[xX*]\s*(\d+)$/);
    if (m) return { product_code: m[1].trim(), quantity: Math.max(1, parseInt(m[2], 10)) };
    return { product_code: t, quantity: 1 };
  }).filter((x): x is LinkedProduct => !!x);
};

const linkedToString = (arr: LinkedProduct[]) => arr.map(l => `${l.product_code} x${l.quantity}`).join(", ");

const rowFromArr = (h: string[], r: any[]): Row | null => {
  const idx = (keys: string[]) => h.findIndex((x) => keys.some((k) => x.includes(k)));
  const name = String(r[idx(["bundlename","name","combo"])] ?? "").trim();
  if (!name) return null;
  return {
    id: uid(),
    name,
    bundle_code: String(r[idx(["bundlecode","code","sku"])] ?? "").trim(),
    description: String(r[idx(["description","details"])] ?? "").trim(),
    mrp: num(r[idx(["mrp","price"])]),
    offer_price: (() => { const i = idx(["offerprice","offer","sale"]); return i >= 0 && r[i] !== "" ? num(r[i]) : null; })(),
    cost_price: (() => { const i = idx(["costprice","cost"]); return i >= 0 && r[i] !== "" ? num(r[i]) : null; })(),
    material: String(r[idx(["material"])] ?? "").trim(),
    dimensions: String(r[idx(["dimension","size"])] ?? "").trim(),
    category: String(r[idx(["category"])] ?? "").trim(),
    image_hint: (() => { const i = idx(["image","photo","file"]); const v = i >= 0 ? String(r[i] ?? "").trim() : ""; return v || null; })(),
    linked_codes: String(r[idx(["linked","products","items","components"])] ?? "").trim(),
    image_file: null, image_preview: null,
  };
};

const parseRows = (matrix: any[][]): Row[] => {
  if (!matrix.length) return [];
  let hi = 0;
  for (let i = 0; i < Math.min(matrix.length, 5); i++) {
    const j = matrix[i].join("|").toLowerCase();
    if (j.includes("bundle") || j.includes("name") || j.includes("combo")) { hi = i; break; }
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
  const { data, error } = await supabase.functions.invoke("bulk-extract-items", { body: { text, kind: "bundle" } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return ((data?.items ?? []) as any[]).map((it) => ({
    id: uid(),
    name: it.name ?? it.product_name ?? "",
    bundle_code: it.bundle_code ?? "",
    description: it.description ?? "",
    mrp: num(it.mrp),
    offer_price: it.offer_price != null ? num(it.offer_price) : null,
    cost_price: it.cost_price != null ? num(it.cost_price) : null,
    material: it.material ?? "",
    dimensions: it.dimensions ?? "",
    category: it.category ?? "",
    image_hint: it.image_hint ?? null,
    linked_codes: Array.isArray(it.linked_products) ? linkedToString(it.linked_products) : "",
    image_file: null, image_preview: null,
  })).filter((r) => r.name);
};

const AdminBundleBulkCreate = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [pasted, setPasted] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [productCodeMap, setProductCodeMap] = useState<Map<string, string>>(new Map());
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from("main_categories").select("id, name").is("deleted_at", null).order("display_order"),
        supabase.from("products").select("id, product_code").is("deleted_at", null),
      ]);
      setCats((c ?? []) as any);
      const m = new Map<string, string>();
      ((p ?? []) as any[]).forEach((x) => m.set(norm(x.product_code), x.id));
      setProductCodeMap(m);
    })();
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
      else { toast({ title: "Unsupported file", variant: "destructive" }); return; }
      if (parsed.length === 0) { toast({ title: "No bundles found", variant: "destructive" }); return; }
      setRows((p) => [...p, ...parsed]);
      toast({ title: `Loaded ${parsed.length} bundles` });
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
    if (parsed.length === 0) return toast({ title: "No bundles detected", variant: "destructive" });
    setRows((p) => [...p, ...parsed]); setPasted("");
    toast({ title: `Loaded ${parsed.length} bundles` });
  };

  const handleImages = (files: FileList | null) => {
    if (!files?.length) return;
    setRows((prev) => {
      const next = [...prev]; const leftover: File[] = [];
      Array.from(files).forEach((file) => {
        const base = norm(file.name.replace(/\.[^.]+$/, ""));
        const i = next.findIndex((r) => !r.image_file && (
          (r.image_hint && norm(r.image_hint.replace(/\.[^.]+$/, "")) === base) ||
          norm(r.name).includes(base) || base.includes(norm(r.name).slice(0, 10))
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
    if (rows.length === 0) return toast({ title: "Add at least one bundle", variant: "destructive" });
    if (cats.length === 0) return toast({ title: "Create a main category first", variant: "destructive" });
    const fallbackCat = cats[0].id;
    setSaving(true);
    try {
      let created = 0; const missingCodes = new Set<string>();
      for (const r of rows) {
        const matchedCat = cats.find((c) => norm(c.name) === norm(r.category));
        let mainImageUrl: string | null = null;
        if (r.image_file) {
          try {
            const compressed = await compressProductImage(r.image_file);
            const path = `bundles/${uid()}-${compressed.name}`;
            const { error: upErr } = await supabase.storage.from("product-images").upload(path, compressed, { contentType: compressed.type });
            if (!upErr) mainImageUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
          } catch (e) { console.warn("img upload failed", e); }
        }
        const payload: any = {
          name: r.name.trim(),
          bundle_code: r.bundle_code?.trim() || `BND-${Date.now().toString().slice(-6)}-${uid().slice(0,3)}`,
          description: r.description || null,
          mrp: r.mrp || 0,
          offer_price: r.offer_price ?? null,
          cost_price: r.cost_price ?? null,
          material: r.material || null,
          dimensions: r.dimensions || null,
          main_image_url: mainImageUrl,
          is_published: true,
          main_category_id: matchedCat?.id ?? fallbackCat,
        };
        const { data: b, error: bErr } = await (supabase as any).from("product_bundles").insert(payload).select("id").single();
        if (bErr || !b) throw bErr ?? new Error("insert failed");

        const linked = parseLinkedString(r.linked_codes);
        const itemRows: any[] = [];
        linked.forEach((lp, i) => {
          const pid = productCodeMap.get(norm(lp.product_code));
          if (pid) itemRows.push({ bundle_id: b.id, product_id: pid, quantity: lp.quantity, display_order: i });
          else missingCodes.add(lp.product_code);
        });
        if (itemRows.length) await (supabase as any).from("bundle_items").insert(itemRows);
        created++;
      }
      toast({
        title: `Created ${created} bundles`,
        description: missingCodes.size
          ? `Skipped unknown product codes: ${[...missingCodes].slice(0,5).join(", ")}${missingCodes.size>5?"…":""}`
          : undefined,
      });
      navigate("/admin/bundles");
    } catch (e: any) { toast({ title: "Save failed", description: e?.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const totalImgs = useMemo(() => rows.filter((r) => r.image_file).length, [rows]);

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl">Bulk Bundle Creation</h1>
            <p className="text-sm text-muted-foreground">
              Upload Excel/Word/PDF or paste rows. Use existing product codes in the "Linked Products" column to attach catalog items.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin/bundles")}>← Back</Button>
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
                <ImageIcon className="mr-2 h-4 w-4" /> Attach bundle images ({totalImgs}/{rows.length})
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardPaste className="h-4 w-4" /> Paste rows</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Textarea rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)}
                placeholder={`Bundle Name\tCode\tMRP\tLinked Products\nLiving Combo\tBND-101\t78000\tSOFA-3S x1, CT-22 x1`} />
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
                    <TableHead>Category</TableHead>
                    <TableHead>Linked product codes (code xN)</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.image_preview
                        ? <img src={r.image_preview} alt="" className="h-10 w-10 rounded object-cover" />
                        : <div className="h-10 w-10 rounded bg-muted" />}</TableCell>
                      <TableCell><Input value={r.name} onChange={(e) => updateRow(r.id, { name: e.target.value })} /></TableCell>
                      <TableCell><Input value={r.bundle_code} onChange={(e) => updateRow(r.id, { bundle_code: e.target.value })} /></TableCell>
                      <TableCell><Input type="number" value={r.mrp} onChange={(e) => updateRow(r.id, { mrp: num(e.target.value) })} /></TableCell>
                      <TableCell><Input type="number" value={r.offer_price ?? ""} onChange={(e) => updateRow(r.id, { offer_price: e.target.value === "" ? null : num(e.target.value) })} /></TableCell>
                      <TableCell><Input value={r.category} onChange={(e) => updateRow(r.id, { category: e.target.value })} placeholder={cats[0]?.name ?? ""} /></TableCell>
                      <TableCell><Input value={r.linked_codes} onChange={(e) => updateRow(r.id, { linked_codes: e.target.value })} placeholder="CODE x1, OTHER x2" /></TableCell>
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

export default AdminBundleBulkCreate;