import {describe,it,expect} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {createElement} from 'react';
import {SchemePeriodPicker} from './SchemePeriodPicker';
import {attributedSummary,attributedBalances,refId} from './schemeAttribution';
import type {VendorMonth,SchemePeriodRef} from './types';
import type {PeriodBenefitRecord} from './periodBenefits';
const ref:SchemePeriodRef={fy:2025,type:'quarterly',key:'Q1'};
const m=(month:number,qty:number):VendorMonth=>({party_id:'v',fy_year:2025,month,scheme_kind:'bogo',scheme_config:{rules:[]},purchases_text:'',purchase_rows:[],invoices:qty?[{id:'i'+month,label:'Purchase',rows:[{id:'r',item:month===4?'Ultra':'Comfort',qty,mrp:10000,price:7500,amountWithTax:7500*qty}]}]:[],benefit_receipts:[]});
const setup=()=>{
 const apr=m(4,5),may=m(5,5),later={...m(6,1),fy_year:2026};
 const periods:PeriodBenefitRecord[]=[{fy_year:2025,period_type:'quarterly',period_key:'Q1',scheme_kind:'bogo',scheme_config:{rules:[{purchaseItem:'Mattress combo',purchaseItems:['Ultra','Comfort'],matchMode:'exact',buyQty:10,freeQty:2,freeItem:'Ultra'}]},benefit_receipts:[]}];
 const all=[apr,may,later];
 const key=attributedBalances(all,periods)[0].key;
 return {all,periods,key,later};
};
describe('cross-year source-period benefit and settlement',()=>{
 it('keeps a fully achieved quarterly combo pending until received next year',()=>{
  const {all,periods,key,later}=setup();
  expect(attributedBalances(all,periods)[0]).toMatchObject({eligible:2,received:0,pending:2,purchased:10,target:10});
  later.benefit_receipts=[{id:'receipt',kind:'free_item',qty:1,unit_value:3000,item:'Ultra',date:'2026-06-10',scheme_period:ref,scheme_rule_key:key}];
  expect(attributedBalances(all,periods)[0]).toMatchObject({received:1,pending:1});
  later.benefit_receipts.push({id:'credit',kind:'credit_note',amount:3000,replaces_free_qty:1,date:'2026-06-12',scheme_period:ref,scheme_rule_key:key});
  expect(attributedBalances(all,periods)[0]).toMatchObject({received:2,pending:0});
  expect(attributedSummary(all,periods,2025,[4,5,6])).toMatchObject({mrp:100000,base:25000,extra:6000,benefit:31000,percent:31});
  expect(attributedSummary(all,periods,2026,[6]).extra).toBe(0);
 });
 it('allocates quarterly, half-yearly and yearly rewards consistently to monthly purchase MRP',()=>{
  const {all,periods,later}=setup();
  for(const source of [ref,{fy:2025,type:'halfyearly',key:'H1'},{fy:2025,type:'yearly',key:'FY'}] as SchemePeriodRef[]){
   later.benefit_receipts=[{id:'c',kind:'credit_note',amount:10000,date:'2026-06-10',scheme_period:source}];
   expect(attributedSummary(all,periods,2025,[4]).extra).toBe(5000);
   expect(attributedSummary(all,periods,2025,[5]).extra).toBe(5000);
   expect(attributedSummary(all,periods,2025,[4,5,6]).extra).toBe(10000);
   expect(attributedSummary(all,periods,2025,[4,5,6,7,8,9,10,11,12,1,2,3]).extra).toBe(10000);
  }
 });
 it('moves invoice reward value to its original FY exactly once and excludes free MRP from purchase basis',()=>{
  const {all,periods,key,later}=setup();
  later.invoices[0].discount_amount=3000;
  later.invoices[0].rows.push({id:'reward',item:'Ultra',qty:2,mrp:0,price:1500,amountWithTax:3000,reward:{scheme_month:'2025-06',scheme_period:ref,scheme_rule_key:key}});
  expect(attributedSummary(all,periods,2025,[4,5,6]).extra).toBe(3000);
  expect(attributedSummary(all,periods,2026,[6])).toMatchObject({mrp:10000,cost:7500,extra:0,benefit:2500});
  expect(attributedBalances(all,periods)[0]).toMatchObject({received:2,pending:0});
  later.invoices[0].discount_amount=1500;
  expect(attributedSummary(all,periods,2025,[4,5,6]).extra).toBe(1500);
 });
 it('reattributes an invoice-inclusive credit rather than counting it in both years',()=>{
  const {all,periods,later}=setup();
  later.invoices[0].discount_amount=1000;
  later.benefit_receipts=[{id:'c',kind:'credit_note',amount:1000,included_in_invoice:true,date:'2026-06-10',scheme_period:ref}];
  expect(attributedSummary(all,periods,2025,[4,5,6]).extra).toBe(1000);
  expect(attributedSummary(all,periods,2026,[6]).benefit).toBe(2500);
 });
 it('reduces achieved combo quantity when a purchase is returned and reverses deleted receipts',()=>{
  const {all,periods,later,key}=setup();
  later.benefit_receipts=[{id:'r',kind:'free_item',qty:1,unit_value:3000,date:'2026-06-10',scheme_period:ref,scheme_rule_key:key}];
  later.benefit_receipts=[];
  expect(attributedBalances(all,periods)[0].pending).toBe(2);
  all[0].invoices.push({id:'return',label:'Return',document_kind:'purchase_return',rows:[{id:'rr',item:'Ultra',qty:1,mrp:10000,price:7500,amountWithTax:7500}]});
  expect(attributedBalances(all,periods)[0].eligible).toBe(0);
 });
 it('does not invent a monthly allocation when source-period MRP is absent',()=>{
  const {all,periods,later}=setup();
  all[0].invoices=[];all[1].invoices=[];
  later.benefit_receipts=[{id:'c',kind:'credit_note',amount:3000,scheme_period:ref}];
  expect(attributedSummary(all,periods,2025,[4])).toMatchObject({percent:null,extra:0,unallocated:3000});
  expect(attributedSummary(all,periods,2025,[4,5,6])).toMatchObject({percent:null,extra:3000});
 });
 it('separates monetary scheme achievement from free-item quantity',()=>{
  const {all,periods,later}=setup();
  periods[0].scheme_kind='cashback';periods[0].scheme_config={minAmount:70000,cashback:5000};
  later.benefit_receipts=[{id:'c',kind:'credit_note',amount:2000,scheme_period:ref}];
  expect(attributedBalances(all,periods)[0]).toMatchObject({unit:'₹',eligible:5000,received:2000,pending:3000});
 });
 it('lets staff select a prior FY and full-year scheme through the shared picker',()=>{
  let value:SchemePeriodRef={fy:2026,type:'monthly',key:'6'};
  const onChange=(r:SchemePeriodRef)=>{value=r;view.rerender(createElement(SchemePeriodPicker,{value,onChange}));};
  const view=render(createElement(SchemePeriodPicker,{value,onChange}));
  fireEvent.change(screen.getByLabelText('Scheme financial year'),{target:{value:'2025'}});
  fireEvent.change(screen.getByLabelText('Scheme period type'),{target:{value:'yearly'}});
  expect(refId(value)).toBe('2025:yearly:FY');
 });
});

it('saves invoice credits with the bill, attributes them to the old scheme and prevents embedded double counting',()=>{
 const {all,periods,later}=setup();
 later.invoices[0].benefit_receipts=[{id:'inline-credit',kind:'credit_note',amount:1000,date:'2026-06-10',scheme_period:ref,reference:'CN-1'}];
 const restored=JSON.parse(JSON.stringify(all)) as VendorMonth[];
 expect(attributedSummary(restored,periods,2025,[4,5,6]).extra).toBe(1000);
 expect(attributedSummary(restored,periods,2026,[6]).benefit).toBe(2500);
 later.invoices[0].discount_amount=1000;
 later.invoices[0].benefit_receipts[0].included_in_invoice=true;
 expect(attributedSummary(all,periods,2025,[4,5,6]).extra).toBe(1000);
 expect(attributedSummary(all,periods,2026,[6]).benefit).toBe(2500);
 later.invoices[0].benefit_receipts=[];
 expect(attributedSummary(all,periods,2025,[4,5,6]).extra).toBe(0);
});
