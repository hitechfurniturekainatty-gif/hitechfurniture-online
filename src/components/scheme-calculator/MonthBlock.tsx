import { monthRows, invoiceRows } from "./periodBenefits";
import { settlementRules, settlementTotals } from "./settlements";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Plus, Save } from "lucide-react";
import { SchemePartyNotesButton } from "@/components/admin/SchemePartyNotesButton";
import { Stat } from "./Stat";
import { SchemeConfigEditor } from "./SchemeConfigEditor";
import { InvoiceCard } from "./InvoiceCard";
import { InvoiceDialog } from "./InvoiceDialog";
import { BenefitReceiptEditor, summarizeMonthBenefit } from "./BenefitTracker";
import { ItemBenefitTracker } from "./ItemBenefitTracker";
import { hasSchemeRule, MONTH_NAME, SCHEME_LABEL, aggregateRowsByItem, computeAchievementPct, computeFreeReport, defaultConfig, fmt, fyCalendarYear } from "./utils";
import type { BenefitReceipt, Invoice, Row, SchemeKind, SchemeRow, VendorMonth } from "./types";

const exactQuantityConfig = () => ({ rules: [{ purchaseItem: "", matchMode: "exact", familyExplicit: false, buyQty: 10, freeQty: 1, freeItem: "" }] });
const freshConfig = (kind: SchemeKind) => kind === "bogo" ? exactQuantityConfig() : defaultConfig(kind);

function itemAwareReport(rows: Row[], fallback: { kind: SchemeKind; config: any }) {
  const groups = new Map<string, { label: string; kind: SchemeKind; config: any; rows: Row[] }>();
  for (const row of rows) {
    const kind = row.scheme_kind || fallback.kind;
    const config = row.scheme_config || fallback.config;
    const key = row.scheme_rule_id ? `row:${row.scheme_rule_id}` : `month:${kind}:${JSON.stringify(config)}`;
    const label = row.scheme_name || "Month scheme";
    const existing = groups.get(key);
    if (existing) existing.rows.push(row); else groups.set(key, { label, kind, config, rows: [row] });
  }
  const rep: any[] = [], targets: any[] = [];
  let weightedPct = 0, qtyWeight = 0;
  for (const g of groups.values()) {
    if (g.kind === "bogo" && Array.isArray(g.config?.rules) && !g.config.rules.some(hasSchemeRule)) continue;
    const agg = aggregateRowsByItem(g.rows);
    const report: any = computeFreeReport({ kind: g.kind, config: g.config }, agg);
    rep.push(...(report.rep || []).map((r: any) => ({ ...r, item: `${g.label}: ${r.item}` })));
    targets.push(...(report.targets || []).filter((t: any) => Number(t.gap) > 0 && !String(t.reward || "").includes("+0")).map((t: any) => ({ ...t, item: `${g.label}: ${t.item}` })));
    const qty = g.rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    weightedPct += computeAchievementPct({ kind: g.kind, config: g.config }, agg) * qty;
    qtyWeight += qty;
  }
  return { rep, targets, completion: qtyWeight > 0 ? Math.round(weightedPct / qtyWeight) : 0 };
}

export function MonthBlock({ vm, fy, savedSchemes, onChange, onSave, additionalReceipts = [], invoiceReceipts = [], schemeMonths = [] }: {
  additionalReceipts?: BenefitReceipt[];
  invoiceReceipts?: BenefitReceipt[];
  schemeMonths?: VendorMonth[];
  vm: VendorMonth;
  fy: number;
  savedSchemes: SchemeRow[];
  onChange: (patch: Partial<VendorMonth>) => void;
  onSave: (next?: VendorMonth) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogInvoice, setDialogInvoice] = useState<Invoice | null>(null);
  const isCurrent = (() => { const n = new Date(); return n.getFullYear() === fyCalendarYear(fy, vm.month) && n.getMonth() + 1 === vm.month; })();
  useEffect(() => { if (isCurrent) setOpen(true); }, [isCurrent]);

  const invoices: Invoice[] = vm.invoices?.length ? vm.invoices : (vm.purchase_rows.length ? [{ id: "legacy", label: "Invoice 1", rows: vm.purchase_rows }] : []);
  const flatRows: Row[] = invoiceRows(invoices);

  useEffect(() => {
    const untouchedLegacyDefault = flatRows.length === 0 && vm.scheme_kind === "company" && Number(vm.scheme_config?.everyQty) === 10;
    if (untouchedLegacyDefault) onChange({ scheme_kind: "bogo", scheme_config: exactQuantityConfig() });
  }, [vm.month, vm.scheme_kind]);

  const nextMonthWithInvoices = (next: Invoice[]): VendorMonth => ({ ...vm, invoices: next, purchase_rows: invoiceRows(next) });
  const setInvoices = (next: Invoice[]) => onChange({ invoices: next, purchase_rows: invoiceRows(next) });
  const updateInvoice = (id: string, patch: Partial<Invoice>) => setInvoices(invoices.map((i) => i.id === id ? { ...i, ...patch } : i));
  const persistInvoices = async (next: Invoice[]) => {
    const nextMonth = nextMonthWithInvoices(next);
    onChange({ invoices: nextMonth.invoices, purchase_rows: nextMonth.purchase_rows });
    await onSave(nextMonth);
  };

  const report = useMemo(() => itemAwareReport(flatRows, { kind: vm.scheme_kind, config: vm.scheme_config }), [vm.scheme_kind, vm.scheme_config, vm.invoices, vm.purchase_rows]);
  const totalQty = flatRows.reduce((s, r) => s + (+r.qty || 0), 0);
  const totalAmount = flatRows.reduce((s, r) => s + (+r.amountWithTax || 0), 0);
  const totalMrp = flatRows.reduce((s, r) => s + (+r.mrp || 0) * (+r.qty || 0), 0);
  const vendorDiscount = totalMrp > 0 ? Math.max(0, (totalMrp - totalAmount) / totalMrp * 100) : 0;
  const free = report.rep.reduce((s: number, r: any) => s + (+r.free || 0), 0);
  const targets = report.targets as any[];
  const completion = report.completion;
  const label = `${MONTH_NAME[vm.month]} ${fyCalendarYear(fy, vm.month)}`;
  const receivedFree = [...(vm.benefit_receipts || []),...invoiceReceipts.filter(r=>settlementRules(report).some(rule=>rule.key===r.scheme_rule_key))].filter((r) => r.kind === "free_item").reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const pendingFree = Math.max(0, free - receivedFree - settlementTotals(vm.benefit_receipts || []).creditSettledQty);
  const applySaved = (id: string) => { const s = savedSchemes.find((x) => x.id === id); if (s) onChange({ scheme_kind: s.kind, scheme_config: s.config || freshConfig(s.kind) }); };
  const handleSave = async () => { if (saving) return; setSaving(true); try { await onSave(); } finally { setSaving(false); } };
  const simpleKinds: SchemeKind[] = ["bogo", "percent", "company", "slab", "cashback", "own"];
  const benefit = summarizeMonthBenefit({...vm,benefit_receipts:[...(vm.benefit_receipts || []),...additionalReceipts]});
  const visibleKinds = simpleKinds.includes(vm.scheme_kind) ? simpleKinds : [vm.scheme_kind, ...simpleKinds];

  return <div className={`scheme-period rounded-2xl border bg-card shadow-sm ${isCurrent ? "border-primary/50" : "border-border"}`}>
    <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-4 px-4 py-3 text-left">
      <div className="admin-accent-tile admin-accent-sage flex h-12 w-12 flex-col items-center justify-center rounded-xl"><span className="text-[9px]">{MONTH_NAME[vm.month]}</span><b className="text-xs">{String(fyCalendarYear(fy, vm.month)).slice(-2)}</b></div>
      <div className="flex-1"><div className="font-display">{label} {isCurrent && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">CURRENT</span>}</div><div className="text-xs text-muted-foreground">{totalQty} qty · Cost ₹{fmt(totalAmount)} · MRP ₹{fmt(totalMrp)} · {totalMrp > 0 && <span>{fmt(vendorDiscount)}% vendor discount · </span>}<span className="font-medium text-primary">{free} eligible</span> · <span className="text-emerald-700">{receivedFree} received</span> · <span className="font-semibold text-amber-700">{pendingFree} pending</span></div></div>
      <span className="shrink-0 text-right"><span className="block text-xs text-muted-foreground">Total benefit</span><b>{benefit.mrpValue > 0 ? benefit.effectiveBenefitPct.toFixed(2) + "%" : "—"}</b></span>{open ? <ChevronUp /> : <ChevronDown />}
    </button>

    {open && <div className="space-y-4 border-t p-4">
      <section className="admin-section-card p-4">
        <div className="mb-2 flex justify-between"><div><h4 className="text-sm font-semibold">① Scheme items for this month</h4><p className="text-xs text-muted-foreground">Add only the item that actually has a scheme. Exact item is default. Family / contains works only when you choose it.</p></div>{savedSchemes.length > 0 && <Select value="" onValueChange={applySaved}><SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Apply template…" /></SelectTrigger><SelectContent>{savedSchemes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>}</div>
        <div className="mb-3 max-w-md"><Label className="text-xs">Scheme type</Label><Select value={vm.scheme_kind} onValueChange={(v) => { const kind = v as SchemeKind; onChange({ scheme_kind: kind, scheme_config: freshConfig(kind) }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{visibleKinds.map((k) => <SelectItem key={k} value={k}>{k === "bogo" ? "Item-wise Quantity Scheme" : k === "percent" ? "Percentage Discount" : SCHEME_LABEL[k]}</SelectItem>)}</SelectContent></Select></div>
        <SchemeConfigEditor scheme={{ kind: vm.scheme_kind, config: vm.scheme_config }} onChange={(c) => onChange({ scheme_config: c })} />
      </section>

      <section className="admin-section-card border-dashed p-4">
        <div className="mb-3 flex flex-wrap justify-between gap-3">
          <div><h4 className="font-semibold">② All invoices for {label}</h4><p className="text-xs text-muted-foreground">Every saved invoice stays here. Upload/save is persisted immediately. MRP, quantity, cost, discount and scheme status remain visible together.</p></div>
          <div className="flex flex-wrap gap-3"><Stat label="Invoices" value={String(invoices.length)} /><Stat label="MRP Value" value={`₹${fmt(totalMrp)}`} /><Stat label="Cost incl. Tax" value={`₹${fmt(totalAmount)}`} /><Stat label="Vendor Discount" value={totalMrp > 0 ? `${fmt(vendorDiscount)}%` : "Add MRP"} /><Stat label="Eligible Free" value={fmt(free)} /></div>
        </div>

        {invoices.length > 0 && <div className="mb-4 overflow-hidden rounded-xl border bg-background">
          <div className="grid grid-cols-[minmax(0,1.6fr)_0.5fr_0.5fr_1fr_1fr] gap-3 border-b bg-muted/20 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
            <div>Invoice</div><div className="text-right">Qty</div><div className="text-right">Items</div><div className="text-right">MRP Value</div><div className="text-right">Cost incl. Tax</div>
          </div>
          {invoices.map((inv, i) => {
            const signedRows = invoiceRows([inv]);
            const qty = signedRows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
            const mrp = signedRows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
            const cost = signedRows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
            return <div key={inv.id} className="grid grid-cols-[minmax(0,1.6fr)_0.5fr_0.5fr_1fr_1fr] gap-3 border-b px-3 py-2 text-xs last:border-b-0">
              <div className="min-w-0"><div className="truncate font-medium">{inv.label || `Invoice ${i + 1}`}</div><div className="truncate text-[11px] text-muted-foreground">{inv.invoice_no || "No invoice no."}{inv.date ? ` · ${inv.date}` : ""}</div></div>
              <div className="text-right tabular-nums">{fmt(qty)}</div><div className="text-right tabular-nums">{inv.rows.length}</div><div className="text-right font-medium tabular-nums">₹{fmt(mrp)}</div><div className="text-right font-medium tabular-nums">₹{fmt(cost)}</div>
            </div>;
          })}
        </div>}

        <Button size="sm" onClick={() => { setDialogInvoice({ id: crypto.randomUUID(), label: `Invoice ${invoices.length + 1}`, date: `${fyCalendarYear(fy, vm.month)}-${String(vm.month).padStart(2,"0")}-01`, rows: [] }); setDialogOpen(true); }}><Plus className="h-4 w-4" /> Add Invoice</Button>
        <Button className="ml-2" size="sm" variant="outline" onClick={() => { setDialogInvoice({ id: crypto.randomUUID(), label: `Purchase return ${invoices.filter(i => i.document_kind === "purchase_return").length + 1}`, document_kind: "purchase_return", date: `${fyCalendarYear(fy, vm.month)}-${String(vm.month).padStart(2,"0")}-01`, rows: [] }); setDialogOpen(true); }}><Plus className="h-4 w-4" /> Debit note · Purchase return</Button><p className="mt-2 text-xs text-muted-foreground">വാങ്ങിയ സാധനം തിരികെ നൽകിയാൽ Debit note ചേർക്കുക. അതേ upload / copy-paste രീതിയാണ്; quantity, MRP, purchase amount എന്നിവ മൊത്തത്തിൽ നിന്ന് കുറയും.</p>
        <div className="mt-3 space-y-4">{invoices.map((inv, i) => <InvoiceCard key={inv.id} index={i} invoice={inv} savedSchemes={savedSchemes} fallbackScheme={{ kind: vm.scheme_kind, config: vm.scheme_config }} onChange={(p) => updateInvoice(inv.id, p)} onPersist={() => onSave(nextMonthWithInvoices(invoices))} onRemove={() => persistInvoices(invoices.filter((x) => x.id !== inv.id))} onEdit={() => { setDialogInvoice(inv); setDialogOpen(true); }} />)}</div>
      </section>

      <InvoiceDialog schemeMonths={schemeMonths} open={dialogOpen} invoice={dialogInvoice} partyId={vm.party_id} onClose={() => setDialogOpen(false)} onSave={async (inv) => {
        const exists = invoices.some((x) => x.id === inv.id);
        const next = exists ? invoices.map((x) => x.id === inv.id ? inv : x) : [...invoices, inv];
        await persistInvoices(next);
        setDialogOpen(false);
      }} />

      <section className="admin-section-card p-4"><h4 className="mb-3 font-semibold">③ Scheme result</h4><div className="mb-3 rounded-xl bg-primary/5 p-3"><span className="text-sm">Total benefit / മൊത്തം ആനുകൂല്യം</span><b className="ml-3 text-xl">{benefit.mrpValue > 0 ? benefit.effectiveBenefitPct.toFixed(2) + "%" : "—"}</b></div>{flatRows.length === 0 ? <p className="text-sm text-muted-foreground">Add an invoice to start live scheme analysis.</p> : <div className="grid gap-4 lg:grid-cols-3"><div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="flex gap-3"><div><div className="flex items-center gap-1 text-primary"><CheckCircle2 className="h-4 w-4" /><b>Eligible Free: {free}</b></div><div className="mt-1 text-xs text-muted-foreground">ഫ്രീ ഐറ്റം ലഭിക്കാനുള്ള quantity target ആണ്. Benefit ശതമാനം അല്ല. വാങ്ങിയ എണ്ണം / ലക്ഷ്യം താഴെ കാണാം.</div></div></div></div><div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"><div className="text-xs text-emerald-700">Received Free</div><div className="mt-1 text-2xl font-semibold text-emerald-700">{fmt(receivedFree)}</div></div><div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"><div className="text-xs text-amber-700">Pending Free</div><div className="mt-1 text-2xl font-semibold text-amber-900">{fmt(pendingFree)}</div></div>{targets.length > 0 && <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 lg:col-span-3"><div className="flex items-center gap-1 text-amber-700"><AlertTriangle className="h-4 w-4" /><b className="text-sm">Next target</b></div><div className="mt-2 grid gap-2 md:grid-cols-2">{targets.slice(0, 6).map((t: any, i: number) => <div key={i} className="rounded-lg border bg-background/70 p-2 text-xs"><b>Buy {fmt(t.gap)} more</b> → {t.reward}<div className="text-muted-foreground">{t.item}</div></div>)}</div></div>}</div>}</section>


      <BenefitReceiptEditor defaultMonth={`${fyCalendarYear(fy, vm.month)}-${String(vm.month).padStart(2,"0")}`} rules={settlementRules(report)} receipts={vm.benefit_receipts || []} onChange={(benefit_receipts) => onChange({ benefit_receipts })} />
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4"><h4 className="font-semibold">മൊത്തം benefit / Total benefit · {benefit.mrpValue > 0 ? `${benefit.effectiveBenefitPct.toFixed(2)}% of MRP` : "MRP balance ഇല്ല — ശതമാനം ലഭ്യമല്ല"}</h4><p className="text-xs mt-1">Base saving ₹{fmt(benefit.baseSaving)} + received credits ₹{fmt(benefit.amountReceived)} + received free-goods value ₹{fmt(benefit.freeReceivedValue)} − additional vendor charges ₹{fmt(benefit.vendorCharges)} = ₹{fmt(benefit.effectiveBenefitValue)}. നൽകിയ MRP മൊത്തമാണ് ശതമാനത്തിന്റെ അടിസ്ഥാനം. MRP ഇല്ലാത്ത pillow / additional items-ന്റെ ബിൽ തുകയും purchase cost-ൽ ഉൾപ്പെടും.</p></div>
      <ItemBenefitTracker invoiceReceipts={invoiceReceipts} vm={vm} onChange={(benefit_receipts) => onChange({ benefit_receipts })} />
      <div className="flex justify-end gap-2"><SchemePartyNotesButton partyId={vm.party_id} /><Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "Saving…" : `Save ${MONTH_NAME[vm.month]}`}</Button></div>
    </div>}
  </div>;
}
