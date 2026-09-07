import { SchemePeriodAnalysis } from "@/components/scheme-calculator/SchemePeriodAnalysis";
import { InvoiceRewardReport } from "@/components/scheme-calculator/InvoiceRewardReport";
import { invoiceRewardReceipts, monthKey } from "@/components/scheme-calculator/invoiceRewards";
import { periodReceiptsForMonths, monthRows, type PeriodBenefitRecord } from "@/components/scheme-calculator/periodBenefits";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { MonthBlock } from "@/components/scheme-calculator/MonthBlock";
import { AggregatedView } from "@/components/scheme-calculator/AggregatedView";
import { PartiesTab } from "@/components/scheme-calculator/PartiesTab";
import { SchemesTab } from "@/components/scheme-calculator/SchemesTab";
import { summarizePeriodBenefit, SchemeBenefitAnalysis } from "@/components/scheme-calculator/BenefitTracker";
import { Stat } from "@/components/scheme-calculator/Stat";
import { FY_MONTHS, hasSchemeRule, aggregateRowsByItem, computeAchievementPct, computeFreeReport, currentFy, fmt } from "@/components/scheme-calculator/utils";
import type { Invoice, Party, Row, SchemeRow, TimelineMode, VendorMonth } from "@/components/scheme-calculator/types";

const emptyItemScheme = () => ({ rules: [{ purchaseItem: "", matchMode: "exact", familyExplicit: false, buyQty: 10, freeQty: 1, freeItem: "" }] });

const AdminSchemeCalculator = () => {
  const [tab, setTab] = useState<"calc" | "parties" | "schemes">("calc");
  const [parties, setParties] = useState<Party[]>([]);
  const [savedSchemes, setSavedSchemes] = useState<SchemeRow[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorQuery, setVendorQuery] = useState("");
  const [fy, setFy] = useState(currentFy());
  const [mode, setMode] = useState<TimelineMode>("monthly");
  const [periodRecords, setPeriodRecords] = useState<PeriodBenefitRecord[]>([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodError, setPeriodError] = useState(false);
  const [historyMonths, setHistoryMonths] = useState<VendorMonth[]>([]);
  const [months, setMonths] = useState<VendorMonth[]>([]);
  const [loading, setLoading] = useState(false);

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
    let cancelled = false;
    setMonths([]);
    setHistoryMonths([]);
    setLoading(true);
    (async () => {
      const data: VendorMonth[] = [];
      let error: any = null;
      for (let from=0; ; from+=500) {
        const page = await supabase.from("scheme_vendor_months" as any).select("*").eq("party_id", vendorId).order("fy_year").order("month").range(from,from+499);
        if(page.error){error=page.error;break;}
        data.push(...(page.data as unknown as VendorMonth[] || []));
        if(!page.data || page.data.length<500)break;
      }
      if (cancelled) return;
      if (error) { toast({ title: "Load failed", description: error.message, variant: "destructive" }); setLoading(false); return; }
      setHistoryMonths(data);
      const saved = data.filter(m=>m.fy_year===fy);
      setMonths(FY_MONTHS.map((month) => {
        const existing = saved.find((r) => r.month === month);
        if (existing) {
          const invoices: Invoice[] = Array.isArray((existing as any).invoices) && (existing as any).invoices.length
            ? (existing as any).invoices
            : existing.purchase_rows?.length ? [{ id: crypto.randomUUID(), label: "Invoice 1", rows: existing.purchase_rows }] : [];
          return { ...existing, invoices, benefit_receipts: Array.isArray((existing as any).benefit_receipts) ? (existing as any).benefit_receipts : [] };
        }
        return { party_id: vendorId, fy_year: fy, month, scheme_kind: "bogo", scheme_config: emptyItemScheme(), purchases_text: "", purchase_rows: [], invoices: [], benefit_receipts: [] };
      }));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [vendorId, fy]);

  useEffect(() => {
    let cancelled = false;
    setPeriodRecords([]); setPeriodError(false);
    if (!vendorId) {setPeriodLoading(false);return;}
    setPeriodLoading(true);
    (async () => {
      const data: PeriodBenefitRecord[] = [];
      let error: any = null;
      for(let from=0;;from+=500){
        const page=await supabase.from("scheme_period_rules").select("*").eq("party_id",vendorId).order("fy_year").order("period_type").order("period_key").range(from,from+499);
        if(page.error){error=page.error;break;}
        data.push(...(page.data as unknown as PeriodBenefitRecord[]||[]));
        if(!page.data||page.data.length<500)break;
      }
      if (cancelled) return;
      setPeriodLoading(false);
      if (error) {setPeriodError(true); return;}
      setPeriodRecords((data || []) as unknown as PeriodBenefitRecord[]);
    })();
    return () => {cancelled=true;};
  },[vendorId,fy]);
  const updatePeriodRecord = (record: PeriodBenefitRecord) => setPeriodRecords(prev => [...prev.filter(r => r.fy_year !== (record.fy_year||fy) || r.period_type !== record.period_type || r.period_key !== record.period_key),{...record,fy_year:record.fy_year||fy}]);

  const allSchemeMonths = [...historyMonths.filter(m=>m.fy_year!==fy),...months];
  const linkedReceipts = invoiceRewardReceipts(allSchemeMonths);
  const vendor = parties.find((p) => p.id === vendorId) || null;
  const filteredParties = useMemo(() => {
    const q = vendorQuery.trim().toLowerCase();
    if (!q) return parties.slice(0, 30);
    return parties.filter((p) => [p.name, p.phone, p.place].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))).slice(0, 50);
  }, [parties, vendorQuery]);

  const updateMonth = (month: number, patch: Partial<VendorMonth>) => setMonths((arr) => arr.map((m) => m.month === month ? { ...m, ...patch } : m));
  const persistMonth = async (m: VendorMonth) => {
    const flatRows: Row[] = monthRows(m);
    const payload = { party_id: m.party_id, fy_year: m.fy_year, month: m.month, scheme_kind: m.scheme_kind, scheme_config: m.scheme_config, purchases_text: m.purchases_text, purchase_rows: flatRows as any, invoices: m.invoices as any, benefit_receipts: (m.benefit_receipts || []) as any };
    const { data, error } = await supabase.from("scheme_vendor_months" as any).upsert(payload, { onConflict: "party_id,fy_year,month" }).select().single();
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); throw error; }
    if ((data as any)?.id && (data as any).id !== m.id) updateMonth(m.month, { id: (data as any).id });
    toast({ title: "Scheme month saved" });
  };

  const ytd = useMemo(() => {
    let totalAmount = 0, totalQty = 0, freeUnits = 0, weightedPct = 0, schemeQty = 0;
    months.forEach((m) => {
      const flat = monthRows(m);
      totalAmount += flat.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
      totalQty += flat.reduce((s, r) => s + (Number(r.qty) || 0), 0);
      if (!flat.length) return;
      const agg = aggregateRowsByItem(flat);
      const report: any = computeFreeReport({ kind: m.scheme_kind, config: m.scheme_config }, agg);
      const hasConfiguredItemRule = m.scheme_kind !== "bogo" || (Array.isArray(m.scheme_config?.rules) && m.scheme_config.rules.some(hasSchemeRule));
      if (!hasConfiguredItemRule) return;
      freeUnits += (report.rep || []).reduce((s: number, r: any) => s + (Number(r.free) || 0), 0);
      const matchedQty = (report.rep || []).reduce((s: number, r: any) => s + (r.purchaseItem ? Number(r.qty) || 0 : 0), 0);
      const weight = matchedQty || flat.reduce((s, r) => s + (Number(r.qty) || 0), 0);
      weightedPct += computeAchievementPct({ kind: m.scheme_kind, config: m.scheme_config }, agg) * weight;
      schemeQty += weight;
    });
    return { totalAmount, totalQty, freeUnits, completionPct: schemeQty ? Math.round(weightedPct / schemeQty) : 0 };
  }, [months]);

  return <AdminShell><div className="scheme-workspace space-y-6 pb-6">
    <div><h1 className="font-display text-2xl">Vendor Scheme Dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Vendor → Month → all invoice items → item-based scheme rules → eligible free → received → pending.</p></div>
    <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
      <TabsList><TabsTrigger value="calc">Vendor Dashboard</TabsTrigger><TabsTrigger value="parties">Vendors ({parties.length})</TabsTrigger><TabsTrigger value="schemes">Scheme Templates ({savedSchemes.length})</TabsTrigger></TabsList>
      <TabsContent value="calc" className="space-y-5 pt-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[260px] flex-1"><Label className="text-xs">Vendor</Label><Input value={vendor ? `${vendor.name}${vendor.place ? ` — ${vendor.place}` : ""}` : vendorQuery} onChange={(e) => { setVendorQuery(e.target.value); setVendorId(null); }} placeholder="Search vendor…" />{vendorQuery && !vendor && <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-popover shadow-lg">{filteredParties.map((p) => <button key={p.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { setVendorId(p.id); setVendorQuery(""); }}>{p.name}{p.place ? ` — ${p.place}` : ""}</button>)}</div>}</div>
          <div><Label className="text-xs">Financial Year</Label><div className="flex gap-2"><Select value={String(fy)} onValueChange={(v) => setFy(Number(v))}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent>{[currentFy()-2,currentFy()-1,currentFy(),currentFy()+1].map((y) => <SelectItem key={y} value={String(y)}>FY {y}–{String(y+1).slice(-2)}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" onClick={() => { const raw=window.prompt("FY starting year"); const y=Number(raw); if(y>=2000&&y<=2100)setFy(y); }}><Plus className="h-4 w-4" /></Button></div></div>
          <div><Label className="text-xs">Timeline</Label><Select value={mode} onValueChange={(v) => setMode(v as TimelineMode)}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="halfyearly">Half-Yearly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent></Select></div>
        </div></div>
        {!vendor ? <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center"><TrendingUp className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="text-sm text-muted-foreground">Pick a vendor to open the scheme dashboard.</p></div> : loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div> : <>
          {periodLoading ? <p className="text-muted-foreground">Loading all period benefits…</p> : periodError ? <p role="alert" className="text-destructive">Could not load period benefits. Reload before relying on totals.</p> : <><SchemePeriodAnalysis months={allSchemeMonths} records={periodRecords} fy={fy} mode={mode} /><details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm">Received-period totals / ബിൽ രേഖപ്പെടുത്തിയ കാലയളവിന്റെ കണക്ക്</summary><SchemeBenefitAnalysis months={months} fy={fy} mode={mode} periodRecords={periodRecords.filter(p=>p.fy_year===fy)} /></details></>}
          <InvoiceRewardReport months={allSchemeMonths} records={periodRecords} />
          {mode === "monthly" ? <div className="space-y-4">{months.map((m) => <MonthBlock schemePeriods={periodRecords} schemeMonths={allSchemeMonths} invoiceReceipts={linkedReceipts.filter(r=>r.benefit_month===monthKey(m))} additionalReceipts={periodReceiptsForMonths(periodRecords,fy,[m.month])} key={m.month} vm={m} fy={fy} savedSchemes={savedSchemes} onChange={(patch) => updateMonth(m.month, patch)} onSave={(next) => persistMonth(next || m)} />)}</div> : <AggregatedView schemeMonths={allSchemeMonths} schemePeriods={periodRecords} onPeriodRecordChange={updatePeriodRecord} periodRecords={periodRecords.filter(p=>p.fy_year===fy)} mode={mode} fy={fy} months={months} savedSchemes={savedSchemes} onChangeMonth={updateMonth} onSaveMonth={persistMonth} />}
        </>}
      </TabsContent>
      <TabsContent value="parties" className="pt-4"><PartiesTab parties={parties} setParties={setParties} /></TabsContent>
      <TabsContent value="schemes" className="pt-4"><SchemesTab schemes={savedSchemes} setSchemes={setSavedSchemes} onApply={() => setTab("calc")} /></TabsContent>
    </Tabs>

  </div></AdminShell>;
};

export default AdminSchemeCalculator;
