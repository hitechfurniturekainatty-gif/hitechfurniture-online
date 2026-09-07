import type { BenefitReceipt, Invoice, Row, VendorMonth } from './types';
export type PeriodBenefitRecord = { period_type: string; period_key: string; benefit_receipts?: BenefitReceipt[] };
/** Return documents keep positive editable rows; signs are applied only for calculations. */
export function invoiceRows(invoices: Invoice[]): Row[] {
  return invoices.flatMap(invoice => invoice.rows.map(row => invoice.document_kind === 'purchase_return'
    ? {...row, qty: -Math.abs(Number(row.qty)||0), amountWithTax: -Math.abs(Number(row.amountWithTax)||0)} : row));
}
export function monthRows(month: Pick<VendorMonth,'invoices'|'purchase_rows'>): Row[] {
  return month.invoices?.length ? invoiceRows(month.invoices) : month.purchase_rows || [];
}
/** New receipts use their effective benefit month; legacy period receipts use period end. */
export function periodReceiptsForMonths(records: PeriodBenefitRecord[], fy: number, months: number[]): BenefitReceipt[] {
  return records.flatMap(record => (record.benefit_receipts || []).filter(receipt => {
    const date = receipt.benefit_month || receipt.date;
    if (date && /^\d{4}-\d{2}/.test(date)) {
      const year = Number(date.slice(0,4)), month = Number(date.slice(5,7));
      return months.includes(month) && year === (month >= 4 ? fy : fy + 1);
    }
    const endMonth = record.period_type === 'quarterly' ? ({Q1:6,Q2:9,Q3:12,Q4:3}[record.period_key] || 3) : record.period_type === 'halfyearly' && record.period_key === 'H1' ? 9 : 3;
    return months.includes(endMonth);
  }));
}
