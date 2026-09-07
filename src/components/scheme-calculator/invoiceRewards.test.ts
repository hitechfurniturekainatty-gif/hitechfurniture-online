import {describe,it,expect} from 'vitest';
import {render,screen} from '@testing-library/react';
import {createElement} from 'react';
import {InvoiceRewardReport} from './InvoiceRewardReport';
import {invoiceRewardReceipts,rewardBalances,rewardRulesForMonth} from './invoiceRewards';
import {summarizeMonthBenefit,summarizePeriodBenefit} from './BenefitTracker';
import {invoiceRows} from './periodBenefits';
import {aggregateRowsByItem} from './utils';
import {parseInvoiceFooterDiscount,parseInvoiceText} from './invoiceParser';
import type {VendorMonth,Invoice} from './types';

const month=(fy:number,m:number):VendorMonth=>({party_id:'vendor',fy_year:fy,month:m,scheme_kind:'bogo',scheme_config:{rules:[{purchaseItem:'Ultra',matchMode:'exact',buyQty:10,freeQty:2,freeItem:'Ultra'}]},purchase_rows:[],invoices:[],purchases_text:'',benefit_receipts:[]});
const setup=()=>{
 const march=month(2025,3),june=month(2026,6);
 march.invoices=[{id:'march',label:'March',rows:[{id:'p',item:'Ultra',qty:10,price:1000,amountWithTax:10000,mrp:1500}]}];
 const key=rewardRulesForMonth(march)[0].key;
 const inv:Invoice={id:'june',label:'June invoice',invoice_no:'J-1',date:'2026-06-10',discount_amount:3000,rows:[
  {id:'normal',item:'Ultra',qty:1,price:10000,amountWithTax:10000,mrp:15000},
  {id:'free',item:'Ultra',qty:2,price:1500,amountWithTax:3000,mrp:0,reward:{scheme_month:'2026-03',scheme_rule_key:key}},
 ]};
 june.invoices=[inv];
 return {march,june,inv};
};
describe('invoice reward accounting and attribution',()=>{
 it('offsets 3000 billed rewards once, preserves paid cost and excludes reward quantity from targets',()=>{
  const {june,inv}=setup();
  const rows=invoiceRows([inv]);
  expect(rows.map(r=>r.amountWithTax)).toEqual([10000,0]);
  expect(aggregateRowsByItem(rows)[0].qty).toBe(1);
  expect(summarizeMonthBenefit(june)).toMatchObject({mrpValue:18000,purchaseCost:10000,effectiveBenefitValue:8000});
  const receipts=invoiceRewardReceipts([june]);
  expect(summarizeMonthBenefit({...june,benefit_receipts:receipts}).effectiveBenefitValue).toBe(8000);
 });
 it('settles March in the previous FY and records June receipt without moving the purchase benefit',()=>{
  const {march,june}=setup();
  const report=rewardBalances([march,june]);
  expect(report.find(r=>r.month==='2026-03')).toMatchObject({eligible:2,received:2,pending:0});
  expect(report.find(r=>r.month==='2026-06')).toMatchObject({eligible:0,received:0});
  expect(invoiceRewardReceipts([march,june])[0]).toMatchObject({benefit_month:'2026-03',received_month:'2026-06',reference:'J-1'});
  expect(summarizePeriodBenefit([march],2025).benefit).toBe(5000);
  expect(summarizePeriodBenefit([june],2026).benefit).toBe(8000);
 });
 it('keeps partial vendor charges, extra discount and edit/delete accounting reversible',()=>{
  const {march,june,inv}=setup();
  inv.discount_amount=1500;
  expect(summarizeMonthBenefit(june).purchaseCost).toBe(11500);
  inv.discount_amount=3500;
  expect(invoiceRows([inv]).map(r=>r.amountWithTax)).toEqual([9500,0]);
  inv.rows[1].qty=1;
  expect(rewardBalances([march,june])[0].pending).toBe(1);
  june.invoices=[];
  expect(rewardBalances([march,june])[0].pending).toBe(2);
 });
 it('does not silently settle a target for an unlinked reward',()=>{
  const {march,june,inv}=setup();
  delete inv.rows[1].reward!.scheme_rule_key;
  expect(rewardBalances([march,june])[0].pending).toBe(2);
 });
 it('retains old invoices and debit notes without discounts',()=>{
  const {march}=setup();
  expect(invoiceRows(march.invoices)[0].amountWithTax).toBe(10000);
  march.invoices[0].document_kind='purchase_return';
  expect(invoiceRows(march.invoices)[0]).toMatchObject({qty:-10,amountWithTax:-10000});
 });
 it('renders the scheme month, receipt month and linked invoice together',()=>{
  const {march,june}=setup();
  render(createElement(InvoiceRewardReport,{months:[march,june]}));
  expect(screen.getByText('2026-03')).toBeTruthy();
  expect(screen.getByText('2026-06 · J-1 · 2 pcs')).toBeTruthy();
 });
 it('reads an unambiguous footer amount but never treats a percentage as rupees',()=>{
  const text='Ultra\t2\t1500\t3000\nDiscount allowed\t3,000.00';
  expect(parseInvoiceFooterDiscount(text)).toBe(3000);
  expect(parseInvoiceText(text)).toHaveLength(1);
  expect(parseInvoiceFooterDiscount('Discount allowed 10%')).toBeNull();
  expect(parseInvoiceFooterDiscount('Discount allowed 10\nTotal discount 20')).toBeNull();
 });
});
