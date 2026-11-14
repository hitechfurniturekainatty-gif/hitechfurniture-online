import { describe, expect, it } from "vitest";
import { itemsMissingPhoto } from "./orderPhotoGate";

describe("itemsMissingPhoto", () => {
  it("blocks a ready-stock item with no photo", () => {
    expect(itemsMissingPhoto([{ description: "Sofa 3+2", fulfillment_route: "ready_stock" }])).toEqual([{ n: 1, description: "Sofa 3+2" }]);
  });
  it("accepts any of item photo, catalog photo or sketch", () => {
    expect(itemsMissingPhoto([
      { item_image_url: "https://x/a.jpg" },
      { catalog_image_url: "https://x/b.jpg" },
      { sketch_url: "https://x/c.jpg" },
    ])).toEqual([]);
  });
  it("does not block custom items", () => {
    expect(itemsMissingPhoto([{ fulfillment_route: "custom" }, { stock_decision: "custom" }])).toEqual([]);
  });
  it("ignores fully cancelled rows and keeps item numbers", () => {
    expect(itemsMissingPhoto([
      { quantity: 1, cancelled_qty: 1 },
      { item_image_url: "https://x/a.jpg" },
      { description: "Cot", quantity: 2, cancelled_qty: 1 },
    ])).toEqual([{ n: 3, description: "Cot" }]);
  });
});
