import type { BenefitReceipt, VendorMonth } from "./types";
import { monthRows, type PeriodBenefitRecord } from "./periodBenefits";
import { allAttributedReceipts, attributedBalances, refId } from "./schemeAttribution";
import { receiptBenefit } from "./settlements";
import { fyCalendarYear } from "./utils";

export type AccountingAudit = {
  missingMrpRows: number;
  missingMrpCost: number;
  missingInvoiceDates: number;
  invoiceDateMismatches: number;
  missingReceiptDates: number;
  missingReceiptReferences: number;
  unlinkedReceipts: number;
  duplicateReceiptReferences: number;
  unvaluedFreeReceipts: number;
  pendingFreeQty: number;
  pendingCashValue: number;
  criticalIssues: number;
  status: "needs_attention" | "reconciled_pending" | "reconciled";
};

const validDate = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const norm = (value?: string) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

function rawReceipts(months: VendorMonth[], records: PeriodBenefitRecord[]) {
  const items: BenefitReceipt[] = [];
  for (const m of months) {
    items.push(...(m.benefit_receipts || []));
    for (const invoice of m.invoices || []) items.push(...(invoice.benefit_receipts || []));
  }
  for (const record of records) items.push(...(record.benefit_receipts || []));
  return items;
}

export function auditSchemeFy(months: VendorMonth[], records: PeriodBenefitRecord[], fy: number): AccountingAudit {
  const fyMonths = months.filter((m) => m.fy_year === fy);
  const purchaseRows = fyMonths.flatMap(monthRows).filter((r) => !r.reward && Number(r.qty) !== 0);
  const missingMrp = purchaseRows.filter((r) => !(Number(r.mrp) > 0));
  const missingMrpCost = missingMrp.reduce((sum, r) => sum + Math.abs(Number(r.amountWithTax) || 0), 0);

  let missingInvoiceDates = 0;
  let invoiceDateMismatches = 0;
  for (const m of fyMonths) {
    const expectedYear = fyCalendarYear(fy, m.month);
    for (const invoice of m.invoices || []) {
      if (!validDate(invoice.date)) {
        missingInvoiceDates++;
        continue;
      }
      const [year, month] = invoice.date!.split("-").map(Number);
      if (year !== expectedYear || month !== m.month) invoiceDateMismatches++;
    }
  }

  const raw = rawReceipts(months, records);
  let missingReceiptDates = 0;
  let missingReceiptReferences = 0;
  let unlinkedReceipts = 0;
  let unvaluedFreeReceipts = 0;
  const keys = new Map<string, number>();

  for (const receipt of raw) {
    const source = receipt.scheme_period;
    if (!source || source.fy !== fy) continue;
    if (!validDate(receipt.date)) missingReceiptDates++;
    if (!norm(receipt.reference)) missingReceiptReferences++;
    if (!receipt.scheme_period && !receipt.benefit_month) unlinkedReceipts++;
    if (receipt.kind === "free_item" && Number(receipt.qty) > 0 && !receipt.included_in_invoice && !(Number(receipt.unit_value) > 0)) unvaluedFreeReceipts++;

    const ref = norm(receipt.reference);
    if (ref) {
      const key = [source ? refId(source) : "unlinked", receipt.kind, receipt.scheme_rule_key || "", ref].join("|");
      keys.set(key, (keys.get(key) || 0) + 1);
    }
  }

  const duplicateReceiptReferences = Array.from(keys.values()).reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  const balances = attributedBalances(months, records).filter((b) => b.ref.fy === fy);
  const pendingFreeQty = balances.filter((b) => b.unit !== "₹").reduce((sum, b) => sum + Math.max(0, Number(b.pending) || 0), 0);
  const pendingCashValue = balances.filter((b) => b.unit === "₹").reduce((sum, b) => sum + Math.max(0, Number(b.pending) || 0), 0);

  const attributed = allAttributedReceipts(months, records).filter((r) => r.source.fy === fy);
  // Any externally recorded free receipt with zero accounting value makes the final margin provisional.
  const zeroValuedAttributedFree = attributed.filter((r) => r.kind === "free_item" && Number(r.qty) > 0 && !r.included_in_invoice && receiptBenefit(r).gross <= 0).length;
  unvaluedFreeReceipts = Math.max(unvaluedFreeReceipts, zeroValuedAttributedFree);

  const criticalIssues =
    missingMrp.length +
    missingInvoiceDates +
    invoiceDateMismatches +
    missingReceiptDates +
    missingReceiptReferences +
    unlinkedReceipts +
    duplicateReceiptReferences +
    unvaluedFreeReceipts;

  return {
    missingMrpRows: missingMrp.length,
    missingMrpCost,
    missingInvoiceDates,
    invoiceDateMismatches,
    missingReceiptDates,
    missingReceiptReferences,
    unlinkedReceipts,
    duplicateReceiptReferences,
    unvaluedFreeReceipts,
    pendingFreeQty,
    pendingCashValue,
    criticalIssues,
    status: criticalIssues > 0 ? "needs_attention" : (pendingFreeQty > 0 || pendingCashValue > 0 ? "reconciled_pending" : "reconciled"),
  };
}
