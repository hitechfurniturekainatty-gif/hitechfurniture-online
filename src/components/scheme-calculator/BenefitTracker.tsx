import { periodReceiptsForMonths, type PeriodBenefitRecord, monthRows, invoiceRows } from "./periodBenefits";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Gift, Plus, ReceiptIndianRupee, Trash2 } from "lucide-react";
import type { BenefitReceipt, Row, SchemeKind, TimelineMode, VendorMonth } from "./types";
import { settlementTotals } from "./settlements";
export { BenefitReceiptEditor } from "./BenefitReceiptEditor";
import { aggregateRowsByItem, computeFreeReport, fmt, fyCalendarYear, MONTH_NAME } from "./utils";

export type MonthBenefitSummary = {
  purchaseQty: number; purchaseCost: number; mrpValue: number; baseSaving: number; baseDiscountPct: number;
  freeEarned: number; amountEarned: number; freeReceived: number; amountReceived: number;
  freeReceivedValue: number; freePending: number; amountPending: number;
  effectiveBenefitValue: number; effectiveBenefitPct: number; vendorCharges: number; creditSettledQty: number;
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
  const rows = monthRows(vm);
  const grouped = groupedSchemeReports(rows, { kind: vm.scheme_kind, config: vm.scheme_config });
  const purchaseQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const purchaseCost = rows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
  const mrpValue = rows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
  const baseSaving = mrpValue - purchaseCost;
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
  const settlements = settlementTotals(receipts);
  const freeReceived = settlements.freeReceived;
  const freeReceivedValue = settlements.freeValue;
  const amountReceived = settlements.cashValue;
  const effectiveBenefitValue = baseSaving + settlements.net;
  const effectiveBenefitPct = mrpValue > 0 ? effectiveBenefitValue / mrpValue * 100 : 0;

  return {
    purchaseQty, purchaseCost, mrpValue, baseSaving, baseDiscountPct,
    freeEarned, amountEarned, freeReceived, amountReceived, freeReceivedValue,
    freePending: Math.max(0, freeEarned - freeReceived - settlements.creditSettledQty), amountPending: Math.max(0, amountEarned - amountReceived),
    effectiveBenefitValue, effectiveBenefitPct, vendorCharges: settlements.charges, creditSettledQty: settlements.creditSettledQty,
    earnedDetails: grouped.flatMap((g) => (g.report.rep || []).filter((r: any) => (Number(r.free) || 0) > 0).map((r: any) => ({ label: `${g.label}: ${String(r.item || "Free item")}`, qty: Number(r.free) || 0 }))),
  };
}


function groupsFor(mode: TimelineMode, months: VendorMonth[], fy: number) {
  if (mode === "yearly") return [{ label: `FY ${fy}–${String(fy + 1).slice(-2)}`, months }];
  if (mode === "halfyearly") return [{ label: "Apr–Sep", months: months.filter((m) => [4,5,6,7,8,9].includes(m.month)) }, { label: "Oct–Mar", months: months.filter((m) => [10,11,12,1,2,3].includes(m.month)) }];
  if (mode === "quarterly") return [{ label: "Q1 · Apr–Jun", months: months.filter((m) => [4,5,6].includes(m.month)) }, { label: "Q2 · Jul–Sep", months: months.filter((m) => [7,8,9].includes(m.month)) }, { label: "Q3 · Oct–Dec", months: months.filter((m) => [10,11,12].includes(m.month)) }, { label: "Q4 · Jan–Mar", months: months.filter((m) => [1,2,3].includes(m.month)) }];
  return months.map((m) => ({ label: `${MONTH_NAME[m.month]} ${fyCalendarYear(fy, m.month)}`, months: [m] }));
}

export function summarizePeriodBenefit(months: VendorMonth[], fy: number, periodRecords: PeriodBenefitRecord[] = []) {
  const summaries = months.map(summarizeMonthBenefit);
  const extra = settlementTotals(periodReceiptsForMonths(periodRecords, fy, months.map(m => m.month)));
  const rows = months.flatMap(monthRows);
  const mrp = summaries.reduce((s,m) => s + m.mrpValue,0);
  const netCost = summaries.reduce((s,m) => s + m.purchaseCost,0);
  const base = mrp - netCost;
  const additional = summaries.reduce((s,m) => s + m.effectiveBenefitValue - m.baseSaving,0) + extra.net;
  const returns = Math.max(0, -rows.filter(r => r.qty < 0).reduce((s,r) => s + r.amountWithTax,0));
  return { mrp, netCost, base, additional, returns, benefit: base + additional, percent: mrp > 0 ? (base + additional) / mrp * 100 : null, completeMrp: rows.every(r => r.mrp > 0) };
}

export function SchemeBenefitAnalysis({ months, fy, mode, periodRecords = [] }: { months: VendorMonth[]; fy: number; mode: TimelineMode; periodRecords?: PeriodBenefitRecord[] }) {
  const groups = groupsFor(mode, months, fy).map(g => ({label:g.label,...summarizePeriodBenefit(g.months,fy,periodRecords)}));
  const total = summarizePeriodBenefit(months,fy,periodRecords);
  return <section className="rounded-2xl border border-primary/30 bg-card p-4 shadow-sm">
    <h3 className="text-lg font-semibold">Total benefit · മൊത്തം ആനുകൂല്യം</h3>
    <p className="mt-1 text-xs text-muted-foreground">MRP-യിലെ ലാഭം + Onam / Vishu / മറ്റ് അധിക benefits − അധിക vendor charge. Purchase return-ന്റെ MRPയും തുകയും കുറച്ച ശേഷമാണ് ശതമാനം. ഇത് selling profit margin അല്ല.</p>
    <div className="my-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{[["Net purchase / വാങ്ങൽ",`₹${fmt(total.netCost)}`],["Returns / തിരികെ നൽകിയത്",`₹${fmt(total.returns)}`],["Net MRP",`₹${fmt(total.mrp)}`],["Additional benefits",`₹${fmt(total.additional)}`],["Total benefit",`₹${fmt(total.benefit)}`],["Total benefit %",total.percent === null ? "—" : `${total.percent.toFixed(2)}%`]].map(([label,value]) => <div key={label} className="rounded-xl border bg-primary/5 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div>
    {!total.completeMrp && <p role="status" className="mb-3 text-xs text-muted-foreground">നൽകിയ MRP മൊത്തമാണ് ശതമാനത്തിന്റെ അടിസ്ഥാനം. MRP ഇല്ലാത്ത pillow / additional items-ന്റെ ബിൽ തുകയും purchase cost-ൽ ഉൾപ്പെടുത്തിയിട്ടുണ്ട്.</p>}
    <p className="mb-2 text-xs text-muted-foreground">FY total above · താഴെ തിരഞ്ഞെടുത്ത {mode} കാലയളവുകളുടെ കണക്ക്. ഓരോ benefit-ഉം ഒരിക്കൽ മാത്രം രേഖപ്പെടുത്തുക; മാസത്തിലെ എൻട്രികൾ quarterly / half-yearly / yearly-ലും സ്വയം ഉൾപ്പെടും.</p>
    <div className="overflow-x-auto"><table className="w-full table-fixed text-xs"><thead><tr>{["Period","Net purchase","Return","Base saving","Extra benefit","Total benefit","Benefit %"].map(label=><th key={label} className="p-2 text-right first:text-left">{label}</th>)}</tr></thead><tbody>{groups.map(g=><tr key={g.label} className="border-t"><td className="p-2 font-semibold">{g.label}</td>{[g.netCost,g.returns,g.base,g.additional,g.benefit].map((v,i)=><td key={i} className="p-2 text-right">₹{fmt(v)}</td>)}<td className="p-2 text-right font-bold text-primary">{g.percent === null ? "—" : `${g.percent.toFixed(2)}%`}</td></tr>)}</tbody></table></div>
  </section>;
}
