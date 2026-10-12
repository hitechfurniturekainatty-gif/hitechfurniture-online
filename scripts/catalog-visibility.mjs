// Build-time copy of the public-catalog visibility rules (see
// src/lib/publicCatalogVisibility.ts). Lets the sitemap / crawler snapshot
// scripts skip items an admin has hidden from the public catalog.
const KEY = "__public_catalog_visibility";

const active = (e, now) =>
  !!e && !(e.from && Date.parse(e.from) > now) && !(e.until && Date.parse(e.until) <= now);

export async function loadCatalogVisibility(supabase) {
  const now = Date.now();
  let cfg = {};
  let legacyShow = null;
  try {
    const [{ data: sec }, { data: hs }] = await Promise.all([
      supabase.from("homepage_sections").select("body").eq("section_key", KEY).maybeSingle(),
      supabase.from("homepage_settings").select("show_public_catalog").limit(1).maybeSingle(),
    ]);
    cfg = sec?.body ? JSON.parse(sec.body) : {};
    legacyShow = hs?.show_public_catalog ?? null;
  } catch (e) {
    console.warn("[visibility] Could not read public catalog visibility rules:", e?.message ?? e);
  }
  const allHidden = legacyShow === false || active(cfg.all, now);
  const m = (k) => (cfg && typeof cfg[k] === "object" && cfg[k]) || {};
  const mainHidden = (id) => allHidden || (!!id && active(m("main")[id], now));
  const itemHidden = ({ id, main_category_id, sub_category_id, isBundle }) =>
    mainHidden(main_category_id) ||
    (!!sub_category_id && active(m("sub")[sub_category_id], now)) ||
    active(m(isBundle ? "bundles" : "products")[id], now);
  return { allHidden, mainHidden, itemHidden };
}
