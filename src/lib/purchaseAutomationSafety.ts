/** Pure, side-effect-free helpers for invoice review. Never posts stock or publishes products. */
export type PurchaseLine = { description: string; supplier: string; invoiceNumber: string; sku: string | null; quantity: number; unitRate: number; lineNumber: number };
export type ReviewDecision = { kind: "review"; reason: string } | { kind: "candidate"; matchKey: string };

export function normalizeCode(value: string): string {
  return value.normalize("NFKC").trim().toUpperCase().replace(/\s+/g, "");
}

/** Price from rupees to rupees, always round *up* to a multiple of ten. */
export function calculateMrp(unitRate: number): number {
  if (!Number.isFinite(unitRate) || unitRate < 0) throw new Error("Invalid unit purchase rate");
  // Work in paise to avoid floating point drift on ordinary currency inputs.
  const paise = Math.round(unitRate * 100);
  if (Math.abs(unitRate * 100 - paise) > 1e-6) throw new Error("Unit rate has more than two decimals");
  return Math.ceil((paise * 3) / 2000) * 10;
}

/** Classification only: excludes invoice-level charges from merchandise lines. */
export function isNonMerchandiseLine(description: string): boolean {
  return /\b(other expenses?|freight|shipping|transport(?:ation)?|delivery charge|round[ -]?off|narration|packing charge|handling charge)\b/i.test(description);
}

/** Explicit source-line identity; never derive identity from item name alone. */
export function invoiceLineKey(line: PurchaseLine): string {
  if (!line.supplier.trim() || !line.invoiceNumber.trim() || !Number.isSafeInteger(line.lineNumber) || line.lineNumber < 1)
    throw new Error("Missing supplier, invoice or valid source line number");
  return JSON.stringify([line.supplier.trim().toLocaleUpperCase("en-IN"), line.invoiceNumber.trim().toLocaleUpperCase("en-IN"), line.lineNumber]);
}

export function assessMatch(line: PurchaseLine): ReviewDecision {
  if (isNonMerchandiseLine(line.description)) return { kind: "review", reason: "Non-merchandise charge: exclude from stock" };
  if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) return { kind: "review", reason: "Invalid quantity" };
  if (!Number.isFinite(line.unitRate) || line.unitRate < 0) return { kind: "review", reason: "Invalid unit rate" };
  if (!line.supplier.trim() || !line.sku?.trim()) return { kind: "review", reason: "Supplier or SKU missing" };
  return { kind: "candidate", matchKey: JSON.stringify([line.supplier.trim().toLocaleUpperCase("en-IN"), normalizeCode(line.sku)]) };
}
