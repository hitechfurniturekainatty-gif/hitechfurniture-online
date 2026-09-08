import {useState} from 'react';
import {SchemePeriodPicker} from './SchemePeriodPicker';
import {targetCatalog,refId,refLabel} from './schemeAttribution';
import type {SchemePeriodRef,VendorMonth} from './types';
import type {PeriodBenefitRecord} from './periodBenefits';
export function SchemeTargetSelect({source,ruleKey,months,periods,onChange,goodsOnly=false}:{source:SchemePeriodRef;ruleKey?:string;months:VendorMonth[];periods:PeriodBenefitRecord[];goodsOnly?:boolean;onChange:(source:SchemePeriodRef,key?:string,label?:string)=>void}){
 const options=targetCatalog(months,periods).flatMap(g=>g.rules.filter(r=>!goodsOnly||r.unit!=='₹').map(r=>({id:refId(g.ref)+'|'+r.key,source:g.ref,rule:r})));
 const selected=options.find(o=>refId(o.source)===refId(source)&&o.rule.key===ruleKey);
 const [custom,setCustom]=useState(false);
 return <div className="space-y-2"><select aria-label="Related scheme" className="h-9 w-full rounded-md border bg-background px-2 text-xs" value={custom?'custom':selected?.id||''} onChange={e=>{if(e.target.value==='custom'){setCustom(true);onChange(source);return;}const o=options.find(o=>o.id===e.target.value);if(o){setCustom(false);onChange(o.source,o.rule.key,o.rule.label);}}}>
  <option value="">Choose scheme / ഏത് സ്കീം?</option>{options.map(o=><option key={o.id} value={o.id}>{refLabel(o.source)} · {o.rule.label}</option>)}<option value="custom">Choose period only / target ഇല്ല</option>
 </select>{(custom||(!selected&&!!ruleKey)||!options.length)&&<SchemePeriodPicker value={source} onChange={r=>onChange(r)}/>}
 {!selected&&!custom&&<p className="text-[11px] text-muted-foreground">Period: {refLabel(source)} · target തിരഞ്ഞെടുക്കുമ്പോൾ balance സ്വയം കുറയും.</p>}
 </div>;
}
