import { describe, expect, it } from "vitest";
import { assessMatch, calculateMrp, invoiceLineKey, isNonMerchandiseLine, normalizeCode } from "./purchaseAutomationSafety";

describe("purchase automation safe preflight", () => {
  it("rounds 50% markup upward to nearest ten", () => {
    expect(calculateMrp(370)).toBe(560);
    expect(calculateMrp(366.666666)).toThrow();
    expect(calculateMrp(100)).toBe(150);
    expect(calculateMrp(100.01)).toBe(160);
    expect(calculateMrp(0)).toBe(0);
  });
  it("rejects invalid currency", () => {
    expect(() => calculateMrp(-1)).toThrow();
    expect(() => calculateMrp(Number.NaN)).toThrow();
  });
  it("does not treat freight as furniture", () => {
    expect(isNonMerchandiseLine("Other Expenses")).toBe(true);
    expect(isNonMerchandiseLine("Freight charges")).toBe(true);
    expect(isNonMerchandiseLine("Wooden Sofa")).toBe(false);
  });
  it("requires supplier and exact SKU for automatic candidate matching", () => {
    const base = { description: "Wooden Sofa", supplier: "ABC", invoiceNumber: "INV-10", sku: " sf 101 ", quantity: 2, unitRate: 370, lineNumber: 1 };
    expect(assessMatch(base)).toEqual({ kind: "candidate", matchKey: JSON.stringify(["ABC", "SF101"]) });
    expect(assessMatch({ ...base, sku: null }).kind).toBe("review");
    expect(assessMatch({ ...base, quantity: 0 }).kind).toBe("review");
    expect(normalizeCode(" sf 101 ")).toBe("SF101");
  });
  it("distinguishes two lines with same name in one invoice", () => {
    const line = { description: "Sofa", supplier: "ABC", invoiceNumber: "10", sku: "SF1", quantity: 1, unitRate: 100, lineNumber: 1 };
    expect(invoiceLineKey(line)).not.toBe(invoiceLineKey({ ...line, lineNumber: 2 }));
    expect(invoiceLineKey(line)).toBe(invoiceLineKey({ ...line }));
  });
});
