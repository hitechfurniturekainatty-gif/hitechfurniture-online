import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Gift, Plus, ReceiptIndianRupee, Trash2 } from "lucide-react";
import type { BenefitReceipt, TimelineMode, VendorMonth } from "./types";
import { aggregateRowsByItem, computeFreeReport, fmt, fyCalendarYear, MONTH_NAME } from "./utils";

export type MonthBenefitSummary = {
  freeEarned: number;
  amountEarned: number;
  freeReceived: number;
  amountReceived: number;
  freePending: number;
  amountPending: number;
  earnedDetails: { label: string; qty: number }[];
};

export function summarizeMonthBenefit(vm: VendorMonth): MonthBenefitSummary {
  const rows = vm.invoices?.length ? vm.invoices.flatMap((i) => i.rows) : vm.purchase_rows;
  const agg = aggregateRowsByItem(rows);
  const report = computeFreeReport({ kind: vm.scheme_kind, config: vm.scheme_config }, agg) as any;
  const freeEarned = (report.rep || []).reduce((s: number, r: any) => s + (Number(r.free) || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);

  let amountEarned = 0;
  if (vm.scheme_kind === "percent") {
    amountEarned = totalAmount * (Number(vm.scheme_config?.percent) || 0) / 100;
  } else if (vm.scheme_kind === "cashback") {
    const min = Number(vm.scheme_config?.minAmount) || 0;
    amountEarned = totalAmount >= min ? (Number(vm.scheme_config?.cashback) || 0) : 0;
  } else if (vm.scheme_kind === "own") {
    const target = totalAmount * (Number(vm.scheme_config?.targetMargin) || 0) / 100;
    const totalMargin = rows.reduce((s, r) => s + Math.max(0, (Number(r.mrp) || 0) * (Number(r.qty) || 0) - (Number(r.amountWithTax) || 0)), 0);
    amountEarned = Math.max(0, totalMargin - target);
  }

  const receipts = vm.benefit_receipts || [];
  const freeReceived = receipts.filter((r) => r.kind === "free_item").reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const amountReceived = receipts.filter((r) => r.kind !== "free_item").reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return {
    freeEarned,
    amountEarned,
    freeReceived,
    amountReceived,
    freePending: Math.max(0, freeEarned - freeReceived),
    amountPending: Math.max(0, amountEarned - amountReceived),
    earnedDetails: (report.rep || [])
      .filter((r: any) => (Number(r.free) || 0) > 0)
      .map((r: any) => ({ label: String(r.item || "Free item"), qty: Number(r.free) || 0 })),
  };
}

export function BenefitReceiptEditor({ receipts, onChange }: {
  receipts: BenefitReceipt[];
  onChange: (receipts: BenefitReceipt[]) => void;
}) {
  const [kind, setKind] = useState<BenefitReceipt["kind"]>("free_item");
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");

  const add = () => {
    const next: BenefitReceipt = {
      id: crypto.randomUUID(),
      kind,
      date: new Date().toISOString().slice(0, 10),
      item: item.trim() || undefined,
      qty: kind === "free_item" ? Math.max(0, Number(qty) || 0) : undefined,
      amount: kind !== "free_item" ? Math.max(0, Number(amount) || 0) : undefined,
      reference: reference.trim() || undefined,
    };
    if (kind === "free_item" && !next.qty) return;
    if (kind !== "free_item" && !next.amount) return;
    onChange([...receipts, next]);
    setItem(""); setQty(""); setAmount(""); setReference("");
  };

  return (
    <div className="space-y-3 rounded-xl border bg-background/60 p-4">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-primary" />
        <h5 className="text-sm font-semibold">Benefits actually received</h5>
      </div>
      <div className="grid gap-2 md:grid-cols-5">
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as BenefitReceipt["kind"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free_item">Free item</SelectItem>
              <SelectItem value="credit_note">Credit note</SelectItem>
              <SelectItem value="cashback">Cashback</SelectItem>
              <SelectItem value="discount">Discount settlement</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{kind === "free_item" ? "Free product" : "Description"}</Label>
          <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder={kind === "free_item" ? "e.g. Ortho Bed" : "Optional"} />
        </div>
        <div>
          <Label className="text-xs">{kind === "free_item" ? "Qty received" : "Amount received"}</Label>
          <Input type="number" min="0" value={kind === "free_item" ? qty : amount} onChange={(e) => kind === "free_item" ? setQty(e.target.value) : setAmount(e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label className="text-xs">Reference</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="CN no / invoice" />
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={add} className="w-full gap-1"><Plus className="h-4 w-4" /> Add received</Button>
        </div>
      </div>
      {receipts.length > 0 && (
        <div className="space-y-1">
          {receipts.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs">
              <Badge variant="secondary">{r.kind.replaceAll("_", " ")}</Badge>
              <span className="font-medium">{r.item || "Scheme settlement"}</span>
              <span className="text-muted-foreground">{r.kind === "free_item" ? `${r.qty || 0} qty` : `₹${fmt(Number(r.amount) || 0)}`}</span>
              {r.reference && <span className="text-muted-foreground">· {r.reference}</span>}
              {r.date && <span className="text-muted-foreground">· {r.date}</span>}
              <Button type="button" size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={() => onChange(receipts.filter((x) => x.id !== r.id))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupsFor(mode: TimelineMode, months: VendorMonth[], fy: number) {
  if (mode === "yearly") return [{ label: `FY ${fy}–${String(fy + 1).slice(-2)}`, months }];
  if (mode === "halfyearly") return [
    { label: "Apr–Sep", months: months.filter((m) => [4,5,6,7,8,9].includes(m.month)) },
    { label: "Oct–Mar", months: months.filter((m) => [10,11,12,1,2,3].includes(m.month)) },
  ];
  if (mode === "quarterly") return [
    { label: "Q1 · Apr–Jun", months: months.filter((m) => [4,5,6].includes(m.month)) },
    { label: "Q2 · Jul–Sep", months: months.filter((m) => [7,8,9].includes(m.month)) },
    { label: "Q3 · Oct–Dec", months: months.filter((m) => [10,11,12].includes(m.month)) },
    { label: "Q4 · Jan–Mar", months: months.filter((m) => [1,2,3].includes(m.month)) },
  ];
  return months.map((m) => ({ label: `${MONTH_NAME[m.month]} ${fyCalendarYear(fy, m.month)}`, months: [m] }));
}

export function SchemeBenefitAnalysis({ months, fy, mode }: { months: VendorMonth[]; fy: number; mode: TimelineMode }) {
  const groups = useMemo(() => groupsFor(mode, months, fy).map((g) => {
    const parts = g.months.map(summarizeMonthBenefit);
    return {
      label: g.label,
      freeEarned: parts.reduce((s, x) => s + x.freeEarned, 0),
      freeReceived: parts.reduce((s, x) => s + x.freeReceived, 0),
      freePending: parts.reduce((s, x) => s + x.freePending, 0),
      amountEarned: parts.reduce((s, x) => s + x.amountEarned, 0),
      amountReceived: parts.reduce((s, x) => s + x.amountReceived, 0),
      amountPending: parts.reduce((s, x) => s + x.amountPending, 0),
      details: parts.flatMap((x) => x.earnedDetails),
    };
  }), [months, fy, mode]);

  const totals = groups.reduce((a, g) => ({
    freeEarned: a.freeEarned + g.freeEarned,
    freeReceived: a.freeReceived + g.freeReceived,
    freePending: a.freePending + g.freePending,
    amountEarned: a.amountEarned + g.amountEarned,
    amountReceived: a.amountReceived + g.amountReceived,
    amountPending: a.amountPending + g.amountPending,
  }), { freeEarned: 0, freeReceived: 0, freePending: 0, amountEarned: 0, amountReceived: 0, amountPending: 0 });

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><ReceiptIndianRupee className="h-5 w-5 text-primary" /><h3 className="font-display text-lg">Scheme Benefit Analysis</h3></div>
          <p className="mt-1 text-xs text-muted-foreground">Earned → received → still pending, using the selected timeline.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Free pending: {fmt(totals.freePending)}</Badge>
          <Badge variant="outline">Amount pending: ₹{fmt(totals.amountPending)}</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Free earned", fmt(totals.freeEarned)], ["Free received", fmt(totals.freeReceived)], ["Free pending", fmt(totals.freePending)],
          ["Amount earned", `₹${fmt(totals.amountEarned)}`], ["Amount received", `₹${fmt(totals.amountReceived)}`], ["Amount pending", `₹${fmt(totals.amountPending)}`],
        ].map(([label, value]) => <div key={label} className="rounded-xl border bg-background p-3"><div className="text-[10px] uppercase text-muted-foreground">{label}</div><div className="mt-1 font-display text-lg font-semibold">{value}</div></div>)}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-xs"><tr><th className="p-2 text-left">Period</th><th className="p-2 text-right">Free earned</th><th className="p-2 text-right">Received</th><th className="p-2 text-right">Pending</th><th className="p-2 text-right">Amount earned</th><th className="p-2 text-right">Received</th><th className="p-2 text-right">Pending</th></tr></thead>
          <tbody>{groups.map((g) => <tr key={g.label} className="border-t"><td className="p-2"><div className="font-medium">{g.label}</div>{g.details.length > 0 && <div className="mt-0.5 max-w-[320px] truncate text-[11px] text-muted-foreground">{g.details.map((d) => `${d.label}: ${d.qty}`).join(" · ")}</div>}</td><td className="p-2 text-right">{fmt(g.freeEarned)}</td><td className="p-2 text-right text-emerald-600">{fmt(g.freeReceived)}</td><td className="p-2 text-right font-semibold">{fmt(g.freePending)}</td><td className="p-2 text-right">₹{fmt(g.amountEarned)}</td><td className="p-2 text-right text-emerald-600">₹{fmt(g.amountReceived)}</td><td className="p-2 text-right font-semibold">₹{fmt(g.amountPending)}</td></tr>)}</tbody>
        </table>
      </div>
      {(totals.freePending === 0 && totals.amountPending === 0) && <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600"><CheckCircle2 className="h-4 w-4" /> No scheme benefit pending in this view.</div>}
    </section>
  );
}
