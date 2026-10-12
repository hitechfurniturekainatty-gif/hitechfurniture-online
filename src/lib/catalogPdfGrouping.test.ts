import { describe, expect, it } from "vitest";
import { groupEntries, thenByOptions } from "./catalogPdfGrouping";
import { buildStoreZip } from "./storeZip";
import type { FloorEntry, FloorLocation } from "./staffFloorCatalog";

const locations: FloorLocation[] = [
  { id: "g1", building: "Main Shop", floor: "Ground Floor", section: "Part A", part: null },
  { id: "g2", building: "Main Shop", floor: "Ground Floor", section: "Part B", part: null },
  { id: "f1", building: "Main Shop", floor: "1st Floor", section: "Sofa Corner", part: null },
  { id: "w1", building: "Godown", floor: "Ground Floor", section: null, part: null },
];
const categories = [{ id: "sofa", name: "Sofa" }, { id: "bed", name: "Bed" }];
const subCategories = [{ id: "l", name: "L-Shape", main_category_id: "sofa" }, { id: "k", name: "King Bed", main_category_id: "bed" }];
const lookup = { locations, categories, subCategories };
const row = (key: string, loc: string | null, cat: string, sub: string | null): FloorEntry => ({
  key, kind: "product", refId: key, variant: null, location_id: loc, floor_display_order: 0, cover: null, stock: 1,
  product: { id: key, product_name: key, product_code: key, mrp: 1, stock_quantity: 1, stock_status: "in_stock", location_id: loc, floor_display_order: 0, main_category_id: cat, sub_category_id: sub, product_images: [], product_variants: [] },
});
const rows = [row("a", "g1", "bed", "k"), row("b", "g2", "sofa", "l"), row("c", "f1", "sofa", "l"), row("d", "w1", "bed", null), row("e", null, "sofa", "l")];
const keys = (e: FloorEntry) => e.key;

describe("groupEntries", () => {
  it("groups floors per building and keeps showroom order, unset location last", () => {
    const g = groupEntries(rows, "floor", lookup, keys);
    expect(g.map(x => [x.title, x.items])).toEqual([
      ["Main Shop · Ground Floor", ["a", "b"]],
      ["Main Shop · 1st Floor", ["c"]],
      ["Godown · Ground Floor", ["d"]],
      ["Location not set", ["e"]],
    ]);
  });
  it("groups by category in category display order", () => {
    expect(groupEntries(rows, "category", lookup, keys).map(x => x.title)).toEqual(["Sofa", "Bed"]);
    expect(groupEntries(rows, "sub", lookup, keys).map(x => x.title)).toEqual(["L-Shape", "King Bed", "No sub-category"]);
  });
  it("nests a second level with short titles", () => {
    const g = groupEntries(rows, "floor", lookup, keys, "section");
    expect(g[0].children?.map(c => [c.title, c.items])).toEqual([["Part A", ["a"]], ["Part B", ["b"]]]);
    const c = groupEntries(rows, "category", lookup, keys, "floor");
    expect(c[0].children?.map(x => x.title)).toEqual(["Main Shop · Ground Floor", "Main Shop · 1st Floor", "Location not set"]);
  });
  it("returns one list when not grouping and limits second-level choices", () => {
    expect(groupEntries(rows, "none", lookup, keys)).toEqual([{ key: "all", title: "All items", items: ["a", "b", "c", "d", "e"] }]);
    expect(thenByOptions("section")).not.toContain("floor");
  });
});

describe("buildStoreZip", () => {
  it("writes a valid zip structure", () => {
    const zip = buildStoreZip([{ name: "01-a.pdf", data: new TextEncoder().encode("hello") }, { name: "02-b.pdf", data: new Uint8Array([1, 2, 3]) }]);
    const v = new DataView(zip.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(14, true)).toBe(0x3610a686); // crc32("hello")
    expect(v.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(zip.length - 12, true)).toBe(2);
  });
});
