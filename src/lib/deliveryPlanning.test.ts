import { describe, expect, it } from "vitest";
import { indiaDateKey, isDeliveryComplete, isDeliveryPlannable, isOrderConfirmed, type PlannedQuotation } from "./deliveryPlanning";

const draft: PlannedQuotation = {
  status: "drafted", commercial_status: "quote_preparation", document_type: "quotation",
  pipeline_stage: 2, expected_delivery_date: "2026-09-28",
};

describe("delivery planning", () => {
  it("shows a dated draft without treating it as a confirmed order", () => {
    expect(isDeliveryPlannable(draft)).toBe(true);
    expect(isOrderConfirmed(draft)).toBe(false);
  });
  it("excludes cancelled orders, purchase orders and unconverted website leads", () => {
    expect(isDeliveryPlannable({ ...draft, status: "rejected" })).toBe(false);
    expect(isDeliveryPlannable({ ...draft, document_type: "po" })).toBe(false);
    expect(isDeliveryPlannable({ ...draft, pipeline_stage: 1, salesperson_name: "Website Enquiry" })).toBe(false);
  });
  it("keeps undated confirmed orders visible for scheduling", () => {
    expect(isDeliveryPlannable({ ...draft, expected_delivery_date: null, commercial_status: "confirmed" })).toBe(true);
    expect(isDeliveryPlannable({ ...draft, expected_delivery_date: null })).toBe(false);
  });
  it("does not hide a partially delivered order even with a stale delivered status", () => {
    expect(isDeliveryComplete("delivered", [{ delivered_at: "2026-09-28" }, { delivered_at: null }])).toBe(false);
    expect(isDeliveryComplete("finalized", [{ delivered_at: "2026-09-28" }])).toBe(true);
    expect(isDeliveryComplete("delivered", [])).toBe(true);
    expect(isDeliveryComplete("drafted", [])).toBe(false);
  });
  it("changes the business day at Indian midnight irrespective of browser timezone", () => {
    expect(indiaDateKey(new Date("2026-09-28T18:29:59Z"))).toBe("2026-09-28");
    expect(indiaDateKey(new Date("2026-09-28T18:30:00Z"))).toBe("2026-09-29");
  });
});
