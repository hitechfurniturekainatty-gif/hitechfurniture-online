export type FloorLocation = {
  id: string; building: string; floor: string; section: string | null; part?: string | null;
};
export type FloorVariant = {
  id: string; color_name: string; color_hex?: string | null; image_url: string | null;
  stock_quantity: number; location_id: string | null; floor_display_order: number;
  product_variant_stock: { id: string; location_id: string; quantity: number; floor_display_order: number }[];
};
export type FloorProduct = {
  id: string; product_name: string; product_code: string; mrp: number;
  description?: string | null; material?: string | null; dimensions?: string | null;
  primary_image_url?: string | null; main_category_id?: string; sub_category_id?: string | null;
  stock_quantity: number; stock_status: string; location_id: string | null; floor_display_order: number;
  review_status?: string | null;
  product_images: { image_url: string; display_order: number }[];
  product_variants: FloorVariant[];
  is_bundle?: boolean;
};
export type FloorEntry = {
  key: string; kind: "product" | "variant" | "variant_stock" | "bundle";
  refId: string; product: FloorProduct; variant: FloorVariant | null;
  location_id: string | null; floor_display_order: number; cover: string | null; stock: number;
};
export const partLabel = (l: FloorLocation) =>
  [...new Set([l.section, l.part].filter(Boolean))].join(" · ") || "General";
export const locationLabel = (l?: FloorLocation) =>
  l ? [l.building, l.floor, partLabel(l)].join(" / ") : "Location not set";

/** Every colour/location keeps its own photo and quantity; never repeat total stock on each floor. */
export function floorEntries(products: FloorProduct[]): FloorEntry[] {
  return products.flatMap(p => {
    const cover = p.primary_image_url || [...(p.product_images || [])].sort((a,b) => a.display_order-b.display_order)[0]?.image_url || null;
    const base = (kind: FloorEntry["kind"], id: string, location: string | null, order: number, stock: number, variant: FloorVariant | null): FloorEntry => ({
      key: kind + ":" + id, kind, refId: id, product: p, variant,
      location_id: location, floor_display_order: order || 0,
      cover: variant?.image_url || cover, stock: Math.max(0, stock || 0),
    });
    if (p.is_bundle) return [base("bundle", p.id, p.location_id, p.floor_display_order, p.stock_quantity, null)];
    const variants = p.product_variants || [];
    if (!variants.length) return [base("product", p.id, p.location_id, p.floor_display_order, p.stock_quantity, null)];
    return variants.flatMap(v => {
      const rows = v.product_variant_stock || [];
      if (!rows.length) return [base("variant", v.id, v.location_id || p.location_id, v.floor_display_order, v.stock_quantity, v)];
      return rows.map(s => base("variant_stock", s.id, s.location_id, s.floor_display_order, s.quantity, v));
    });
  });
}

export function sortFloorEntries(entries: FloorEntry[], locations: FloorLocation[]): FloorEntry[] {
  const order = new Map(locations.map((l,i) => [l.id,i]));
  return [...entries].sort((a,b) =>
    (order.get(a.location_id || "") ?? 1e9) - (order.get(b.location_id || "") ?? 1e9)
    || ((a.floor_display_order > 0 ? a.floor_display_order : 1e9) - (b.floor_display_order > 0 ? b.floor_display_order : 1e9))
    || a.product.product_name.localeCompare(b.product.product_name)
    || a.key.localeCompare(b.key));
}
