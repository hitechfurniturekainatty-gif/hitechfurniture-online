/**
 * Public catalog visibility rules (admin controlled).
 *
 * Lets an admin hide the PUBLIC catalog — everything, a main category, a
 * sub-category, or single products / bundles — now or for a time window.
 * Products themselves are never changed (is_published is untouched), and
 * staff always see everything.
 *
 * Storage: one hidden row in `homepage_sections` (section_key below,
 * is_visible = false so it never renders on the home page) whose `body`
 * holds this config as JSON. That table is already admin-writable and
 * publicly readable, so no schema change was needed.
 *
 * NOTE: this is enforced by the website pages, not by database policies.
 */

export const VISIBILITY_SECTION_KEY = "__public_catalog_visibility";

export type HideEntry = {
  /** Hidden from this moment (ISO). null/undefined = already hidden. */
  from?: string | null;
  /** Shown again automatically at this moment (ISO). null = until switched on. */
  until?: string | null;
  /** Display name kept for the admin list (items may be renamed later). */
  label?: string;
};

export type CatalogVisibilityConfig = {
  v: 1;
  all: HideEntry | null;
  message: string;
  main: Record<string, HideEntry>;
  sub: Record<string, HideEntry>;
  products: Record<string, HideEntry>;
  bundles: Record<string, HideEntry>;
};

export const DEFAULT_PUBLIC_MESSAGE =
  "Our full collection is available at the showroom. Visit us or message us on WhatsApp for photos of the latest models.";

export const emptyVisibilityConfig = (): CatalogVisibilityConfig => ({
  v: 1, all: null, message: "", main: {}, sub: {}, products: {}, bundles: {},
});

const asEntryMap = (x: unknown): Record<string, HideEntry> => {
  if (!x || typeof x !== "object" || Array.isArray(x)) return {};
  const out: Record<string, HideEntry> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (v && typeof v === "object") {
      const e = v as Record<string, unknown>;
      out[k] = {
        from: typeof e.from === "string" ? e.from : null,
        until: typeof e.until === "string" ? e.until : null,
        label: typeof e.label === "string" ? e.label : undefined,
      };
    }
  }
  return out;
};

export function parseVisibilityConfig(body: string | null | undefined): CatalogVisibilityConfig {
  if (!body) return emptyVisibilityConfig();
  try {
    const raw = JSON.parse(body) as Record<string, unknown>;
    const all = raw.all && typeof raw.all === "object" ? asEntryMap({ all: raw.all }).all ?? null : null;
    return {
      v: 1,
      all,
      message: typeof raw.message === "string" ? raw.message : "",
      main: asEntryMap(raw.main),
      sub: asEntryMap(raw.sub),
      products: asEntryMap(raw.products),
      bundles: asEntryMap(raw.bundles),
    };
  } catch {
    return emptyVisibilityConfig();
  }
}

/** Is this hide entry in force right now? */
export function entryActive(e: HideEntry | null | undefined, now: number = Date.now()): boolean {
  if (!e) return false;
  if (e.from && Date.parse(e.from) > now) return false;
  if (e.until && Date.parse(e.until) <= now) return false;
  return true;
}

/** Hidden later (scheduled) but not yet. */
export function entryScheduled(e: HideEntry | null | undefined, now: number = Date.now()): boolean {
  return !!e && !!e.from && Date.parse(e.from) > now && (!e.until || Date.parse(e.until) > now);
}

/** Drop entries whose window has already ended. */
export function pruneExpired(cfg: CatalogVisibilityConfig, now: number = Date.now()): CatalogVisibilityConfig {
  const keep = (m: Record<string, HideEntry>) =>
    Object.fromEntries(Object.entries(m).filter(([, e]) => !e.until || Date.parse(e.until) > now));
  return {
    ...cfg,
    all: cfg.all && (!cfg.all.until || Date.parse(cfg.all.until) > now) ? cfg.all : null,
    main: keep(cfg.main), sub: keep(cfg.sub), products: keep(cfg.products), bundles: keep(cfg.bundles),
  };
}

/**
 * Whole public catalog hidden?  `legacyShowFlag` is homepage_settings.show_public_catalog
 * (the older master switch on the Home Page admin screen) — false there also hides all.
 */
export function isAllHidden(cfg: CatalogVisibilityConfig, legacyShowFlag?: boolean | null, now: number = Date.now()): boolean {
  return legacyShowFlag === false || entryActive(cfg.all, now);
}

export type VisibilityTarget = {
  main_category_id?: string | null;
  sub_category_id?: string | null;
  id: string;
  isBundle?: boolean;
};

export function isItemHidden(cfg: CatalogVisibilityConfig, t: VisibilityTarget, now: number = Date.now()): boolean {
  if (entryActive(cfg.all, now)) return true;
  if (t.main_category_id && entryActive(cfg.main[t.main_category_id], now)) return true;
  if (t.sub_category_id && entryActive(cfg.sub[t.sub_category_id], now)) return true;
  return entryActive((t.isBundle ? cfg.bundles : cfg.products)[t.id], now);
}

export const isMainHidden = (cfg: CatalogVisibilityConfig, id: string, now = Date.now()) =>
  entryActive(cfg.all, now) || entryActive(cfg.main[id], now);

export const isSubHidden = (cfg: CatalogVisibilityConfig, sub: { id: string; main_category_id: string }, now = Date.now()) =>
  isMainHidden(cfg, sub.main_category_id, now) || entryActive(cfg.sub[sub.id], now);

export function activeCounts(cfg: CatalogVisibilityConfig, now: number = Date.now()) {
  const n = (m: Record<string, HideEntry>) => Object.values(m).filter(e => entryActive(e, now)).length;
  const s = (m: Record<string, HideEntry>) => Object.values(m).filter(e => entryScheduled(e, now)).length;
  return {
    all: entryActive(cfg.all, now),
    main: n(cfg.main), sub: n(cfg.sub), items: n(cfg.products) + n(cfg.bundles),
    scheduled: s(cfg.main) + s(cfg.sub) + s(cfg.products) + s(cfg.bundles) + (entryScheduled(cfg.all, now) ? 1 : 0),
  };
}
