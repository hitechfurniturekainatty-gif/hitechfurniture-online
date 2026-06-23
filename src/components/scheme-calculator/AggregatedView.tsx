import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { MonthBlock } from "./MonthBlock";
import { MONTH_NAME, aggregateRowsByItem, computeAchievementPct, computeFreeReport, fmt } from "./utils";
import type { Row, SchemeRow, TimelineMode, VendorMonth } from "./types";

export function AggregatedView({ mode, fy, months, savedSchemes, onChangeMonth, onSaveMonth }: {
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
