/**
 * Home page layout: which sections show, in what order, and admin overrides
 * for their text and pictures. Stored as JSON in a hidden system row of
 * homepage_sections (no schema change). Every field falls back to the
 * built-in default, so an empty layout renders the page exactly as before.
 */
export const HOME_LAYOUT_KEY = "__home_layout";

export type BlockId =
  | "trust" | "connect" | "rooms" | "interior_intro" | "story" | "delivery" | "categories"
  | "featured" | "custom" | "interiors" | "why" | "extra" | "contact" | "google_review";

export type FieldDef = { key: string; label: string; def: string; multiline?: boolean };
export type ImageDef = { key: string; label: string };
export type BlockDef = { id: BlockId; name: string; hint?: string; fields: FieldDef[]; images?: ImageDef[] };

const f = (key: string, label: string, def: string, multiline = false): FieldDef => ({ key, label, def, multiline });
const four = (prefix: string, items: [string, string][], t1 = "Title", t2 = "Text"): FieldDef[] =>
  items.flatMap(([a, b], i) => [f(`${prefix}${i + 1}_title`, `${t1} ${i + 1}`, a), f(`${prefix}${i + 1}_text`, `${t2} ${i + 1}`, b, true)]);

/** Hero text (the big photo section at the top — always first). */
export const HERO_FIELDS: FieldDef[] = [
  f("badge", "Small label", "Hitech Furniture & Interiors"),
  f("title", "Main heading", "Furniture crafted for the way you live."),
  f("chip1", "Tag 1", "Custom Furniture"),
  f("chip2", "Tag 2", "Premium Collections"),
  f("chip3", "Tag 3", "Complete Interiors"),
  f("body", "Description", "Custom furniture, premium collections and complete interior solutions for homes and businesses across Wayanad.", true),
  f("btn1", "White button", "Explore Collection"),
  f("btn2", "Second button", "Get Free Consultation"),
];

export const BLOCKS: BlockDef[] = [
  { id: "trust", name: "Highlights strip (14+ Years…)", fields: [
    f("i1_title", "Item 1", "14+ Years"), f("i1_text", "Item 1 sub", "Trusted craftsmanship"),
    f("i2_title", "Item 2", "Custom Made"), f("i2_text", "Item 2 sub", "Built for your space"),
    f("i3_title", "Item 3", "Wayanad"), f("i3_text", "Item 3 sub", "Local showroom & service"),
    f("i4_title", "Item 4", "Complete Interiors"), f("i4_text", "Item 4 sub", "Design to installation"),
  ] },
  { id: "connect", name: "Follow us & rate us (QR)", hint: "Links are edited in the Social tab.", fields: [
    f("eyebrow", "Small label", "Stay connected"),
    f("title", "Heading", "Let's stay in touch"),
    f("body", "Text", "New designs, showroom moments and happy homes — all our pages in one little code. Scan it, or tap to see the list.", true),
  ] },
  { id: "rooms", name: "Shop by room", fields: [
    f("eyebrow", "Small label", "Explore your space"),
    f("title", "Heading", "Shop by room"),
    f("body", "Text", "Discover furniture and interior inspiration room by room, then browse our live collection for available designs.", true),
    f("link", "Link text", "View full catalog"),
    f("r1", "Room 1", "Living Room"), f("r2", "Room 2", "Dining Room"), f("r3", "Room 3", "Kitchen"),
    f("r4", "Room 4", "Master Bedroom"), f("r5", "Room 5", "Balcony"),
  ], images: [
    { key: "r1", label: "Room 1 photo" }, { key: "r2", label: "Room 2 photo" }, { key: "r3", label: "Room 3 photo" },
    { key: "r4", label: "Room 4 photo" }, { key: "r5", label: "Room 5 photo" },
  ] },
  { id: "interior_intro", name: "Interior solutions (photo collage)", fields: [
    f("eyebrow", "Small label", "Interior solutions"),
    f("title", "Heading", "From an empty room to a complete living space."),
    f("body", "Text", "We handle custom furniture and complete interiors for living rooms, bedrooms, kitchens and more — from planning and material selection to production and installation.", true),
    f("btn1", "Button", "Start an Interior Enquiry"),
    f("btn2", "Second button", "About Hitech"),
  ], images: [{ key: "a", label: "Big photo" }, { key: "b", label: "Top-right photo" }, { key: "c", label: "Bottom-right photo" }] },
  { id: "story", name: "Our story (14+ years)", fields: [
    f("badge", "Brown panel label", "14+ Years of Craftsmanship"),
    f("number", "Big number", "14+"),
    f("number_text", "Under the number", "Years serving homes and businesses across Wayanad."),
    f("place", "Bottom line", "Kalpetta · Wayanad"),
    f("eyebrow", "Small label", "Our story"),
    f("title", "Heading", "Designed for your home. Crafted for your life."),
    f("body", "Text", "From custom sofas and solid-wood dining sets to wardrobes and complete interior solutions, Hitech brings together craftsmanship, comfort and thoughtful design. We create furniture around your space, your needs and the way you live — with local support from our Wayanad team.", true),
    f("link1", "Link 1", "Discover Hitech"),
    f("link2", "Link 2", "Browse furniture"),
  ] },
  { id: "delivery", name: "Delivery note", fields: [
    f("text", "Text (leave empty for the default with bold places)", "", true),
  ] },
  { id: "categories", name: "Explore by category", fields: [
    f("eyebrow", "Small label", "Furniture collection"),
    f("title", "Heading", "Explore by category"),
    f("body", "Text", "Browse our live collection and find pieces for every room, style and requirement.", true),
    f("link", "Link text", "View all"),
  ] },
  { id: "featured", name: "Featured products", fields: [
    f("eyebrow", "Small label", "Featured collection"),
    f("title", "Heading", "Selected pieces for your home"),
    f("body", "Text", "A curated selection from our current furniture catalog, chosen to help you start exploring.", true),
    f("link", "Link text", "Shop all furniture"),
  ] },
  { id: "custom", name: "Custom furniture (made for your space)", fields: [
    f("eyebrow", "Small label", "Custom furniture"),
    f("title", "Heading", "Made for your space, not just any space."),
    f("body", "Text", "Choose the size, layout, finish, material and comfort that suit your home. From sofas and dining sets to beds, wardrobes and storage, our team helps shape furniture around the way you live.", true),
    f("btn1", "Button", "Start a custom order"),
    f("btn2", "Second button", "Explore furniture"),
    ...four("f", [
      ["Designed to fit", "Furniture planned around your room dimensions and practical needs."],
      ["Your finish", "Select materials, colours and finishes that match your interior style."],
      ["Comfort first", "Choose proportions and configurations that work for everyday living."],
      ["Local support", "Discuss, customise and follow up with our Wayanad-based team."],
    ], "Point", "Point text"),
  ] },
  { id: "interiors", name: "Complete interiors (brown, 4 steps)", fields: [
    f("eyebrow", "Small label", "Complete interiors"),
    f("title", "Heading", "From an empty room to a finished home."),
    f("body", "Text", "Hitech brings furniture and interiors together under one roof — helping you plan spaces, customise storage and furniture, coordinate finishes and complete installation with a more seamless experience.", true),
    f("btn", "Button", "Discuss your interior project"),
    ...four("s", [
      ["Plan", "Understand the room, requirement, style and practical priorities."],
      ["Design", "Develop furniture, storage and finish choices around the space."],
      ["Build", "Coordinate custom furniture and interior elements with attention to detail."],
      ["Install", "Bring the pieces together on site for a finished, usable space."],
    ], "Step", "Step text"),
  ] },
  { id: "why", name: "Why Hitech", fields: [
    f("eyebrow", "Small label", "Why Hitech"),
    f("title", "Heading", "Premium choices, with a local team you can reach."),
    f("body", "Text", "More than a catalog — we combine product choice, customisation, interior guidance and local after-sales support for homes and businesses across Wayanad.", true),
    ...four("c", [
      ["14+ Years", "Experience serving furniture and interior customers across Wayanad."],
      ["Custom Made", "Furniture can be tailored around space, finish and usage requirements."],
      ["Furniture + Interiors", "A simpler journey from individual products to complete room solutions."],
      ["Local Support", "A Kalpetta-area team for showroom visits, enquiries and follow-up."],
    ], "Card", "Card text"),
  ] },
  { id: "extra", name: "Your extra sections", hint: "Added and edited in the Sections tab.", fields: [] },
  { id: "contact", name: "Visit our showroom + enquiry", fields: [
    f("eyebrow", "Small label", "Visit our showroom"),
    f("title", "Heading", "See the furniture. Feel the finish. Plan your space."),
    f("body", "Text", "Visit Hitech Furniture & Interiors in the Kalpetta area to explore furniture, discuss custom requirements and plan complete interior solutions with our team.", true),
    f("place", "Place", "Kalpetta · Wayanad"),
    f("place_sub", "Place sub", "Furniture showroom & interior consultation"),
    f("phone_sub", "Phone sub", "Call our showroom team"),
    f("badge", "Right label", "Furniture & Interiors"),
    f("title2", "Right heading", "Have a room, project or furniture idea in mind?"),
    f("body2", "Right text", "Tell us what you need. Share your room details, preferred style or product requirement and our team can guide you with suitable options.", true),
    f("btn1", "Button", "Start an enquiry"),
    f("btn2", "Second button", "Browse furniture"),
    f("m1_title", "Box 1", "14+ Years"), f("m1_text", "Box 1 sub", "Local experience"),
    f("m2_title", "Box 2", "Custom Made"), f("m2_text", "Box 2 sub", "Built for your space"),
    f("m3_title", "Box 3", "Interiors"), f("m3_text", "Box 3 sub", "Design to install"),
    f("m4_title", "Box 4", "Wayanad"), f("m4_text", "Box 4 sub", "Local support"),
  ] },
  { id: "google_review", name: "Rate us on Google", hint: "Also needs 'Show Google review' on in Contact settings.", fields: [
    f("eyebrow", "Small label", "Loved your experience?"),
    f("title", "Heading", "Rate us on Google"),
    f("body", "Text", "One tap opens the star-rating page — or copy the link to share with friends & family.", true),
    f("btn", "Button", "Rate us on Google"),
  ] },
];

export const DEFAULT_ORDER: BlockId[] = [
  "trust", "connect", "rooms", "interior_intro", "story", "delivery", "categories",
  "featured", "custom", "interiors", "why", "extra", "contact", "google_review",
];

export type HomeLayout = {
  v: 1;
  order: BlockId[];
  hidden: BlockId[];
  /** "blockId.field" → text */
  text: Record<string, string>;
  /** "blockId.imageKey" → url */
  images: Record<string, string>;
  /** "blockId" (or "hero") → per-section colours, border, alignment */
  styles: Record<string, BlockStyle>;
};

export type BlockStyle = {
  bg?: string; text?: string; brand?: string; brandText?: string; highlight?: string;
  card?: string; borderColor?: string; borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "dotted" | "double";
  radius?: number; align?: "left" | "center" | "right"; padY?: number; boxed?: boolean;
};

export const emptyHomeLayout = (): HomeLayout => ({ v: 1, order: [...DEFAULT_ORDER], hidden: [], text: {}, images: {}, styles: {} });

const IDS = new Set<BlockId>(DEFAULT_ORDER);

export function parseHomeLayout(body: string | null | undefined): HomeLayout {
  const d = emptyHomeLayout();
  if (!body) return d;
  try {
    const raw = JSON.parse(body) as Partial<HomeLayout>;
    const order = Array.isArray(raw.order) ? raw.order.filter((x): x is BlockId => IDS.has(x as BlockId)) : [];
    const seen = new Set(order);
    // New sections added in future releases are appended so they never disappear.
    for (const id of DEFAULT_ORDER) if (!seen.has(id)) order.push(id);
    const strMap = (m: unknown) => (m && typeof m === "object" ? Object.fromEntries(Object.entries(m as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<string, string> : {});
    return {
      v: 1,
      order,
      hidden: Array.isArray(raw.hidden) ? raw.hidden.filter((x): x is BlockId => IDS.has(x as BlockId)) : [],
      text: strMap(raw.text),
      images: strMap(raw.images),
      styles: raw.styles && typeof raw.styles === "object" ? (Object.fromEntries(Object.entries(raw.styles).filter(([, v]) => v && typeof v === "object")) as Record<string, BlockStyle>) : {},
    };
  } catch {
    return d;
  }
}

/** Text getter for one block: admin override (non-empty) or the default. */
export function textFor(layout: HomeLayout, block: string, fields: FieldDef[]) {
  return (key: string): string => {
    const v = layout.text[`${block}.${key}`];
    if (typeof v === "string" && v.trim()) return v;
    return fields.find(x => x.key === key)?.def ?? "";
  };
}

export const blockDef = (id: BlockId) => BLOCKS.find(b => b.id === id)!;
export const blockText = (layout: HomeLayout, id: BlockId) => textFor(layout, id, blockDef(id).fields);
export const heroText = (layout: HomeLayout) => textFor(layout, "hero", HERO_FIELDS);
export const blockImage = (layout: HomeLayout, id: BlockId, key: string, fallback: string) => {
  const v = layout.images[`${id}.${key}`];
  return v && v.trim() ? v : fallback;
};
