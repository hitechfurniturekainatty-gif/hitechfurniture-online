import type {VendorMonth,TimelineMode,SchemePeriodRef} from './types';
import type {PeriodBenefitRecord} from './periodBenefits';
import {attributedSummary,allAttributedReceipts,refLabel,refMonths} from './schemeAttribution';
import {fmt} from './utils';
export function SchemePeriodAnalysis({months,records,fy,mode}:{months:VendorMonth[];records:PeriodBenefitRecord[];fy:number;mode:TimelineMode}){
 const keys=mode==='monthly'?[4,5,6,7,8,9,10,11,12,1,2,3].map(String):mode==='quarterly'?['Q1','Q2','Q3','Q4']:mode==='halfyearly'?['H1','H2']:['FY'];
 const total=attributedSummary(months,records,fy,[4,5,6,7,8,9,10,11,12,1,2,3]);
 const prior=allAttributedReceipts(months,records).filter(r=>r.source.fy<fy && Number(r.received_month.slice(0,4))===(Number(r.received_month.slice(5,7))>=4?fy:fy+1));
 return <section className="rounded-2xl border border-primary/20 bg-card p-4 space-y-3">
  <h3 className="font-semibold">Scheme-period benefit / സ്കീം കാലയളവിന്റെ ആനുകൂല്യം</h3>
  <p className="text-xs text-muted-foreground">തിരഞ്ഞെടുത്ത FY-യുടെ schemes-ൽ ലഭിച്ച benefit. അടുത്ത വർഷം ലഭിച്ചാലും അതിന്റെ original scheme period-ലാണ് കണക്ക്. ലഭിക്കാനുള്ള reward ഇതിൽ കൂട്ടിയിട്ടില്ല.</p>
  <div className="grid gap-3 sm:grid-cols-3">{[['Purchase MRP',`₹${fmt(total.mrp)}`],['Total benefit',`₹${fmt(total.benefit)}`],['Total benefit %',total.percent===null?'—':total.percent.toFixed(2)+'%']].map(([l,v])=><div key={l} className="rounded-xl bg-primary/5 p-3"><div className="text-xs text-muted-foreground">{l}</div><b className="text-xl">{v}</b></div>)}</div>
  <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['Period','Base saving','Scheme benefits received','Total benefit','Benefit %'].map(h=><th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{keys.map(key=>{const ref:SchemePeriodRef={fy,type:mode,key};const s=attributedSummary(months,records,fy,refMonths(ref));return <tr key={key} className="border-t"><td className="p-2">{refLabel(ref)}</td><td className="p-2">₹{fmt(s.base)}</td><td className="p-2">₹{fmt(s.extra)}{s.unallocated!==0&&<span className="block text-amber-700">Period-level ₹{fmt(s.unallocated)}: MRP needed to allocate</span>}</td><td className="p-2">₹{fmt(s.benefit)}</td><td className="p-2 font-semibold">{s.percent===null?'—':s.percent.toFixed(2)+'%'}</td></tr>;})}</tbody></table></div>
  <p className="text-xs text-muted-foreground">Quarterly / half-yearly / yearly benefits monthly reports-ൽ ആ കാലയളവിലെ purchase MRP അനുപാതത്തിൽ വിഭജിക്കുന്നു. Free-item value numerator-ൽ മാത്രം; purchase MRP-ൽ വീണ്ടും കൂട്ടില്ല. ലഭിച്ച സാധനത്തിന് നൽകിയ അധിക തുക benefit-ൽ നിന്ന് കുറയും.</p>
  {prior.length>0&&<details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">ഈ FY-ൽ ലഭിച്ച മുൻവർഷ benefits · ₹{fmt(prior.reduce((s,r)=>s+r.net,0))}</summary><p className="mt-2 text-xs text-muted-foreground">മുകളിലെ current-FY benefit-ൽ ഉൾപ്പെടുത്തിയിട്ടില്ല; ബന്ധപ്പെട്ട പഴയ FY തിരഞ്ഞെടുക്കുമ്പോൾ കാണാം.</p>{prior.map(r=><p key={r.id} className="mt-2 text-xs">{refLabel(r.source)} · {r.scheme_label||r.item||r.kind} · ₹{fmt(r.net)} · Received {r.received_month} · {r.reference}</p>)}</details>}
 </section>;
}
