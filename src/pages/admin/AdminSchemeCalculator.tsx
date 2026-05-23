import { useEffect, useMemo, useRef, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Trash2, Upload, Save, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SchemePartyNotesButton } from "@/components/admin/SchemePartyNotesButton";

type Row = {
  id: string;
  item: string;
  qty: number;
  price: number;
  amountWithTax: number;
  mrp: number;
};

type SchemeKind = "company" | "own" | "slab" | "bogo" | "percent" | "cashback" | "custom";
type Period = "monthly" | "quarterly" | "yearly";

type Party = {
  id: string;
  name: string;
  phone: string | null;
  place: string | null;
  address: string | null;
  gst_number: string | null;
  category: string | null;
  notes: string | null;
};

type SchemeRow = {
  id: string;
  name: string;
  kind: SchemeKind;
  period: Period;
  config: any;
  is_active: boolean;
  notes: string | null;
};

const newRow = (): Row => ({
  id: crypto.randomUUID(),
  item: "",
  qty: 1,
  price: 0,
  amountWithTax: 0,
  mrp: 0,
});

const fmt = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "0";

const SCHEME_LABEL: Record<SchemeKind, string> = {
  company: "Company (1 free / N qty)",
  own: "Own (target margin %)",
  slab: "Slab (tiered free items)",
  bogo: "Buy X Get Y",
  percent: "% Discount on total",
  cashback: "Cashback on target",
  custom: "Custom (per-product free qty)",
};

const defaultConfig = (kind: SchemeKind): any => {
  switch (kind) {
    case "company": return { everyQty: 10 };
    case "own": return { targetMargin: 15 };
    case "slab": return { slabs: [{ minQty: 10, free: 1 }, { minQty: 25, free: 3 }, { minQty: 50, free: 7 }] };
    case "bogo": return { buyQty: 2, getQty: 1 };
    case "percent": return { percent: 5 };
    case "cashback": return { minAmount: 50000, cashback: 2000 };
    case "custom": return { groups: [{ name: "Group 1", patterns: "", slabs: [{ minQty: 20, free: 3 }], freeProduct: "" }] };
  }
};

function computeFreeReport(scheme: { kind: SchemeKind; config: any }, rows: Row[]) {
  const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
  const totalMrp = rows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
  const live = rows.filter((r) => r.item && r.qty > 0);
  const { kind, config } = scheme;

  if (kind === "company") {
    const per = Math.max(1, Number(config?.everyQty) || 10);
    const rep = live.map((r) => ({ item: r.item, qty: r.qty, free: Math.floor(r.qty / per), note: `1 free per ${per} qty` }));
    return { rep, summary: `Total free items: ${rep.reduce((s, x) => s + x.free, 0)}` };
  }
  if (kind === "own") {
    const target = (totalAmount * (Number(config?.targetMargin) || 0)) / 100;
    const totalMargin = rows.reduce((s, r) => s + Math.max(0, (Number(r.mrp) || 0) * (Number(r.qty) || 0) - (Number(r.amountWithTax) || 0)), 0);
    const budget = Math.max(0, totalMargin - target);
    const rep = live.map((r) => {
      const unit = Number(r.price) || 0;
      const free = unit > 0 ? Math.floor(budget / unit / Math.max(1, live.length)) : 0;
      return { item: r.item, qty: r.qty, free, note: `Within ${config?.targetMargin || 0}% target margin` };
    });
    return { rep, summary: `Free-item budget: ₹${fmt(budget)}` };
  }
  if (kind === "slab") {
    const slabs = (config?.slabs || []).slice().sort((a: any, b: any) => Number(a.minQty) - Number(b.minQty));
    const rep = live.map((r) => {
      let free = 0;
      for (const s of slabs) if (r.qty >= Number(s.minQty)) free = Number(s.free);
      const matched = slabs.find((s: any) => r.qty >= Number(s.minQty) && r.qty < (slabs[slabs.indexOf(s) + 1]?.minQty ?? Infinity));
      return { item: r.item, qty: r.qty, free, note: matched ? `Slab ≥ ${matched.minQty} → ${matched.free}` : "Below first slab" };
    });
    return { rep, summary: `Total free items: ${rep.reduce((s, x) => s + x.free, 0)}` };
  }
  if (kind === "bogo") {
    const buy = Math.max(1, Number(config?.buyQty) || 1);
    const get = Math.max(0, Number(config?.getQty) || 0);
    const rep = live.map((r) => ({ item: r.item, qty: r.qty, free: Math.floor(r.qty / buy) * get, note: `Buy ${buy} Get ${get}` }));
    return { rep, summary: `Total free items: ${rep.reduce((s, x) => s + x.free, 0)}` };
  }
  if (kind === "percent") {
    const pct = Number(config?.percent) || 0;
    const disc = (totalAmount * pct) / 100;
    return {
      rep: [{ item: "All items", qty: totalQty, free: 0, note: `${pct}% off → ₹${fmt(disc)} discount` }],
      summary: `Discount: ₹${fmt(disc)} · Payable: ₹${fmt(totalAmount - disc)}`,
    };
  }
  if (kind === "cashback") {
    const min = Number(config?.minAmount) || 0;
    const cb = Number(config?.cashback) || 0;
    const earned = totalAmount >= min ? cb : 0;
    return {
      rep: [{ item: "All items", qty: totalQty, free: 0, note: earned > 0 ? `Earned ₹${fmt(cb)} (≥ ₹${fmt(min)})` : `Need ₹${fmt(min - totalAmount)} more for cashback` }],
      summary: `Cashback: ₹${fmt(earned)}`,
    };
  }
  if (kind === "custom") {
    const groups: any[] = config?.groups || [];
    const rep: any[] = [];
    let totalFree = 0;
    for (const g of groups) {
      const patterns: string[] = String(g.patterns || "")
        .split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (!patterns.length) continue;
      const matchedRows = live.filter((r) => {
        const n = (r.item || "").toLowerCase();
        return patterns.some((p) => n.includes(p));
      });
      const groupQty = matchedRows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
      const slabs = (g.slabs || []).slice().sort((a: any, b: any) => Number(a.minQty) - Number(b.minQty));
      let free = 0;
      let matchedSlab: any = null;
      for (const s of slabs) if (groupQty >= Number(s.minQty)) { free = Number(s.free) || 0; matchedSlab = s; }
      totalFree += free;
      const freeProd = String(g.freeProduct || "").trim() || (matchedRows[0]?.item ?? "—");
      const matchedNames = matchedRows.map((r) => `${r.item} (${r.qty})`).join(", ") || "no items matched";
      rep.push({
        item: `${g.name || "Group"} → ${freeProd}`,
        qty: groupQty,
        free,
        note: matchedSlab
          ? `Total ${groupQty} qty [${matchedNames}] → ≥ ${matchedSlab.minQty} → ${matchedSlab.free} free`
          : `Total ${groupQty} qty [${matchedNames}] — below first slab`,
      });
    }
    return { rep, summary: `Total free items: ${totalFree}` };
  }
  return { rep: [], summary: "" };
  void totalMrp;
}

/* -------------------- Component -------------------- */

const AdminSchemeCalculator = () => {
  const [tab, setTab] = useState<"calc" | "parties" | "schemes">("calc");

  // ===== Calculator state =====
  const [activeScheme, setActiveScheme] = useState<{ id?: string; name: string; kind: SchemeKind; period: Period; config: any }>({
    name: "Ad-hoc",
    kind: "company",
    period: "monthly",
    config: defaultConfig("company"),
  });
  const [savedSchemes, setSavedSchemes] = useState<SchemeRow[]>([]);

  const [partyId, setPartyId] = useState<string | null>(null);
  const [partyLabel, setPartyLabel] = useState("");
  const [parties, setParties] = useState<Party[]>([]);
  const [partyQuery, setPartyQuery] = useState("");

  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 5 }, newRow));
  const [autofill, setAutofill] = useState("");
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => {
    const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const totalAmount = rows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
    const totalMrp = rows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
    return { totalQty, totalAmount, totalMrp };
  }, [rows]);

  const report = useMemo(() => computeFreeReport(activeScheme, rows), [activeScheme, rows]);

  /* ----- Load parties + schemes ----- */
  useEffect(() => {
    (async () => {
      const [{ data: ps }, { data: ss }] = await Promise.all([
        supabase.from("scheme_parties").select("*").order("name").limit(500),
        supabase.from("scheme_rules").select("*").order("created_at", { ascending: false }).limit(200),
      ]);
      setParties((ps as any) || []);
      setSavedSchemes((ss as any) || []);
    })();
  }, []);

  const filteredParties = useMemo(() => {
    const q = partyQuery.trim().toLowerCase();
    if (!q) return parties.slice(0, 30);
    return parties.filter((p) =>
      [p.name, p.phone, p.place].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    ).slice(0, 50);
  }, [parties, partyQuery]);

  /* ----- Row helpers ----- */
  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, newRow()]);
  const addMany = (n: number) => setRows((rs) => [...rs, ...Array.from({ length: n }, newRow)]);
  const removeRow = (id: string) => setRows((rs) => (rs.length === 1 ? [newRow()] : rs.filter((r) => r.id !== id)));
  const clearRows = () => setRows([newRow()]);

  /* ----- Auto-fill ----- */
  const parseText = async (text: string) => {
    if (!text.trim()) return;
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-extract-items", { body: { text, kind: "quotation" } });
      if (error) throw error;
      const items: any[] = data?.items || [];
      if (!items.length) { toast({ title: "No rows found" }); return; }
      const parsed: Row[] = items.map((it) => {
        const qty = Number(it.quantity) || 1;
        const price = Number(it.unit_price) || 0;
        return { id: crypto.randomUUID(), item: [it.description, it.measurement].filter(Boolean).join(" — "), qty, price, amountWithTax: price * qty, mrp: price };
      });
      setRows((rs) => {
        const allEmpty = rs.every((r) => !r.item);
        return allEmpty ? parsed : [...rs, ...parsed];
      });
      toast({ title: `Added ${parsed.length} rows` });
      setAutofill("");
    } catch (e: any) {
      toast({ title: "Auto-fill failed", description: e?.message || String(e), variant: "destructive" });
    } finally { setParsing(false); }
  };

  const onUpload = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      let text = "";
      if (ext === "txt" || ext === "csv") text = await file.text();
      else if (ext === "xlsx" || ext === "xls") {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        text = wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n");
      } else { toast({ title: "Paste text instead", description: "For PDF/Word, paste text below." }); return; }
      await parseText(text);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message || String(e), variant: "destructive" });
    }
  };

  /* ----- Apply / Save scheme ----- */
  const applySavedScheme = (id: string) => {
    const s = savedSchemes.find((x) => x.id === id);
    if (!s) return;
    setActiveScheme({ id: s.id, name: s.name, kind: s.kind, period: s.period, config: s.config || defaultConfig(s.kind) });
    toast({ title: `Applied scheme: ${s.name}` });
  };

  const saveCurrentSchemeAs = async (name: string) => {
    if (!name.trim()) return;
    const { data, error } = await supabase.from("scheme_rules").insert({
      name: name.trim(), kind: activeScheme.kind, period: activeScheme.period, config: activeScheme.config,
    }).select().single();
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    setSavedSchemes((arr) => [data as any, ...arr]);
    setActiveScheme((s) => ({ ...s, id: (data as any).id, name: (data as any).name }));
    toast({ title: `Saved scheme: ${name}` });
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        <h1 className="font-display text-2xl">Scheme Calculator</h1>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="calc">Calculator</TabsTrigger>
            <TabsTrigger value="parties">Parties ({parties.length})</TabsTrigger>
            <TabsTrigger value="schemes">Schemes ({savedSchemes.length})</TabsTrigger>
          </TabsList>

          {/* ========== CALCULATOR ========== */}
          <TabsContent value="calc" className="space-y-6 pt-4">
            {/* Scheme picker + editor */}
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs">Saved scheme</Label>
                  <Select value={activeScheme.id || ""} onValueChange={applySavedScheme}>
                    <SelectTrigger><SelectValue placeholder="Pick a saved scheme…" /></SelectTrigger>
                    <SelectContent>
                      {savedSchemes.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No saved schemes yet</div>}
                      {savedSchemes.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} · {SCHEME_LABEL[s.kind]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Scheme type</Label>
                  <Select value={activeScheme.kind} onValueChange={(v) => setActiveScheme((s) => ({ ...s, id: undefined, kind: v as SchemeKind, config: defaultConfig(v as SchemeKind) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SCHEME_LABEL) as SchemeKind[]).map((k) => (
                        <SelectItem key={k} value={k}>{SCHEME_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Period</Label>
                  <Select value={activeScheme.period} onValueChange={(v) => setActiveScheme((s) => ({ ...s, period: v as Period }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <SchemeConfigEditor scheme={activeScheme} onChange={(config) => setActiveScheme((s) => ({ ...s, config }))} />

              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">Save as scheme name</Label>
                  <Input value={activeScheme.name} onChange={(e) => setActiveScheme((s) => ({ ...s, name: e.target.value }))} />
                </div>
                <Button onClick={() => saveCurrentSchemeAs(activeScheme.name)} variant="outline">
                  <Save className="h-4 w-4" /> Save scheme
                </Button>
              </div>
            </div>

            {/* Party picker */}
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <Label className="text-xs">Party / Client</Label>
              <Input value={partyLabel || partyQuery} placeholder="Search party (name / phone / place)…"
                onChange={(e) => { setPartyQuery(e.target.value); setPartyLabel(""); setPartyId(null); }} />
              {partyQuery && !partyLabel && (
                <div className="max-h-56 overflow-auto rounded border bg-popover">
                  {filteredParties.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground">No matching parties. Use the “Parties” tab to add one.</div>
                  )}
                  {filteredParties.map((p) => (
                    <button key={p.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => { setPartyId(p.id); setPartyLabel(`${p.name}${p.place ? ` — ${p.place}` : ""}${p.phone ? ` · ${p.phone}` : ""}`); setPartyQuery(""); }}>
                      {p.name}{p.place ? ` — ${p.place}` : ""}{p.phone ? ` · ${p.phone}` : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Auto-fill */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">Auto-fill (paste / upload)</h2>
                <div className="flex gap-2">
                  <input ref={fileRef} type="file" className="hidden" accept=".csv,.txt,.xlsx,.xls"
                    onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Upload</Button>
                  <Button size="sm" onClick={() => parseText(autofill)} disabled={parsing || !autofill.trim()}>
                    {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Extract
                  </Button>
                </div>
              </div>
              <Textarea rows={3} placeholder="Paste lines like:  Sofa 3-seater  2  12500"
                value={autofill} onChange={(e) => setAutofill(e.target.value)} />
            </div>

            {/* Grid */}
            <div className="rounded-lg border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                <h2 className="font-medium">Items</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-4 w-4" /> Add row</Button>
                  <Button size="sm" variant="outline" onClick={() => addMany(10)}>+ 10 rows</Button>
                  <Button size="sm" variant="ghost" onClick={clearRows}>Clear</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Sl</TableHead>
                      <TableHead>Item & Size</TableHead>
                      <TableHead className="w-20">Qty</TableHead>
                      <TableHead className="w-28">Price</TableHead>
                      <TableHead className="w-32">Amount + Tax</TableHead>
                      <TableHead className="w-28">MRP</TableHead>
                      <TableHead className="w-20">Margin %</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => {
                      const mrpTotal = (Number(r.mrp) || 0) * (Number(r.qty) || 0);
                      const margin = mrpTotal > 0 ? ((mrpTotal - (Number(r.amountWithTax) || 0)) / mrpTotal) * 100 : 0;
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell><Input value={r.item} onChange={(e) => updateRow(r.id, { item: e.target.value })} placeholder="e.g. Sofa 3-seater 180x90" /></TableCell>
                          <TableCell><Input type="number" value={r.qty} onChange={(e) => updateRow(r.id, { qty: Number(e.target.value) || 0 })} /></TableCell>
                          <TableCell><Input type="number" value={r.price} onChange={(e) => updateRow(r.id, { price: Number(e.target.value) || 0 })} /></TableCell>
                          <TableCell><Input type="number" value={r.amountWithTax} onChange={(e) => updateRow(r.id, { amountWithTax: Number(e.target.value) || 0 })} /></TableCell>
                          <TableCell><Input type="number" value={r.mrp} onChange={(e) => updateRow(r.id, { mrp: Number(e.target.value) || 0 })} /></TableCell>
                          <TableCell className="text-sm font-medium">{margin.toFixed(1)}%</TableCell>
                          <TableCell><Button size="icon" variant="ghost" onClick={() => removeRow(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap gap-6 border-t p-3 text-sm">
                <div>Total Qty: <span className="font-semibold">{totals.totalQty}</span></div>
                <div>Total Amount: <span className="font-semibold">₹{fmt(totals.totalAmount)}</span></div>
                <div>Total MRP: <span className="font-semibold">₹{fmt(totals.totalMrp)}</span></div>
              </div>
            </div>

            {/* Notes / attachments — floating window like quotation notes */}
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-medium">Notes & attachments</h2>
                  <p className="text-xs text-muted-foreground">
                    {partyLabel
                      ? `Saved against: ${partyLabel}`
                      : "Pick a party above to attach photos / PDFs of handwritten scheme pages."}
                  </p>
                </div>
                <SchemePartyNotesButton partyId={partyId} />
              </div>
            </div>

            {/* Report */}
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-medium">Scheme Report</h2>
                <span className="text-xs text-muted-foreground">
                  {SCHEME_LABEL[activeScheme.kind]} · {activeScheme.period} · {partyLabel || "no party"}
                </span>
              </div>
              {report.rep.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add items to see eligibility.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-28">Free</TableHead>
                      <TableHead>Rule</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rep.map((f, i) => (
                      <TableRow key={i}>
                        <TableCell>{f.item}</TableCell>
                        <TableCell>{f.qty}</TableCell>
                        <TableCell className="font-semibold text-primary">{f.free}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.note}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-3 rounded bg-muted/50 p-3 text-sm">{report.summary}</div>
            </div>
          </TabsContent>

          {/* ========== PARTIES ========== */}
          <TabsContent value="parties" className="pt-4">
            <PartiesTab parties={parties} setParties={setParties} />
          </TabsContent>

          {/* ========== SCHEMES ========== */}
          <TabsContent value="schemes" className="pt-4">
            <SchemesTab schemes={savedSchemes} setSchemes={setSavedSchemes} onApply={(s) => { applySavedScheme(s.id); setTab("calc"); }} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  );
};

/* -------------------- Scheme config editor -------------------- */

function SchemeConfigEditor({ scheme, onChange }: { scheme: { kind: SchemeKind; config: any }; onChange: (c: any) => void }) {
  const { kind, config } = scheme;
  const set = (patch: any) => onChange({ ...config, ...patch });

  if (kind === "company") return (
    <div><Label className="text-xs">1 free per N qty</Label>
      <Input type="number" min={1} value={config.everyQty} onChange={(e) => set({ everyQty: Number(e.target.value) || 1 })} className="w-32" />
    </div>
  );
  if (kind === "own") return (
    <div><Label className="text-xs">Target margin %</Label>
      <Input type="number" min={0} value={config.targetMargin} onChange={(e) => set({ targetMargin: Number(e.target.value) || 0 })} className="w-32" />
    </div>
  );
  if (kind === "slab") {
    const slabs: any[] = config.slabs || [];
    return (
      <div className="space-y-2">
        <Label className="text-xs">Slabs (min qty → free items)</Label>
        {slabs.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input type="number" value={s.minQty} onChange={(e) => { const arr = slabs.slice(); arr[i] = { ...s, minQty: Number(e.target.value) || 0 }; set({ slabs: arr }); }} className="w-28" placeholder="Min qty" />
            <span className="text-muted-foreground">→</span>
            <Input type="number" value={s.free} onChange={(e) => { const arr = slabs.slice(); arr[i] = { ...s, free: Number(e.target.value) || 0 }; set({ slabs: arr }); }} className="w-28" placeholder="Free" />
            <Button size="icon" variant="ghost" onClick={() => set({ slabs: slabs.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => set({ slabs: [...slabs, { minQty: 0, free: 0 }] })}><Plus className="h-4 w-4" /> Add slab</Button>
      </div>
    );
  }
  if (kind === "bogo") return (
    <div className="flex gap-3">
      <div><Label className="text-xs">Buy qty</Label><Input type="number" value={config.buyQty} onChange={(e) => set({ buyQty: Number(e.target.value) || 1 })} className="w-24" /></div>
      <div><Label className="text-xs">Get free</Label><Input type="number" value={config.getQty} onChange={(e) => set({ getQty: Number(e.target.value) || 0 })} className="w-24" /></div>
    </div>
  );
  if (kind === "percent") return (
    <div><Label className="text-xs">Discount %</Label>
      <Input type="number" value={config.percent} onChange={(e) => set({ percent: Number(e.target.value) || 0 })} className="w-32" />
    </div>
  );
  if (kind === "cashback") return (
    <div className="flex gap-3">
      <div><Label className="text-xs">Min total ₹</Label><Input type="number" value={config.minAmount} onChange={(e) => set({ minAmount: Number(e.target.value) || 0 })} className="w-32" /></div>
      <div><Label className="text-xs">Cashback ₹</Label><Input type="number" value={config.cashback} onChange={(e) => set({ cashback: Number(e.target.value) || 0 })} className="w-32" /></div>
    </div>
  );
  if (kind === "custom") {
    const rules: any[] = config.rules || [];
    const update = (i: number, patch: any) => { const arr = rules.slice(); arr[i] = { ...arr[i], ...patch }; set({ rules: arr }); };
    return (
      <div className="space-y-2">
        <Label className="text-xs">Per-product rules — matched against item name (case-insensitive substring)</Label>
        <div className="grid grid-cols-[1fr_90px_90px_40px] gap-2 text-xs text-muted-foreground">
          <div>Product (name contains)</div><div>Buy qty</div><div>Free qty</div><div></div>
        </div>
        {rules.map((u, i) => (
          <div key={i} className="grid grid-cols-[1fr_90px_90px_40px] gap-2">
            <Input value={u.product} onChange={(e) => update(i, { product: e.target.value })} placeholder="e.g. Sofa" />
            <Input type="number" value={u.buyQty} onChange={(e) => update(i, { buyQty: Number(e.target.value) || 1 })} />
            <Input type="number" value={u.freeQty} onChange={(e) => update(i, { freeQty: Number(e.target.value) || 0 })} />
            <Button size="icon" variant="ghost" onClick={() => set({ rules: rules.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => set({ rules: [...rules, { product: "", buyQty: 10, freeQty: 1 }] })}><Plus className="h-4 w-4" /> Add product rule</Button>
      </div>
    );
  }
  return null;
}

/* -------------------- Parties tab -------------------- */

function PartiesTab({ parties, setParties }: { parties: Party[]; setParties: (p: Party[]) => void }) {
  const empty = { name: "", phone: "", place: "", address: "", gst_number: "", category: "", notes: "" };
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const save = async () => {
    if (!form.name?.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (editingId) {
      const { data, error } = await supabase.from("scheme_parties").update(form).eq("id", editingId).select().single();
      if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
      setParties(parties.map((p) => (p.id === editingId ? (data as any) : p)));
      toast({ title: "Party updated" });
    } else {
      const { data, error } = await supabase.from("scheme_parties").insert(form).select().single();
      if (error) return toast({ title: "Create failed", description: error.message, variant: "destructive" });
      setParties([data as any, ...parties]);
      toast({ title: "Party created" });
    }
    setForm(empty); setEditingId(null);
  };

  const edit = (p: Party) => { setEditingId(p.id); setForm({ name: p.name, phone: p.phone || "", place: p.place || "", address: p.address || "", gst_number: p.gst_number || "", category: p.category || "", notes: p.notes || "" }); };
  const remove = async (id: string) => {
    if (!confirm("Delete this party?")) return;
    const { error } = await supabase.from("scheme_parties").delete().eq("id", id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    setParties(parties.filter((p) => p.id !== id));
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return parties;
    return parties.filter((p) => [p.name, p.phone, p.place, p.category].filter(Boolean).some((v) => String(v).toLowerCase().includes(s)));
  }, [parties, q]);

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-medium">{editingId ? "Edit party" : "Add party"}</h3>
        <div className="space-y-2">
          <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label className="text-xs">Place</Label><Input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">Address</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">GST number</Label><Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} /></div>
            <div><Label className="text-xs">Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Dealer / Retail / VIP" /></div>
          </div>
          <div><Label className="text-xs">Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1"><Save className="h-4 w-4" /> {editingId ? "Update" : "Save"}</Button>
            {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(empty); }}>Cancel</Button>}
          </div>
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">Saved parties</h3>
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Place</TableHead><TableHead>Phone</TableHead><TableHead>Category</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No parties yet</TableCell></TableRow>}
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.place}</TableCell>
                  <TableCell>{p.phone}</TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => edit(p)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Schemes tab -------------------- */

function SchemesTab({ schemes, setSchemes, onApply }: { schemes: SchemeRow[]; setSchemes: (s: SchemeRow[]) => void; onApply: (s: SchemeRow) => void }) {
  const [form, setForm] = useState<{ name: string; kind: SchemeKind; period: Period; config: any; notes: string }>(
    { name: "", kind: "company", period: "monthly", config: defaultConfig("company"), notes: "" }
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  const save = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (editingId) {
      const { data, error } = await supabase.from("scheme_rules").update(form).eq("id", editingId).select().single();
      if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
      setSchemes(schemes.map((s) => (s.id === editingId ? (data as any) : s)));
    } else {
      const { data, error } = await supabase.from("scheme_rules").insert(form).select().single();
      if (error) return toast({ title: "Create failed", description: error.message, variant: "destructive" });
      setSchemes([data as any, ...schemes]);
    }
    setForm({ name: "", kind: "company", period: "monthly", config: defaultConfig("company"), notes: "" });
    setEditingId(null);
    toast({ title: "Saved" });
  };

  const edit = (s: SchemeRow) => {
    setEditingId(s.id);
    setForm({ name: s.name, kind: s.kind, period: s.period, config: s.config || defaultConfig(s.kind), notes: s.notes || "" });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this scheme?")) return;
    const { error } = await supabase.from("scheme_rules").delete().eq("id", id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    setSchemes(schemes.filter((s) => s.id !== id));
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-medium">{editingId ? "Edit scheme" : "New scheme"}</h3>
        <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diwali Dealer Slab" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as SchemeKind, config: defaultConfig(v as SchemeKind) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(SCHEME_LABEL) as SchemeKind[]).map((k) => (<SelectItem key={k} value={k}>{SCHEME_LABEL[k]}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Period</Label>
            <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v as Period })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <SchemeConfigEditor scheme={{ kind: form.kind, config: form.config }} onChange={(config) => setForm({ ...form, config })} />
        <div><Label className="text-xs">Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="flex gap-2">
          <Button onClick={save} className="flex-1"><Save className="h-4 w-4" /> {editingId ? "Update" : "Save scheme"}</Button>
          {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm({ name: "", kind: "company", period: "monthly", config: defaultConfig("company"), notes: "" }); }}>Cancel</Button>}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 font-medium">Saved schemes</h3>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Period</TableHead><TableHead className="w-40"></TableHead></TableRow></TableHeader>
          <TableBody>
            {schemes.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No schemes yet</TableCell></TableRow>}
            {schemes.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{SCHEME_LABEL[s.kind]}</TableCell>
                <TableCell className="capitalize">{s.period}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => onApply(s)}>Apply</Button>
                    <Button size="icon" variant="ghost" onClick={() => edit(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default AdminSchemeCalculator;