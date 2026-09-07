import { useState } from 'react';
import type {VendorMonth} from './types';
import type {PeriodBenefitRecord} from './periodBenefits';
import {allAttributedReceipts,attributedBalances,refLabel,refId} from './schemeAttribution';
import {fmt} from './utils';
export function InvoiceRewardReport({months,records=[]}:{months:VendorMonth[];records?:PeriodBenefitRecord[]}) {
 const [pendingOnly,setPendingOnly]=useState(false);
 const [year,setYear]=useState("all"),[period,setPeriod]=useState("all");
 const allBalances=attributedBalances(months,records);
 const balances=allBalances.filter(r=>(!pendingOnly||r.pending>0)&&(year==="all"||r.ref.fy===Number(year))&&(period==="all"||r.ref.type===period));
 const receipts=allAttributedReceipts(months,records);
 const exportReport=()=>{
  const cells=[['Scheme period','Scheme / item','Unit','Purchased quantity','Target quantity','Achieved','Settled','Balance','Receipts'],...balances.map(r=>[refLabel(r.ref),r.label,r.unit||'pcs',r.purchased??'',r.target??'',r.eligible,r.received,r.pending,r.receipts.map(x=>x.received_month+' '+(x.reference||'')).join('; ')])];
  const csv='\uFEFF'+cells.map(row=>row.map(v=>'"'+(/^[=+\-@\t\r]/.test(String(v)) ? "'"+String(v) : String(v)).replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='scheme-achieved-received-balance.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <details className="rounded-2xl border bg-card p-4 space-y-3">
  <summary className="cursor-pointer font-semibold">Achieved · Received · Balance / സ്കീം റിപ്പോർട്ട്</summary>
  <p className="text-xs text-muted-foreground">എല്ലാ financial years-ലെയും monthly / quarterly / half-yearly / yearly item & combo schemes. അടുത്ത വർഷം ലഭിച്ചാലും original scheme-ന്റെ balance കുറയും. Credit note നൽകി തീർത്ത quantity-യും Settled-ൽ ഉൾപ്പെടും.</p>
  <button type="button" className="rounded-md border px-3 py-2 text-xs" onClick={exportReport}>Download report / CSV</button>
  <div className="flex flex-wrap gap-2"><select aria-label="Report financial year" className="rounded border bg-background p-2 text-xs" value={year} onChange={e=>setYear(e.target.value)}><option value="all">All financial years</option>{[...new Set(allBalances.map(r=>r.ref.fy))].sort((a,b)=>b-a).map(fy=><option key={fy} value={fy}>FY {fy}–{String(fy+1).slice(-2)}</option>)}</select><select aria-label="Report period type" className="rounded border bg-background p-2 text-xs" value={period} onChange={e=>setPeriod(e.target.value)}><option value="all">All scheme periods</option>{["monthly","quarterly","halfyearly","yearly"].map(v=><option key={v}>{v}</option>)}</select></div>
  <label className="flex gap-2 text-sm"><input type="checkbox" checked={pendingOnly} onChange={e=>setPendingOnly(e.target.checked)}/> Pending മാത്രം</label>
  <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['Scheme period','Scheme / item','Achieved','Settled','Balance','Received in / reference'].map(h=><th key={h} className="p-2 text-left">{h}</th>)}</tr></thead>
   <tbody>{balances.map(r=><tr key={refId(r.ref)+r.key} className="border-t"><td className="p-2">{refLabel(r.ref)}</td><td className="p-2">{r.label}{r.purchased!==undefined&&<span className="block text-muted-foreground">Purchased {fmt(r.purchased)}{r.target? " / Target "+fmt(r.target):""}</span>}</td><td className="p-2">{fmt(r.eligible)} {r.unit||"pcs"}</td><td className="p-2">{fmt(r.received)} {r.unit||"pcs"}</td><td className="p-2 font-semibold text-amber-800">{fmt(r.pending)}{r.eligible===0&&' · Target not reached'}</td><td className="p-2">{r.receipts.map(x=>`${x.received_month} · ${x.reference||'Receipt'} · ${r.unit==='₹'?x.net:x.qty||x.replaces_free_qty||0} ${r.unit||'pcs'}`).join('; ') || '—'}</td></tr>)}</tbody>
  </table>{!balances.length&&<p className="p-2 text-sm text-muted-foreground">No matching scheme targets.</p>}</div>
  {receipts.length>0&&<details><summary className="cursor-pointer text-sm">Receipt history ({receipts.length})</summary><div className="mt-2 space-y-2">{receipts.map(r=><p key={r.id} className="rounded border p-2 text-xs">{r.scheme_label||r.item||r.kind} · {r.qty||r.replaces_free_qty||0} pcs · ₹{fmt(r.net)} · {refLabel(r.source)} · Received: {r.received_month} · {r.reference}{!r.scheme_rule_key&&' · No quantity target linked'}</p>)}</div></details>}
 </details>;
}
