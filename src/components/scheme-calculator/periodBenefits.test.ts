import {describe,it,expect} from 'vitest';
import {monthRows, periodReceiptsForMonths} from './periodBenefits';
import {summarizePeriodBenefit} from './BenefitTracker';
import {computeFreeReport,aggregateRowsByItem} from './utils';
import type {VendorMonth,Invoice} from './types';
const doc=(qty:number,cost:number,returned=false):Invoice=>({id:Math.random().toString(),label:'Doc',document_kind:returned?'purchase_return':'purchase',rows:[{id:'r',item:'Mattress',qty,price:cost/qty,amountWithTax:cost,mrp:10000}]});
const month=(month:number,invoices:Invoice[],amount=0):VendorMonth=>({party_id:'p',fy_year:2026,month,scheme_kind:'company',scheme_config:{everyQty:10},purchase_rows:[],purchases_text:'',invoices,benefit_receipts:amount?[{id:'c'+month,kind:'credit_note',amount}]:[]});
describe('period benefits and debit-note returns',()=>{
 it('adds Onam and Vishu credits to base MRP discount',()=>{expect(summarizePeriodBenefit([month(4,[doc(10,75000)],10000),month(5,[],5000)],2026)).toMatchObject({base:25000,additional:15000,benefit:40000,percent:40});});
 it('subtracts return amount and MRP rather than counting a debit note as benefit',()=>{expect(summarizePeriodBenefit([month(4,[doc(10,75000)]),month(5,[doc(2,15000,true)])],2026)).toMatchObject({mrp:80000,netCost:60000,returns:15000,benefit:20000,percent:25});});
 it('reduces eligible scheme quantity after returns',()=>{const rows=[month(4,[doc(10,75000)]),month(5,[doc(2,15000,true)])].flatMap(monthRows);expect(computeFreeReport({kind:'company',config:{everyQty:10}},aggregateRowsByItem(rows)).rep[0].free).toBe(0);});
 it('adds saved quarterly and yearly credits to the matching effective month only',()=>{const records=[{period_type:'quarterly',period_key:'Q1',benefit_receipts:[{id:'x',kind:'credit_note' as const,amount:10000,benefit_month:'2026-06'}]},{period_type:'yearly',period_key:'FY',benefit_receipts:[{id:'y',kind:'credit_note' as const,amount:5000,benefit_month:'2027-03'}]}];expect(periodReceiptsForMonths(records,2026,[4,5,6])).toHaveLength(1);expect(periodReceiptsForMonths(records,2026,[1,2,3])).toHaveLength(1);expect(periodReceiptsForMonths(records,2026,[7,8,9])).toHaveLength(0);expect(summarizePeriodBenefit([month(6,[doc(10,75000)])],2026,records).percent).toBe(35);});
 it('uses weighted MRP totals instead of averaging monthly percentages',()=>{expect(summarizePeriodBenefit([month(4,[doc(10,75000)]),month(5,[doc(20,100000)])],2026).percent).toBeCloseTo(41.6666667);});
 it('keeps original return rows positive for editing and applies signs once',()=>{const m=month(4,[doc(2,15000,true)]);expect(monthRows(m)[0].qty).toBe(-2);expect(m.invoices[0].rows[0].qty).toBe(2);});
 it('has no percentage when all purchases are returned',()=>{expect(summarizePeriodBenefit([month(4,[doc(10,75000),doc(10,75000,true)])],2026).percent).toBeNull();});
});
