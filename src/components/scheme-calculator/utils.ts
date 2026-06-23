// Pure helpers for the Vendor Scheme Dashboard — invoice parsing, item
// aggregation, scheme evaluation, and FY date helpers. Extracted from
// AdminSchemeCalculator.tsx during the P5 refactor.
import type { Row, SchemeKind } from "./types";

export const newRow = (): Row => ({
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
export function parseInvoiceText(text: string): Row[] {
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

    if (parts.length >= 2) {
      let totalIdx = -1;
      for (let i = parts.length - 1; i >= 0; i--) {
        if (isNumTok(parts[i])) { totalIdx = i; break; }
      }
      if (totalIdx > 0) {
        total = numClean(parts[totalIdx]);
        let qtyIdx = -1;
        for (let i = 0; i < totalIdx; i++) {
          if (isNumTok(parts[i])) { qtyIdx = i; break; }
        }
        if (qtyIdx > 0) {
          item = parts.slice(0, qtyIdx).join(" ").trim();
          qty = numClean(parts[qtyIdx]);
          for (let i = qtyIdx + 1; i < totalIdx; i++) {
            if (isNumTok(parts[i])) { price = numClean(parts[i]); break; }
          }
        }
      }
    }

    if (!item || !Number.isFinite(total)) {
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
 */
export function aggregateRowsByItem(rows: Row[]): Row[] {
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

export const fmt = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "0";

export const SCHEME_LABEL: Record<SchemeKind, string> = {
  company: "Company (1 free / N qty)",
  own: "Own (target margin %)",
  slab: "Slab (tiered free items)",
  bogo: "Buy X Get Y",
  percent: "% Discount on total",
  cashback: "Cashback on target",
  custom: "Custom (per-product free qty)",
};

export const defaultConfig = (kind: SchemeKind): any => {
  switch (kind) {
    case "company": return { everyQty: 10 };
    case "own": return { targetMargin: 15 };
    case "slab": return { slabs: [{ minQty: 10, free: 1 }, { minQty: 25, free: 3 }, { minQty: 50, free: 7 }] };
    case "bogo": return { buyQty: 2, getQty: 1 };
    case "percent": return { percent: 5 };
    case "cashback": return { minAmount: 50000, cashback: 2000 };
    case "custom": return { groups: [{ name: "Group 1", slabs: [{ minQty: 10, free: 2 }], rows: [{ pattern: "", freeProduct: "" }] }] };
  }
};

export function computeFreeReport(scheme: { kind: SchemeKind; config: any }, rows: Row[]) {
  const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
  const totalMrp = rows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
  const live = rows.filter((r) => r.item && r.qty > 0);
  const { kind, config } = scheme;

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
      const legacyPatterns: string[] = String(g.patterns || "")
        .split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
      const legacyRows = legacyPatterns.length
        ? legacyPatterns.map((p) => ({ pattern: p, freeProduct: g.freeProduct || "" }))
        : [];
      const bundleRows: { pattern: string; freeProduct: string }[] =
        Array.isArray(g.rows) && g.rows.length ? g.rows : legacyRows;
      const activeRows = bundleRows
        .map((r) => ({ pattern: String(r.pattern || "").trim().toLowerCase(), freeProduct: String(r.freeProduct || "").trim() }))
        .filter((r) => r.pattern);
      if (!activeRows.length) continue;
      const matchedRows = live.filter((r) => {
        const n = (r.item || "").toLowerCase();
        return activeRows.some((ar) => n.includes(ar.pattern));
      });
      const groupQty = matchedRows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
      const slabs = (g.slabs || []).slice().sort((a: any, b: any) => Number(a.minQty) - Number(b.minQty));
      let matchedSlab: any = null;
      for (const s of slabs) if (groupQty >= Number(s.minQty)) matchedSlab = s;
      const perUnit = matchedSlab ? Number(matchedSlab.free) || 0 : 0;
      const perQty = matchedSlab ? Math.max(1, Number(matchedSlab.minQty) || 1) : 0;
      const free = matchedSlab ? Math.floor(groupQty / perQty) * perUnit : 0;
      totalFree += free;
      const freebies = Array.from(new Set(activeRows.map((r) => r.freeProduct).filter(Boolean)));
      const freeProd = freebies.join(" + ") || g.freeProduct || (matchedRows[0]?.item ?? "—");
      const matchedNames = matchedRows.map((r) => `${r.item} (${r.qty})`).join(", ") || "no items matched";
      rep.push({
        item: `${g.name || "Group"} → ${freeProd}`,
        qty: groupQty,
        free,
        note: matchedSlab
          ? `Bundle total ${groupQty} qty [${matchedNames}] → every ${matchedSlab.minQty} → ${matchedSlab.free} free ${freeProd} (×${Math.floor(groupQty / perQty)} = ${free})`
          : `Bundle total ${groupQty} qty [${matchedNames}] — below first slab`,
      });
      const nextSlab = slabs.find((s: any) => groupQty < Number(s.minQty));
      if (nextSlab) {
        const gap = Number(nextSlab.minQty) - groupQty;
        targets.push({
          item: `${g.name || "Group"} → ${freeProd}`,
          have: groupQty,
          need: Number(nextSlab.minQty),
          gap,
          reward: `${nextSlab.free} free ${freeProd}`,
          note: `Buy ${gap} more across bundle [${activeRows.map((r) => r.pattern).join(", ")}] to unlock`,
        });
      } else if (matchedSlab) {
        const nextMilestone = (Math.floor(groupQty / perQty) + 1) * perQty;
        const gap = nextMilestone - groupQty;
        targets.push({
          item: `${g.name || "Group"} → ${freeProd}`,
          have: groupQty,
          need: nextMilestone,
          gap,
          reward: `+${perUnit} free ${freeProd}`,
          note: `Buy ${gap} more across bundle [${activeRows.map((r) => r.pattern).join(", ")}] for next +${perUnit} free`,
        });
      }
    }
    return { rep, targets, summary: `Total free items: ${totalFree}` };
  }
  void totalMrp;
  return { rep: [], targets: [], summary: "" };
}

/**
 * Achievement % for a scheme on the given rows.
 */
export function computeAchievementPct(
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
  const pcts = targets.map((t: any) =>
    Number(t.need) > 0
      ? Math.min(100, (Number(t.have) / Number(t.need)) * 100)
      : 0,
  );
  const avg = pcts.reduce((s, p) => s + p, 0) / pcts.length;
  return Math.round(avg);
}

export const FY_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
export const MONTH_NAME = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fyCalendarYear(fyYear: number, month: number) {
  return month >= 4 ? fyYear : fyYear + 1;
}
export function currentFy() {
  const d = new Date();
  return d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
}
