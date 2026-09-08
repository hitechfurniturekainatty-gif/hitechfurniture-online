import type {BenefitReceipt, SchemePeriodRef, VendorMonth} from './types';
import {invoiceRows,monthRows,type PeriodBenefitRecord} from './periodBenefits';
import {aggregateRowsByItem,computeFreeReport,fyCalendarYear} from './utils';
import {receiptBenefit,settlementRules,settledForRule, type SettlementRule} from './settlements';

export const monthRef=(date:string):SchemePeriodRef=>{
 const year=Number(date.slice(0,4)),month=Number(date.slice(5,7));
 return {fy:month>=4?year:year-1,type:'monthly',key:String(month)};
};
export const refId=(r:SchemePeriodRef)=>`${r.fy}:${r.type}:${r.key}`;
export function refMonths(r:SchemePeriodRef):number[] {
 const order=[4,5,6,7,8,9,10,11,12,1,2,3];
 if(r.type==='monthly')return [Number(r.key)];
 if(r.type==='quarterly')return order.slice((Number(r.key.slice(1))-1)*3,Number(r.key.slice(1))*3);
 if(r.type==='halfyearly')return r.key==='H1'?order.slice(0,6):order.slice(6);
 return order;
}
export const refLabel=(r:SchemePeriodRef)=>`FY ${r.fy}–${String(r.fy+1).slice(-2)} · ${r.type==='monthly'?new Date(Date.UTC(fyCalendarYear(r.fy,Number(r.key)),Number(r.key)-1,1)).toLocaleDateString('en',{month:'short',year:'numeric',timeZone:'UTC'}):r.type==='yearly'?'Yearly':r.key+' · '+r.type}`;
export const refEndMonth=(r:SchemePeriodRef)=>{const m=refMonths(r).at(-1)||3;return `${fyCalendarYear(r.fy,m)}-${String(m).padStart(2,'0')}`;};
export type AttributedReceipt=BenefitReceipt & {source:SchemePeriodRef;received_month:string;net:number;invoiceLinked?:boolean;embeddedNet?:number;accounting_month?:string};
const embeddedBenefit=(r:BenefitReceipt)=>(r.included_in_invoice?receiptBenefit(r).gross:0)-(r.charge_in_invoice?Math.max(0,Number(r.vendor_charge)||0):0);
export function allAttributedReceipts(months:VendorMonth[],records:PeriodBenefitRecord[]):AttributedReceipt[]{
 const receipts:AttributedReceipt[]=[];
 for(const m of months){
  const date=`${fyCalendarYear(m.fy_year,m.month)}-${String(m.month).padStart(2,'0')}`;
  for(const r of m.benefit_receipts||[])receipts.push({...r,source:r.scheme_period||monthRef(r.benefit_month||date),received_month:r.date?.slice(0,7)||date,accounting_month:date,net:receiptBenefit(r).net+embeddedBenefit(r),embeddedNet:embeddedBenefit(r)});
  for(const i of m.invoices||[]){
   if(i.document_kind==='purchase_return')continue;
   for(const r of i.benefit_receipts||[])receipts.push({...r,source:r.scheme_period||monthRef(date),received_month:r.date?.slice(0,7)||date,accounting_month:date,net:receiptBenefit(r).net+embeddedBenefit(r),embeddedNet:embeddedBenefit(r)});
   const valued=invoiceRows([i]);
   for(const row of valued.filter(r=>r.reward)){
    const original=i.rows.find(r=>r.id===row.id)!;
    receipts.push({id:`invoice:${i.id}:${row.id}`,kind:'free_item',item:row.item,qty:row.qty,
     scheme_rule_key:row.reward!.scheme_rule_key,scheme_label:row.reward!.scheme_label,
     source:row.reward!.scheme_period||monthRef(row.reward!.scheme_month),received_month:date,
     reference:i.invoice_no||i.label,date:i.date||date+'-01',invoiceLinked:true,included_in_invoice:true,
     net:row.mrp*row.qty-row.amountWithTax,unit_value:row.qty?row.mrp:0,
     note:`Billed ₹${original.amountWithTax}; invoice discount counted once.`});
   }
  }
 }
 for(const p of records)for(const r of p.benefit_receipts||[]){
  const fallback:SchemePeriodRef={fy:p.fy_year||monthRef(r.benefit_month||r.date||'2026-04').fy,type:p.period_type as SchemePeriodRef['type'],key:p.period_key};
  receipts.push({...r,source:r.scheme_period||(r.benefit_month?monthRef(r.benefit_month):fallback),received_month:r.date?.slice(0,7)||r.benefit_month||refEndMonth(fallback),accounting_month:r.benefit_month||r.date?.slice(0,7)||refEndMonth(fallback),net:receiptBenefit(r).net+embeddedBenefit(r),embeddedNet:embeddedBenefit(r)});
 }
 return receipts;
}
export function targetCatalog(months:VendorMonth[],records:PeriodBenefitRecord[]){
 const groups=months.map(m=>({ref:{fy:m.fy_year,type:'monthly',key:String(m.month)} as SchemePeriodRef,kind:m.scheme_kind,config:m.scheme_config,rows:monthRows(m)}));
 for(const p of records)if(p.fy_year&&p.scheme_kind){
  const ref:SchemePeriodRef={fy:p.fy_year,type:p.period_type as SchemePeriodRef['type'],key:p.period_key};
  groups.push({ref,kind:p.scheme_kind,config:p.scheme_config,rows:months.filter(m=>m.fy_year===ref.fy&&refMonths(ref).includes(m.month)).flatMap(monthRows)});
 }
 return groups.map(g=>{
  const rows=aggregateRowsByItem(g.rows),report=computeFreeReport({kind:g.kind,config:g.config},rows);
  let rules:SettlementRule[]=settlementRules(report).map((r,i)=>({...r,unit:"pcs",purchased:Number(report.rep[i]?.qty)||0,target:Number((report.rep[i] as any)?.buyQty)||0}));
  if(!rules.length && g.kind!=="bogo"){
    if(g.kind==="percent"||g.kind==="cashback"){
      const cost=rows.reduce((s,r)=>s+r.amountWithTax,0);
      const eligible=g.kind==="percent"?cost*(Number(g.config?.percent)||0)/100:cost>=(Number(g.config?.minAmount)||0)?Number(g.config?.cashback)||0:0;
      rules=[{key:g.kind+":amount",label:g.kind==="percent"?"Percentage discount":"Cashback target",freeItem:"",eligible:Math.max(0,eligible),unit:"₹"}];
    }else rules=report.rep.map((r,i)=>({key:g.kind+":"+i,label:r.item,freeItem:(r as any).freeItem||r.item,eligible:Math.max(0,Number(r.free)||0),unit:"pcs",purchased:Number(r.qty)||0}));
  }
  return {...g,rules};
 });
}
export function attributedBalances(months:VendorMonth[],records:PeriodBenefitRecord[]){
 const receipts=allAttributedReceipts(months,records);
 return targetCatalog(months,records).flatMap(g=>{
  const linked=receipts.filter(r=>refId(r.source)===refId(g.ref)&&(!r.invoiceLinked||r.scheme_rule_key));
  return g.rules.map(rule=>{
   const matching=linked.filter(r=>r.scheme_rule_key===rule.key||(!r.scheme_rule_key&&g.rules.length===1));
   const received=rule.unit==="₹"?matching.reduce((s,r)=>s+Math.max(0,r.net),0):settledForRule(rule,g.rules,linked);
   return {...rule,ref:g.ref,received,pending:Math.max(0,rule.eligible-received),receipts:matching};
  });
 });
}
/** Period-wide rewards are distributed by eligible-period purchase MRP, never by receipt date. */
export function attributedSummary(months:VendorMonth[],records:PeriodBenefitRecord[],fy:number,selected:number[]){
 const receipts=allAttributedReceipts(months,records);
 const fyMonths=months.filter(m=>m.fy_year===fy);
 const bases=fyMonths.map(m=>{
  const rows=monthRows(m).filter(r=>!r.reward);
  const mrp=rows.reduce((s,r)=>s+r.mrp*r.qty,0),cost=rows.reduce((s,r)=>s+r.amountWithTax,0);
  const date=refEndMonth({fy,type:"monthly",key:String(m.month)});
  const embedded=receipts.filter(r=>(r.accounting_month||r.received_month)===date).reduce((s,r)=>s+(r.embeddedNet||0),0);
  return {month:m.month,mrp,cost:cost+embedded,base:mrp-cost-embedded};
 });
 const chosen=bases.filter(m=>selected.includes(m.month));
 const mrp=chosen.reduce((s,m)=>s+m.mrp,0),cost=chosen.reduce((s,m)=>s+m.cost,0);
 let extra=0,unallocated=0;
 for(const r of receipts.filter(r=>r.source.fy===fy)){
  const eligible=refMonths(r.source);
  if(eligible.every(m=>selected.includes(m))){extra+=r.net;continue;}
  if(!eligible.some(m=>selected.includes(m)))continue;
  const total=bases.filter(m=>eligible.includes(m.month)).reduce((s,m)=>s+Math.max(0,m.mrp),0);
  if(total>0)extra+=r.net*bases.filter(m=>eligible.includes(m.month)&&selected.includes(m.month)).reduce((s,m)=>s+Math.max(0,m.mrp),0)/total;
  else unallocated+=r.net;
 }
 const benefit=mrp-cost+extra;
 return {mrp,cost,base:mrp-cost,extra,benefit,percent:mrp>0?benefit/mrp*100:null,unallocated};
}
