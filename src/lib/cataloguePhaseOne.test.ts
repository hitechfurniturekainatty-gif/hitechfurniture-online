import { describe, expect, it } from "vitest";
import { createCatalogueReviewDraft } from "./cataloguePhaseOne";

describe("catalogue review draft", () => {
  it("keeps stock untouched", () => {
    const draft = createCatalogueReviewDraft({
      supplier: "ABC",
      invoiceNumber: "INV1",
      lineNumber: 1,
      sku: "SOFA1",
      description: "Wooden Sofa",
      quantity: 4,
      unitRate: 370
    });
    expect(draft?.suggestedMrp).toBe(560);
    expect(draft?.stockPostingAllowed).toBe(false);
    expect(draft?.selectedImage).toBeNull();
  });
});
