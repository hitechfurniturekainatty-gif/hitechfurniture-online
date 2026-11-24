import { describe, expect, it } from "vitest";
import { addDays, daysBetween, estimate, estimateRange, lateness, measureFor, suggestedOrder } from "./supplierOrders";

describe("supplier order lateness", () => {
  it("counts days late, due soon and on time", () => {
    expect(lateness("ordered", "2026-11-20", "2026-11-24")).toEqual({ kind: "late", days: 4, label: "4 days late" });
    expect(lateness("ordered", "2026-11-23", "2026-11-24").label).toBe("1 day late");
    expect(lateness("ordered", "2026-11-24", "2026-11-24").label).toBe("Due today");
    expect(lateness("ordered", "2026-11-26", "2026-11-24")).toMatchObject({ kind: "due_soon", days: 2 });
    expect(lateness("ordered", "2026-12-10", "2026-11-24").kind).toBe("on_time");
    expect(lateness("received", "2026-11-01", "2026-11-24").label).toBe("Received");
  });
  it("does date maths on plain day keys", () => {
    expect(daysBetween("2026-11-24", "2026-12-01")).toBe(7);
    expect(addDays("2026-11-28", 5)).toBe("2026-12-03");
  });
});

describe("rate card estimate", () => {
  it("multiplies the right measure for each unit", () => {
    expect(measureFor("sqft", 6, 7, 0, 1)).toBe(42);
    expect(measureFor("sqft", 6, 7, 0, 2)).toBe(84);
    expect(measureFor("rft", 0, 0, 10, 1)).toBe(10);
    expect(measureFor("piece", 6, 7, 10, 3)).toBe(3);
    expect(measureFor("sqft", -1, 7, 0, 1)).toBe(0);
  });
  it("gives a rounded estimate and a low-high range", () => {
    expect(estimate(1250, 42)).toBe(52500);
    expect(estimateRange([1250, 1100, 0], 42)).toEqual({ low: 46200, high: 52500 });
    expect(estimateRange([], 42)).toBeNull();
    expect(estimateRange([1200], 0)).toBeNull();
  });
});

describe("suggested reorder quantity", () => {
  it("uses the reorder level or a month of sales, minus stock and what is on order", () => {
    expect(suggestedOrder(1, 5, 0, 0)).toBe(4);
    expect(suggestedOrder(0, 2, 30, 0)).toBe(10);
    expect(suggestedOrder(0, 2, 30, 6)).toBe(4);
    expect(suggestedOrder(12, 5, 30, 0)).toBe(0);
  });
});
