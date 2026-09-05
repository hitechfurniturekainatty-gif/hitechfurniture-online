import { describe, expect, it } from "vitest";
import { parseInvoiceText } from "./invoiceParser";

function stripIds(rows: ReturnType<typeof parseInvoiceText>) {
  return rows.map(({ id: _id, ...r }) => r);
}

describe("parseInvoiceText", () => {
  it("parses simple tab-separated copy paste", () => {
    const rows = parseInvoiceText("Comfobond 75x60x6\t10\t1250\t12500\nOrtho Plus\t5\t2200\t11000");
    expect(stripIds(rows)).toEqual([
      { item: "Comfobond 75x60x6", qty: 10, price: 1250, amountWithTax: 12500, mrp: 0 },
      { item: "Ortho Plus", qty: 5, price: 2200, amountWithTax: 11000, mrp: 0 },
    ]);
  });

  it("uses invoice headers and ignores serial, HSN, GST and summary rows", () => {
    const text = [
      "Sl No\tDescription\tHSN\tQty\tRate\tTaxable Value\tGST %\tTax Amount",
      "1\tOrtho Deluxe 72x60x6\t94042190\t4\t3500\t14000\t18%\t2520",
      "2\tSpine Care 75x60x6\t94042190\t2\t4200\t8400\t18%\t1512",
      "Grand Total\t\t\t6\t\t22400\t\t4032",
    ].join("\n");
    const rows = parseInvoiceText(text);
    expect(stripIds(rows)).toEqual([
      { item: "Ortho Deluxe 72x60x6", qty: 4, price: 3500, amountWithTax: 14000, mrp: 0 },
      { item: "Spine Care 75x60x6", qty: 2, price: 4200, amountWithTax: 8400, mrp: 0 },
    ]);
  });

  it("parses quoted CSV with currency commas", () => {
    const text = [
      'Description,Qty,Unit Price,Net Amount',
      '"Premium Mattress, King",2,"₹12,500.00","₹25,000.00"',
    ].join("\n");
    const rows = parseInvoiceText(text);
    expect(stripIds(rows)).toEqual([
      { item: "Premium Mattress, King", qty: 2, price: 12500, amountWithTax: 25000, mrp: 0 },
    ]);
  });

  it("parses pipe separated billing software exports", () => {
    const rows = parseInvoiceText("Item | Qty | Rate | Total\nCloud Bed | 3 | 5000 | 15000");
    expect(stripIds(rows)).toEqual([
      { item: "Cloud Bed", qty: 3, price: 5000, amountWithTax: 15000, mrp: 0 },
    ]);
  });

  it("falls back to calculated unit price when only quantity and total are usable", () => {
    const rows = parseInvoiceText("Comfort Bed\t4\t12000");
    expect(rows).toHaveLength(1);
    expect(rows[0].item).toBe("Comfort Bed");
    expect(rows[0].qty).toBe(4);
    expect(rows[0].price).toBe(3000);
    expect(rows[0].amountWithTax).toBe(12000);
  });

  it("does not create rows from totals, GST or invalid text", () => {
    const text = "GST 18% 2520\nGrand Total 16520\nInvoice No ABC123\nThank you";
    expect(parseInvoiceText(text)).toEqual([]);
  });

  it("handles non-breaking spaces and INR formatted numbers", () => {
    const rows = parseInvoiceText("Latex Bed\u00a0\u00a0 2\u00a0\u00a0 ₹7,500\u00a0\u00a0 ₹15,000");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ item: "Latex Bed", qty: 2, price: 7500, amountWithTax: 15000 });
  });
});
