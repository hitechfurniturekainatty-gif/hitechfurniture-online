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

  // achieved: what's already unlocked. targets: what's left to unlock next slab.
  type Achieved = { item: string; qty: number; free: number; note: string };
  type Target = { item: string; have: number; need: number; gap: number; reward: string; note?: string };

  if (kind === "company") {
    const per = Math.max(1, Number(config?.everyQty) || 10);
    const rep: Achieved[] = live.map((r) => ({ item: r.item, qty: r.qty, free: Math.floor(r.qty / per), note: `1 free per ${per} qty` }));
    const targets: Target[] = live.map((r) => {
      const nextThreshold = (Math.floor(r.qty / per) + 1) * per;
      const gap = nextThreshold - r.qty;
      return { item: r.item, have: r.qty, need: nextThreshold, gap, reward: `+1 free`, note: `Buy ${gap} more for next free unit` };
    });
    return { rep, targets, summary: `Total free items: ${rep.reduce((s, x) => s + x.free, 0)}` };
  }
  if (kind === "own") {
    const target = (totalAmount * (Number(config?.targetMargin) || 0)) / 100;
    const totalMargin = rows.reduce((s, r) => s + Math.max(0, (Number(r.mrp) || 0) * (Number(r.qty) || 0) - (Number(r.amountWithTax) || 0)), 0);
    const budget = Math.max(0, totalMargin - target);
    const rep: Achieved[] = live.map((r) => {
      const unit = Number(r.price) || 0;
      const free = unit > 0 ? Math.floor(budget / unit / Math.max(1, live.length)) : 0;
      return { item: r.item, qty: r.qty, free, note: `Within ${config?.targetMargin || 0}% target margin` };
    });
    return { rep, targets: [], summary: `Free-item budget: ₹${fmt(budget)}` };
  }
  if (kind === "slab") {
    const slabs = (config?.slabs || []).slice().sort((a: any, b: any) => Number(a.minQty) - Number(b.minQty));
    const rep: Achieved[] = live.map((r) => {
      let free = 0;
      for (const s of slabs) if (r.qty >= Number(s.minQty)) free = Number(s.free);
      const matched = slabs.find((s: any) => r.qty >= Number(s.minQty) && r.qty < (slabs[slabs.indexOf(s) + 1]?.minQty ?? Infinity));
      return { item: r.item, qty: r.qty, free, note: matched ? `Slab ≥ ${matched.minQty} → ${matched.free}` : "Below first slab" };
    });
    const targets: Target[] = live.map((r) => {
      const next = slabs.find((s: any) => r.qty < Number(s.minQty));
      if (!next) return { item: r.item, have: r.qty, need: r.qty, gap: 0, reward: "Top slab reached", note: "All slabs unlocked" };
      return { item: r.item, have: r.qty, need: Number(next.minQty), gap: Number(next.minQty) - r.qty, reward: `${next.free} free`, note: `Buy ${Number(next.minQty) - r.qty} more to unlock` };
    }).filter((t) => t.gap > 0);
    return { rep, targets, summary: `Total free items: ${rep.reduce((s, x) => s + x.free, 0)}` };
  }
  if (kind === "bogo") {
    const buy = Math.max(1, Number(config?.buyQty) || 1);
    const get = Math.max(0, Number(config?.getQty) || 0);
    const rep: Achieved[] = live.map((r) => ({ item: r.item, qty: r.qty, free: Math.floor(r.qty / buy) * get, note: `Buy ${buy} Get ${get}` }));
    const targets: Target[] = live.map((r) => {
      const nextThreshold = (Math.floor(r.qty / buy) + 1) * buy;
      const gap = nextThreshold - r.qty;
      return { item: r.item, have: r.qty, need: nextThreshold, gap, reward: `+${get} free`, note: `Buy ${gap} more for next freebie` };
    });
    return { rep, targets, summary: `Total free items: ${rep.reduce((s, x) => s + x.free, 0)}` };
  }
  if (kind === "percent") {
    const pct = Number(config?.percent) || 0;
    const disc = (totalAmount * pct) / 100;
    return {
      rep: [{ item: "All items", qty: totalQty, free: 0, note: `${pct}% off → ₹${fmt(disc)} discount` }],
      targets: [],
      summary: `Discount: ₹${fmt(disc)} · Payable: ₹${fmt(totalAmount - disc)}`,
    };
  }
  if (kind === "cashback") {
    const min = Number(config?.minAmount) || 0;
    const cb = Number(config?.cashback) || 0;
    const earned = totalAmount >= min ? cb : 0;
    const targets: Target[] = earned > 0 ? [] : [{
      item: "Total purchase",
      have: Math.round(totalAmount),
      need: min,
      gap: Math.max(0, min - totalAmount),
      reward: `₹${fmt(cb)} cashback`,
      note: `Spend ₹${fmt(min - totalAmount)} more`,
    }];
    return {
      rep: [{ item: "All items", qty: totalQty, free: 0, note: earned > 0 ? `Earned ₹${fmt(cb)} (≥ ₹${fmt(min)})` : `Need ₹${fmt(min - totalAmount)} more for cashback` }],
      targets,
      summary: `Cashback: ₹${fmt(earned)}`,
    };
  }
  if (kind === "custom") {
    const groups: any[] = config?.groups || [];
    const rep: Achieved[] = [];
    const targets: Target[] = [];
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
      const nextSlab = slabs.find((s: any) => groupQty < Number(s.minQty));
      if (nextSlab) {
        const gap = Number(nextSlab.minQty) - groupQty;
        targets.push({
          item: `${g.name || "Group"} → ${freeProd}`,
          have: groupQty,
          need: Number(nextSlab.minQty),
          gap,
          reward: `${nextSlab.free} free`,
          note: `Buy ${gap} more ${g.name || "units"} to unlock`,
        });
      }
    }
    return { rep, targets, summary: `Total free items: ${totalFree}` };
  }
  return { rep: [], targets: [], summary: "" };
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
            {/* Invoice-style frame wrapping the whole calculator */}
            <div className="rounded-xl border-2 border-foreground/20 bg-card shadow-md overflow-hidden">
              {/* Invoice header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-foreground/20 bg-muted/40 px-4 py-3">
                <div>
                  <h2 className="font-display text-xl leading-tight">Scheme Worksheet</h2>
                  <p className="text-xs text-muted-foreground">
                    {activeScheme.name} · {SCHEME_LABEL[activeScheme.kind]} · {activeScheme.period}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>Date: {new Date().toLocaleDateString("en-IN")}</div>
                  <div>Party: <span className="font-medium text-foreground">{partyLabel || "—"}</span></div>
                </div>
              </div>

              <div className="p-4 space-y-5">

            {/* Scheme picker + editor */}
            <section className="rounded-lg border bg-background/40 p-4 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scheme</div>
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

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs">Cycle start date</Label>
                  <Input
                    type="date"
                    value={activeScheme.config?.cycleStart || ""}
                    onChange={(e) => setActiveScheme((s) => ({ ...s, config: { ...s.config, cycleStart: e.target.value } }))}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Defaults to start of current {activeScheme.period === "monthly" ? "month" : activeScheme.period === "quarterly" ? "quarter" : "year"}.
                  </p>
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
            </section>

            {/* Party picker */}
            <section className="rounded-lg border bg-background/40 p-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill To / Party</div>
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
            </section>

            {/* Auto-fill */}
            <section className="rounded-lg border bg-background/40 p-4 space-y-3">
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
            </section>

            {/* Grid */}
            <section className="rounded-lg border bg-background/40">
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
            </section>

            {/* Notes / attachments — floating window like quotation notes */}
            <section className="rounded-lg border bg-background/40 p-4 space-y-2">
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
            </section>

            {/* Report */}
            <section className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-lg">Scheme Report</h2>
                <span className="text-xs text-muted-foreground">
                  {SCHEME_LABEL[activeScheme.kind]} · {activeScheme.period} · {partyLabel || "no party"}
                </span>
              </div>
              <MonthProgress period={activeScheme.period} cycleStart={activeScheme.config?.cycleStart} />
              {report.rep.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add items to see eligibility.</p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Achieved */}
                  <div className="rounded-lg border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">✓ Achieved Schemes</h3>
                      <span className="text-xs text-muted-foreground">
                        {report.rep.reduce((s: number, r: any) => s + (r.free || 0), 0)} free unlocked
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="w-16">Qty</TableHead>
                          <TableHead className="w-16">Free</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.rep.map((f: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">
                              <div>{f.item}</div>
                              <div className="text-xs text-muted-foreground">{f.note}</div>
                            </TableCell>
                            <TableCell>{f.qty}</TableCell>
                            <TableCell className="font-semibold text-emerald-600">{f.free}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Targets */}
                  <div className="rounded-lg border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">⏳ Target Reminders</h3>
                      <span className="text-xs text-muted-foreground">
                        {(report as any).targets?.length || 0} pending
                      </span>
                    </div>
                    {!(report as any).targets || (report as any).targets.length === 0 ? (
                      <p className="text-sm text-muted-foreground">All available slabs are unlocked. Nothing more to chase.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="w-20">Have / Need</TableHead>
                            <TableHead className="w-20">Buy more</TableHead>
                            <TableHead className="w-24">Reward</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(report as any).targets.map((t: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm">
                                <div>{t.item}</div>
                                {t.note && <div className="text-xs text-muted-foreground">{t.note}</div>}
                              </TableCell>
                              <TableCell className="text-sm">{t.have} / {t.need}</TableCell>
                              <TableCell className="font-semibold text-amber-600">{t.gap}</TableCell>
                              <TableCell className="text-sm">{t.reward}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-3 rounded bg-muted/50 p-3 text-sm">{report.summary}</div>
            </section>

              </div>
              {/* Invoice footer */}
              <div className="border-t-2 border-foreground/20 bg-muted/40 px-4 py-2 text-center text-[11px] text-muted-foreground">
                Scheme Worksheet · Internal use only · Generated by Scheme Calculator
              </div>
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

function MonthProgress({ period }: { period: Period }) {
  const now = new Date();
  let start: Date, end: Date, label: string;
  if (period === "monthly") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    label = start.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  } else if (period === "quarterly") {
    const q = Math.floor(now.getMonth() / 3);
    start = new Date(now.getFullYear(), q * 3, 1);
    end = new Date(now.getFullYear(), q * 3 + 3, 0);
    label = `Q${q + 1} ${now.getFullYear()}`;
  } else {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31);
    label = String(now.getFullYear());
  }
  const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const elapsed = Math.max(0, Math.min(total, Math.round((now.getTime() - start.getTime()) / 86400000) + 1));
  const remaining = Math.max(0, total - elapsed);
  const pct = Math.round((elapsed / total) * 100);
  return (
    <div className="mb-3 rounded-md border bg-background p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label} · {period}</span>
        <span className="text-muted-foreground">
          Day {elapsed} of {total} · <span className="font-semibold text-foreground">{remaining} days left</span>
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

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
    const groups: any[] = config.groups || [];
    const updateG = (i: number, patch: any) => { const arr = groups.slice(); arr[i] = { ...arr[i], ...patch }; set({ groups: arr }); };
    const removeG = (i: number) => set({ groups: groups.filter((_, j) => j !== i) });
    const addG = () => set({ groups: [...groups, { name: `Group ${groups.length + 1}`, patterns: "", slabs: [{ minQty: 20, free: 3 }], freeProduct: "" }] });
    return (
      <div className="space-y-4">
        <Label className="text-xs">
          Product groups — combine multiple variants (sizes/colours) into one bucket. Total qty across matches triggers free items of the chosen product.
        </Label>
        {groups.map((g, gi) => {
          const slabs: any[] = g.slabs || [];
          const updateS = (si: number, patch: any) => { const arr = slabs.slice(); arr[si] = { ...arr[si], ...patch }; updateG(gi, { slabs: arr }); };
          return (
            <div key={gi} className="rounded border p-3 space-y-2 bg-background/40">
              <div className="grid gap-2 md:grid-cols-[1fr_2fr_2fr_40px]">
                <div><Label className="text-xs">Group name</Label>
                  <Input value={g.name || ""} onChange={(e) => updateG(gi, { name: e.target.value })} placeholder="e.g. Comfobond" /></div>
                <div><Label className="text-xs">Match patterns (comma-separated)</Label>
                  <Input value={g.patterns || ""} onChange={(e) => updateG(gi, { patterns: e.target.value })} placeholder="comfobond, comfo-bond" /></div>
                <div><Label className="text-xs">Free product (given as freebie)</Label>
                  <Input value={g.freeProduct || ""} onChange={(e) => updateG(gi, { freeProduct: e.target.value })} placeholder="Comfobond 75x60x6" /></div>
                <div className="flex items-end"><Button size="icon" variant="ghost" onClick={() => removeG(gi)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Slabs — total qty in group → free qty</Label>
                {slabs.map((s, si) => (
                  <div key={si} className="grid grid-cols-[1fr_1fr_40px] gap-2">
                    <Input type="number" value={s.minQty} onChange={(e) => updateS(si, { minQty: Number(e.target.value) || 0 })} placeholder="Min qty" />
                    <Input type="number" value={s.free} onChange={(e) => updateS(si, { free: Number(e.target.value) || 0 })} placeholder="Free" />
                    <Button size="icon" variant="ghost" onClick={() => updateG(gi, { slabs: slabs.filter((_, j) => j !== si) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => updateG(gi, { slabs: [...slabs, { minQty: 0, free: 0 }] })}><Plus className="h-4 w-4" /> Add slab</Button>
              </div>
            </div>
          );
        })}
        <Button size="sm" variant="outline" onClick={addG}><Plus className="h-4 w-4" /> Add group</Button>
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