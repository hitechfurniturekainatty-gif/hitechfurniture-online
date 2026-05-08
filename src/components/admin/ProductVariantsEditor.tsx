import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, MapPin } from "lucide-react";
import { SingleImagePicker } from "@/components/admin/SingleImagePicker";

export type VariantStockDraft = {
  id?: string;
  location_id: string;
  quantity: number;
  floor_display_order?: number;
};

export type VariantDraft = {
  id?: string;
  color_name: string;
  color_hex: string;
  image_url: string | null;
  /** Legacy total — auto-derived from `stocks` when any are defined. */
  stock_quantity: number;
  /** Per-location stock breakdown (Floor 1: 3 pcs, Godown: 2 pcs, …). */
  stocks: VariantStockDraft[];
};

export type VariantLocationOption = {
  id: string;
  building: string;
  floor: string;
  section: string | null;
};

const NAMED_COLORS: Record<string, string> = {
  red: "#ef4444", maroon: "#7f1d1d", pink: "#ec4899", orange: "#f97316",
  yellow: "#eab308", gold: "#d4a017", green: "#22c55e", olive: "#65a30d",
  teal: "#14b8a6", blue: "#3b82f6", navy: "#1e3a8a", sky: "#0ea5e9",
  purple: "#a855f7", violet: "#8b5cf6", brown: "#92400e", beige: "#d6b88a",
  cream: "#f5e9d4", ivory: "#fffff0", white: "#ffffff", grey: "#9ca3af",
  gray: "#9ca3af", silver: "#c0c0c0", charcoal: "#374151", black: "#111827",
  walnut: "#5d3a1a", oak: "#b08968", teak: "#9c6b3c", rosewood: "#65000b",
  mahogany: "#4a1e0c",
};

const guessHex = (name: string): string => {
  const k = name.trim().toLowerCase();
  if (!k) return "#cbd5e1";
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(k)) return k.startsWith("#") ? k : `#${k}`;
  return NAMED_COLORS[k] ?? "#cbd5e1";
};

export const ProductVariantsEditor = ({
  variants,
  onChange,
  locations = [],
  defaultLocationId,
}: {
  variants: VariantDraft[];
  onChange: (v: VariantDraft[]) => void;
  locations?: VariantLocationOption[];
  defaultLocationId?: string | null;
}) => {
  const [quickName, setQuickName] = useState("");

  const update = (idx: number, patch: Partial<VariantDraft>) => {
    const next = variants.slice();
    next[idx] = { ...next[idx], ...patch };
    // Keep the legacy total in sync with the per-location breakdown so other
    // surfaces (admin list, public total, low-stock alerts) stay correct.
    if (patch.stocks) {
      next[idx].stock_quantity = patch.stocks.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    }
    onChange(next);
  };

  const remove = (idx: number) => onChange(variants.filter((_, i) => i !== idx));

  const addQuick = () => {
    const name = quickName.trim();
    if (!name) return;
    onChange([
      ...variants,
      {
        color_name: name,
        color_hex: guessHex(name),
        image_url: null,
        stock_quantity: 0,
        stocks: defaultLocationId
          ? [{ location_id: defaultLocationId, quantity: 0, floor_display_order: 0 }]
          : [],
      },
    ]);
    setQuickName("");
  };

  const addStockRow = (idx: number) => {
    const v = variants[idx];
    // Pick a location not already used by this variant, falling back to the first.
    const used = new Set((v.stocks ?? []).map((s) => s.location_id));
    const next = locations.find((l) => !used.has(l.id)) ?? locations[0];
    if (!next) return;
    update(idx, {
      stocks: [...(v.stocks ?? []), { location_id: next.id, quantity: 0, floor_display_order: 0 }],
    });
  };
  const updateStockRow = (idx: number, sIdx: number, patch: Partial<VariantStockDraft>) => {
    const v = variants[idx];
    const stocks = (v.stocks ?? []).slice();
    stocks[sIdx] = { ...stocks[sIdx], ...patch };
    update(idx, { stocks });
  };
  const removeStockRow = (idx: number, sIdx: number) => {
    const v = variants[idx];
    update(idx, { stocks: (v.stocks ?? []).filter((_, i) => i !== sIdx) });
  };

  const labelFor = useMemo(
    () => (id: string) => {
      const l = locations.find((x) => x.id === id);
      return l ? `${l.building} · ${l.floor}${l.section ? " · " + l.section : ""}` : "—";
    },
    [locations],
  );

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Add color (name auto-fills the swatch)
          </label>
          <Input
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addQuick();
              }
            }}
            placeholder="e.g. Walnut, Beige, #1e3a8a"
          />
        </div>
        <Button type="button" onClick={addQuick} disabled={!quickName.trim()}>
          <Plus className="mr-1 h-4 w-4" /> Add color
        </Button>
      </div>

      {variants.length === 0 ? (
        <p className="rounded-md border border-dashed bg-background p-4 text-center text-xs text-muted-foreground">
          No colors yet. Add one above — each color can have its own photo and stock count.
        </p>
      ) : (
        <ul className="space-y-2">
          {variants.map((v, idx) => (
            <li key={v.id ?? idx} className="rounded-md border bg-background p-3">
              <div className="flex flex-wrap items-start gap-3">
                <GripVertical className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                <span
                  className="mt-1 inline-block h-8 w-8 shrink-0 rounded-full border shadow-inner"
                  style={{ backgroundColor: v.color_hex || "#cbd5e1" }}
                  aria-label={`Swatch for ${v.color_name}`}
                />
                <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-muted-foreground">Color name</label>
                    <Input
                      value={v.color_name}
                      onChange={(e) => update(idx, { color_name: e.target.value, color_hex: v.color_hex || guessHex(e.target.value) })}
                      placeholder="Beige"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-muted-foreground">Hex / picker</label>
                    <div className="flex gap-1">
                      <Input
                        type="color"
                        value={v.color_hex || "#cbd5e1"}
                        onChange={(e) => update(idx, { color_hex: e.target.value })}
                        className="h-9 w-12 cursor-pointer p-1"
                      />
                      <Input
                        value={v.color_hex}
                        onChange={(e) => update(idx, { color_hex: e.target.value })}
                        placeholder="#000000"
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-muted-foreground">
                      Total stock {(v.stocks?.length ?? 0) > 0 ? "(auto)" : ""}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={v.stock_quantity}
                      readOnly={(v.stocks?.length ?? 0) > 0}
                      onChange={(e) => update(idx, { stock_quantity: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(idx)}
                  className="text-destructive"
                  aria-label="Remove color"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {locations.length > 0 && (
                <div className="mt-3 space-y-2 rounded-md border border-dashed bg-muted/20 p-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase text-muted-foreground">
                      <MapPin className="mr-1 inline h-3 w-3" />
                      Stock by location
                    </label>
                    <Button type="button" size="sm" variant="ghost" onClick={() => addStockRow(idx)} className="h-7 px-2 text-xs">
                      <Plus className="mr-1 h-3 w-3" /> Add location
                    </Button>
                  </div>
                  {(v.stocks ?? []).length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      No location set — this color will appear under the product's main location with the total above.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      <li className="grid grid-cols-12 gap-1.5 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <span className="col-span-7">Floor / Location</span>
                        <span className="col-span-2 text-center">Qty</span>
                        <span className="col-span-2 text-center">Order</span>
                        <span className="col-span-1" />
                      </li>
                      {(v.stocks ?? []).map((s, sIdx) => (
                        <li key={s.id ?? sIdx} className="grid grid-cols-12 gap-1.5 rounded bg-background p-1.5">
                          <Select
                            value={s.location_id}
                            onValueChange={(val) => updateStockRow(idx, sIdx, { location_id: val })}
                          >
                            <SelectTrigger className="col-span-7 h-8 text-xs"><SelectValue placeholder="Pick location" /></SelectTrigger>
                            <SelectContent>
                              {locations.map((l) => (
                                <SelectItem key={l.id} value={l.id}>
                                  {l.building} · {l.floor}{l.section ? ` · ${l.section}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min={0}
                            value={s.quantity}
                            onChange={(e) => updateStockRow(idx, sIdx, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                            placeholder="Qty"
                            className="col-span-2 h-8 text-xs"
                          />
                          <Input
                            type="number"
                            min={0}
                            value={s.floor_display_order ?? 0}
                            onChange={(e) => updateStockRow(idx, sIdx, { floor_display_order: Math.max(0, Number(e.target.value) || 0) })}
                            placeholder="Order"
                            className="col-span-2 h-8 text-xs"
                            title="Display order on that floor"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeStockRow(idx, sIdx)}
                            className="col-span-1 h-8 w-8 text-destructive"
                            aria-label="Remove location row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="mt-3 max-w-xs">
                <p className="mb-1 text-[10px] uppercase text-muted-foreground">Photo for this color (optional)</p>
                <SingleImagePicker
                  value={v.image_url}
                  onChange={(url) => update(idx, { image_url: url })}
                  bucket="product-images"
                  folder="variants"
                  compact
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};