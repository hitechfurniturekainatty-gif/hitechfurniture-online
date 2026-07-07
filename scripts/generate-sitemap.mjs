// Generates public/sitemap.xml before every build, from live Supabase data.
// Why: this site is a client-side SPA with no SSR/prerendering. AI/answer-engine
// crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot) don't execute
// JS and can't discover routes via the React Router links on the homepage — a
// sitemap is the only way they (and Google/Bing) learn every product/bundle URL
// exists. Run automatically via `npm run build` (see package.json "prebuild").
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync, existsSync } from "fs";

// Minimal .env loader (avoids adding a new dependency just for this script).
// Build hosts (Hostinger CI, local `npm run build`) may already export these
// as real env vars, in which case the .env file is simply ignored below.
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

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("[sitemap] Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — skipping sitemap generation.");
  process.exit(0); // don't fail the whole build over this
}

const supabase = createClient(supabaseUrl, supabaseKey);

const STATIC_ROUTES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/catalog", changefreq: "daily", priority: "0.9" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.2" },
  { path: "/guide", changefreq: "monthly", priority: "0.3" },
];

const urlEntry = (loc, lastmod, changefreq, priority) => `  <url>
    <loc>${SITE_URL}${loc}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;

async function main() {
  const entries = STATIC_ROUTES.map((r) =>
    urlEntry(r.path, new Date().toISOString().split("T")[0], r.changefreq, r.priority)
  );

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, updated_at")
    .eq("is_published", true)
    .is("deleted_at", null);

  if (productsError) {
    console.error("[sitemap] Failed to fetch products:", productsError.message);
  } else {
    for (const p of products) {
      entries.push(
        urlEntry(`/product/${p.id}`, p.updated_at?.split("T")[0], "weekly", "0.8")
      );
    }
  }

  const { data: bundles, error: bundlesError } = await supabase
    .from("product_bundles")
    .select("id, updated_at")
    .eq("is_published", true)
    .is("deleted_at", null);

  if (bundlesError) {
    console.error("[sitemap] Failed to fetch bundles:", bundlesError.message);
  } else {
    for (const b of bundles) {
      entries.push(
        urlEntry(`/bundle/${b.id}`, b.updated_at?.split("T")[0], "weekly", "0.7")
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

  writeFileSync("public/sitemap.xml", xml);
  console.log(`[sitemap] Wrote public/sitemap.xml with ${entries.length} URLs (${products?.length ?? 0} products, ${bundles?.length ?? 0} bundles).`);
}

main();
