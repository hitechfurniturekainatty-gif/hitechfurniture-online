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
        <p className="truncate text-sm font-medium">{item.product_name}</p>
        <p className="truncate text-xs text-muted-foreground">{item.product_code}</p>
      </div>
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
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
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

  const save = async () => {
    setSaving(true);
    try {
      // Update each row with its new order. Step 10 to allow easy manual inserts.
      const updates = items.map((it, idx) =>
        supabase.from("products").update({ floor_display_order: (idx + 1) * 10 }).eq("id", it.id),
      );
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
      const ids = Array.from(selected);
      const { error } = await supabase
        .from("products")
        .update({ location_id: moveTarget, floor_display_order: 0 })
        .in("id", ids);
      if (error) throw error;
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
      <DialogContent className="max-w-2xl">
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

        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No products in this location yet.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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
