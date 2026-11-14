import { describe, expect, it } from "vitest";
import { classifyAttribution } from "./attribution";

describe("classifyAttribution", () => {
  it("treats a Meta click id as a Meta ad", () => {
    expect(classifyAttribution("?fbclid=abc&utm_campaign=sofa_nov")).toEqual({ ad_source: "meta_ad", ad_campaign: "sofa_nov" });
  });
  it("treats paid Instagram traffic as a Meta ad", () => {
    expect(classifyAttribution("?utm_source=instagram&utm_medium=paid_social").ad_source).toBe("meta_ad");
  });
  it("treats a Google click id as a Google ad", () => {
    expect(classifyAttribution("?gclid=xyz").ad_source).toBe("google_ad");
  });
  it("treats an Instagram bio link (not paid) as organic", () => {
    expect(classifyAttribution("?utm_source=instagram&utm_medium=bio")).toEqual({ ad_source: "organic", ad_campaign: null });
  });
  it("treats a plain visit as organic", () => {
    expect(classifyAttribution("")).toEqual({ ad_source: "organic", ad_campaign: null });
  });
});
