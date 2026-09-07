import type {SchemePeriodRef} from './types';
import {fyCalendarYear} from './utils';
export function SchemePeriodPicker({value,onChange}:{value:SchemePeriodRef;onChange:(r:SchemePeriodRef)=>void}){
 const options=value.type==='monthly'?[4,5,6,7,8,9,10,11,12,1,2,3].map(m=>({key:String(m),label:new Date(Date.UTC(fyCalendarYear(value.fy,m),m-1,1)).toLocaleDateString('en',{month:'short',year:'numeric',timeZone:'UTC'})})):value.type==='quarterly'?['Q1','Q2','Q3','Q4'].map((k,i)=>({key:k,label:k+' · '+['Apr–Jun','Jul–Sep','Oct–Dec','Jan–Mar'][i]})):value.type==='halfyearly'?[{key:'H1',label:'Apr–Sep'},{key:'H2',label:'Oct–Mar'}]:[{key:'FY',label:'Full financial year'}];
 return <fieldset className="rounded-lg border bg-primary/5 p-3"><legend className="px-1 text-xs font-medium">Scheme period / ഏത് കാലയളവിനുള്ള benefit?</legend><div className="grid gap-2 sm:grid-cols-3">
  <label className="text-xs">FY starting year<input aria-label="Scheme financial year" className="mt-1 h-9 w-full rounded-md border bg-background px-2" type="number" min={2000} max={2100} value={value.fy} onChange={e=>{const fy=Number(e.target.value);if(fy>=2000&&fy<=2100)onChange({...value,fy});}}/></label>
  <label className="text-xs">Period type<select aria-label="Scheme period type" className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={value.type} onChange={e=>{const type=e.target.value as SchemePeriodRef['type'];onChange({...value,type,key:type==='monthly'?'4':type==='quarterly'?'Q1':type==='halfyearly'?'H1':'FY'});}}>{['monthly','quarterly','halfyearly','yearly'].map(v=><option key={v}>{v}</option>)}</select></label>
  <label className="text-xs">Period<select aria-label="Scheme period" className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={value.key} onChange={e=>onChange({...value,key:e.target.value})}>{options.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}</select></label>
 </div></fieldset>;
}
