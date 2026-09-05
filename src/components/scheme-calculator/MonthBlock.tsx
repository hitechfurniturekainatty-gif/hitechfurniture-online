import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Plus, Save } from "lucide-react";
import { SchemePartyNotesButton } from "@/components/admin/SchemePartyNotesButton";
import { Stat } from "./Stat"; import { ProgressRing } from "./ProgressRing"; import { SchemeConfigEditor } from "./SchemeConfigEditor"; import { InvoiceCard } from "./InvoiceCard"; import { InvoiceDialog } from "./InvoiceDialog";
import { MONTH_NAME, SCHEME_LABEL, aggregateRowsByItem, computeAchievementPct, computeFreeReport, defaultConfig, fmt, fyCalendarYear } from "./utils";
import type { Invoice, Row, SchemeKind, SchemeRow, VendorMonth } from "./types";

function itemAwareReport(rows: Row[], fallback: { kind: SchemeKind; config: any }) {
  const groups = new Map<string, { label: string; kind: SchemeKind; config: any; rows: Row[] }>();
  for (const row of rows) {
    const kind = row.scheme_kind || fallback.kind;
    const config = row.scheme_config || fallback.config;
    const key = row.scheme_rule_id ? `row:${row.scheme_rule_id}` : `month:${kind}:${JSON.stringify(config)}`;
    const label = row.scheme_name || "Month scheme";
    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { label, kind, config, rows: [row] });
  }
  const rep: any[] = [], targets: any[] = [];
  let weightedPct = 0, qtyWeight = 0;
  for (const g of groups.values()) {
    const agg = aggregateRowsByItem(g.rows);
    const report: any = computeFreeReport({ kind: g.kind, config: g.config }, agg);
    rep.push(...(report.rep || []).map((r: any) => ({ ...r, item: `${g.label}: ${r.item}` })));
    targets.push(...(report.targets || []).map((t: any) => ({ ...t, item: `${g.label}: ${t.item}` })));
    const qty = g.rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    weightedPct += computeAchievementPct({ kind: g.kind, config: g.config }, agg) * qty;
    qtyWeight += qty;
  }
  return { rep, targets, completion: qtyWeight > 0 ? Math.round(weightedPct / qtyWeight) : 0 };
}

export function MonthBlock({ vm, fy, savedSchemes, onChange, onSave }: { vm: VendorMonth; fy: number; savedSchemes: SchemeRow[]; onChange: (patch: Partial<VendorMonth>) => void; onSave: () => void | Promise<void>; }) {
 const [open,setOpen]=useState(false),[dialogOpen,setDialogOpen]=useState(false),[saving,setSaving]=useState(false); const [dialogInvoice,setDialogInvoice]=useState<Invoice|null>(null);
 const isCurrent=(()=>{const n=new Date();return n.getFullYear()===fyCalendarYear(fy,vm.month)&&n.getMonth()+1===vm.month})(); useEffect(()=>{if(isCurrent)setOpen(true)},[isCurrent]);
 const invoices:Invoice[]=vm.invoices?.length?vm.invoices:(vm.purchase_rows.length?[{id:"legacy",label:"Invoice 1",rows:vm.purchase_rows}]:[]); const flatRows:Row[]=invoices.flatMap(i=>i.rows);
 const setInvoices=(next:Invoice[])=>onChange({invoices:next,purchase_rows:next.flatMap(i=>i.rows)}); const updateInvoice=(id:string,patch:Partial<Invoice>)=>setInvoices(invoices.map(i=>i.id===id?{...i,...patch}:i));
 const report=useMemo(()=>itemAwareReport(flatRows,{kind:vm.scheme_kind,config:vm.scheme_config}),[vm.scheme_kind,vm.scheme_config,vm.invoices,vm.purchase_rows]);
 const totalQty=flatRows.reduce((s,r)=>s+(+r.qty||0),0),totalAmount=flatRows.reduce((s,r)=>s+(+r.amountWithTax||0),0); const free=report.rep.reduce((s:number,r:any)=>s+(+r.free||0),0),targets=report.targets as any[]; const completion=report.completion; const label=`${MONTH_NAME[vm.month]} ${fyCalendarYear(fy,vm.month)}`;
 const freeReceived=(vm.benefit_receipts||[]).filter(r=>r.kind==="free_item").reduce((s,r)=>s+(Number(r.qty)||0),0); const freePending=Math.max(0,free-freeReceived);
 const applySaved=(id:string)=>{const s=savedSchemes.find(x=>x.id===id);if(s)onChange({scheme_kind:s.kind,scheme_config:s.config||defaultConfig(s.kind)})};
 const handleSave=async()=>{if(saving)return;setSaving(true);try{await onSave()}finally{setSaving(false)}};
 return <div className={`rounded-2xl border-2 bg-card shadow-sm ${isCurrent?"border-primary/50":"border-border"}`}>
  <button onClick={()=>setOpen(!open)} className="flex w-full items-center gap-4 px-4 py-3 text-left"><div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary"><span className="text-[9px]">{MONTH_NAME[vm.month]}</span><b className="text-xs">{String(fyCalendarYear(fy,vm.month)).slice(-2)}</b></div><div className="flex-1"><div className="font-display">{label} {isCurrent&&<span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">CURRENT</span>}</div><div className="text-xs text-muted-foreground">{totalQty} qty · ₹{fmt(totalAmount)} · <span className="text-emerald-600">{free} eligible</span> · <span className={freePending>0?"text-amber-600":"text-muted-foreground"}>{freePending} pending</span></div></div><b>{completion}%</b>{open?<ChevronUp/>:<ChevronDown/>}</button>
  {open&&<div className="space-y-4 border-t p-4">
   <section className="rounded-xl border bg-background/50 p-4"><div className="mb-2 flex justify-between"><div><h4 className="text-sm font-semibold">① Default month scheme</h4><p className="text-xs text-muted-foreground">Used only for invoice items that do not have their own scheme selected.</p></div>{savedSchemes.length>0&&<Select value="" onValueChange={applySaved}><SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Apply template…"/></SelectTrigger><SelectContent>{savedSchemes.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>}</div><div className="mb-3 max-w-md"><Label className="text-xs">Scheme type</Label><Select value={vm.scheme_kind} onValueChange={v=>onChange({scheme_kind:v as SchemeKind,scheme_config:defaultConfig(v as SchemeKind)})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{(["bogo","percent"] as SchemeKind[]).map(k=><SelectItem key={k} value={k}>{SCHEME_LABEL[k]}</SelectItem>)}</SelectContent></Select></div><SchemeConfigEditor scheme={{kind:vm.scheme_kind,config:vm.scheme_config}} onChange={c=>onChange({scheme_config:c})}/></section>
   <section className="rounded-xl border-2 border-dashed p-4"><div className="mb-3 flex flex-wrap justify-between gap-2"><div><h4 className="font-semibold">② Invoices for {label}</h4><p className="text-xs text-muted-foreground">Select a saved scheme per item when products have different offers. Eligible free is shown on each row.</p></div><div className="flex gap-3"><Stat label="Invoices" value={String(invoices.length)}/><Stat label="Cost" value={`₹${fmt(totalAmount)}`}/><Stat label="Eligible Free" value={fmt(free)} tone="success"/></div></div><Button size="sm" onClick={()=>{setDialogInvoice({id:crypto.randomUUID(),label:`Invoice ${invoices.length+1}`,rows:[]});setDialogOpen(true)}}><Plus className="h-4 w-4"/> Add Invoice</Button><div className="mt-3 space-y-3">{invoices.map((inv,i)=><InvoiceCard key={inv.id} index={i} invoice={inv} savedSchemes={savedSchemes} fallbackScheme={{kind:vm.scheme_kind,config:vm.scheme_config}} onChange={p=>updateInvoice(inv.id,p)} onRemove={()=>setInvoices(invoices.filter(x=>x.id!==inv.id))} onEdit={()=>{setDialogInvoice(inv);setDialogOpen(true)}}/>)}</div></section>
   <InvoiceDialog open={dialogOpen} invoice={dialogInvoice} onClose={()=>setDialogOpen(false)} onSave={inv=>{const exists=invoices.some(x=>x.id===inv.id);setInvoices(exists?invoices.map(x=>x.id===inv.id?inv:x):[...invoices,inv]);setDialogOpen(false)}}/>
   <section className="rounded-xl border bg-background/50 p-4"><h4 className="mb-3 font-semibold">③ Scheme result</h4>{flatRows.length===0?<p className="text-sm text-muted-foreground">Add an invoice to start live scheme analysis.</p>:<><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4"><div className="text-[10px] uppercase text-muted-foreground">Eligible Free</div><div className="mt-1 text-2xl font-semibold text-emerald-700">{fmt(free)}</div></div><div className="rounded-xl border bg-background p-4"><div className="text-[10px] uppercase text-muted-foreground">Received Free</div><div className="mt-1 text-2xl font-semibold">{fmt(freeReceived)}</div></div><div className={`rounded-xl border-2 p-4 ${freePending>0?"border-amber-500/40 bg-amber-500/5":"border-emerald-500/30 bg-emerald-500/5"}`}><div className="text-[10px] uppercase text-muted-foreground">Pending Free</div><div className={`mt-1 text-2xl font-semibold ${freePending>0?"text-amber-700":"text-emerald-700"}`}>{fmt(freePending)}</div></div></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="rounded-xl border bg-background p-4"><div className="flex gap-3"><ProgressRing pct={completion} size={72}/><div><div className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4"/><b>Scheme achievement</b></div><div className="mt-1 text-xs text-muted-foreground">Calculated from each item’s selected scheme. Items without an override use the month scheme.</div></div></div></div><div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-4"><div className="flex items-center gap-1 text-amber-700"><AlertTriangle className="h-4 w-4"/><b className="text-sm">Next target</b></div>{targets.length?<div className="mt-2 space-y-2">{targets.slice(0,4).map((t:any,i:number)=><div key={i} className="rounded-lg border bg-background/70 p-2 text-xs"><b>Buy {fmt(t.gap)} more</b> → {t.reward}<div className="text-muted-foreground">{t.item}</div></div>)}</div>:<p className="mt-2 text-xs text-emerald-700">Current available target is achieved.</p>}</div></div></>}</section>
   <div className="flex justify-end gap-2"><SchemePartyNotesButton partyId={vm.party_id}/><Button onClick={handleSave} disabled={saving}>{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}{saving?"Saving…":`Save ${MONTH_NAME[vm.month]}`}</Button></div>
  </div>}
 </div>;
}
