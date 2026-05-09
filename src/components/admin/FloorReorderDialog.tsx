import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, GripVertical, ArrowRightLeft } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type ReorderItem = {
  id: string;
  product_name: string;
  product_code: string;
  cover_url?: string | null;
  /** "product" reorders products row; "variant_stock" reorders a per-location stock row */
  kind?: "product" | "variant_stock";
  /** Display-only color label for variant rows */
  color_label?: string | null;
  /** Color hex for swatch display (variant rows) */
  color_hex?: string | null;
  /** Stock count for this row (used for display + stock-sort) */
  stock?: number;
};

export type LocationOption = {
  id: string;
  building: string;
  floor: string;
  section: string | null;
};

const Row = ({
  item,
  index,
  selected,
  onToggle,
}: {
  item: ReorderItem;
  index: number;
  selected: boolean;
  onToggle: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border bg-card p-2 shadow-sm"
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <Checkbox checked={selected} onCheckedChange={() => onToggle(item.id)} aria-label="Select to move" />
      <span className="w-6 shrink-0 text-center text-xs font-mono text-muted-foreground">{index + 1}</span>
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
        {item.cover_url ? (
          <img src={item.cover_url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {item.color_hex && (
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full border"
              style={{ backgroundColor: item.color_hex }}
              aria-hidden
            />
          )}
          <p className="truncate text-sm font-medium">{item.product_name}</p>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {item.product_code}
          {item.color_label ? <span className="ml-1 text-foreground/70">· {item.color_label}</span> : null}
        </p>
      </div>
      <span
        className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-mono ${
          (item.stock ?? 0) > 0 ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"
        }`}
        title="Stock available at this location"
      >
        {item.stock ?? 0} in stock
      </span>
    </li>
  );
};

export const FloorReorderDialog = ({
  open,
  onOpenChange,
  locationLabel,
  items: initialItems,
  onSaved,
  allLocations = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  locationLabel: string;
  items: ReorderItem[];
  onSaved: () => void;
  allLocations?: LocationOption[];
}) => {
  const [items, setItems] = useState<ReorderItem[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    setItems(initialItems);
    setSelected(new Set());
    setMoveTarget("");
  }, [initialItems, open]);

  const sensors = useSensors(
    // Pointer = mouse / pen. Use distance to avoid drag on accidental clicks.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Touch needs a slightly longer press so the page can still scroll
    // vertically by swiping anywhere on the row. Drag only kicks in when
    // the finger is held still on the grip handle.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((curr) => {
      const oldIdx = curr.findIndex((i) => i.id === active.id);
      const newIdx = curr.findIndex((i) => i.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return curr;
      return arrayMove(curr, oldIdx, newIdx);
    });
  };

  const sortBy = (mode: "color" | "stock" | "name" | "type") => {
    setItems((curr) => {
      const next = curr.slice();
      if (mode === "color") {
        next.sort((a, b) => {
          const ac = (a.color_label ?? "~").toLowerCase();
          const bc = (b.color_label ?? "~").toLowerCase();
          if (ac !== bc) return ac.localeCompare(bc);
          return a.product_name.localeCompare(b.product_name);
        });
      } else if (mode === "stock") {
        // High stock first, zero-stock items pushed to the bottom.
        next.sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0) || a.product_name.localeCompare(b.product_name));
      } else if (mode === "name") {
        next.sort((a, b) => a.product_name.localeCompare(b.product_name));
      } else if (mode === "type") {
        // Group by base product so all colors of the same item sit next to each other.
        next.sort((a, b) => {
          if (a.product_name !== b.product_name) return a.product_name.localeCompare(b.product_name);
          return (a.color_label ?? "").localeCompare(b.color_label ?? "");
        });
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      // Update each row with its new order. Step 10 to allow easy manual inserts.
      // Variants update product_variants; products update products.
      const updates = items.map((it, idx) => {
        const order = (idx + 1) * 10;
        if (it.kind === "variant_stock") {
          return supabase.from("product_variant_stock").update({ floor_display_order: order }).eq("id", it.id);
        }
        return supabase.from("products").update({ floor_display_order: order }).eq("id", it.id);
      });
      const results = await Promise.all(updates);
      const firstErr = results.find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
      toast({ title: "Floor order saved", description: `${items.length} item${items.length === 1 ? "" : "s"} reordered.` });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save the new order";
      toast({ title: "Failed to save", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const moveSelected = async () => {
    if (!moveTarget || selected.size === 0) return;
    setMoving(true);
    try {
      const chosen = items.filter((i) => selected.has(i.id));
      const stockIds = chosen.filter((i) => i.kind === "variant_stock").map((i) => i.id);
      const productIds = chosen.filter((i) => i.kind !== "variant_stock").map((i) => i.id);
      if (stockIds.length > 0) {
        // Move the per-location stock row to the new location (no merge: if the
        // variant already has a row in the target it'll be a duplicate, which
        // the unique constraint blocks — but in practice staff move singletons).
        const { error } = await supabase
          .from("product_variant_stock")
          .update({ location_id: moveTarget, floor_display_order: 0 })
          .in("id", stockIds);
        if (error) throw error;
      }
      if (productIds.length > 0) {
        const { error } = await supabase
          .from("products")
          .update({ location_id: moveTarget, floor_display_order: 0 })
          .in("id", productIds);
        if (error) throw error;
      }
      const ids = [...stockIds, ...productIds];
      const loc = allLocations.find((l) => l.id === moveTarget);
      const label = loc ? `${loc.building} · ${loc.floor}${loc.section ? " · " + loc.section : ""}` : "new location";
      toast({ title: "Items moved", description: `${ids.length} item${ids.length === 1 ? "" : "s"} moved to ${label}.` });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not move items";
      toast({ title: "Failed to move", description: msg, variant: "destructive" });
    } finally {
      setMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] sm:w-full max-h-[92vh] sm:max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Arrange floor order</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {locationLabel} · Drag rows to match the physical sequence on the floor. Top of the list = first item a salesman sees.
          </p>
        </DialogHeader>

        {items.length > 0 && allLocations.length > 0 && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-medium">
                <ArrowRightLeft className="mr-1 inline h-3.5 w-3.5" />
                Move items to another building / floor / section
              </Label>
              <button type="button" onClick={toggleAll} className="text-xs text-primary hover:underline">
                {selected.size === items.length ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={moveTarget} onValueChange={setMoveTarget}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose destination location…" />
                </SelectTrigger>
                <SelectContent>
                  {allLocations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.building} · {l.floor}{l.section ? ` · ${l.section}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="secondary"
                onClick={moveSelected}
                disabled={moving || !moveTarget || selected.size === 0}
              >
                {moving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Move {selected.size > 0 ? `${selected.size} ` : ""}selected
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tick the rows you want to move, pick a destination, then press Move. Use this when items are physically shifted between floors or sections.
            </p>
          </div>
        )}

        {items.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Quick sort
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => sortBy("type")}>
              By item (group colors)
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => sortBy("color")}>
              By color
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => sortBy("stock")}>
              By stock (high → low)
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => sortBy("name")}>
              By name
            </Button>
          </div>
        )}

        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No products in this location yet.</p>
        ) : (
          <div
            className="max-h-[55vh] sm:max-h-[60vh] overflow-y-auto overscroll-contain pr-1 -mx-1 px-1"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2">
                  {items.map((it, idx) => (
                    <Row key={it.id} item={it} index={idx} selected={selected.has(it.id)} onToggle={toggle} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || items.length === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
