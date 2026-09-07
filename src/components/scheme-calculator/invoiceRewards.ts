import type { BenefitReceipt, VendorMonth } from './types';
import { monthRows } from './periodBenefits';
import { aggregateRowsByItem, computeFreeReport, fyCalendarYear } from './utils';
import { settlementRules, settledForRule } from './settlements';

export const monthKey = (m: Pick<VendorMonth,'fy_year'|'month'>) => `${fyCalendarYear(m.fy_year,m.month)}-${String(m.month).padStart(2,'0')}`;
export function invoiceRewardReceipts(months: VendorMonth[]) {
  return months.flatMap(m => (m.invoices||[]).filter(i=>i.document_kind!=='purchase_return').flatMap(i =>
    i.rows.filter(r=>r.reward).map(r => ({
      id: `invoice:${i.id}:${r.id}`, kind: 'free_item' as const, item:r.item, qty:r.qty,
      scheme_rule_key:r.reward!.scheme_rule_key, scheme_label:r.reward!.scheme_label,
      benefit_month:r.reward!.scheme_month, date:i.date || monthKey(m)+'-01',
      reference:i.invoice_no || i.label, included_in_invoice:true,
      note:'Invoice-linked reward; edit the original invoice to change this receipt.',
      received_month:monthKey(m),
    }))));
}
export function rewardRulesForMonth(m: VendorMonth) {
  return settlementRules(computeFreeReport({kind:m.scheme_kind,config:m.scheme_config},aggregateRowsByItem(monthRows(m))));
}
export function rewardBalances(months: VendorMonth[]) {
  const incoming=invoiceRewardReceipts(months);
  return months.flatMap(m=>{
    const rules=rewardRulesForMonth(m);
    const receipts=[...(m.benefit_receipts||[]),...incoming.filter(r=>r.scheme_rule_key&&r.benefit_month===monthKey(m))];
    return rules.map(rule=>{
      const received=settledForRule(rule,rules,receipts);
      return {month:monthKey(m),...rule,received,pending:Math.max(0,rule.eligible-received),
        receipts:incoming.filter(r=>r.benefit_month===monthKey(m)&&r.scheme_rule_key===rule.key)};
    });
  });
}
