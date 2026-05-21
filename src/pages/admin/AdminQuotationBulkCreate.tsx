import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, FileDown, Image as ImageIcon, Trash2, Sparkles, ClipboardPaste, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { titleCaseTrim } from "@/lib/textCase";
import { compressProductImage } from "@/lib/imageCompression";

type Row = {
  id: string;
  description: string;
  quantity: number;
  measurement: string;
  unit_price: number;
  fulfillment_route: "ready_stock" | "custom";
  image_hint: string | null;
  image_file?: File | null;
  image_preview?: string | null;
};

const SAMPLE_HEADERS = ["Sl.No", "Description", "Quantity", "Measurement", "Unit Price", "Type (ready_stock/custom)", "Image File Name"];
const SAMPLE_ROWS = [
  ["1", "Sofa 3-seater (Brown leather)", "2", "180x90x85 cm", "32500", "ready_stock", "sofa-brown.jpg"],
  ["2", "Dining table with 6 chairs", "1", "180x90 cm", "48000", "custom", "dining-set.jpg"],
  ["3", "Wardrobe 3-door sliding", "1", "210x60x200 cm", "27500", "ready_stock", "wardrobe.jpg"],
];

const uid = () => Math.random().toString(36).slice(2, 10);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/* ---------- Sample template generators ---------- */
const downloadExcel = () => {
  const ws = XLSX.utils.aoa_to_sheet([SAMPLE_HEADERS, ...SAMPLE_ROWS]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Items");
  XLSX.writeFile(wb, "quotation-items-sample.xlsx");
};
const downloadCsv = () => {
  const ws = XLSX.utils.aoa_to_sheet([SAMPLE_HEADERS, ...SAMPLE_ROWS]);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv" });
  triggerDownload(blob, "quotation-items-sample.csv");
};
const downloadWord = () => {
  const tableRows = SAMPLE_ROWS.map(
    (r) => `<tr>${r.map((c) => `<td style="border:1px solid #999;padding:6px">${c}</td>`).join("")}</tr>`,
  ).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
  <h2>Quotation Items — Sample</h2>
  <p>Edit this table and save as .docx, then upload it. Keep column order.</p>
  <table style="border-collapse:collapse"><thead><tr>
  ${SAMPLE_HEADERS.map((h) => `<th style="border:1px solid #999;padding:6px;background:#eee">${h}</th>`).join("")}
  </tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  triggerDownload(blob, "quotation-items-sample.doc");
};
const downloadPdf = async () => {
  // Tiny printable HTML opened in a new tab — user prints to PDF.
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<html><head><title>Quotation Items — Sample</title>
  <style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px;text-align:left}th{background:#eee}</style>
  </head><body><h2>Quotation Items — Sample</h2>
  <p>Print this page → Save as PDF, then upload it.</p>
  <table><thead><tr>${SAMPLE_HEADERS.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
  <tbody>${SAMPLE_ROWS.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
  <script>setTimeout(()=>window.print(),300)</script></body></html>`);
  win.document.close();
};
const triggerDownload = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/* ---------- Parsers ---------- */
const parseRows = (matrix: string[][]): Row[] => {
  if (matrix.length === 0) return [];
  // Detect header row: first row that contains "description" or "item"
  let headerIdx = 0;
  for (let i = 0; i < Math.min(matrix.length, 5); i++) {
    const joined = matrix[i].join("|").toLowerCase();
    if (joined.includes("description") || joined.includes("item") || joined.includes("product")) {
      headerIdx = i; break;
    }
  }
  const headers = matrix[headerIdx].map((h) => norm(String(h ?? "")));
  const idx = (keys: string[]) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
  const iDesc = idx(["description", "item", "product", "particular"]);
  const iQty = idx(["quantity", "qty", "nos"]);
  const iMeas = idx(["measurement", "size", "dimension"]);
  const iPrice = idx(["unitprice", "rate", "price"]);
  const iType = idx(["type", "route", "fulfillment"]);
  const iImg = idx(["image", "photo", "picture", "file"]);

  return matrix.slice(headerIdx + 1)
    .filter((r) => r && r.some((c) => String(c ?? "").trim()))
    .map((r) => {
      const desc = iDesc >= 0 ? String(r[iDesc] ?? "").trim() : String(r[1] ?? r[0] ?? "").trim();
      if (!desc) return null;
      const rt = (iType >= 0 ? String(r[iType] ?? "").toLowerCase() : "");
      const row: Row = {
        id: uid(),
        description: desc,
        quantity: Math.max(Number(iQty >= 0 ? r[iQty] : 1) || 1, 1),
        measurement: iMeas >= 0 ? String(r[iMeas] ?? "").trim() : "",
        unit_price: Number(String(iPrice >= 0 ? r[iPrice] : 0).replace(/[^\d.]/g, "")) || 0,
        fulfillment_route: rt.includes("custom") ? "custom" : "ready_stock",
        image_hint: iImg >= 0 ? String(r[iImg] ?? "").trim() || null : null,
        image_file: null,
        image_preview: null,
      };
      return row;
    })
    .filter((x): x is Row => !!x);
};

const parsePastedText = (text: string): Row[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const delim = trimmed.includes("\t") ? "\t" : ",";
  const matrix = trimmed.split(/\r?\n/).map((line) => line.split(delim).map((c) => c.trim()));
  return parseRows(matrix);
};

const parseExcelFile = async (file: File): Promise<Row[]> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  return parseRows(matrix);
};

const extractDocxText = async (file: File): Promise<string> => {
  const mammoth = await import("mammoth/mammoth.browser");
  const buf = await file.arrayBuffer();
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return res.value ?? "";
};

const extractPdfText = async (file: File): Promise<string> => {
  // pdfjs-dist is already in deps. Use new URL() so Vite resolves the worker
  // asset reliably (dynamic `?url` imports get stripped under some configs).
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).href;
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  const doc = await (pdfjs as any).getDocument({ data: buf }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const text = await page.getTextContent();
    out += text.items.map((it: any) => it.str).join(" ") + "\n";
  }
  return out;
};

const extractViaAI = async (text: string): Promise<Row[]> => {
  const { data, error } = await supabase.functions.invoke("bulk-extract-items", { body: { text } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  const items = (data?.items ?? []) as Array<{
    description: string; quantity?: number; measurement?: string | null;
    unit_price?: number | null; fulfillment_route?: "ready_stock" | "custom"; image_hint?: string | null;
  }>;
  return items.map((it) => ({
    id: uid(),
    description: it.description,
    quantity: Math.max(Number(it.quantity ?? 1) || 1, 1),
    measurement: it.measurement ?? "",
    unit_price: Number(it.unit_price ?? 0) || 0,
    fulfillment_route: it.fulfillment_route === "custom" ? "custom" : "ready_stock",
    image_hint: it.image_hint ?? null,
    image_file: null,
    image_preview: null,
  }));
};

/* ---------- Component ---------- */
const AdminQuotationBulkCreate = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [partyName, setPartyName] = useState("");
  const [partyPlace, setPartyPlace] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [pasted, setPasted] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const total = useMemo(() => rows.reduce((a, r) => a + r.quantity * r.unit_price, 0), [rows]);

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const ext = file.name.toLowerCase().split(".").pop() ?? "";
      let parsed: Row[] = [];
      if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        parsed = await parseExcelFile(file);
      } else if (ext === "docx") {
        const text = await extractDocxText(file);
        parsed = await extractViaAI(text);
      } else if (ext === "pdf") {
        const text = await extractPdfText(file);
        parsed = await extractViaAI(text);
      } else {
        toast({ title: "Unsupported file", description: "Use .xlsx, .csv, .docx or .pdf", variant: "destructive" });
        return;
      }
      if (parsed.length === 0) {
        toast({ title: "No items found", description: "Check the file format or use the sample template.", variant: "destructive" });
        return;
      }
      setRows((prev) => [...prev, ...parsed]);
      toast({ title: `Loaded ${parsed.length} items`, description: "Review and edit before approving." });
    } catch (e: any) {
      toast({ title: "Parse failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handlePaste = async () => {
    const parsed = parsePastedText(pasted);
    if (parsed.length === 0) {
      // fallback: send to AI
      if (!pasted.trim()) return;
      setParsing(true);
      try {
        const ai = await extractViaAI(pasted);
        if (ai.length === 0) { toast({ title: "No items detected", variant: "destructive" }); return; }
        setRows((prev) => [...prev, ...ai]);
        setPasted("");
        toast({ title: `Loaded ${ai.length} items via AI` });
      } catch (e: any) {
        toast({ title: "Parse failed", description: e?.message, variant: "destructive" });
      } finally { setParsing(false); }
      return;
    }
    setRows((prev) => [...prev, ...parsed]);
    setPasted("");
    toast({ title: `Loaded ${parsed.length} items` });
  };

  const handleImages = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Auto-match by filename to hint OR description
    setRows((prev) => {
      const next = [...prev];
      const unmatched: File[] = [];
      Array.from(files).forEach((file) => {
        const base = norm(file.name.replace(/\.[^.]+$/, ""));
        const idx = next.findIndex((r) => !r.image_file && (
          (r.image_hint && norm(r.image_hint.replace(/\.[^.]+$/, "")) === base) ||
          norm(r.description).includes(base) || base.includes(norm(r.description).slice(0, 10))
        ));
        if (idx >= 0) {
          next[idx] = { ...next[idx], image_file: file, image_preview: URL.createObjectURL(file) };
        } else {
          unmatched.push(file);
        }
      });
      // Assign leftovers to first rows without image
      unmatched.forEach((file) => {
        const idx = next.findIndex((r) => !r.image_file);
        if (idx >= 0) next[idx] = { ...next[idx], image_file: file, image_preview: URL.createObjectURL(file) };
      });
      return next;
    });
    if (imgRef.current) imgRef.current.value = "";
  };

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const approveAll = async () => {
    if (!partyName.trim() || !partyPlace.trim()) {
      toast({ title: "Customer name and place are required", variant: "destructive" }); return;
    }
    if (rows.length === 0) {
      toast({ title: "Add at least one item", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      // 1. Generate quotation id
      const { data: qid, error: qidErr } = await supabase.rpc("next_quotation_id", {
        _party: partyName, _place: partyPlace,
      });
      if (qidErr) throw qidErr;

      // 2. Create quotation
      const { data: q, error: qErr } = await supabase.from("quotations").insert({
        quotation_id: qid as string,
        party_name: titleCaseTrim(partyName),
        party_place: partyPlace.trim(),
        party_phone: partyPhone.trim() || null,
        document_type: "quotation",
        lead_type: "lead",
        created_by: user?.id ?? null,
      }).select("id").single();
      if (qErr || !q) throw qErr ?? new Error("Failed to create quotation");

      // 3. Upload images
      const urls: Record<string, string> = {};
      const withImg = rows.filter((r) => r.image_file);
      for (const r of withImg) {
        try {
          const compressed = await compressProductImage(r.image_file!);
          const path = `${q.id}/${uid()}-${compressed.name}`;
          const { error: upErr } = await supabase.storage.from("quotation-images").upload(path, compressed, {
            contentType: compressed.type, upsert: false,
          });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from("quotation-images").getPublicUrl(path);
          urls[r.id] = pub.publicUrl;
        } catch (e) {
          console.warn("Image upload failed for", r.description, e);
        }
      }

      // 4. Insert items
      const payload = rows.map((r, i) => ({
        quotation_id: q.id,
        display_order: i,
        description: r.description,
        quantity: r.quantity,
        unit_price: r.unit_price,
        measurement: r.measurement || null,
        fulfillment_route: r.fulfillment_route,
        item_image_url: urls[r.id] ?? null,
      }));
      const { error: itemsErr } = await supabase.from("quotation_items").insert(payload);
      if (itemsErr) throw itemsErr;

      toast({ title: "Quotation created", description: `${rows.length} items added.` });
      navigate(`/admin/quotations/${q.id}`);
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <AdminShell>
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl">Bulk Quotation Creation</h1>
            <p className="text-sm text-muted-foreground">
              Upload Excel/Word/PDF or paste your accounting export to create a quotation with many line items at once.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin/quotations")}>← Back</Button>
        </div>

        {/* Customer header */}
        <Card>
          <CardHeader><CardTitle className="text-base">Customer details</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div><Label>Customer name *</Label><Input value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="Rahul Kumar" /></div>
            <div><Label>Place *</Label><Input value={partyPlace} onChange={(e) => setPartyPlace(e.target.value)} placeholder="Kalpetta" /></div>
            <div><Label>Phone</Label><Input value={partyPhone} onChange={(e) => setPartyPhone(e.target.value)} placeholder="+91…" /></div>
          </CardContent>
        </Card>

        {/* Sample download */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileDown className="h-4 w-4" /> Download sample format</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadExcel}>Excel (.xlsx)</Button>
            <Button variant="outline" size="sm" onClick={downloadCsv}>CSV</Button>
            <Button variant="outline" size="sm" onClick={downloadWord}>Word (.doc)</Button>
            <Button variant="outline" size="sm" onClick={downloadPdf}>PDF (print)</Button>
          </CardContent>
        </Card>

        {/* Inputs */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Upload file</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.docx,.pdf"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
              <Button onClick={() => fileRef.current?.click()} disabled={parsing} variant="secondary" className="w-full">
                {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Choose .xlsx / .csv / .docx / .pdf
              </Button>
              <p className="text-xs text-muted-foreground">PDF and Word are extracted with AI; structured Excel/CSV parses instantly.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardPaste className="h-4 w-4" /> Copy &amp; paste</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Textarea rows={5} value={pasted} onChange={(e) => setPasted(e.target.value)}
                placeholder="Paste from Tally / Excel / accounting software (tab- or comma-separated)…" />
              <Button onClick={handlePaste} disabled={parsing || !pasted.trim()} className="w-full">
                {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Parse pasted text
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Image upload */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Item images (optional)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <input ref={imgRef} type="file" accept="image/*" multiple
              onChange={(e) => handleImages(e.target.files)} className="hidden" />
            <Button onClick={() => imgRef.current?.click()} variant="outline" disabled={rows.length === 0}>
              <ImageIcon className="mr-2 h-4 w-4" /> Upload images (auto-match by filename)
            </Button>
            <p className="text-xs text-muted-foreground">
              We try to match by the "Image File Name" column or the description. Unmatched files fill empty rows in order.
            </p>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Live preview ({rows.length} items)</CardTitle>
            <div className="text-sm font-semibold">Subtotal: ₹{total.toLocaleString("en-IN")}</div>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No items yet. Upload a file or paste data above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-16">Image</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-20">Qty</TableHead>
                      <TableHead className="w-36">Measurement</TableHead>
                      <TableHead className="w-28">Unit price</TableHead>
                      <TableHead className="w-32">Type</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          {r.image_preview ? (
                            <img src={r.image_preview} alt="" className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-muted-foreground">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell><Input value={r.description} onChange={(e) => updateRow(r.id, { description: e.target.value })} /></TableCell>
                        <TableCell><Input type="number" min={1} value={r.quantity} onChange={(e) => updateRow(r.id, { quantity: Math.max(Number(e.target.value) || 1, 1) })} /></TableCell>
                        <TableCell><Input value={r.measurement} onChange={(e) => updateRow(r.id, { measurement: e.target.value })} /></TableCell>
                        <TableCell><Input type="number" min={0} value={r.unit_price} onChange={(e) => updateRow(r.id, { unit_price: Number(e.target.value) || 0 })} /></TableCell>
                        <TableCell>
                          <Select value={r.fulfillment_route} onValueChange={(v: "ready_stock" | "custom") => updateRow(r.id, { fulfillment_route: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ready_stock">Ready stock</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeRow(r.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur">
          <Button variant="outline" onClick={() => setRows([])} disabled={rows.length === 0 || saving}>Clear all</Button>
          <Button onClick={approveAll} disabled={rows.length === 0 || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Approve all &amp; create quotation
          </Button>
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminQuotationBulkCreate;