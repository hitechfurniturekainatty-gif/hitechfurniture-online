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
    "Custom furniture manufacturer, retailer, wholesaler and interior designer in Kalpetta, Wayanad, Kerala. Sofas, beds, wardrobes, dining and branded mattresses (Kurlon, Repose, Peps) for every budget. 14+ years in operation.",
  telephone: "+91 98951 34482",
  address: {
    "@type": "PostalAddress",
    // Canonical NAP address — keep identical to Google Business Profile,
    // Justdial, Instagram, Facebook and the footer (homepage_settings.address_lines).
    streetAddress: "Edapetty Shopping Centre, Edapetty",
    addressLocality: "Kalpetta",
    addressRegion: "Wayanad, Kerala",
    postalCode: "673122",
    addressCountry: "IN",
  },
  url: typeof window !== "undefined" ? window.location.origin : "https://hitechfurniture.online",
  geo: { "@type": "GeoCoordinates", latitude: 11.637805, longitude: 76.094218 },
  hasMap: "https://maps.app.goo.gl/DQWJCG1xRGEcRzx56",
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "09:30",
      closes: "20:30",
    },
  ],
  sameAs: [
    "https://www.instagram.com/hitech_furniture_wayanad",
    "https://www.facebook.com/634075729791776",
  ],
  // Showroom is in Kalpetta, but sales and delivery go well beyond Wayanad:
  // across Kerala (incl. the Malabar region), Bengaluru and Tamil Nadu.
  areaServed: [
    { "@type": "City", name: "Kalpetta" },
    { "@type": "City", name: "Sulthan Bathery" },
    { "@type": "City", name: "Mananthavady" },
    { "@type": "AdministrativeArea", name: "Wayanad" },
    { "@type": "AdministrativeArea", name: "Malabar, Kerala" },
    { "@type": "State", name: "Kerala" },
    { "@type": "City", name: "Bengaluru" },
    { "@type": "State", name: "Karnataka" },
    { "@type": "State", name: "Tamil Nadu" },
  ],
} as const;
