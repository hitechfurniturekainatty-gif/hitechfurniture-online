import { describe, expect, it } from "vitest";
import { buildSocialLinks, normalizeUrl, parseSocialConfig, resolveItemUrl, DEFAULT_GOOGLE_REVIEW_URL, DEFAULT_MAPS_URL } from "./socialLinks";

const settings = { instagram_url: "https://www.instagram.com/hitech", facebook_url: "", whatsapp_number: "91 98951 34482", google_maps_url: null };

describe("social links", () => {
  it("normalises links and rejects non-web schemes", () => {
    expect(normalizeUrl("instagram.com/hitech")).toBe("https://instagram.com/hitech");
    expect(normalizeUrl("javascript:alert(1)")).toBe("");
    expect(normalizeUrl("  ")).toBe("");
  });

  it("builds the default list from existing settings before anything is saved", () => {
    const cfg = parseSocialConfig(null, settings);
    expect(cfg.show_on_home).toBe(true);
    const links = buildSocialLinks(cfg, "Hi");
    expect(links.map(l => l.key)).toEqual(["instagram", "whatsapp", "google", "maps"]); // Facebook empty -> hidden
    expect(links.find(l => l.key === "whatsapp")?.url).toBe("https://wa.me/919895134482?text=Hi");
    expect(links.find(l => l.key === "google")?.url).toBe(DEFAULT_GOOGLE_REVIEW_URL);
    expect(links.find(l => l.key === "maps")?.url).toBe(DEFAULT_MAPS_URL);
  });

  it("keeps admin order, hides switched-off items and supports custom platforms", () => {
    const body = JSON.stringify({ v: 2, show_on_home: false, items: [
      { id: "t", type: "custom", label: "Threads", url: "threads.net/@hitech", icon_url: "https://x/icon.png", visible: true },
      { id: "i", type: "instagram", label: "Instagram", url: "https://instagram.com/h", visible: false },
      { id: "bad", type: "nope", label: "x", url: "https://x", visible: true },
    ] });
    const cfg = parseSocialConfig(body, settings);
    expect(cfg.show_on_home).toBe(false);
    expect(cfg.items.map(i => i.id)).toEqual(["t", "i"]);
    const links = buildSocialLinks(cfg);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ label: "Threads", url: "https://threads.net/@hitech", icon_url: "https://x/icon.png" });
  });

  it("reads the earlier saved format", () => {
    const cfg = parseSocialConfig(JSON.stringify({ google_review_url: "https://g.page/r/abc/review", youtube_url: "https://youtube.com/@h", show_on_home: true }), settings);
    expect(cfg.items.find(i => i.type === "google")?.url).toBe("https://g.page/r/abc/review");
    expect(cfg.items.some(i => i.type === "youtube")).toBe(true);
  });

  it("accepts a WhatsApp number or link", () => {
    expect(resolveItemUrl({ type: "whatsapp", url: "+91 98951 34482" })).toBe("https://wa.me/919895134482");
    expect(resolveItemUrl({ type: "whatsapp", url: "https://wa.me/919895134482" })).toBe("https://wa.me/919895134482");
  });
});
