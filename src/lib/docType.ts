/**
 * Document type helpers.
 *
 * The `quotations` table stores BOTH customer quotations and purchase orders
 * (POs sent to workers / suppliers). They share the same line-item schema —
 * only labelling, theme color, numbering and pricing visibility differ.
 */
export type DocType = "quotation" | "po";

export const isPO = (t: string | null | undefined): boolean => t === "po";

export const docLabel = (t: string | null | undefined): string =>
  isPO(t) ? "Purchase Order" : "Quotation";

export const docLabelShort = (t: string | null | undefined): string =>
  isPO(t) ? "PO" : "Quotation";

export const docPartyLabel = (t: string | null | undefined): string =>
  isPO(t) ? "Worker / Supplier" : "Customer";

/**
 * Tailwind utility classes for the document tag pill shown on lists.
 * Green = customer quotation, Blue = purchase order.
 */
export const docTagClasses = (t: string | null | undefined): string =>
  isPO(t)
    ? "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300"
    : "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300";

/** Section/border accent classes used inside the editor when in PO mode. */
export const docAccentBorder = (t: string | null | undefined): string =>
  isPO(t) ? "border-blue-500/40" : "border-primary/20";

export const docAccentText = (t: string | null | undefined): string =>
  isPO(t) ? "text-blue-600 dark:text-blue-400" : "text-primary";

export const docAccentBg = (t: string | null | undefined): string =>
  isPO(t) ? "bg-blue-500/5" : "bg-primary/5";
