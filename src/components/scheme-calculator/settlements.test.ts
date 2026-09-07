import { describe, it, expect } from 'vitest';
import { receiptBenefit, settlementTotals, settledForRule } from './settlements';
import { summarizeMonthBenefit } from './BenefitTracker';
import type { BenefitReceipt, VendorMonth } from './types';
const goods: BenefitReceipt = { id:'g',kind:'free_item',qty:1,unit_value:10000,vendor_charge:1500 };
describe('scheme accounting',()=>{
 it('subtracts the amount payable for a scheme mattress',()=>expect(receiptBenefit(goods).net).toBe(8500));
 it('does not subtract a charge already in invoice cost again',()=>expect(receiptBenefit({...goods,charge_in_invoice:true}).net).toBe(10000));
 it('does not add a benefit already discounted in the bill again',()=>expect(receiptBenefit({...goods,included_in_invoice:true,charge_in_invoice:true}).net).toBe(0));
 it('subtracts a separate charge even for an invoice-inclusive benefit',()=>expect(receiptBenefit({...goods,included_in_invoice:true}).net).toBe(-1500));
 it('settles goods with credit without inventing a goods value',()=>{const r:BenefitReceipt={id:'c',kind:'credit_note',amount:8500,replaces_free_qty:1};expect(settlementTotals([r])).toMatchObject({freeReceived:0,creditSettledQty:1,net:8500});});
 it('keeps separate rules with the same reward separate',()=>{const rules=[{key:'a',label:'A',freeItem:'Mattress',eligible:2},{key:'b',label:'B',freeItem:'Mattress',eligible:2}];expect(settledForRule(rules[1],rules,[{id:'c',kind:'credit_note',scheme_rule_key:'a',replaces_free_qty:2}])).toBe(0);});
 it.each([4,7,10,1])('calculates net MRP benefit for month %s',month=>{const vm:VendorMonth={party_id:'p',fy_year:2026,month,scheme_kind:'company',scheme_config:{everyQty:10},purchases_text:'',invoices:[],purchase_rows:[{id:'i',item:'Mattress',qty:10,price:7000,mrp:10000,amountWithTax:70000}],benefit_receipts:[goods]};expect(summarizeMonthBenefit(vm)).toMatchObject({effectiveBenefitValue:38500,effectiveBenefitPct:38.5,vendorCharges:1500});});
 it('removes credit-replaced units from pending',()=>{const vm:VendorMonth={party_id:'p',fy_year:2026,month:4,scheme_kind:'company',scheme_config:{everyQty:10},purchases_text:'',invoices:[],purchase_rows:[{id:'i',item:'Mattress',qty:10,price:7000,mrp:10000,amountWithTax:70000}],benefit_receipts:[{id:'c',kind:'credit_note',amount:8500,replaces_free_qty:1}]};expect(summarizeMonthBenefit(vm).freePending).toBe(0);});
});
