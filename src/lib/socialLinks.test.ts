import { describe, expect, it } from "vitest";
import { buildSocialLinks, normalizeUrl, parseSocialExtras, DEFAULT_GOOGLE_REVIEW_URL, DEFAULT_MAPS_URL } from "./socialLinks";

describe("social links", () => {
  it("normalises links and rejects non-web schemes", () => {
    expect(normalizeUrl("instagram.com/hitech")).toBe("https://instagram.com/hitech");
    expect(normalizeUrl("javascript:alert(1)")).toBe("");
    expect(normalizeUrl("  ")).toBe("");
  });
  it("defaults the Google review link and keeps the home switch on", () => {
    const x = parseSocialExtras(null);
    expect(x.google_review_url).toBe(DEFAULT_GOOGLE_REVIEW_URL);
    expect(x.show_on_home).toBe(true);
    expect(parseSocialExtras("{bad").youtube_url).toBe("");
  });
  it("builds only configured links in a fixed order", () => {
    const links = buildSocialLinks({ instagram_url: "https://www.instagram.com/x", facebook_url: "", whatsapp_number: "91 98951 34482", google_maps_url: null }, parseSocialExtras(null), "Hi");
    expect(links.map(l => l.key)).toEqual(["instagram", "google", "whatsapp", "maps"]);
    expect(links.find(l => l.key === "whatsapp")?.url).toBe("https://wa.me/919895134482?text=Hi");
    expect(links.find(l => l.key === "maps")?.url).toBe(DEFAULT_MAPS_URL);
  });
});
