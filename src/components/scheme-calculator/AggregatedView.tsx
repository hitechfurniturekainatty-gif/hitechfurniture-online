import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { MonthBlock } from "./MonthBlock";
import { SchemeConfigEditor } from "./SchemeConfigEditor";
import { MONTH_NAME, aggregateRowsByItem, computeAchievementPct, computeFreeReport, fmt } from "./utils";
import type { Row, SchemeKind, SchemeRow, TimelineMode, VendorMonth } from "./types";

type PeriodRule = {
  id?: string;
  party_id: string;
  fy_year: number;
  period_type: "quarterly" | "halfyearly" | "yearly";
  period_key: string;
  scheme_kind: SchemeKind;
  scheme_config: any;
  benefit_receipts?: any[];
};

type Bucket = { key: string; label: string; months: VendorMonth[] };

const emptyItemScheme = () => ({
  rules: [{ purchaseItem: "", matchMode: "exact", familyExplicit: false, buyQty: 10, freeQty: 1, freeItem: "" }],
});

const bucketDefs = (mode: TimelineMode, fy: number, months: VendorMonth[]): Bucket[] => {
  if (mode === "yearly") return [{ key: "FY", label: `FY ${fy}–${String(fy + 1).slice(-2)}`, months }];
  if (mode === "quarterly") {
    const order = [
      { key: "Q1", label: "Q1 · Apr–Jun", set: [4, 5, 6] },
      { key: "Q2", label: "Q2 · Jul–Sep", set: [7, 8, 9] },
      { key: "Q3", label: "Q3 · Oct–Dec", set: [10, 11, 12] },
      { key: "Q4", label: "Q4 · Jan–Mar", set: [1, 2, 3] },
    ];
    return order.map((x) => ({ key: x.key, label: x.label, months: months.filter((m) => x.set.includes(m.month)) }));
  }
  return [
    { key: "H1", label: "H1 · Apr–Sep", months: months.filter((m) => [4, 5, 6, 7, 8, 9].includes(m.month)) },
    { key: "H2", label: "H2 · Oct–Mar", months: months.filter((m) => [10, 11, 12, 1, 2, 3].includes(m.month)) },
  ];
};

export function AggregatedView({ mode, fy, months, savedSchemes, onChangeMonth, onSaveMonth }: {
  mode: TimelineMode;
  fy: number;
  months: VendorMonth[];
  savedSchemes: SchemeRow[];
  onChangeMonth: (month: number, patch: Partial<VendorMonth>) => void;
  onSaveMonth: (m: VendorMonth) => void;
}) {
  const partyId = months[0]?.party_id || "";
  const periodType = mode === "quarterly" ? "quarterly" : mode === "halfyearly" ? "halfyearly" : "yearly";
  const buckets = useMemo(() => bucketDefs(mode, fy, months), [mode, fy, months]);
  const [rules, setRules] = useState<Record<string, PeriodRule>>({});
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!partyId || mode === "monthly") return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await (supabase as any)
        .from("scheme_period_rules")
        .select("*")
        .eq("party_id", partyId)
        .eq("fy_year", fy)
        .eq("period_type", periodType);
      if (cancelled) return;
      if (error) {
        toast({ title: "Period scheme load failed", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      const next: Record<string, PeriodRule> = {};
      for (const b of buckets) {
        const existing = (data || []).find((x: any) => x.period_key === b.key);
        next[b.key] = existing || {
          party_id: partyId,
          fy_year: fy,
          period_type: periodType,
          period_key: b.key,
          scheme_kind: "bogo",
          scheme_config: emptyItemScheme(),
          benefit_receipts: [],
        };
      }
      setRules(next);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [partyId, fy, periodType, mode]);

  const updateRule = (key: string, patch: Partial<PeriodRule>) => {
    setRules((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const saveRule = async (key: string) => {
    const rule = rules[key];
    if (!rule) return;
    setSavingKey(key);
    const payload = {
      party_id: partyId,
      fy_year: fy,
      period_type: periodType,
      period_key: key,
      scheme_kind: rule.scheme_kind,
      scheme_config: rule.scheme_config,
      benefit_receipts: rule.benefit_receipts || [],
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await (supabase as any)
      .from("scheme_period_rules")
      .upsert(payload, { onConflict: "party_id,fy_year,period_type,period_key" })
      .select()
      .single();
    setSavingKey(null);
    if (error) {
      toast({ title: "Period scheme save failed", description: error.message, variant: "destructive" });
      return;
    }
    setRules((prev) => ({ ...prev, [key]: data }));
    toast({ title: `${key} scheme saved`, description: "This rule is independent from monthly schemes and will use all invoice quantities inside this period." });
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="font-display text-lg">{mode === "quarterly" ? "Quarterly" : mode === "halfyearly" ? "Half-Yearly" : "Yearly"} Scheme Setup</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Each period has its own item-wise scheme. Invoice data remains monthly, but quantities from all months in this period are combined automatically for achievement and pending calculation.
        </p>
      </div>

      <div className="space-y-5">
        {buckets.map((b) => {
          const rule = rules[b.key] || {
            party_id: partyId,
            fy_year: fy,
            period_type: periodType,
            period_key: b.key,
            scheme_kind: "bogo" as SchemeKind,
            scheme_config: emptyItemScheme(),
            benefit_receipts: [],
          };
          const allRows: Row[] = b.months.flatMap((m) => m.invoices?.length ? m.invoices.flatMap((i) => i.rows) : m.purchase_rows);
          const agg = aggregateRowsByItem(allRows);
          const report: any = computeFreeReport({ kind: rule.scheme_kind, config: rule.scheme_config }, agg);
          const totalQty = allRows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
          const totalAmount = allRows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
          const totalMrp = allRows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
          const discountAmount = Math.max(0, totalMrp - totalAmount);
          const discountPct = totalMrp > 0 ? discountAmount / totalMrp * 100 : 0;
          const eligible = (report.rep || []).reduce((s: number, r: any) => s + (Number(r.free) || 0), 0);
          const pct = computeAchievementPct({ kind: rule.scheme_kind, config: rule.scheme_config }, agg);
          const targets = (report.targets || []).filter((t: any) => Number(t.gap) > 0);
          const received = (rule.benefit_receipts || []).filter((x: any) => x.kind === "free_item").reduce((s: number, x: any) => s + (Number(x.qty) || 0), 0);
          const pending = Math.max(0, eligible - received);

          return (
            <section key={b.key} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="border-b bg-muted/15 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{b.key}</div>
                    <h4 className="font-display text-lg">{b.label}</h4>
                    <p className="text-xs text-muted-foreground">{b.months.map((m) => MONTH_NAME[m.month]).join(" · ")}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-right text-xs sm:grid-cols-3 lg:grid-cols-6">
                    <div><div className="text-muted-foreground">Purchased Qty</div><b>{fmt(totalQty)}</b></div>
                    <div><div className="text-muted-foreground">Cost</div><b>₹{fmt(totalAmount)}</b></div>
                    <div><div className="text-muted-foreground">MRP</div><b>₹{fmt(totalMrp)}</b></div>
                    <div><div className="text-muted-foreground">Discount</div><b>{totalMrp > 0 ? `${fmt(discountPct)}%` : "—"}</b></div>
                    <div><div className="text-muted-foreground">Eligible Free</div><b className="text-emerald-700">{fmt(eligible)}</b></div>
                    <div><div className="text-muted-foreground">Pending Free</div><b className="text-amber-700">{fmt(pending)}</b></div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div className="rounded-xl border bg-background p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h5 className="text-sm font-semibold">Item-wise scheme for {b.key}</h5>
                      <p className="text-[11px] text-muted-foreground">Exact item matching is default. This rule applies only to the months shown above.</p>
                    </div>
                    <Button size="sm" onClick={() => saveRule(b.key)} disabled={savingKey === b.key}>
                      {savingKey === b.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {savingKey === b.key ? "Saving…" : `Save ${b.key} Scheme`}
                    </Button>
                  </div>
                  <SchemeConfigEditor
                    scheme={{ kind: rule.scheme_kind, config: rule.scheme_config }}
                    onChange={(config) => updateRule(b.key, { scheme_config: config })}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border bg-muted/10 p-3"><div className="text-xs text-muted-foreground">Achievement</div><div className="mt-1 text-2xl font-semibold">{fmt(pct)}%</div></div>
                  <div className="rounded-xl border bg-emerald-50/40 p-3"><div className="text-xs text-emerald-700">Eligible Free</div><div className="mt-1 text-2xl font-semibold text-emerald-700">{fmt(eligible)}</div></div>
                  <div className="rounded-xl border bg-muted/10 p-3"><div className="text-xs text-muted-foreground">Received Free</div><div className="mt-1 text-2xl font-semibold">{fmt(received)}</div></div>
                  <div className="rounded-xl border bg-amber-50/50 p-3"><div className="text-xs text-amber-700">Pending Free</div><div className="mt-1 text-2xl font-semibold text-amber-900">{fmt(pending)}</div></div>
                </div>

                <div className="rounded-xl border overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-muted/20 text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-left">Scheme Item</th><th className="px-3 py-2 text-right">Purchased</th><th className="px-3 py-2 text-right">Eligible Free</th><th className="px-3 py-2 text-left">Free Item</th><th className="px-3 py-2 text-right">Need More</th></tr></thead>
                    <tbody>
                      {(report.rep || []).length === 0 && targets.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-muted-foreground">Add an item rule above. Matching quantities from all invoices in this period will appear here.</td></tr>}
                      {(report.rep || []).map((r: any, i: number) => {
                        const target = targets.find((t: any) => String(t.item || "").includes(String(r.purchaseItem || r.item || "")));
                        return <tr key={`r-${i}`} className="border-t"><td className="px-3 py-2 font-medium">{r.purchaseItem || r.item || "—"}</td><td className="px-3 py-2 text-right tabular-nums">{fmt(Number(r.qty) || 0)}</td><td className="px-3 py-2 text-right font-semibold text-emerald-700">{fmt(Number(r.free) || 0)}</td><td className="px-3 py-2">{r.freeItem || r.reward || "—"}</td><td className="px-3 py-2 text-right tabular-nums">{target ? fmt(Number(target.gap) || 0) : "0"}</td></tr>;
                      })}
                      {(report.rep || []).length === 0 && targets.map((t: any, i: number) => <tr key={`t-${i}`} className="border-t"><td className="px-3 py-2 font-medium">{t.item || "—"}</td><td className="px-3 py-2 text-right">0</td><td className="px-3 py-2 text-right">0</td><td className="px-3 py-2">{t.reward || "—"}</td><td className="px-3 py-2 text-right font-semibold text-amber-700">{fmt(Number(t.gap) || 0)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 pt-2"><h3 className="font-display text-base">Monthly invoice breakdown</h3><span className="text-xs text-muted-foreground">· Source data used for the selected period calculation</span></div>
        {buckets.map((b) => (
          <div key={`mb-${b.key}`} className="space-y-3">
            <div className="flex items-center gap-2"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{b.label}</span><div className="h-px flex-1 bg-border" /></div>
            {b.months.map((m) => <MonthBlock key={`${b.key}-${m.month}`} vm={m} fy={fy} savedSchemes={savedSchemes} onChange={(patch) => onChangeMonth(m.month, patch)} onSave={() => onSaveMonth(m)} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
