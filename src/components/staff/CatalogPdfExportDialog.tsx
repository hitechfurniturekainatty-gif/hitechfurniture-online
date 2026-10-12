import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { FileDown, Loader2 } from "lucide-react";
import { locationLabel, type FloorEntry } from "@/lib/staffFloorCatalog";
import { GROUP_BY_OPTIONS, groupByLabel, groupEntries, thenByOptions, fileSlug, type PdfGroupBy, type PdfLookup } from "@/lib/catalogPdfGrouping";
import type { CatalogPdfItem } from "@/lib/catalogPdf";

type Scope = "filtered" | "item" | "all";
type Output = "single" | "separate";

const QUICK: { id: PdfGroupBy; label: string }[] = [
  { id: "floor", label: "Floor wise" },
  { id: "section", label: "Section wise" },
  { id: "category", label: "Category wise" },
  { id: "sub", label: "Sub-category wise" },
];

export function CatalogPdfExportDialog({
  open, onOpenChange, allRows, filteredRows, lookup, filters, filterLines, scopeLabel, loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  allRows: FloorEntry[];
  filteredRows: FloorEntry[];
  lookup: PdfLookup;
  /** The same Shop / Floor / Section / Category / Sub-category / Stock pickers used on the page. */
  filters: ReactNode;
  filterLines: string[];
  scopeLabel: string;
  loading: boolean;
}) {
  const [scope, setScope] = useState<Scope>("filtered");
  const [itemSearch, setItemSearch] = useState("");
  const [groupBy, setGroupBy] = useState<PdfGroupBy>("section");
  const [thenBy, setThenBy] = useState<PdfGroupBy>("none");
  const [output, setOutput] = useState<Output>("single");
  const [layout, setLayout] = useState<"large" | "compact">("large");
  const [copy, setCopy] = useState<"staff" | "customer">("staff");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  useEffect(() => { if (!thenByOptions(groupBy).includes(thenBy)) setThenBy("none"); }, [groupBy, thenBy]);
  useEffect(() => { if (groupBy === "none") setOutput("single"); }, [groupBy]);

  const rows = useMemo(() => {
    if (scope === "all") return allRows;
    if (scope === "item") {
      const q = itemSearch.trim().toLowerCase();
      if (!q) return [];
      return filteredRows.filter(e => [e.product.product_name, e.product.product_code, e.variant?.color_name].filter(Boolean).join(" ").toLowerCase().includes(q));
    }
    return filteredRows;
  }, [scope, itemSearch, allRows, filteredRows]);

  const groupsPreview = useMemo(() => groupEntries(rows, groupBy, lookup, () => 0, thenBy), [rows, groupBy, thenBy, lookup]);

  const download = async () => {
    if (!rows.length) {
      toast({ title: "No products to download", description: "Change the filters and try again." });
      return;
    }
    setBusy(true);
    setProgress("Preparing photos…");
    try {
      const [{ generateGroupedCatalogPdf, prepareCatalogImages }, { downloadBlob }] = await Promise.all([
        import("@/lib/catalogPdf"), import("@/lib/downloadBlob"),
      ]);
      const locById = new Map(lookup.locations.map(l => [l.id, l]));
      const toItem = (e: FloorEntry): CatalogPdfItem => ({
        product_name: e.product.product_name + (e.variant ? " - " + e.variant.color_name : ""),
        product_code: e.product.product_code,
        mrp: Number(e.product.mrp ?? 0),
        offer_price: null,
        material: e.product.material ?? null,
        dimensions: e.product.dimensions ?? null,
        cover_image: e.cover,
        stock_quantity: e.stock,
        stock_status: e.stock > 0 && e.product.stock_status !== "out_of_stock" ? "in_stock" : "out_of_stock",
        location_label: locationLabel(e.location_id ? locById.get(e.location_id) : undefined),
      });
      const groups = groupEntries(rows, groupBy, lookup, toItem, thenBy);
      const { map, failed } = await prepareCatalogImages(rows.map(e => e.cover));
      const staff = copy === "staff";
      const baseTitle = scope === "all" ? "Complete Showroom Catalog" : groupBy === "none" ? "Product Catalog" : `${groupByLabel(groupBy).replace(/ wise$/i, "")} wise Catalog`;
      const lines = scope === "all" ? ["All locations · all stock"] : scope === "item" ? [`Search: ${itemSearch.trim()}`] : filterLines;
      const opts = (title: string, subtitle: string) => ({
        title, subtitle,
        filterLines: lines,
        layout,
        showLocation: staff,
        showStock: staff,
      });
      const stamp = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const subtitle = `HITECH Furniture & Interiors · ${stamp}`;

      if (output === "separate" && groups.length > 1) {
        const { buildStoreZip } = await import("@/lib/storeZip");
        const files: { name: string; data: Uint8Array }[] = [];
        const used = new Set<string>();
        for (let i = 0; i < groups.length; i++) {
          const g = groups[i];
          setProgress(`Making PDF ${i + 1} of ${groups.length}…`);
          const blob = await generateGroupedCatalogPdf([g], opts(g.title, subtitle), map);
          let name = `${String(i + 1).padStart(2, "0")}-${fileSlug(g.title)}.pdf`;
          while (used.has(name)) name = name.replace(/\.pdf$/, "-x.pdf");
          used.add(name);
          files.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
        }
        const zip = buildStoreZip(files);
        downloadBlob(new Blob([zip.buffer as ArrayBuffer], { type: "application/zip" }), `hitech-catalog-${fileSlug(groupByLabel(groupBy))}.zip`);
        toast({ title: `${files.length} PDFs downloaded (ZIP)`, description: `${rows.length} items · one PDF per ${groupByLabel(groupBy).replace(/ wise$/i, "").toLowerCase()}${failed ? ` · ${failed} photo(s) could not load` : ""}` });
      } else {
        setProgress("Making PDF…");
        const title = groups.length === 1 && groupBy !== "none" ? groups[0].title : baseTitle;
        const blob = await generateGroupedCatalogPdf(groups, opts(title, subtitle), map);
        const slug = scope === "all" ? "complete" : fileSlug([groups.length === 1 && groupBy !== "none" ? groups[0].title : scopeLabel, groupBy !== "none" ? groupByLabel(groupBy) : ""].join(" "));
        downloadBlob(blob, `hitech-catalog-${slug}${staff ? "" : "-customer"}.pdf`);
        toast({ title: "PDF downloaded", description: `${rows.length} items${groupBy !== "none" ? ` in ${groups.length} group${groups.length === 1 ? "" : "s"}` : ""}${failed ? ` · ${failed} photo(s) could not load` : ""}` });
      }
      onOpenChange(false);
    } catch (e) {
      toast({ title: "PDF download failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const separateCount = output === "separate" ? groupsPreview.length : 1;

  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-xl overflow-y-auto rounded-2xl p-4 sm:p-6">
        <DialogHeader><DialogTitle>Catalog PDF Download</DialogTitle></DialogHeader>

        <Section title="1. ഏത് സാധനങ്ങൾ">
          <Pick label="Export selection" value={scope} onChange={v => setScope(v as Scope)} options={[
            { id: "filtered", label: "Filters below (shop / floor / section / category / stock)" },
            { id: "item", label: "Individual item(s) by name or code" },
            { id: "all", label: "Complete catalog — everything" },
          ]} />
          {scope === "filtered" && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{filters}</div>}
          {scope === "item" && <div className="space-y-1.5"><Label htmlFor="pdf-item-search">Product name / code / colour</Label><Input id="pdf-item-search" value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Enter item name or code…" /></div>}
        </Section>

        <Section title="2. എങ്ങനെ തിരിക്കണം">
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map(q => (
              <Button key={q.id} type="button" size="sm" variant={groupBy === q.id && thenBy === "none" ? "default" : "outline"} className="h-8 rounded-full" onClick={() => { setGroupBy(q.id); setThenBy("none"); }}>{q.label}</Button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Pick label="Group by" value={groupBy} onChange={v => setGroupBy(v as PdfGroupBy)} options={GROUP_BY_OPTIONS} />
            <Pick label="Then by (inside each group)" value={thenBy} onChange={v => setThenBy(v as PdfGroupBy)} disabled={groupBy === "none"}
              options={thenByOptions(groupBy).map(id => ({ id, label: id === "none" ? "Nothing more" : groupByLabel(id) }))} />
          </div>
        </Section>

        <Section title="3. ഫയൽ">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Pick label="Files" value={output} onChange={v => setOutput(v as Output)} disabled={groupBy === "none"} options={[
              { id: "single", label: "One PDF (with headings)" },
              { id: "separate", label: "Separate PDF per group (ZIP)" },
            ]} />
            <Pick label="Layout" value={layout} onChange={v => setLayout(v as "large" | "compact")} options={[
              { id: "large", label: "Large photos · 6/page" },
              { id: "compact", label: "Compact · 10/page" },
            ]} />
            <Pick label="Copy for" value={copy} onChange={v => setCopy(v as "staff" | "customer")} options={[
              { id: "staff", label: "Staff (location + stock)" },
              { id: "customer", label: "Customer (MRP only)" },
            ]} />
          </div>
        </Section>

        <div className="rounded-xl border bg-stone-50 p-3 text-sm">
          <p className="font-semibold">{scope === "all" ? "All locations" : scope === "item" ? "Search result" : scopeLabel}</p>
          <p className="text-muted-foreground">
            {rows.length} items
            {groupBy !== "none" && rows.length > 0 && <> · {groupsPreview.length} {groupByLabel(groupBy).replace(/ wise$/i, "").toLowerCase()} group{groupsPreview.length === 1 ? "" : "s"}</>}
            {output === "separate" && groupBy !== "none" && separateCount > 1 && <> · {separateCount} PDF files in one ZIP</>}
          </p>
          {groupBy !== "none" && rows.length > 0 && (
            <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
              {groupsPreview.slice(0, 12).map(g => `${g.title} (${g.items.length})`).join(" · ")}{groupsPreview.length > 12 ? " …" : ""}
            </p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">Supplier / cost price is never included. Products keep the showroom display order.</p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => void download()} disabled={busy || loading || !rows.length}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            {busy ? (progress || "Working…") : output === "separate" && separateCount > 1 ? `Download ${separateCount} PDFs` : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div className="space-y-2 rounded-xl border p-3"><p className="text-xs font-semibold uppercase tracking-wide text-stone-600">{title}</p>{children}</div>;
}

function Pick({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; disabled?: boolean }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs text-stone-600">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-10 rounded-xl bg-white" aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
