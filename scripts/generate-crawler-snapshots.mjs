// Generates static "crawler snapshot" HTML for every public route, from live
// Supabase data, at build time. Written to public/_snapshots/... so Vite's
// build copies them straight into dist/_snapshots/... alongside the real SPA.
//
// WHY THIS EXISTS: this site is a client-side React SPA. Real visitors get the
// full interactive app. But AI/answer-engine crawlers (GPTBot, ClaudeBot,
// PerplexityBot, Google-Extended, CCBot, etc.) do NOT execute JavaScript — they
// only ever see dist/index.html's empty <div id="root"></div>. These crawlers
// are what feed ChatGPT/Claude/Perplexity/Google AI Overview answers, so
// without this, none of the 300+ products can ever be cited by an AI answer.
//
// public/.htaccess rewrites requests from known bot user-agents to these
// static files instead of index.html. Everyone else (real browsers, Googlebot,
// which does render JS) still gets the normal SPA. This is the standard
// "dynamic rendering" pattern for JS-heavy sites on static hosting.
//
// Run automatically via `npm run build` (see package.json "prebuild").
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf-8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = (match[2] ?? "").trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

const SITE_URL = "https://hitechfurniture.online";
const BRAND = "Hitech Furniture & Interiors";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("[snapshots] Missing Supabase env vars — skipping snapshot generation.");
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const LOCAL_BUSINESS_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FurnitureStore",
  name: BRAND,
  description: "Custom furniture manufacturer, retailer, wholesaler and interior designer in Kalpetta, Wayanad, Kerala. 14+ years in operation.",
  telephone: "+91 98951 34482",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Edappetty",
    addressLocality: "Kalpetta",
    addressRegion: "Wayanad, Kerala",
    addressCountry: "IN",
  },
  url: SITE_URL,
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
};

// General FAQ — only facts we can actually stand behind (confirmed business
// policy). Does not invent per-product/per-SKU warranty or delivery specifics
// that aren't in the product data yet — kept in sync with src/pages/Faq.tsx.
const GENERAL_FAQ = [
  {
    q: "Where is Hitech Furniture & Interiors located?",
    a: "Hitech Furniture & Interiors is located in Edappetty, Kalpetta, Wayanad, Kerala. The showroom serves customers across Wayanad district and beyond.",
  },
  {
    q: "What does Hitech Furniture & Interiors sell?",
    a: "Hitech Furniture & Interiors sells sofas, beds, wardrobes, dining sets, chairs and other home furniture, and also offers custom interior design and wholesale furniture supply, across 37 product categories.",
  },
  {
    q: "How can I get a price quote or place an enquiry?",
    a: "You can browse the live catalog at hitechfurniture.online/catalog and send a product enquiry directly on WhatsApp for pricing, availability and delivery details.",
  },
  {
    q: "How long has Hitech Furniture & Interiors been operating?",
    a: "Hitech Furniture & Interiors has been operating in Wayanad, Kerala for over 14 years.",
  },
  {
    q: "Is EMI available?",
    a: "Yes, EMI is available through Bajaj Finserv on eligible purchases. Ask in-store or on WhatsApp for current terms.",
  },
  {
    q: "Is there a warranty on furniture?",
    a: "Locally manufactured wooden furniture carries a 10-year warranty against termite and wood-borer damage (original bill required; does not cover physical damage). Ask about the specific item's warranty before purchase.",
  },
];

const faqBlockHtml = (items) => `
  <section>
    <h2>Frequently Asked Questions</h2>
    ${items.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("\n")}
  </section>`;

const faqJsonLd = (items) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

const page = ({ title, description, canonical, jsonLd, bodyHtml }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
${(Array.isArray(jsonLd) ? jsonLd : [jsonLd]).map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}
</head>
<body>
<header><h1>${esc(title.split(" — ")[0])}</h1></header>
<main>
${bodyHtml}
</main>
<footer>
<p>${BRAND} — Edappetty, Kalpetta, Wayanad, Kerala. <a href="${SITE_URL}">Visit the full interactive site</a>.</p>
</footer>
</body>
</html>
`;

async function main() {
  mkdirSync("public/_snapshots/product", { recursive: true });
  mkdirSync("public/_snapshots/bundle", { recursive: true });

  // ---- Homepage ----
  writeFileSync(
    "public/_snapshots/index.html",
    page({
      title: "Hitech Furniture & Interiors — Custom Sofas, Beds & Wardrobes in Wayanad",
      description:
        "14+ years of crafting custom furniture and interiors in Kalpetta, Wayanad. Browse our live catalog of sofas, beds, wardrobes and more — enquire on WhatsApp.",
      canonical: `${SITE_URL}/`,
      jsonLd: [LOCAL_BUSINESS_JSONLD, faqJsonLd(GENERAL_FAQ)],
      bodyHtml: `
<p>Hitech Furniture &amp; Interiors is a furniture retailer, wholesaler and interior design business in Edappetty, Kalpetta, Wayanad, Kerala, operating for over 14 years. Browse the full catalog at <a href="${SITE_URL}/catalog">hitechfurniture.online/catalog</a>.</p>
<p>Serving customers across Kalpetta, Sulthan Bathery, Mananthavady, Vythiri, Meppadi, Pulpally and the wider Wayanad district.</p>
${faqBlockHtml(GENERAL_FAQ)}`,
    })
  );

  // ---- Catalog ----
  const { data: categories } = await supabase
    .from("main_categories")
    .select("name")
    .is("deleted_at", null)
    .order("display_order", { ascending: true });

  writeFileSync(
    "public/_snapshots/catalog.html",
    page({
      title: "Full Furniture Catalog — Hitech Furniture & Interiors, Wayanad",
      description: `Browse ${categories?.length ?? "all"} furniture categories from Hitech Furniture & Interiors in Kalpetta, Wayanad — sofas, beds, wardrobes, dining sets and more.`,
      canonical: `${SITE_URL}/catalog`,
      jsonLd: LOCAL_BUSINESS_JSONLD,
      bodyHtml: `
<p>Hitech Furniture &amp; Interiors' catalog spans ${categories?.length ?? "several"} categories, including: ${(categories ?? []).map((c) => esc(c.name)).join(", ")}.</p>
<p>See live prices, colors and stock on the <a href="${SITE_URL}/catalog">full interactive catalog</a>, or view individual products below.</p>`,
    })
  );

  // ---- About ----
  writeFileSync(
    "public/_snapshots/about.html",
    page({
      title: `About ${BRAND} — Furniture Shop in Kalpetta, Wayanad`,
      description: "Hitech Furniture & Interiors — 14+ years serving Wayanad, Kerala with furniture retail, wholesale and interior design.",
      canonical: `${SITE_URL}/about`,
      jsonLd: LOCAL_BUSINESS_JSONLD,
      bodyHtml: `<p>${BRAND} has served customers in Kalpetta, Wayanad, Kerala for over 14 years, offering furniture retail, wholesale and interior design services.</p>`,
    })
  );

  // ---- FAQ ----
  writeFileSync(
    "public/_snapshots/faq.html",
    page({
      title: `Frequently Asked Questions — ${BRAND}`,
      description: "Answers about location, product range, pricing, EMI and warranty for Hitech Furniture & Interiors, Kalpetta, Wayanad.",
      canonical: `${SITE_URL}/faq`,
      jsonLd: faqJsonLd(GENERAL_FAQ),
      bodyHtml: faqBlockHtml(GENERAL_FAQ),
    })
  );

  // ---- Products ----
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(
      "id, product_name, product_code, description, mrp, offer_price, material, primary_material, secondary_material, dimensions, color_finish, warranty_period, delivery_condition, primary_image_url, stock_status, main_categories(name), sub_categories(name)"
    )
    .eq("is_published", true)
    .is("deleted_at", null);

  if (productsError) {
    console.error("[snapshots] Failed to fetch products:", productsError.message);
  } else {
    for (const p of products) {
      const canonical = `${SITE_URL}/product/${p.id}`;
      const categoryName = p.main_categories?.name;
      const price = Number(p.offer_price ?? p.mrp ?? 0);
      const hasPrice = price > 0;
      const title = `${p.product_name}${categoryName ? ` — ${categoryName}` : ""} | ${BRAND}`;
      const description =
        p.description?.slice(0, 155) ||
        `${p.product_name} (Code ${p.product_code}) by ${BRAND}, Wayanad. Enquire on WhatsApp for price and delivery.`;

      const facts = [
        categoryName && `<li>Category: ${esc(categoryName)}${p.sub_categories?.name ? ` — ${esc(p.sub_categories.name)}` : ""}</li>`,
        (p.primary_material || p.material) && `<li>Material: ${esc(p.primary_material || p.material)}${p.secondary_material ? ` (with ${esc(p.secondary_material)})` : ""}</li>`,
        p.dimensions && `<li>Dimensions: ${esc(p.dimensions)}</li>`,
        p.color_finish && `<li>Finish: ${esc(p.color_finish)}</li>`,
        p.warranty_period && `<li>Warranty: ${esc(p.warranty_period)}</li>`,
        p.delivery_condition && `<li>Delivery: ${esc(p.delivery_condition)}</li>`,
        hasPrice && `<li>Price: ₹${price.toLocaleString("en-IN")}</li>`,
      ].filter(Boolean);

      const productJsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: p.product_name,
        sku: p.product_code,
        description: p.description || undefined,
        image: p.primary_image_url || undefined,
        brand: { "@type": "Brand", name: BRAND },
        category: categoryName || undefined,
        material: p.primary_material || p.material || undefined,
        ...(hasPrice
          ? {
              offers: {
                "@type": "Offer",
                priceCurrency: "INR",
                price,
                availability:
                  p.stock_status === "in_stock" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                url: canonical,
              },
            }
          : {}),
      };

      writeFileSync(
        `public/_snapshots/product/${p.id}.html`,
        page({
          title,
          description,
          canonical,
          jsonLd: productJsonLd,
          bodyHtml: `
${p.description ? `<p>${esc(p.description)}</p>` : ""}
${facts.length ? `<ul>${facts.join("\n")}</ul>` : ""}
<p>See photos, colors and place an enquiry on the <a href="${canonical}">full product page</a>.</p>`,
        })
      );
    }
  }

  // ---- Bundles ----
  const { data: bundles, error: bundlesError } = await supabase
    .from("product_bundles")
    .select("id, name, description, mrp, offer_price, material, dimensions, main_image_url, stock_status, main_categories(name)")
    .eq("is_published", true)
    .is("deleted_at", null);

  if (bundlesError) {
    console.error("[snapshots] Failed to fetch bundles:", bundlesError.message);
  } else {
    for (const b of bundles) {
      const canonical = `${SITE_URL}/bundle/${b.id}`;
      const price = Number(b.offer_price ?? b.mrp ?? 0);
      const hasPrice = price > 0;
      const title = `${b.name} Bundle | ${BRAND}`;
      const description = b.description?.slice(0, 155) || `${b.name} furniture bundle by ${BRAND}, Wayanad. Enquire on WhatsApp for price and delivery.`;

      const bundleJsonLd = {
        "@context": "https://schema.org",
        "@type": "ProductGroup",
        name: b.name,
        description: b.description || undefined,
        image: b.main_image_url || undefined,
        brand: { "@type": "Brand", name: BRAND },
        ...(hasPrice
          ? {
              offers: {
                "@type": "Offer",
                priceCurrency: "INR",
                price,
                availability: b.stock_status === "in_stock" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                url: canonical,
              },
            }
          : {}),
      };

      writeFileSync(
        `public/_snapshots/bundle/${b.id}.html`,
        page({
          title,
          description,
          canonical,
          jsonLd: bundleJsonLd,
          bodyHtml: `
${b.description ? `<p>${esc(b.description)}</p>` : ""}
${b.material ? `<p>Material: ${esc(b.material)}</p>` : ""}
${b.dimensions ? `<p>Dimensions: ${esc(b.dimensions)}</p>` : ""}
${hasPrice ? `<p>Price: ₹${price.toLocaleString("en-IN")}</p>` : ""}
<p>See photos and place an enquiry on the <a href="${canonical}">full bundle page</a>.</p>`,
        })
      );
    }
  }

  console.log(
    `[snapshots] Wrote crawler snapshots: 1 home, 1 catalog, 1 about, ${products?.length ?? 0} products, ${bundles?.length ?? 0} bundles.`
  );
}

main();
