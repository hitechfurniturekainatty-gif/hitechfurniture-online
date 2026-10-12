import { locationLabel, partLabel, type FloorEntry, type FloorLocation } from "./staffFloorCatalog";

/**
 * Pure helpers that split Staff Catalog rows into the groups used by the
 * catalog PDF export (shop / floor / section / category / sub-category).
 * Kept free of React and @react-pdf so it can be unit-tested and so the
 * heavy PDF chunk is only loaded when a download actually starts.
 */

export type PdfGroupBy = "none" | "building" | "floor" | "section" | "category" | "sub";

export const GROUP_BY_OPTIONS: { id: PdfGroupBy; label: string }[] = [
  { id: "none", label: "No grouping (one list)" },
  { id: "building", label: "Shop / Godown wise" },
  { id: "floor", label: "Floor wise" },
  { id: "section", label: "Section / Part wise" },
  { id: "category", label: "Main category wise" },
  { id: "sub", label: "Sub-category wise" },
];

export const groupByLabel = (g: PdfGroupBy) => GROUP_BY_OPTIONS.find(o => o.id === g)?.label ?? g;

export type PdfLookup = {
  locations: FloorLocation[];
  categories: { id: string; name: string }[];
  subCategories: { id: string; name: string; main_category_id: string }[];
};

export type PdfGroup<T> = { key: string; title: string; items: T[]; children?: PdfGroup<T>[] };

const NONE = "~none";

function keyOf(e: FloorEntry, by: PdfGroupBy, locById: Map<string, FloorLocation>): string {
  const loc = e.location_id ? locById.get(e.location_id) : undefined;
  switch (by) {
    case "building": return loc ? loc.building : NONE;
    case "floor": return loc ? loc.building + "\u0000" + loc.floor : NONE;
    case "section": return loc ? loc.id : NONE;
    case "category": return e.product.main_category_id || NONE;
    case "sub": return e.product.sub_category_id || NONE;
    default: return "all";
  }
}

function titleOf(key: string, by: PdfGroupBy, lookup: PdfLookup, locById: Map<string, FloorLocation>, parentBy?: PdfGroupBy): string {
  if (key === NONE) {
    if (by === "category") return "No category";
    if (by === "sub") return "No sub-category";
    return "Location not set";
  }
  switch (by) {
    case "building": return key;
    case "floor": {
      const [b, f] = key.split("\u0000");
      return parentBy === "building" ? f : `${b} · ${f}`;
    }
    case "section": {
      const l = locById.get(key);
      if (!l) return "Location not set";
      if (parentBy === "floor") return partLabel(l);
      if (parentBy === "building") return `${l.floor} · ${partLabel(l)}`;
      return locationLabel(l);
    }
    case "category": return lookup.categories.find(c => c.id === key)?.name ?? "Other category";
    case "sub": return lookup.subCategories.find(c => c.id === key)?.name ?? "Other sub-category";
    default: return "All items";
  }
}

/** Order groups: location groups keep showroom order (rows arrive sorted), categories keep their display order. */
function rank(key: string, by: PdfGroupBy, lookup: PdfLookup, firstSeen: Map<string, number>): number {
  if (key === NONE) return 1e9;
  if (by === "category") {
    const i = lookup.categories.findIndex(c => c.id === key);
    return i < 0 ? 1e8 : i;
  }
  if (by === "sub") {
    const i = lookup.subCategories.findIndex(c => c.id === key);
    return i < 0 ? 1e8 : i;
  }
  return firstSeen.get(key) ?? 1e8;
}

export function groupEntries<T>(
  rows: FloorEntry[],
  by: PdfGroupBy,
  lookup: PdfLookup,
  map: (e: FloorEntry) => T,
  thenBy: PdfGroupBy = "none",
  parentBy?: PdfGroupBy,
): PdfGroup<T>[] {
  if (by === "none") return [{ key: "all", title: "All items", items: rows.map(map) }];
  const locById = new Map(lookup.locations.map(l => [l.id, l]));
  const buckets = new Map<string, FloorEntry[]>();
  const firstSeen = new Map<string, number>();
  rows.forEach((e, i) => {
    const k = keyOf(e, by, locById);
    if (!buckets.has(k)) { buckets.set(k, []); firstSeen.set(k, i); }
    buckets.get(k)!.push(e);
  });
  return [...buckets.entries()]
    .sort(([a], [b]) => rank(a, by, lookup, firstSeen) - rank(b, by, lookup, firstSeen))
    .map(([k, list]) => {
      const group: PdfGroup<T> = { key: by + ":" + k, title: titleOf(k, by, lookup, locById, parentBy), items: list.map(map) };
      if (thenBy !== "none" && thenBy !== by) {
        const children = groupEntries(list, thenBy, lookup, map, "none", by);
        // Only nest when it actually splits the group; otherwise a single
        // sub-heading just repeats information.
        if (children.length > 1 || children[0]?.title !== group.title) group.children = children;
      }
      return group;
    });
}

/** Second-level choices that make sense under a given first level. */
export function thenByOptions(by: PdfGroupBy): PdfGroupBy[] {
  switch (by) {
    case "building": return ["none", "floor", "section", "category", "sub"];
    case "floor": return ["none", "section", "category", "sub"];
    case "section": return ["none", "category", "sub"];
    case "category": return ["none", "sub", "floor", "section"];
    case "sub": return ["none", "floor", "section"];
    default: return ["none"];
  }
}

export const fileSlug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "catalog";
