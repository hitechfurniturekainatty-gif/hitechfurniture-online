import { calculateMrp, invoiceLineKey, isNonMerchandiseLine, type PurchaseLine } from "./purchaseAutomationSafety";

export type CatalogueReviewDraft = {
  sourceKey: string;
  productName: string;
  sku: string | null;
  invoiceQuantityReference: number;
  suggestedMrp: number;
  suggestedImages: string[];
  selectedImage: null;
  reviewStatus: "needs_review";
  stockPostingAllowed: false;
};

/** Produces review data only. Never changes inventory or publishes a product. */
export function createCatalogueReviewDraft(line: PurchaseLine, imageUrls: string[] = []): CatalogueReviewDraft | null {
  if (isNonMerchandiseLine(line.description)) return null;
  if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error("Invalid invoice quantity");
  if (!line.description.trim()) throw new Error("Missing product name");
  return {
    sourceKey: invoiceLineKey(line),
    productName: line.description.trim(),
    sku: line.sku?.trim() || null,
    invoiceQuantityReference: line.quantity,
    suggestedMrp: calculateMrp(line.unitRate),
    suggestedImages: [...new Set(imageUrls.filter(url => url.startsWith("https://")))],
    selectedImage: null,
    reviewStatus: "needs_review",
    stockPostingAllowed: false,
  };
}
