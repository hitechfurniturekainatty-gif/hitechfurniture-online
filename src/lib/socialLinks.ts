/**
 * Social / review links shown on the home page and the /connect page (the
 * page the shop QR code opens).
 *
 * Instagram, Facebook, WhatsApp and the Maps pin come from homepage_settings
 * (Admin → Home Page → Social / Contact). Extra links that have no column
 * there (Google review, YouTube) and the "show on home page" switch are kept
 * as JSON in a hidden system row of homepage_sections (no schema change).
 */
export const SOCIAL_SECTION_KEY = "__social_links";
export const CONNECT_PAGE_URL = "https://hitechfurniture.online/connect";
export const DEFAULT_GOOGLE_REVIEW_URL = "https://search.google.com/local/writereview?placeid=ChIJh4fFy6kMpjsR9mGrdWARwXo";
export const DEFAULT_MAPS_URL = "https://maps.app.goo.gl/DQWJCG1xRGEcRzx56";

export type SocialExtras = {
  google_review_url: string;
  youtube_url: string;
  show_on_home: boolean;
};

export const defaultSocialExtras = (): SocialExtras => ({
  google_review_url: DEFAULT_GOOGLE_REVIEW_URL,
  youtube_url: "",
  show_on_home: true,
});

export function parseSocialExtras(body: string | null | undefined): SocialExtras {
  const d = defaultSocialExtras();
  if (!body) return d;
  try {
    const raw = JSON.parse(body) as Partial<SocialExtras>;
    return {
      google_review_url: typeof raw.google_review_url === "string" ? raw.google_review_url : d.google_review_url,
      youtube_url: typeof raw.youtube_url === "string" ? raw.youtube_url : "",
      show_on_home: typeof raw.show_on_home === "boolean" ? raw.show_on_home : true,
    };
  } catch {
    return d;
  }
}

export type SocialKey = "instagram" | "facebook" | "google" | "whatsapp" | "youtube" | "maps";

export type SocialLink = { key: SocialKey; label: string; action: string; url: string };

/** Accepts "instagram.com/x" or "https://…"; returns "" for anything that isn't a web link. */
export function normalizeUrl(u: string | null | undefined): string {
  const s = (u ?? "").trim();
  if (!s) return "";
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function buildSocialLinks(
  s: { instagram_url?: string | null; facebook_url?: string | null; whatsapp_number?: string | null; google_maps_url?: string | null } | null,
  extras: SocialExtras,
  whatsappMessage = "Hi Hitech Furniture, I'd like to know more.",
): SocialLink[] {
  const wa = (s?.whatsapp_number ?? "").replace(/\D/g, "");
  const links: SocialLink[] = [
    { key: "instagram", label: "Instagram", action: "Follow us on Instagram", url: normalizeUrl(s?.instagram_url) },
    { key: "facebook", label: "Facebook", action: "Like our Facebook page", url: normalizeUrl(s?.facebook_url) },
    { key: "google", label: "Google Review", action: "Rate us on Google", url: normalizeUrl(extras.google_review_url) },
    { key: "whatsapp", label: "WhatsApp", action: "Chat on WhatsApp", url: wa ? `https://wa.me/${wa}?text=${encodeURIComponent(whatsappMessage)}` : "" },
    { key: "youtube", label: "YouTube", action: "Watch on YouTube", url: normalizeUrl(extras.youtube_url) },
    { key: "maps", label: "Location", action: "Get directions", url: normalizeUrl(s?.google_maps_url) || DEFAULT_MAPS_URL },
  ];
  return links.filter(l => !!l.url);
}
