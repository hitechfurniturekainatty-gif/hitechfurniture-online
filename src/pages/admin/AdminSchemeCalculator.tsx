import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Trash2, Upload, Save, Pencil, ChevronDown, ChevronUp, TrendingUp, AlertTriangle, CheckCircle2, FileText, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SchemePartyNotesButton } from "@/components/admin/SchemePartyNotesButton";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";

type Row = {
  id: string;
  item: string;
  qty: number;
  price: number;
  amountWithTax: number;
  mrp: number;
};

type Invoice = {
  id: string;
  label: string;
  invoice_no?: string;
  date?: string;
  rows: Row[];
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

/**
 * Strict 4-column parser:
 *   [Item Name] [Qty] [Unit Price] [Total Cost incl. tax]
 *
 * Accepts tab/pipe/comma/multi-space delimiters. Item name may contain
 * spaces — we take the LAST 3 numeric tokens as qty/price/total and treat
 * everything before that as the item name. Header rows and totals/GST/tax
 * summary lines are skipped.
 */
function parseInvoiceText(text: string): Row[] {
  const out: Row[] = [];
  if (!text) return out;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const SKIP_RE = /^(s\.?\s*no|sr\.?\s*no|sl\.?|item|description|particular|product|total|sub[-\s]?total|grand[-\s]?total|gst|igst|cgst|sgst|tax|amount|invoice|date|vendor|party|qty|quantity|rate|price|mrp|unit|hsn|sac)\b/i;
  const numClean = (s: string) => Number(String(s).replace(/[₹$,\s]/g, ""));
  const isNumTok = (s: string) => {
    const c = String(s).replace(/[₹$,\s]/g, "");
    if (!c) return false;
    return /^-?\d+(\.\d+)?$/.test(c);
  };

  for (const raw of lines) {
    let parts: string[] = [];
    if (raw.includes("\t")) parts = raw.split(/\t+/);
    else if (raw.includes("|")) parts = raw.split(/\|+/);
    else if (raw.split(",").length >= 4 && /,\s*\d/.test(raw)) parts = raw.split(",");
    else if (/\s{2,}/.test(raw)) parts = raw.split(/\s{2,}/);
    parts = parts.map((s) => s.trim()).filter(Boolean);

    let item = "";
    let qty = NaN, price = NaN, total = NaN;

    // Strategy: total = LAST numeric column (exact amount), even if extra
    // columns like Discount/Tax/HSN sit between qty/price and total.
    if (parts.length >= 2) {
      // find last numeric token index
      let totalIdx = -1;
      for (let i = parts.length - 1; i >= 0; i--) {
        if (isNumTok(parts[i])) { totalIdx = i; break; }
      }
      if (totalIdx > 0) {
        total = numClean(parts[totalIdx]);
        // find first numeric token from left → qty
        let qtyIdx = -1;
        for (let i = 0; i < totalIdx; i++) {
          if (isNumTok(parts[i])) { qtyIdx = i; break; }
        }
        if (qtyIdx > 0) {
          item = parts.slice(0, qtyIdx).join(" ").trim();
          qty = numClean(parts[qtyIdx]);
          // next numeric token after qty (before total) → unit price
          for (let i = qtyIdx + 1; i < totalIdx; i++) {
            if (isNumTok(parts[i])) { price = numClean(parts[i]); break; }
          }
        }
      }
    }

    if (!item || !Number.isFinite(total)) {
      // Fallback: whitespace split — total = last numeric, qty = first numeric
      const toks = raw.split(/\s+/);
      let totalIdx = -1;
      for (let i = toks.length - 1; i >= 0; i--) {
        if (isNumTok(toks[i])) { totalIdx = i; break; }
      }
      if (totalIdx > 0) {
        let qtyIdx = -1;
        for (let i = 0; i < totalIdx; i++) {
          if (isNumTok(toks[i])) { qtyIdx = i; break; }
        }
        if (qtyIdx > 0) {
          item = toks.slice(0, qtyIdx).join(" ").trim();
          qty = numClean(toks[qtyIdx]);
          total = numClean(toks[totalIdx]);
          for (let i = qtyIdx + 1; i < totalIdx; i++) {
            if (isNumTok(toks[i])) { price = numClean(toks[i]); break; }
          }
        }
      }
    }

    if (!item || !Number.isFinite(qty) || !Number.isFinite(total)) continue;
    if (SKIP_RE.test(item)) continue;
    if (qty <= 0 && total <= 0) continue;

    out.push({
      id: crypto.randomUUID(),
      item,
      qty: qty || 1,
      price: Number.isFinite(price) ? price : (qty > 0 ? total / qty : 0),
      amountWithTax: total,
      mrp: 0,
    });
  }
  return out;
}

/**
 * Aggregate purchase rows by item name (case-insensitive). Sums qty &
 * amountWithTax; computes a weighted unit price and qty-weighted MRP.
 * This is the core of the "cumulative monthly quantity" comparison so
 * Product Group rules (Buy N → Get free) actually match across invoices.
 */
function aggregateRowsByItem(rows: Row[]): Row[] {
  const map = new Map<string, Row & { _mrpWeighted: number; _mrpQty: number }>();
  for (const r of rows) {
    const name = String(r.item || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const qty = Number(r.qty) || 0;
    const amt = Number(r.amountWithTax) || 0;
    const mrp = Number(r.mrp) || 0;
    const existing = map.get(key);
    if (existing) {
      existing.qty += qty;
      existing.amountWithTax += amt;
      existing._mrpWeighted += mrp * qty;
      existing._mrpQty += qty;
    } else {
      map.set(key, {
        id: r.id,
        item: name,
        qty,
        price: 0,
        amountWithTax: amt,
        mrp,
        _mrpWeighted: mrp * qty,
        _mrpQty: qty,
      });
    }
  }
  return Array.from(map.values()).map((r) => {
    const price = r.qty > 0 ? r.amountWithTax / r.qty : 0;
    const mrp = r._mrpQty > 0 ? r._mrpWeighted / r._mrpQty : r.mrp;
    return { id: r.id, item: r.item, qty: r.qty, price, amountWithTax: r.amountWithTax, mrp };
  });
}

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
    const groupQty = live.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const free = Math.floor(groupQty / per);
    const matchedNames = live.map((r) => `${r.item} (${r.qty})`).join(", ") || "no items";
    const rep: Achieved[] = [{
      item: `All products → ${free} free`,
      qty: groupQty,
      free,
      note: `Group total ${groupQty} qty [${matchedNames}] → 1 free per ${per}`,
    }];
    const nextThreshold = (Math.floor(groupQty / per) + 1) * per;
    const gap = nextThreshold - groupQty;
    const targets: Target[] = gap > 0 ? [{
      item: "All products (group total)",
      have: groupQty, need: nextThreshold, gap,
      reward: `+1 free`, note: `Buy ${gap} more across any item to unlock next free unit`,
    }] : [];
    return { rep, targets, summary: `Total free items: ${free}` };
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
    const groupQty = live.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    let free = 0;
    let matchedSlab: any = null;
    for (const s of slabs) if (groupQty >= Number(s.minQty)) { free = Number(s.free) || 0; matchedSlab = s; }
    const matchedNames = live.map((r) => `${r.item} (${r.qty})`).join(", ") || "no items";
    const rep: Achieved[] = [{
      item: `All products → ${free} free`,
      qty: groupQty,
      free,
      note: matchedSlab
        ? `Group total ${groupQty} qty [${matchedNames}] → ≥ ${matchedSlab.minQty} → ${matchedSlab.free} free`
        : `Group total ${groupQty} qty [${matchedNames}] — below first slab`,
    }];
    const next = slabs.find((s: any) => groupQty < Number(s.minQty));
    const targets: Target[] = next ? [{
      item: "All products (group total)",
      have: groupQty, need: Number(next.minQty), gap: Number(next.minQty) - groupQty,
      reward: `${next.free} free`, note: `Buy ${Number(next.minQty) - groupQty} more across any item to unlock`,
    }] : [];
    return { rep, targets, summary: `Total free items: ${free}` };
  }
  if (kind === "bogo") {
    const buy = Math.max(1, Number(config?.buyQty) || 1);
    const get = Math.max(0, Number(config?.getQty) || 0);
    const groupQty = live.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const free = Math.floor(groupQty / buy) * get;
    const matchedNames = live.map((r) => `${r.item} (${r.qty})`).join(", ") || "no items";
    const rep: Achieved[] = [{
      item: `All products → ${free} free`,
      qty: groupQty,
      free,
      note: `Group total ${groupQty} qty [${matchedNames}] → Buy ${buy} Get ${get}`,
    }];
    const nextThreshold = (Math.floor(groupQty / buy) + 1) * buy;
    const gap = nextThreshold - groupQty;
    const targets: Target[] = gap > 0 ? [{
      item: "All products (group total)",
      have: groupQty, need: nextThreshold, gap,
      reward: `+${get} free`, note: `Buy ${gap} more across any item for next freebie`,
    }] : [];
    return { rep, targets, summary: `Total free items: ${free}` };
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

/**
 * Achievement % for a scheme on the given rows, driven strictly by the
 * configured product group rules. 100 = all available slabs unlocked.
 * Otherwise the highest in-progress slab's have/need ratio.
 */
function computeAchievementPct(
  scheme: { kind: SchemeKind; config: any },
  rows: Row[],
): number {
  const live = rows.filter((r) => r.item && (Number(r.qty) || 0) > 0);
  if (!live.length) return 0;
  const r = computeFreeReport(scheme, rows) as any;
  const targets = (r.targets || []) as any[];
  const freeUnits = (r.rep || []).reduce(
    (s: number, x: any) => s + (Number(x.free) || 0),
    0,
  );
  if (targets.length === 0) return freeUnits > 0 ? 100 : 0;
  // Average progress across each pending target (group-rule driven).
  const pcts = targets.map((t: any) =>
    Number(t.need) > 0
      ? Math.min(100, (Number(t.have) / Number(t.need)) * 100)
      : 0,
  );
  const avg = pcts.reduce((s, p) => s + p, 0) / pcts.length;
  return Math.round(avg);
}

/* ============== Vendor Dashboard (Calculator) ============== */

type TimelineMode = "monthly" | "quarterly" | "halfyearly" | "yearly";
type VendorMonth = {
  id?: string;
  party_id: string;
  fy_year: number;
  month: number;
  scheme_kind: SchemeKind;
  scheme_config: any;
  purchases_text: string | null;
  purchase_rows: Row[];
  invoices: Invoice[];
};

const FY_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const MONTH_NAME = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fyCalendarYear(fyYear: number, month: number) {
  return month >= 4 ? fyYear : fyYear + 1;
}
function currentFy() {
  const d = new Date();
  return d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
}

const AdminSchemeCalculator = () => {
  const [tab, setTab] = useState<"calc" | "parties" | "schemes">("calc");

  const [parties, setParties] = useState<Party[]>([]);
  const [savedSchemes, setSavedSchemes] = useState<SchemeRow[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorQuery, setVendorQuery] = useState("");
  const [fy, setFy] = useState<number>(currentFy());
  const [mode, setMode] = useState<TimelineMode>("monthly");
  const [months, setMonths] = useState<VendorMonth[]>([]);
  const [loading, setLoading] = useState(false);
  const [customFys, setCustomFys] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("scheme_custom_fys") || "[]"); } catch { return []; }
  });

  const fyOptions = useMemo(() => {
    const base = new Set<number>([currentFy() - 2, currentFy() - 1, currentFy(), currentFy() + 1]);
    customFys.forEach((y) => base.add(y));
    base.add(fy);
    return Array.from(base).sort((a, b) => b - a);
  }, [customFys, fy]);

  const addCustomFy = () => {
    const input = window.prompt("Enter the starting year of the Financial Year (e.g. 2024 for FY 2024–25):");
    if (!input) return;
    const y = parseInt(input.trim(), 10);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      toast({ title: "Invalid year", description: "Enter a 4-digit year between 2000 and 2100.", variant: "destructive" });
      return;
    }
    const next = Array.from(new Set([...customFys, y])).sort((a, b) => b - a);
    setCustomFys(next);
    localStorage.setItem("scheme_custom_fys", JSON.stringify(next));
    setFy(y);
    toast({ title: "Financial year added", description: `FY ${y}–${String(y + 1).slice(-2)} is now selected.` });
  };

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

  useEffect(() => {
    if (!vendorId) { setMonths([]); return; }
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("scheme_vendor_months" as any)
        .select("*")
        .eq("party_id", vendorId)
        .eq("fy_year", fy);
      if (error) { toast({ title: "Load failed", description: error.message, variant: "destructive" }); setLoading(false); return; }
      const rows = ((data as any) || []) as VendorMonth[];
      const full: VendorMonth[] = FY_MONTHS.map((m) => {
        const existing = rows.find((r) => r.month === m);
        if (existing) {
          const invs: Invoice[] = Array.isArray((existing as any).invoices) && (existing as any).invoices.length
            ? (existing as any).invoices
            : (existing.purchase_rows && existing.purchase_rows.length
                ? [{ id: crypto.randomUUID(), label: "Invoice 1", rows: existing.purchase_rows }]
                : []);
          return { ...existing, invoices: invs };
        }
        return {
          party_id: vendorId,
          fy_year: fy,
          month: m,
          scheme_kind: "company",
          scheme_config: defaultConfig("company"),
          purchases_text: "",
          purchase_rows: [],
          invoices: [],
        };
      });
      setMonths(full);
      setLoading(false);
    })();
  }, [vendorId, fy]);

  const vendor = parties.find((p) => p.id === vendorId) || null;
  const filteredParties = useMemo(() => {
    const q = vendorQuery.trim().toLowerCase();
    if (!q) return parties.slice(0, 30);
    return parties.filter((p) =>
      [p.name, p.phone, p.place].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    ).slice(0, 50);
  }, [parties, vendorQuery]);

  const updateMonth = (month: number, patch: Partial<VendorMonth>) => {
    setMonths((arr) => arr.map((m) => (m.month === month ? { ...m, ...patch } : m)));
  };

  const persistMonth = async (m: VendorMonth) => {
    const flatRows: Row[] = (m.invoices && m.invoices.length)
      ? m.invoices.flatMap((inv) => inv.rows)
      : m.purchase_rows;
    const payload = {
      party_id: m.party_id,
      fy_year: m.fy_year,
      month: m.month,
      scheme_kind: m.scheme_kind,
      scheme_config: m.scheme_config,
      purchases_text: m.purchases_text,
      purchase_rows: flatRows as any,
      invoices: m.invoices as any,
    };
    const { data, error } = await supabase
      .from("scheme_vendor_months" as any)
      .upsert(payload, { onConflict: "party_id,fy_year,month" })
      .select()
      .single();
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    updateMonth(m.month, { id: (data as any).id });
    toast({ title: `Saved ${MONTH_NAME[m.month]} ${fyCalendarYear(fy, m.month)}` });
  };

  const ytd = useMemo(() => {
    let totalAmount = 0, totalQty = 0, freeUnits = 0;
    const pcts: number[] = [];
    months.forEach((m) => {
      const flat = m.invoices && m.invoices.length ? m.invoices.flatMap((i) => i.rows) : m.purchase_rows;
      if (!flat.length) return;
      const rep = computeFreeReport(
        { kind: m.scheme_kind, config: m.scheme_config },
        aggregateRowsByItem(flat),
      );
      flat.forEach((r) => {
        totalAmount += Number(r.amountWithTax) || 0;
        totalQty += Number(r.qty) || 0;
      });
      freeUnits += rep.rep.reduce((s: number, x: any) => s + (x.free || 0), 0);
      pcts.push(computeAchievementPct(
        { kind: m.scheme_kind, config: m.scheme_config },
        aggregateRowsByItem(flat),
      ));
    });
    const completionPct = pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : 0;
    return { totalAmount, totalQty, freeUnits, completionPct };
  }, [months]);

  return (
    <AdminShell>
      <div className="space-y-6 pb-28">
        <h1 className="font-display text-2xl">Vendor Scheme Dashboard</h1>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="calc">Vendor Dashboard</TabsTrigger>
            <TabsTrigger value="parties">Vendors ({parties.length})</TabsTrigger>
            <TabsTrigger value="schemes">Scheme Templates ({savedSchemes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="calc" className="space-y-5 pt-4">
            <div className="sticky top-0 z-20 -mx-2 rounded-2xl border bg-card/90 px-3 py-3 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[240px] flex-1">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Vendor</Label>
                  <Input
                    value={vendor ? `${vendor.name}${vendor.place ? ` — ${vendor.place}` : ""}` : vendorQuery}
                    onChange={(e) => { setVendorQuery(e.target.value); setVendorId(null); }}
                    placeholder="Search vendor by name / phone / place…"
                  />
                  {vendorQuery && !vendor && (
                    <div className="mt-1 max-h-56 overflow-auto rounded border bg-popover">
                      {filteredParties.length === 0 && <div className="p-2 text-xs text-muted-foreground">No vendors. Add one in Vendors tab.</div>}
                      {filteredParties.map((p) => (
                        <button key={p.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => { setVendorId(p.id); setVendorQuery(""); }}>
                          {p.name}{p.place ? ` — ${p.place}` : ""}{p.phone ? ` · ${p.phone}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Financial Year</Label>
                  <div className="flex items-center gap-2">
                    <Select value={String(fy)} onValueChange={(v) => setFy(Number(v))}>
                      <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {fyOptions.map((y) => (
                          <SelectItem key={y} value={String(y)}>FY {y}–{String(y + 1).slice(-2)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="sm" onClick={addCustomFy} className="h-9 gap-1">
                      <Plus className="h-4 w-4" /> Add FY
                    </Button>
                  </div>
                </div>
                <div className="ml-auto">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Timeline</Label>
                  <div className="inline-flex rounded-full border bg-background p-1">
                    {(["monthly", "quarterly", "halfyearly", "yearly"] as TimelineMode[]).map((m) => (
                      <button key={m} onClick={() => setMode(m)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${mode === m ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                        {m === "halfyearly" ? "Half-Yearly" : m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {!vendor ? (
              <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
                <TrendingUp className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Pick a vendor above to open their full year dashboard.</p>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : mode === "monthly" ? (
              <div className="space-y-4">
                {months.map((m) => (
                  <MonthBlock
                    key={m.month}
                    vm={m}
                    fy={fy}
                    savedSchemes={savedSchemes}
                    onChange={(patch) => updateMonth(m.month, patch)}
                    onSave={() => persistMonth(m)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <AggregatedView
                  mode={mode}
                  fy={fy}
                  months={months}
                  savedSchemes={savedSchemes}
                  onChangeMonth={(month, patch) => updateMonth(month, patch)}
                  onSaveMonth={(m) => persistMonth(m)}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="parties" className="pt-4">
            <PartiesTab parties={parties} setParties={setParties} />
          </TabsContent>

          <TabsContent value="schemes" className="pt-4">
            <SchemesTab schemes={savedSchemes} setSchemes={setSavedSchemes} onApply={() => setTab("calc")} />
          </TabsContent>
        </Tabs>

        {vendor && (
          <div className="fixed bottom-3 left-1/2 z-30 w-[min(1200px,95vw)] -translate-x-1/2 rounded-2xl border bg-card/95 px-4 py-3 shadow-2xl backdrop-blur">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="font-display text-sm">FY {fy}–{String(fy + 1).slice(-2)} · {vendor.name}</div>
              <div className="ml-auto flex flex-wrap items-center gap-5">
                <Stat label="YTD Purchases" value={`₹${fmt(ytd.totalAmount)}`} />
                <Stat label="Total Qty" value={fmt(ytd.totalQty)} />
                <Stat label="Free Units Earned" value={fmt(ytd.freeUnits)} tone="success" />
                <div className="flex items-center gap-2">
                  <ProgressRing pct={ytd.completionPct} size={42} stroke={5} />
                  <div className="leading-tight">
                    <div className="text-[10px] uppercase text-muted-foreground">Completion</div>
                    <div className="text-sm font-semibold">{ytd.completionPct}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  const cls = tone === "success" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "warning" ? "text-amber-600 dark:text-amber-400"
    : "text-foreground";
  return (
    <div className="leading-tight">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function ProgressRing({ pct, size = 96, stroke = 8, color = "hsl(var(--primary))" }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" className="transition-all duration-500" />
      <text x="50%" y="50%" dy=".35em" textAnchor="middle" transform={`rotate(90 ${size / 2} ${size / 2})`}
        className="fill-foreground text-xs font-semibold">{Math.round(pct)}%</text>
    </svg>
  );
}

function MonthBlock({ vm, fy, savedSchemes, onChange, onSave }: {
  vm: VendorMonth; fy: number; savedSchemes: SchemeRow[];
  onChange: (patch: Partial<VendorMonth>) => void; onSave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dialogInvoice, setDialogInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const isCurrent = (() => {
    const now = new Date();
    return now.getFullYear() === fyCalendarYear(fy, vm.month) && now.getMonth() + 1 === vm.month;
  })();

  useEffect(() => { if (isCurrent) setOpen(true); }, [isCurrent]);

  const invoices: Invoice[] = vm.invoices && vm.invoices.length
    ? vm.invoices
    : (vm.purchase_rows.length ? [{ id: "legacy", label: "Invoice 1", rows: vm.purchase_rows }] : []);
  const flatRows: Row[] = invoices.flatMap((inv) => inv.rows);

  const setInvoices = (next: Invoice[]) => {
    const flat = next.flatMap((inv) => inv.rows);
    onChange({ invoices: next, purchase_rows: flat });
  };
  const updateInvoice = (id: string, patch: Partial<Invoice>) => {
    setInvoices(invoices.map((inv) => (inv.id === id ? { ...inv, ...patch } : inv)));
  };
  const removeInvoice = (id: string) => setInvoices(invoices.filter((inv) => inv.id !== id));

  const openAddInvoice = () => {
    setDialogInvoice({ id: crypto.randomUUID(), label: `Invoice ${invoices.length + 1}`, rows: [] });
    setDialogOpen(true);
  };
  const openEditInvoice = (inv: Invoice) => { setDialogInvoice(inv); setDialogOpen(true); };
  const saveDialogInvoice = (inv: Invoice) => {
    const exists = invoices.some((x) => x.id === inv.id);
    setInvoices(exists ? invoices.map((x) => (x.id === inv.id ? inv : x)) : [...invoices, inv]);
    setDialogOpen(false);
    setDialogInvoice(null);
  };

  const report = useMemo(
    () => computeFreeReport(
      { kind: vm.scheme_kind, config: vm.scheme_config },
      aggregateRowsByItem(flatRows),
    ),
    [vm.scheme_kind, vm.scheme_config, vm.invoices, vm.purchase_rows]
  );

  const totalQty = flatRows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const totalAmount = flatRows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
  const totalMrpValue = flatRows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
  const monthAvgDiscount = totalMrpValue > 0 ? ((totalMrpValue - totalAmount) / totalMrpValue) * 100 : 0;
  const freeUnits = report.rep.reduce((s: number, r: any) => s + (r.free || 0), 0);
  const targets = (report as any).targets || [];

  const completion = useMemo(() => {
    return computeAchievementPct(
      { kind: vm.scheme_kind, config: vm.scheme_config },
      aggregateRowsByItem(flatRows),
    );
  }, [vm.scheme_kind, vm.scheme_config, vm.invoices, vm.purchase_rows]);

  const monthLabel = `${MONTH_NAME[vm.month]} ${fyCalendarYear(fy, vm.month)}`;

  const applySaved = (id: string) => {
    const s = savedSchemes.find((x) => x.id === id);
    if (!s) return;
    onChange({ scheme_kind: s.kind, scheme_config: s.config || defaultConfig(s.kind) });
  };

  return (
    <div className={`rounded-2xl border-2 bg-card shadow-sm transition-shadow ${isCurrent ? "border-primary/50 shadow-md" : "border-border"}`}>
      <button onClick={() => setOpen((x) => !x)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-muted/30">
        <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
          <div className="text-[9px] font-medium uppercase">{MONTH_NAME[vm.month]}</div>
          <div className="text-xs font-bold">{String(fyCalendarYear(fy, vm.month)).slice(-2)}</div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base">{monthLabel}</h3>
            {isCurrent && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">CURRENT</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {totalQty} qty · ₹{fmt(totalAmount)} · <span className="font-medium text-emerald-600 dark:text-emerald-400">{freeUnits} free</span>
            {targets.length > 0 && <> · <span className="font-medium text-amber-600 dark:text-amber-400">{targets.length} pending</span></>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`text-lg font-bold tabular-nums ${completion >= 100 ? "text-emerald-600 dark:text-emerald-400" : completion > 0 ? "text-primary" : "text-muted-foreground"}`}>
            {completion}%
          </div>
          <div className="hidden sm:block"><ProgressRing pct={completion} size={48} stroke={5} /></div>
        </div>
        {open ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="space-y-4 border-t p-4">
          <section className="rounded-xl border bg-background/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">① Scheme configuration</h4>
              {savedSchemes.length > 0 && (
                <Select value="" onValueChange={applySaved}>
                  <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Apply template…" /></SelectTrigger>
                  <SelectContent>{savedSchemes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="mb-3 grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Scheme type</Label>
                <Select value={vm.scheme_kind} onValueChange={(v) => onChange({ scheme_kind: v as SchemeKind, scheme_config: defaultConfig(v as SchemeKind) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(SCHEME_LABEL) as SchemeKind[]).map((k) => <SelectItem key={k} value={k}>{SCHEME_LABEL[k]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <SchemeConfigEditor scheme={{ kind: vm.scheme_kind, config: vm.scheme_config }} onChange={(c) => onChange({ scheme_config: c })} />
          </section>

          <section className="rounded-xl border-2 border-dashed bg-background/50 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">② Invoices for {monthLabel}</h4>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Stat label="Invoices" value={String(invoices.length)} />
                <Stat label="Month Cost" value={`₹${fmt(totalAmount)}`} />
                <Stat label="Month MRP" value={`₹${fmt(totalMrpValue)}`} />
                <Stat label="Avg Discount" value={`${monthAvgDiscount.toFixed(2)}%`} tone={monthAvgDiscount > 0 ? "success" : undefined} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-background p-3">
              <div className="text-xs text-muted-foreground">
                Each invoice is parsed from a 4-column paste: <span className="font-medium text-foreground">Item · Qty · Unit Price · Total Cost</span>. MRP stays blank for you to fill.
              </div>
              <Button size="sm" onClick={openAddInvoice}>
                <Plus className="h-4 w-4" /> Add Invoice
              </Button>
            </div>

            {invoices.length === 0 && (
              <p className="text-xs text-muted-foreground">No invoices yet. Click <strong>+ Add Invoice</strong> to paste or upload one.</p>
            )}

            <div className="space-y-3">
              {invoices.map((inv, idx) => (
                <InvoiceCard
                  key={inv.id}
                  index={idx}
                  invoice={inv}
                  onChange={(patch) => updateInvoice(inv.id, patch)}
                  onRemove={() => removeInvoice(inv.id)}
                  onEdit={() => openEditInvoice(inv)}
                />
              ))}
            </div>
          </section>

          <InvoiceDialog
            open={dialogOpen}
            invoice={dialogInvoice}
            onClose={() => { setDialogOpen(false); setDialogInvoice(null); }}
            onSave={saveDialogInvoice}
          />

          <section className="rounded-xl border bg-background/50 p-4">
            <h4 className="mb-3 text-sm font-semibold">③ Live performance</h4>
            {flatRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Paste purchase data above to see achievements and targets.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="mb-3 flex items-start gap-3">
                    <ProgressRing pct={completion} size={88} color="hsl(142 71% 45%)" />
                    <div>
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <h5 className="text-sm font-semibold">Achieved</h5>
                      </div>
                      <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{freeUnits}</div>
                      <div className="text-[11px] text-muted-foreground">free units unlocked</div>
                    </div>
                  </div>
                  <ul className="space-y-1 text-xs">
                    {report.rep.slice(0, 5).map((r: any, i: number) => (
                      <li key={i} className="flex justify-between gap-2 border-t border-emerald-500/10 py-1">
                        <span className="truncate">{r.item}</span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">{r.qty} → {r.free} free</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-4">
                  <div className="mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <h5 className="text-sm font-semibold">Target reminders</h5>
                  </div>
                  {targets.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {freeUnits > 0
                        ? "All available slabs unlocked. Nothing more to chase this month."
                        : "No pending target found yet — check that this month has a scheme target matching the invoice item names."}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {targets.slice(0, 4).map((t: any, i: number) => {
                        const pct = t.need > 0 ? Math.round((t.have / t.need) * 100) : 0;
                        return (
                          <li key={i}>
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="truncate text-xs font-medium">{t.item}</div>
                              <div className="text-[11px] text-amber-700 dark:text-amber-400">+{t.gap} for {t.reward}</div>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-amber-500/10">
                              <div className="h-full bg-amber-500 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <div className="mt-1 text-[10px] text-muted-foreground">{t.have} / {t.need}</div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>

          <div className="flex items-center justify-end gap-2">
            <SchemePartyNotesButton partyId={vm.party_id} />
            <Button onClick={onSave}><Save className="h-4 w-4" /> Save {MONTH_NAME[vm.month]}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LivePerformancePanel({ fy, months, mode }: { fy: number; months: VendorMonth[]; mode: TimelineMode }) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentFyYear = (now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1);

  const filteredMonths = useMemo(() => {
    if (mode === "yearly") return months;
    if (mode === "quarterly") {
      const sets = [[4,5,6],[7,8,9],[10,11,12],[1,2,3]];
      const q = sets.find((s) => s.includes(currentMonth)) || sets[0];
      return months.filter((m) => q.includes(m.month));
    }
    if (mode === "halfyearly") {
      const h1 = [4,5,6,7,8,9];
      const set = h1.includes(currentMonth) ? h1 : [10,11,12,1,2,3];
      return months.filter((m) => set.includes(m.month));
    }
    return months; // monthly view: aggregate everything entered so far in the FY
  }, [months, mode, currentMonth]);

  const allRows: Row[] = useMemo(
    () => filteredMonths.flatMap((m) =>
      m.invoices && m.invoices.length ? m.invoices.flatMap((i) => i.rows) : m.purchase_rows
    ),
    [filteredMonths],
  );

  const schemeMonth =
    filteredMonths.find((m) => m.month === currentMonth && fyCalendarYear(fy, m.month) === currentFyYear)
    || filteredMonths.find((m) => m.scheme_config)
    || filteredMonths[0];

  const report = useMemo(() => {
    if (!schemeMonth) return { rep: [] as any[], targets: [] as any[], summary: "" };
    return computeFreeReport(
      { kind: schemeMonth.scheme_kind, config: schemeMonth.scheme_config },
      aggregateRowsByItem(allRows),
    ) as any;
  }, [schemeMonth, allRows]);

  const totalQty = allRows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const totalAmount = allRows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
  const totalMrp = allRows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
  const avgDiscount = totalMrp > 0 ? ((totalMrp - totalAmount) / totalMrp) * 100 : 0;
  const freeUnits = report.rep.reduce((s: number, x: any) => s + (x.free || 0), 0);
  const targets = report.targets || [];
  const performancePct = Math.min(100, freeUnits > 0 ? 100 : (targets[0] ? Math.round(((targets[0].have || 0) / Math.max(1, targets[0].need || 1)) * 100) : 0));

  const modeLabel =
    mode === "yearly" ? `FY ${fy}–${String(fy + 1).slice(-2)}`
    : mode === "quarterly" ? "this quarter"
    : mode === "halfyearly" ? "this half-year"
    : "all entered months";

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-background p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg">Live Performance Dashboard</h3>
          <p className="text-xs text-muted-foreground">
            Aggregated across {modeLabel} · {allRows.length} line items from {filteredMonths.reduce((s, m) => s + ((m.invoices?.length) || 0), 0)} invoices
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <Stat label="Total Qty" value={fmt(totalQty)} />
          <Stat label="Total Cost" value={`₹${fmt(totalAmount)}`} />
          <Stat label="Total MRP" value={`₹${fmt(totalMrp)}`} />
          <Stat label="Avg Discount" value={`${avgDiscount.toFixed(2)}%`} tone={avgDiscount > 0 ? "success" : undefined} />
        </div>
      </div>

      {allRows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          Add invoices in any month below to start tracking achievements and pending targets here.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="mb-3 flex items-start gap-3">
              <ProgressRing pct={performancePct} size={72} color="hsl(142 71% 45%)" />
              <div>
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <h5 className="text-sm font-semibold">Achieved (cumulative)</h5>
                </div>
                <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{freeUnits}</div>
                <div className="text-[11px] text-muted-foreground">free units unlocked</div>
              </div>
            </div>
            {report.rep.length === 0 ? (
              <p className="text-xs text-muted-foreground">No matched products yet — set up a product group in any month's scheme config.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {report.rep.slice(0, 6).map((r: any, i: number) => (
                  <li key={i} className="flex justify-between gap-2 border-t border-emerald-500/10 py-1">
                    <span className="truncate">{r.item}</span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">{r.qty} → {r.free} free</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <h5 className="text-sm font-semibold">Target Reminders</h5>
            </div>
            {targets.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {freeUnits > 0
                  ? "All available slabs unlocked — nothing pending in this period."
                  : "No pending target found yet — check that this period has a scheme target matching the invoice item names."}
              </p>
            ) : (
              <ul className="space-y-3">
                {targets.slice(0, 5).map((t: any, i: number) => {
                  const pct = t.need > 0 ? Math.round((t.have / t.need) * 100) : 0;
                  return (
                    <li key={i}>
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="truncate text-xs font-medium">{t.item}</div>
                        <div className="text-[11px] text-amber-700 dark:text-amber-400">Buy {t.gap} more → {t.reward}</div>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-amber-500/10">
                        <div className="h-full bg-amber-500 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{t.have} / {t.need}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AggregatedView({ mode, fy, months, savedSchemes, onChangeMonth, onSaveMonth }: {
  mode: TimelineMode;
  fy: number;
  months: VendorMonth[];
  savedSchemes: SchemeRow[];
  onChangeMonth: (month: number, patch: Partial<VendorMonth>) => void;
  onSaveMonth: (m: VendorMonth) => void;
}) {
  const buckets = useMemo(() => {
    if (mode === "yearly") return [{ label: `FY ${fy}–${String(fy + 1).slice(-2)}`, months }];
    if (mode === "quarterly") {
      const order = [[4, 5, 6], [7, 8, 9], [10, 11, 12], [1, 2, 3]];
      return order.map((mset, i) => ({ label: `Q${i + 1}`, months: months.filter((m) => mset.includes(m.month)) }));
    }
    return [
      { label: "H1 (Apr–Sep)", months: months.filter((m) => [4, 5, 6, 7, 8, 9].includes(m.month)) },
      { label: "H2 (Oct–Mar)", months: months.filter((m) => [10, 11, 12, 1, 2, 3].includes(m.month)) },
    ];
  }, [mode, fy, months]);

  const chartData = months.map((m) => {
    const flat = (m.invoices && m.invoices.length ? m.invoices.flatMap((i) => i.rows) : m.purchase_rows);
    const agg = aggregateRowsByItem(flat);
    const rep = computeFreeReport({ kind: m.scheme_kind, config: m.scheme_config }, agg);
    const qty = flat.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const amount = flat.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
    const free = rep.rep.reduce((s: number, x: any) => s + (x.free || 0), 0);
    const gap = ((rep as any).targets || []).reduce((s: number, t: any) => s + (Number(t.gap) || 0), 0);
    return { name: MONTH_NAME[m.month], qty, amount: Math.round(amount), free, gap };
  });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 font-display text-base">Monthly comparison</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="qty" name="Purchased Qty" stackId="a" fill="hsl(217 91% 60%)" />
              <Bar dataKey="gap" name="Gap to next slab" stackId="a" fill="hsl(38 92% 50%)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="free" name="Free unlocked" fill="hsl(142 71% 45%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {buckets.map((b) => {
          const allRows: Row[] = b.months.flatMap((m) =>
            m.invoices && m.invoices.length ? m.invoices.flatMap((i) => i.rows) : m.purchase_rows,
          );
          const totalQty = allRows.reduce((a, r) => a + (Number(r.qty) || 0), 0);
          const totalAmount = allRows.reduce((a, r) => a + (Number(r.amountWithTax) || 0), 0);
          // Bucket-level group comparison: aggregate the whole period and
          // run the comparison engine against the first month's scheme rules
          // (vendor schemes are typically uniform across the FY).
          const schemeMonth = b.months.find((m) => m.scheme_config) || b.months[0];
          const bucketRep = schemeMonth
            ? computeFreeReport(
                { kind: schemeMonth.scheme_kind, config: schemeMonth.scheme_config },
                aggregateRowsByItem(allRows),
              )
            : { rep: [], targets: [], summary: "" } as any;
          const freeUnits = bucketRep.rep.reduce((a: number, x: any) => a + (x.free || 0), 0);
          const targets = ((bucketRep as any).targets || []) as any[];
          const targetCount = targets.length;
          const bucketPct = schemeMonth
            ? computeAchievementPct(
                { kind: schemeMonth.scheme_kind, config: schemeMonth.scheme_config },
                aggregateRowsByItem(allRows),
              )
            : 0;
          return (
            <div key={b.label} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{b.label}</div>
                <div className={`text-sm font-bold tabular-nums ${bucketPct >= 100 ? "text-emerald-600 dark:text-emerald-400" : bucketPct > 0 ? "text-primary" : "text-muted-foreground"}`}>{bucketPct}%</div>
              </div>
              <div className="mt-2 text-2xl font-bold">₹{fmt(totalAmount)}</div>
              <div className="text-xs text-muted-foreground">{totalQty} units purchased</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400">{freeUnits}</div>
                  <div className="text-[10px] text-muted-foreground">free unlocked</div>
                </div>
                <div className="rounded-lg bg-amber-500/10 p-2">
                  <div className="font-semibold text-amber-700 dark:text-amber-400">{targetCount}</div>
                  <div className="text-[10px] text-muted-foreground">pending targets</div>
                </div>
              </div>
              {(bucketRep.rep.length > 0 || targets.length > 0) && (
                <div className="mt-3 space-y-2">
                  {bucketRep.rep.slice(0, 3).map((r: any, i: number) => (
                    <div key={`a-${i}`} className="flex justify-between gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[11px]">
                      <span className="truncate">{r.item}</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">{r.qty} → {r.free} free</span>
                    </div>
                  ))}
                  {targets.slice(0, 3).map((t: any, i: number) => (
                    <div key={`t-${i}`} className="flex justify-between gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[11px]">
                      <span className="truncate">{t.item}</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">+{t.gap} → {t.reward}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 pt-2">
          <h3 className="font-display text-base">Monthly breakdown</h3>
          <span className="text-xs text-muted-foreground">· Live performance per month within the selected {mode === "yearly" ? "year" : mode === "quarterly" ? "quarter" : "half-year"}</span>
        </div>
        {buckets.map((b) => (
          <div key={`mb-${b.label}`} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{b.label}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {b.months.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-xs text-muted-foreground">
                No months in this bucket.
              </div>
            ) : (
              b.months.map((m) => (
                <MonthBlock
                  key={`${b.label}-${m.month}`}
                  vm={m}
                  fy={fy}
                  savedSchemes={savedSchemes}
                  onChange={(patch) => onChangeMonth(m.month, patch)}
                  onSave={() => onSaveMonth(m)}
                />
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


function SchemeConfigEditor({ scheme, onChange }: { scheme: { kind: SchemeKind; config: any }; onChange: (c: any) => void }) {
  return SchemeConfigEditorImpl({ scheme, onChange });
}

function InvoiceCard({ index, invoice, onChange, onRemove, onEdit }: {
  index: number;
  invoice: Invoice;
  onChange: (patch: Partial<Invoice>) => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const rows = invoice.rows;
  const totalCost = rows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
  const totalMrp = rows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
  const avgDiscount = totalMrp > 0 ? ((totalMrp - totalCost) / totalMrp) * 100 : 0;

  const updateRow = (id: string, patch: Partial<Row>) => {
    const next = rows.map((r) => {
      if (r.id !== id) return r;
      const merged = { ...r, ...patch };
      if (patch.qty !== undefined || patch.price !== undefined) {
        const q = Number(merged.qty) || 0;
        const p = Number(merged.price) || 0;
        if (patch.amountWithTax === undefined) merged.amountWithTax = q * p;
      }
      return merged;
    });
    onChange({ rows: next });
  };
  const removeRow = (id: string) => onChange({ rows: rows.filter((r) => r.id !== id) });

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/30 px-4 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Receipt className="h-4 w-4" />
        </div>
        <Input
          value={invoice.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="h-8 max-w-[200px] text-sm font-medium"
          placeholder={`Invoice ${index + 1}`}
        />
        <Input
          value={invoice.invoice_no || ""}
          onChange={(e) => onChange({ invoice_no: e.target.value })}
          className="h-8 max-w-[160px] text-xs"
          placeholder="Invoice no."
        />
        <Input
          type="date"
          value={invoice.date || ""}
          onChange={(e) => onChange({ date: e.target.value })}
          className="h-8 max-w-[150px] text-xs"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onEdit} title="Edit invoice (re-paste / add items)">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove} title="Delete invoice" className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="min-w-[200px]">Item Name</TableHead>
              <TableHead className="w-20">Qty</TableHead>
              <TableHead className="w-28">Purchase Price / Unit</TableHead>
              <TableHead className="w-32">Total Cost (incl. tax)</TableHead>
              <TableHead className="w-28">MRP / Unit</TableHead>
              <TableHead className="w-28 text-right">Discount %</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-xs text-muted-foreground">
                  No rows — paste invoice text above or click “Row” to add manually.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const mrpValue = (Number(r.mrp) || 0) * (Number(r.qty) || 0);
              const discountPct = mrpValue > 0
                ? ((mrpValue - (Number(r.amountWithTax) || 0)) / mrpValue) * 100
                : 0;
              const positive = discountPct > 0;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Input value={r.item} onChange={(e) => updateRow(r.id, { item: e.target.value })} className="h-8" placeholder="Item name" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} value={r.qty} onChange={(e) => updateRow(r.id, { qty: Number(e.target.value) || 0 })} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} value={r.price} onChange={(e) => updateRow(r.id, { price: Number(e.target.value) || 0 })} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} value={r.amountWithTax} onChange={(e) => updateRow(r.id, { amountWithTax: Number(e.target.value) || 0 })} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} value={r.mrp} onChange={(e) => updateRow(r.id, { mrp: Number(e.target.value) || 0 })} className="h-8" placeholder="MRP" />
                  </TableCell>
                  <TableCell className={`text-right text-sm font-semibold ${r.mrp > 0 ? (positive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400") : "text-muted-foreground"}`}>
                    {r.mrp > 0 ? `${discountPct.toFixed(2)}%` : "—"}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => removeRow(r.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t bg-muted/20 px-4 py-2 text-xs sm:grid-cols-4">
        <Stat label="Rows" value={String(rows.length)} />
        <Stat label="Invoice Cost" value={`₹${fmt(totalCost)}`} />
        <Stat label="Invoice MRP" value={`₹${fmt(totalMrp)}`} />
        <Stat label="Avg Discount" value={`${avgDiscount.toFixed(2)}%`} tone={avgDiscount > 0 ? "success" : undefined} />
      </div>
    </div>
  );
}

/* -------------------- Invoice add/edit dialog -------------------- */

function InvoiceDialog({ open, invoice, onClose, onSave }: {
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
          // Tab-delimited so our parser's tab branch kicks in cleanly
          parts.push(XLSX.utils.sheet_to_csv(ws, { FS: "\t", blankrows: false }));
        }
        txt = parts.join("\n");
      } else if (name.endsWith(".pdf")) {
        const pdfjs: any = await import("pdfjs-dist");
        // Use a worker-less build path: disable worker to avoid CDN setup
        try { pdfjs.GlobalWorkerOptions.workerSrc = ""; } catch {}
        const buf = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf, disableWorker: true }).promise;
        const lines: string[] = [];
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          const content = await page.getTextContent();
          // Group items by Y position to reconstruct rows
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
            // Join cells with tabs when there's a big horizontal gap
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
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> {invoice.rows.length ? "Edit invoice" : "Add invoice"}</DialogTitle>
        </DialogHeader>

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

        <div className="max-h-[40vh] overflow-auto rounded-lg border">
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={commit}><Save className="h-4 w-4" /> Save invoice</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SchemeConfigEditorImpl({ scheme, onChange }: { scheme: { kind: SchemeKind; config: any }; onChange: (c: any) => void }) {
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