/**
 * Social / review links shown on the home page "Connect" section and the
 * /connect page (the page the QR code opens).
 *
 * Admin → Home Page → Social keeps an ordered list: add, remove, hide,
 * reorder, and upload an icon for new platforms (e.g. Threads). Stored as
 * JSON in a hidden system row of homepage_sections (no schema change).
 * Until the list is first saved it is built from the existing settings
 * (Instagram, Facebook, WhatsApp number, Maps pin) + the Google review link.
 */
export const SOCIAL_SECTION_KEY = "__social_links";
export const CONNECT_PAGE_URL = "https://hitechfurniture.online/connect";
export const DEFAULT_GOOGLE_REVIEW_URL = "https://search.google.com/local/writereview?placeid=ChIJh4fFy6kMpjsR9mGrdWARwXo";
export const DEFAULT_MAPS_URL = "https://maps.app.goo.gl/DQWJCG1xRGEcRzx56";

export type SocialType =
  | "instagram" | "facebook" | "whatsapp" | "google" | "youtube" | "threads"
  | "x" | "linkedin" | "telegram" | "maps" | "website" | "custom";

export const SOCIAL_TYPES: { type: SocialType; label: string; action: string; placeholder: string }[] = [
  { type: "instagram", label: "Instagram", action: "Follow us on Instagram", placeholder: "https://instagram.com/…" },
  { type: "facebook", label: "Facebook", action: "Like our Facebook page", placeholder: "https://facebook.com/…" },
  { type: "whatsapp", label: "WhatsApp", action: "Chat on WhatsApp", placeholder: "919895134482 or https://wa.me/…" },
  { type: "google", label: "Google Review", action: "Rate us on Google", placeholder: "https://g.page/r/…/review" },
  { type: "youtube", label: "YouTube", action: "Watch on YouTube", placeholder: "https://youtube.com/@…" },
  { type: "threads", label: "Threads", action: "Follow us on Threads", placeholder: "https://threads.net/@…" },
  { type: "x", label: "X (Twitter)", action: "Follow us on X", placeholder: "https://x.com/…" },
  { type: "linkedin", label: "LinkedIn", action: "Connect on LinkedIn", placeholder: "https://linkedin.com/company/…" },
  { type: "telegram", label: "Telegram", action: "Join us on Telegram", placeholder: "https://t.me/…" },
  { type: "maps", label: "Location", action: "Get directions", placeholder: "https://maps.app.goo.gl/…" },
  { type: "website", label: "Website", action: "Visit website", placeholder: "https://…" },
  { type: "custom", label: "Other", action: "Open", placeholder: "https://…" },
];
export const typeInfo = (t: SocialType) => SOCIAL_TYPES.find(x => x.type === t) ?? SOCIAL_TYPES[SOCIAL_TYPES.length - 1];

export type SocialItem = {
  id: string;
  type: SocialType;
  /** Shown under the icon / on the button. */
  label: string;
  url: string;
  /** Uploaded icon picture (used for "custom" or to override a built-in icon). */
  icon_url?: string | null;
  visible: boolean;
};

export type SocialConfig = { v: 2; items: SocialItem[]; show_on_home: boolean };

/** A link ready to render. */
export type SocialLink = { id: string; key: SocialType; label: string; action: string; url: string; icon_url?: string | null };

const newId = () => Math.random().toString(36).slice(2, 10);

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

/** WhatsApp entries may hold just a phone number. */
export function resolveItemUrl(it: Pick<SocialItem, "type" | "url">, whatsappMessage?: string): string {
  const raw = (it.url ?? "").trim();
  if (it.type === "whatsapp") {
    const digits = raw.replace(/\D/g, "");
    if (raw && !/[a-z]/i.test(raw) && digits.length >= 10) {
      return `https://wa.me/${digits}${whatsappMessage ? `?text=${encodeURIComponent(whatsappMessage)}` : ""}`;
    }
  }
  return normalizeUrl(raw);
}

type SettingsLike = {
  instagram_url?: string | null; facebook_url?: string | null; whatsapp_number?: string | null;
  google_maps_url?: string | null; whatsapp_default_message?: string | null;
} | null;

/** The list used before an admin has ever saved one — built from the existing settings. */
export function defaultSocialItems(s: SettingsLike): SocialItem[] {
  const wa = (s?.whatsapp_number ?? "").replace(/\D/g, "");
  return [
    { id: "instagram", type: "instagram", label: "Instagram", url: s?.instagram_url ?? "", visible: !!s?.instagram_url },
    { id: "facebook", type: "facebook", label: "Facebook", url: s?.facebook_url ?? "", visible: !!s?.facebook_url },
    { id: "whatsapp", type: "whatsapp", label: "WhatsApp", url: wa, visible: !!wa },
    { id: "google", type: "google", label: "Google Review", url: DEFAULT_GOOGLE_REVIEW_URL, visible: true },
    { id: "maps", type: "maps", label: "Location", url: s?.google_maps_url || DEFAULT_MAPS_URL, visible: true },
  ];
}

const TYPES = new Set(SOCIAL_TYPES.map(t => t.type));

/** Parse the saved JSON (v2 list, or the earlier v1 extras) — never throws. */
export function parseSocialConfig(body: string | null | undefined, s: SettingsLike): SocialConfig {
  const fallback: SocialConfig = { v: 2, items: defaultSocialItems(s), show_on_home: true };
  if (!body) return fallback;
  try {
    const raw = JSON.parse(body) as Record<string, unknown>;
    const show = typeof raw.show_on_home === "boolean" ? raw.show_on_home : true;
    if (Array.isArray(raw.items)) {
      const items = (raw.items as Record<string, unknown>[])
        .filter(x => x && typeof x === "object" && TYPES.has(x.type as SocialType))
        .map(x => ({
          id: typeof x.id === "string" && x.id ? x.id : newId(),
          type: x.type as SocialType,
          label: typeof x.label === "string" && x.label.trim() ? x.label : typeInfo(x.type as SocialType).label,
          url: typeof x.url === "string" ? x.url : "",
          icon_url: typeof x.icon_url === "string" ? x.icon_url : null,
          visible: x.visible !== false,
        }));
      return { v: 2, items, show_on_home: show };
    }
    // v1: { google_review_url, youtube_url, show_on_home }
    const items = defaultSocialItems(s);
    if (typeof raw.google_review_url === "string") {
      const g = items.find(i => i.type === "google")!;
      g.url = raw.google_review_url; g.visible = !!raw.google_review_url;
    }
    if (typeof raw.youtube_url === "string" && raw.youtube_url) {
      items.splice(4, 0, { id: "youtube", type: "youtube", label: "YouTube", url: raw.youtube_url, visible: true });
    }
    return { v: 2, items, show_on_home: show };
  } catch {
    return fallback;
  }
}

export function newSocialItem(type: SocialType): SocialItem {
  return { id: newId(), type, label: typeInfo(type).label === "Other" ? "" : typeInfo(type).label, url: "", icon_url: null, visible: true };
}

/** Visible items with a usable link, in admin order. */
export function buildSocialLinks(cfg: SocialConfig, whatsappMessage?: string): SocialLink[] {
  return cfg.items
    .filter(it => it.visible)
    .map(it => ({
      id: it.id,
      key: it.type,
      label: it.label || typeInfo(it.type).label,
      action: it.type === "custom" ? (it.label || "Open link") : typeInfo(it.type).action,
      url: resolveItemUrl(it, whatsappMessage),
      icon_url: it.icon_url ?? null,
    }))
    .filter(l => !!l.url);
}
