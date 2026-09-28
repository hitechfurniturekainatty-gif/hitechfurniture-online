import { describe, expect, it } from "vitest";
import { leadCreatorLabel, leadSourceLabel } from "./leadSource";

describe("lead provenance", () => {
  it("distinguishes customer submissions from staff-entered leads", () => {
    expect(leadSourceLabel("website")).toBe("Website · Customer enquiry");
    expect(leadCreatorLabel("website", null, {})).toBe("Customer · Website form");
    expect(leadCreatorLabel("manual", "staff-a", { "staff-a": "Sales A" })).toBe("Sales A");
  });
  it("does not invent missing historical attribution", () => {
    expect(leadCreatorLabel("manual", null, {})).toBe("Not recorded");
    expect(leadSourceLabel(null)).toBe("Source not recorded");
    expect(leadCreatorLabel("website", "unknown", {})).toBe("Staff name unavailable");
  });
});
