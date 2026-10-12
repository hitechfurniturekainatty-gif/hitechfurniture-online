import { describe, expect, it } from "vitest";
import { parseVisibilityConfig, isItemHidden, isAllHidden, pruneExpired, entryActive, emptyVisibilityConfig, isSubHidden } from "./publicCatalogVisibility";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const past = "2026-10-11T00:00:00Z", future = "2026-10-20T00:00:00Z";

describe("public catalog visibility", () => {
  it("parses bad input safely", () => {
    expect(parseVisibilityConfig("not json")).toEqual(emptyVisibilityConfig());
    expect(parseVisibilityConfig(null).main).toEqual({});
  });
  it("hides by main, sub, product and bundle", () => {
    const cfg = { ...emptyVisibilityConfig(), main: { sofa: {} }, sub: { lshape: {} }, products: { p1: {} }, bundles: { b1: {} } };
    expect(isItemHidden(cfg, { id: "x", main_category_id: "sofa" }, NOW)).toBe(true);
    expect(isItemHidden(cfg, { id: "x", main_category_id: "bed", sub_category_id: "lshape" }, NOW)).toBe(true);
    expect(isItemHidden(cfg, { id: "p1", main_category_id: "bed" }, NOW)).toBe(true);
    expect(isItemHidden(cfg, { id: "p1", main_category_id: "bed", isBundle: true }, NOW)).toBe(false);
    expect(isItemHidden(cfg, { id: "b1", isBundle: true }, NOW)).toBe(true);
    expect(isItemHidden(cfg, { id: "p2", main_category_id: "bed" }, NOW)).toBe(false);
    expect(isSubHidden(cfg, { id: "king", main_category_id: "sofa" }, NOW)).toBe(true);
  });
  it("respects time windows and the legacy master switch", () => {
    expect(entryActive({ until: past }, NOW)).toBe(false);
    expect(entryActive({ until: future }, NOW)).toBe(true);
    expect(entryActive({ from: future }, NOW)).toBe(false);
    const cfg = { ...emptyVisibilityConfig(), all: { from: null, until: future } };
    expect(isAllHidden(cfg, true, NOW)).toBe(true);
    expect(isAllHidden(emptyVisibilityConfig(), false, NOW)).toBe(true);
    expect(isAllHidden(emptyVisibilityConfig(), null, NOW)).toBe(false);
  });
  it("prunes expired rules", () => {
    const cfg = { ...emptyVisibilityConfig(), all: { until: past }, products: { a: { until: past }, b: { until: future }, c: {} } };
    const p = pruneExpired(cfg, NOW);
    expect(p.all).toBeNull();
    expect(Object.keys(p.products)).toEqual(["b", "c"]);
  });
});
