import { expect, it } from "vitest";
import { handoffItemEligible } from "./deliveryHandoffSelection";
const ready = { warehouse_ready: true, order_confirmed: true };
it("requires confirmation and readiness even when planning shows an order", () => {
  expect(handoffItemEligible({ status: "drafted" }, { quantity: 1 }, ready)).toBe(false);
  expect(handoffItemEligible({ status: "finalized" }, { quantity: 1 }, ready)).toBe(true);
  expect(handoffItemEligible({ status: "finalized" }, { quantity: 1 }, { ...ready, warehouse_ready: false })).toBe(false);
});
it("excludes delivered and partially ordered or cancelled rows", () => {
  const quote = { status: "finalized" };
  for (const item of [{quantity: 2, ordered_qty: 1}, {quantity: 2, cancelled_qty: 1}, {quantity: 2, delivered_at: "2026-09-28"}]) {
    expect(handoffItemEligible(quote, item, ready)).toBe(false);
  }
});
