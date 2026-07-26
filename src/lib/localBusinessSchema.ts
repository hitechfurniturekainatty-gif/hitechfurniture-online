// Single source of truth for the site's LocalBusiness/FurnitureStore structured
// data. Used by Index.tsx, About.tsx and Catalog.tsx so the schema emitted to
// real browsers/Googlebot always matches what scripts/generate-crawler-snapshots.mjs
// emits to AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc).
// Full legal/SEO business name — distinct from BRAND_NAME in lib/brand.ts
// ("My Hitech"), which is the short in-app display name. Schema.org and
// crawler-facing content use the full name for consistency with GBP/Justdial listings.
export const SEO_BRAND_NAME = "Hitech Furniture & Interiors";

export const LOCAL_BUSINESS_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FurnitureStore",
  name: SEO_BRAND_NAME,
  description:
    "Custom furniture manufacturer, retailer, wholesaler and interior designer in Kalpetta, Wayanad, Kerala. 14+ years in operation.",
  telephone: "+91 98951 34482",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Edappetty",
    addressLocality: "Kalpetta",
    addressRegion: "Wayanad, Kerala",
    addressCountry: "IN",
  },
  url: typeof window !== "undefined" ? window.location.origin : "https://hitechfurniture.online",
  sameAs: ["https://www.instagram.com/hitech_furniture_wayanad"],
  areaServed: [
    { "@type": "City", name: "Kalpetta" },
    { "@type": "City", name: "Sulthan Bathery" },
    { "@type": "City", name: "Mananthavady" },
    { "@type": "City", name: "Vythiri" },
    { "@type": "City", name: "Meppadi" },
    { "@type": "City", name: "Pulpally" },
    { "@type": "AdministrativeArea", name: "Wayanad" },
  ],
} as const;
