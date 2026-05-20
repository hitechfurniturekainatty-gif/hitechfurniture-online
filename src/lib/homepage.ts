import { supabase } from "@/integrations/supabase/client";

export type HomepageSettings = {
  id: string;
  brand_tagline: string;
  contact_phone: string | null;
  contact_phone_secondary: string | null;
  contact_email: string | null;
  address_lines: string[];
  google_maps_url: string | null;
  google_maps_embed_url: string | null;
  whatsapp_number: string;
  whatsapp_default_message: string;
  instagram_url: string | null;
  facebook_url: string | null;
  managing_partner: string | null;
  footer_about: string | null;
  // Optional overrides for the cinematic "Visual Journey" hero. When null, the
  // bundled default images are used.
  hero_arch_image_url: string | null;
  hero_glass_door_image_url: string | null;
  hero_interior_image_url: string | null;
  // Visibility toggles + editable hero overlay text
  show_hero_window: boolean;
  show_hero_text: boolean;
  show_google_review: boolean;
  hero_brand_text: string | null;
  hero_headline_line1: string | null;
  hero_headline_line2: string | null;
  hero_scroll_hint: string | null;
  hero_caption_eyebrow: string | null;
  hero_caption_title: string | null;
  /** Master switch: when true, prices and MRPs are hidden everywhere on the
   *  public catalog and product detail pages. Staff catalog (PIN-protected)
   *  always shows prices. */
  hide_public_prices: boolean;
  /** When false, the public catalog is hidden from visitors (link removed
   *  from the header and the /catalog route redirects home). Staff/admins
   *  always retain access. Defaults to true. */
  show_public_catalog: boolean;
};

export type HeroSlide = {
  id: string;
  image_url: string;
  headline: string | null;
  subheadline: string | null;
  cta_label: string | null;
  cta_link: string | null;
  display_order: number;
  is_visible: boolean;
};

export type HomepageSection = {
  id: string;
  section_key: string;
  eyebrow: string | null;
  title: string | null;
  body: string | null;
  cta_label: string | null;
  cta_link: string | null;
  image_url: string | null;
  // Newline-joined list of additional gallery images. When set, the section
  // renders an auto-rotating slideshow (3s per image) instead of the single
  // `image_url`.
  image_urls: string | null;
  style_preset: "default" | "elegant" | "bold" | "minimal";
  text_align: "left" | "center" | "right";
  display_order: number;
  is_visible: boolean;
};

export const STYLE_PRESETS: Array<{ value: HomepageSection["style_preset"]; label: string; description: string }> = [
  { value: "default", label: "Default", description: "Clean serif headline, comfortable body" },
  { value: "elegant", label: "Elegant", description: "Larger display heading, refined spacing" },
  { value: "bold", label: "Bold", description: "Heavy display heading, premium contrast" },
  { value: "minimal", label: "Minimal", description: "Sans-serif, tight, understated" },
];

export const SECTION_PRESETS: Array<{ key: string; label: string }> = [
  { key: "hero_intro", label: "Hero — intro copy" },
  { key: "live_catalog", label: "Live Catalog" },
  { key: "made_to_order", label: "Made to Order" },
  { key: "about_us", label: "About Us" },
  { key: "find_us", label: "Find Us" },
  { key: "visit_us", label: "Visit Us" },
];

export async function fetchHomepageData() {
  const [settingsRes, slidesRes, sectionsRes] = await Promise.all([
    supabase.from("homepage_settings").select("*").limit(1).maybeSingle(),
    supabase.from("homepage_hero_slides").select("*").order("display_order", { ascending: true }),
    supabase.from("homepage_sections").select("*").order("display_order", { ascending: true }),
  ]);

  return {
    settings: (settingsRes.data ?? null) as HomepageSettings | null,
    // A slide with no image_url is effectively empty — drop it so the
    // homepage falls back to the rich default hero instead of rendering a
    // blank coloured strip where the slider would be.
    slides: ((slidesRes.data ?? []) as HeroSlide[]).filter(
      (s) => s.is_visible && typeof s.image_url === "string" && s.image_url.trim().length > 0,
    ),
    sections: ((sectionsRes.data ?? []) as HomepageSection[]).filter((s) => s.is_visible),
  };
}

export function presetClasses(p: HomepageSection["style_preset"]): {
  eyebrow: string;
  title: string;
  body: string;
} {
  switch (p) {
    case "elegant":
      return {
        eyebrow: "text-xs font-semibold uppercase tracking-[0.3em] text-accent",
        title: "font-display text-4xl leading-[1.05] text-foreground md:text-6xl lg:text-7xl",
        body: "text-base text-muted-foreground md:text-lg",
      };
    case "bold":
      return {
        eyebrow: "text-xs font-bold uppercase tracking-[0.3em] text-accent",
        title: "font-display text-3xl font-semibold text-foreground md:text-5xl",
        body: "text-base text-foreground/80 md:text-lg",
      };
    case "minimal":
      return {
        eyebrow: "text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground",
        title: "font-sans text-2xl font-semibold text-foreground md:text-3xl",
        body: "text-sm text-muted-foreground md:text-base",
      };
    default:
      return {
        eyebrow: "text-xs font-semibold uppercase tracking-[0.25em] text-accent",
        title: "font-display text-3xl text-foreground md:text-4xl",
        body: "text-base text-muted-foreground",
      };
  }
}

export function alignClass(a: HomepageSection["text_align"]): string {
  return a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";
}