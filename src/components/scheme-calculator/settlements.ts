import type { BenefitReceipt } from './types';

const nonnegative = (n: unknown) => Math.max(0, Number(n) || 0);
const norm = (v: unknown) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
export const receiptRuleKey = (purchaseItem: string, freeItem: string, matchMode: string) => `${matchMode}:${norm(purchaseItem)}=>${norm(freeItem)}`;
export type SettlementRule = { key: string; label: string; freeItem: string; eligible: number };
export function settlementRules(report: { rep: any[] }): SettlementRule[] {
  return report.rep.filter(r => r.purchaseItem && r.freeItem).map(r => ({
    key: receiptRuleKey(r.purchaseItem, r.freeItem, r.matchMode || 'exact'),
    label: `${r.purchaseItem} → ${r.freeItem}`, freeItem: r.freeItem, eligible: nonnegative(r.free),
  }));
}
export function settledQuantity(receipt: BenefitReceipt) {
  return receipt.kind === 'free_item' ? nonnegative(receipt.qty) : receipt.kind === 'credit_note' ? nonnegative(receipt.replaces_free_qty) : 0;
}
export function receiptBenefit(receipt: BenefitReceipt) {
  const gross = receipt.kind === 'free_item' ? nonnegative(receipt.qty) * nonnegative(receipt.unit_value) : nonnegative(receipt.amount);
  // Invoice-inclusive savings already live in MRP minus invoice cost.
  const additionalValue = receipt.included_in_invoice ? 0 : gross;
  const additionalCharge = receipt.charge_in_invoice ? 0 : nonnegative(receipt.vendor_charge);
  return { gross, additionalValue, additionalCharge, net: additionalValue - additionalCharge };
}
export function settlementTotals(receipts: BenefitReceipt[]) {
  return receipts.reduce((total, receipt) => {
    const benefit = receiptBenefit(receipt);
    total.freeReceived += receipt.kind === 'free_item' ? nonnegative(receipt.qty) : 0;
    total.creditSettledQty += receipt.kind === 'credit_note' ? nonnegative(receipt.replaces_free_qty) : 0;
    total.freeValue += receipt.kind === 'free_item' ? benefit.additionalValue : 0;
    total.cashValue += receipt.kind !== 'free_item' ? benefit.additionalValue : 0;
    total.charges += benefit.additionalCharge;
    total.net += benefit.net;
    return total;
  }, { freeReceived: 0, creditSettledQty: 0, freeValue: 0, cashValue: 0, charges: 0, net: 0 });
}
export function settledForRule(rule: SettlementRule, allRules: SettlementRule[], receipts: BenefitReceipt[]) {
  const ambiguous = allRules.filter(r => norm(r.freeItem) === norm(rule.freeItem)).length > 1;
  return receipts.filter(r => r.scheme_rule_key ? r.scheme_rule_key === rule.key : !ambiguous && norm(r.free_item || r.item) === norm(rule.freeItem))
    .reduce((sum, r) => sum + settledQuantity(r), 0);
}
