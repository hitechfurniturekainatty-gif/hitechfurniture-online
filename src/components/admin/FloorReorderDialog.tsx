import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, GripVertical } from "lucide-react";
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

const Row = ({ item, index }: { item: ReorderItem; index: number }) => {
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
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  locationLabel: string;
  items: ReorderItem[];
  onSaved: () => void;
}) => {
  const [items, setItems] = useState<ReorderItem[]>(initialItems);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setItems(initialItems); }, [initialItems, open]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Arrange floor order</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {locationLabel} · Drag rows to match the physical sequence on the floor. Top of the list = first item a salesman sees.
          </p>
        </DialogHeader>

        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No products in this location yet.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2">
                  {items.map((it, idx) => (
                    <Row key={it.id} item={it} index={idx} />
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
