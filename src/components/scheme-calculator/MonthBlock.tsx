import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Plus, Save } from "lucide-react";
import { SchemePartyNotesButton } from "@/components/admin/SchemePartyNotesButton";
import { Stat } from "./Stat";
import { ProgressRing } from "./ProgressRing";
import { SchemeConfigEditor } from "./SchemeConfigEditor";
import { InvoiceCard } from "./InvoiceCard";
import { InvoiceDialog } from "./InvoiceDialog";
import { MONTH_NAME, SCHEME_LABEL, aggregateRowsByItem, computeAchievementPct, computeFreeReport, defaultConfig, fmt, fyCalendarYear } from "./utils";
import type { Invoice, Row, SchemeKind, SchemeRow, VendorMonth } from "./types";

export function MonthBlock({ vm, fy, savedSchemes, onChange, onSave }: {
  vm: VendorMonth; fy: number; savedSchemes: SchemeRow[];
  onChange: (patch: Partial<VendorMonth>) => void; onSave: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [dialogInvoice, setDialogInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try { await onSave(); } catch {} finally { setSaving(false); }
  };

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
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : `Save ${MONTH_NAME[vm.month]}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
