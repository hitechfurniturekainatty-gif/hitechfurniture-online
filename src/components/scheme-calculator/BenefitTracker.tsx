import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Gift, Plus, ReceiptIndianRupee, Trash2 } from "lucide-react";
import type { BenefitReceipt, Row, SchemeKind, TimelineMode, VendorMonth } from "./types";
import { aggregateRowsByItem, computeFreeReport, fmt, fyCalendarYear, MONTH_NAME } from "./utils";

export type MonthBenefitSummary = {
  purchaseQty: number; purchaseCost: number; mrpValue: number; baseSaving: number; baseDiscountPct: number;
  freeEarned: number; amountEarned: number; freeReceived: number; amountReceived: number;
  freeReceivedValue: number; freePending: number; amountPending: number;
  effectiveBenefitValue: number; effectiveBenefitPct: number;
  earnedDetails: { label: string; qty: number }[];
};

function groupedSchemeReports(rows: Row[], fallback: { kind: SchemeKind; config: any }) {
  const groups = new Map<string, { label: string; kind: SchemeKind; config: any; rows: Row[] }>();
  for (const row of rows) {
    const kind = row.scheme_kind || fallback.kind;
    const config = row.scheme_config || fallback.config;
    const key = row.scheme_rule_id ? `row:${row.scheme_rule_id}` : `month:${kind}:${JSON.stringify(config)}`;
    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { label: row.scheme_name || "Month scheme", kind, config, rows: [row] });
  }
  return Array.from(groups.values()).map((g) => ({ ...g, report: computeFreeReport({ kind: g.kind, config: g.config }, aggregateRowsByItem(g.rows)) as any }));
}

export function summarizeMonthBenefit(vm: VendorMonth): MonthBenefitSummary {
  const rows = vm.invoices?.length ? vm.invoices.flatMap((i) => i.rows) : vm.purchase_rows;
  const grouped = groupedSchemeReports(rows, { kind: vm.scheme_kind, config: vm.scheme_config });
  const purchaseQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const purchaseCost = rows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
  const mrpValue = rows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
  const baseSaving = Math.max(0, mrpValue - purchaseCost);
  const baseDiscountPct = mrpValue > 0 ? baseSaving / mrpValue * 100 : 0;
  const freeEarned = grouped.reduce((sum, g) => sum + (g.report.rep || []).reduce((s: number, r: any) => s + (Number(r.free) || 0), 0), 0);

  let amountEarned = 0;
  for (const g of grouped) {
    const cost = g.rows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
    const mrp = g.rows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
    if (g.kind === "percent") amountEarned += cost * (Number(g.config?.percent) || 0) / 100;
    else if (g.kind === "cashback") {
      const min = Number(g.config?.minAmount) || 0;
      amountEarned += cost >= min ? (Number(g.config?.cashback) || 0) : 0;
    } else if (g.kind === "own") {
      const target = cost * (Number(g.config?.targetMargin) || 0) / 100;
      amountEarned += Math.max(0, Math.max(0, mrp - cost) - target);
    }
  }

  const receipts = vm.benefit_receipts || [];
  const freeReceipts = receipts.filter((r) => r.kind === "free_item");
  const freeReceived = freeReceipts.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const freeReceivedValue = freeReceipts.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unit_value) || 0), 0);
  const amountReceived = receipts.filter((r) => r.kind !== "free_item").reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const effectiveBenefitValue = baseSaving + freeReceivedValue + amountReceived;
  const effectiveBenefitPct = mrpValue > 0 ? effectiveBenefitValue / mrpValue * 100 : 0;

  return {
    purchaseQty, purchaseCost, mrpValue, baseSaving, baseDiscountPct,
    freeEarned, amountEarned, freeReceived, amountReceived, freeReceivedValue,
    freePending: Math.max(0, freeEarned - freeReceived), amountPending: Math.max(0, amountEarned - amountReceived),
    effectiveBenefitValue, effectiveBenefitPct,
    earnedDetails: grouped.flatMap((g) => (g.report.rep || []).filter((r: any) => (Number(r.free) || 0) > 0).map((r: any) => ({ label: `${g.label}: ${String(r.item || "Free item")}`, qty: Number(r.free) || 0 }))),
  };
}

export function BenefitReceiptEditor({ receipts, onChange }: { receipts: BenefitReceipt[]; onChange: (receipts: BenefitReceipt[]) => void; }) {
  const [kind, setKind] = useState<BenefitReceipt["kind"]>("free_item");
  const [item, setItem] = useState(""); const [qty, setQty] = useState(""); const [amount, setAmount] = useState("");
  const [unitValue, setUnitValue] = useState(""); const [reference, setReference] = useState("");
  const add = () => {
    const next: BenefitReceipt = { id: crypto.randomUUID(), kind, date: new Date().toISOString().slice(0, 10), item: item.trim() || undefined,
      qty: kind === "free_item" ? Math.max(0, Number(qty) || 0) : undefined,
      unit_value: kind === "free_item" ? Math.max(0, Number(unitValue) || 0) : undefined,
      amount: kind !== "free_item" ? Math.max(0, Number(amount) || 0) : undefined, reference: reference.trim() || undefined };
    if (kind === "free_item" && !next.qty) return; if (kind !== "free_item" && !next.amount) return;
    onChange([...receipts, next]); setItem(""); setQty(""); setAmount(""); setUnitValue(""); setReference("");
  };
  return <div className="space-y-3 rounded-xl border bg-background/60 p-4">
    <div className="flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /><h5 className="text-sm font-semibold">Received from vendor</h5></div>
    <div className="grid gap-2 md:grid-cols-6">
      <div><Label className="text-xs">Type</Label><Select value={kind} onValueChange={(v) => setKind(v as BenefitReceipt["kind"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="free_item">Free item</SelectItem><SelectItem value="credit_note">Credit note</SelectItem><SelectItem value="cashback">Cashback</SelectItem><SelectItem value="discount">Discount settlement</SelectItem></SelectContent></Select></div>
      <div><Label className="text-xs">{kind === "free_item" ? "Free product" : "Description"}</Label><Input value={item} onChange={(e) => setItem(e.target.value)} placeholder={kind === "free_item" ? "e.g. Ortho Bed" : "Optional"} /></div>
      <div><Label className="text-xs">{kind === "free_item" ? "Qty received" : "Amount received"}</Label><Input type="number" min="0" value={kind === "free_item" ? qty : amount} onChange={(e) => kind === "free_item" ? setQty(e.target.value) : setAmount(e.target.value)} placeholder="0" /></div>
      {kind === "free_item" ? <div><Label className="text-xs">Value / free unit</Label><Input type="number" min="0" value={unitValue} onChange={(e) => setUnitValue(e.target.value)} placeholder="Purchase value" /></div> : <div><Label className="text-xs">Benefit value</Label><Input disabled value={amount ? `₹${fmt(Number(amount))}` : "—"} /></div>}
      <div><Label className="text-xs">Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="CN no / invoice" /></div>
      <div className="flex items-end"><Button type="button" onClick={add} className="w-full gap-1"><Plus className="h-4 w-4" /> Add received</Button></div>
    </div>
    {receipts.length > 0 && <div className="space-y-1">{receipts.map((r) => <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs"><Badge variant="secondary">{r.kind.replaceAll("_", " ")}</Badge><span className="font-medium">{r.item || "Scheme settlement"}</span><span className="text-muted-foreground">{r.kind === "free_item" ? `${r.qty || 0} qty${r.unit_value ? ` · ₹${fmt((r.qty || 0) * r.unit_value)} value` : ""}` : `₹${fmt(Number(r.amount) || 0)}`}</span>{r.reference && <span className="text-muted-foreground">· {r.reference}</span>}<Button type="button" size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={() => onChange(receipts.filter((x) => x.id !== r.id))}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}</div>}
  </div>;
}

function groupsFor(mode: TimelineMode, months: VendorMonth[], fy: number) {
  if (mode === "yearly") return [{ label: `FY ${fy}–${String(fy + 1).slice(-2)}`, months }];
  if (mode === "halfyearly") return [{ label: "Apr–Sep", months: months.filter((m) => [4,5,6,7,8,9].includes(m.month)) }, { label: "Oct–Mar", months: months.filter((m) => [10,11,12,1,2,3].includes(m.month)) }];
  if (mode === "quarterly") return [{ label: "Q1 · Apr–Jun", months: months.filter((m) => [4,5,6].includes(m.month)) }, { label: "Q2 · Jul–Sep", months: months.filter((m) => [7,8,9].includes(m.month)) }, { label: "Q3 · Oct–Dec", months: months.filter((m) => [10,11,12].includes(m.month)) }, { label: "Q4 · Jan–Mar", months: months.filter((m) => [1,2,3].includes(m.month)) }];
  return months.map((m) => ({ label: `${MONTH_NAME[m.month]} ${fyCalendarYear(fy, m.month)}`, months: [m] }));
}

export function SchemeBenefitAnalysis({ months, fy, mode }: { months: VendorMonth[]; fy: number; mode: TimelineMode }) {
  const groups = useMemo(() => groupsFor(mode, months, fy).map((g) => {
    const p = g.months.map(summarizeMonthBenefit); const mrp = p.reduce((s,x)=>s+x.mrpValue,0); const base = p.reduce((s,x)=>s+x.baseSaving,0); const effective = p.reduce((s,x)=>s+x.effectiveBenefitValue,0);
    return { label:g.label, purchaseQty:p.reduce((s,x)=>s+x.purchaseQty,0), purchaseCost:p.reduce((s,x)=>s+x.purchaseCost,0), mrpValue:mrp, baseSaving:base, baseDiscountPct:mrp>0?base/mrp*100:0,
      freeEarned:p.reduce((s,x)=>s+x.freeEarned,0), freeReceived:p.reduce((s,x)=>s+x.freeReceived,0), freePending:p.reduce((s,x)=>s+x.freePending,0), freeValue:p.reduce((s,x)=>s+x.freeReceivedValue,0),
      amountEarned:p.reduce((s,x)=>s+x.amountEarned,0), amountReceived:p.reduce((s,x)=>s+x.amountReceived,0), amountPending:p.reduce((s,x)=>s+x.amountPending,0), effectiveBenefitValue:effective, effectiveBenefitPct:mrp>0?effective/mrp*100:0, details:p.flatMap(x=>x.earnedDetails) };
  }), [months,fy,mode]);
  const totalMrp=groups.reduce((s,g)=>s+g.mrpValue,0), totalBase=groups.reduce((s,g)=>s+g.baseSaving,0), totalEffective=groups.reduce((s,g)=>s+g.effectiveBenefitValue,0);
  const totals={ purchaseCost:groups.reduce((s,g)=>s+g.purchaseCost,0), basePct:totalMrp>0?totalBase/totalMrp*100:0, freeEarned:groups.reduce((s,g)=>s+g.freeEarned,0), freeReceived:groups.reduce((s,g)=>s+g.freeReceived,0), freePending:groups.reduce((s,g)=>s+g.freePending,0), freeValue:groups.reduce((s,g)=>s+g.freeValue,0), amountPending:groups.reduce((s,g)=>s+g.amountPending,0), effectivePct:totalMrp>0?totalEffective/totalMrp*100:0, effectiveValue:totalEffective };
  return <section className="rounded-2xl border bg-card p-4 shadow-sm">
    <div className="mb-4"><div className="flex items-center gap-2"><ReceiptIndianRupee className="h-5 w-5 text-primary"/><h3 className="font-display text-lg">Scheme Benefit Summary</h3></div><p className="mt-1 text-xs text-muted-foreground">Eligible = calculated from purchases. Received = actually received from vendor. Pending = balance still to receive.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{[["Purchase cost",`₹${fmt(totals.purchaseCost)}`],["Base discount",`${totals.basePct.toFixed(2)}%`],["Eligible Free",fmt(totals.freeEarned)],["Received Free",fmt(totals.freeReceived)],["Pending Free",fmt(totals.freePending)],["Amount Pending",`₹${fmt(totals.amountPending)}`],["Effective Benefit",`${totals.effectivePct.toFixed(2)}%`]].map(([l,v])=><div key={l} className="rounded-xl border bg-background p-3"><div className="text-[10px] uppercase text-muted-foreground">{l}</div><div className="mt-1 font-display text-lg font-semibold">{v}</div></div>)}</div>
    <div className="mt-4 overflow-x-auto rounded-xl border"><table className="w-full min-w-[900px] text-sm"><thead className="bg-muted/50 text-xs"><tr><th className="p-2 text-left">Period</th><th className="p-2 text-right">Purchase</th><th className="p-2 text-right">Eligible Free</th><th className="p-2 text-right">Received Free</th><th className="p-2 text-right">Pending Free</th><th className="p-2 text-right">Amount Pending</th><th className="p-2 text-right">Effective Benefit</th></tr></thead><tbody>{groups.map(g=><tr key={g.label} className="border-t"><td className="p-2 font-medium">{g.label}</td><td className="p-2 text-right">₹{fmt(g.purchaseCost)}</td><td className="p-2 text-right">{fmt(g.freeEarned)}</td><td className="p-2 text-right text-emerald-600">{fmt(g.freeReceived)}</td><td className="p-2 text-right font-semibold">{fmt(g.freePending)}</td><td className="p-2 text-right">₹{fmt(g.amountPending)}</td><td className="p-2 text-right font-semibold">₹{fmt(g.effectiveBenefitValue)} · {g.effectiveBenefitPct.toFixed(2)}%</td></tr>)}</tbody></table></div>
    {totals.freePending===0&&totals.amountPending===0&&<div className="mt-3 flex items-center gap-2 text-xs text-emerald-600"><CheckCircle2 className="h-4 w-4"/> No scheme benefit pending in this view.</div>}
  </section>;
}
