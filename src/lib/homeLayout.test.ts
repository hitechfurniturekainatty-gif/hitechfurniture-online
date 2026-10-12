import { describe, expect, it } from "vitest";
import { parseHomeLayout, blockText, heroText, blockImage, DEFAULT_ORDER, emptyHomeLayout } from "./homeLayout";

describe("home layout", () => {
  it("renders the original page when nothing is saved", () => {
    const l = parseHomeLayout(null);
    expect(l.order).toEqual(DEFAULT_ORDER);
    expect(l.hidden).toEqual([]);
    expect(heroText(l)("title")).toBe("Furniture crafted for the way you live.");
    expect(blockText(l, "why")("c1_title")).toBe("14+ Years");
  });
  it("keeps saved order, appends sections added later, drops unknown ids", () => {
    const l = parseHomeLayout(JSON.stringify({ order: ["contact", "nope", "trust"], hidden: ["why", "bad"], text: {}, images: {} }));
    expect(l.order.slice(0, 2)).toEqual(["contact", "trust"]);
    expect(l.order).toHaveLength(DEFAULT_ORDER.length);
    expect(l.hidden).toEqual(["why"]);
  });
  it("uses overrides, but empty text falls back to the original", () => {
    const l = { ...emptyHomeLayout(), text: { "custom.title": "Your size, your style", "custom.body": "  " }, images: { "rooms.r1": "https://x/a.jpg" } };
    expect(blockText(l, "custom")("title")).toBe("Your size, your style");
    expect(blockText(l, "custom")("body")).toMatch(/^Choose the size/);
    expect(blockImage(l, "rooms", "r1", "/default.png")).toBe("https://x/a.jpg");
    expect(blockImage(l, "rooms", "r2", "/default.png")).toBe("/default.png");
  });
  it("survives broken JSON", () => {
    expect(parseHomeLayout("{oops").order).toEqual(DEFAULT_ORDER);
  });
});
