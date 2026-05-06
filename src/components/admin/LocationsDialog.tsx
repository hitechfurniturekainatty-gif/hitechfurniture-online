import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

export type Location = {
  id: string;
  building: string;
  floor: string;
  section: string | null;
  display_order: number;
  is_active: boolean;
};

const BUILDINGS = ["Main Shop", "Suzuki Godown", "JCB Godown"];
const FLOORS = ["Ground Floor", "1st Floor", "2nd Floor", "3rd Floor"];

export const LocationsDialog = ({
  open,
  onOpenChange,
  locations,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  locations: Location[];
  onChanged: () => void;
}) => {
  const [building, setBuilding] = useState(BUILDINGS[0]);
  const [floor, setFloor] = useState(FLOORS[0]);
  const [section, setSection] = useState("");

  const add = async () => {
    if (!building || !floor) return;
    const { error } = await supabase.from("product_locations").insert({
      building,
      floor,
      section: section.trim() || null,
      display_order: (locations[locations.length - 1]?.display_order ?? 0) + 10,
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setSection("");
    onChanged();
    toast({ title: "Location added" });
  };

  const toggleActive = async (loc: Location, v: boolean) => {
    const { error } = await supabase.from("product_locations").update({ is_active: v }).eq("id", loc.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    onChanged();
  };

  const remove = async (loc: Location) => {
    if (!confirm(`Delete "${loc.building} · ${loc.floor}${loc.section ? " · " + loc.section : ""}"? Products assigned here will lose their location.`)) return;
    const { error } = await supabase.from("product_locations").delete().eq("id", loc.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Shop locations (Building · Floor · Section)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Add new location</Label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <select className="h-10 rounded-md border bg-background px-2 text-sm" value={building} onChange={(e) => setBuilding(e.target.value)}>
                {BUILDINGS.map((b) => <option key={b}>{b}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-2 text-sm" value={floor} onChange={(e) => setFloor(e.target.value)}>
                {FLOORS.map((f) => <option key={f}>{f}</option>)}
              </select>
              <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Section (optional, e.g. Part A)" />
              <Button onClick={add} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
            </div>
          </div>
          <div className="max-h-[55vh] overflow-y-auto rounded-lg border">
            <ul className="divide-y">
              {locations.length === 0 && (
                <li className="p-6 text-center text-sm text-muted-foreground">No locations yet.</li>
              )}
              {locations.map((l) => (
                <li key={l.id} className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">
                      {l.building} · {l.floor}{l.section ? ` · ${l.section}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{l.is_active ? "Visible to staff" : "Hidden"}</p>
                  </div>
                  <Switch checked={l.is_active} onCheckedChange={(v) => toggleActive(l, v)} />
                  <Button size="icon" variant="ghost" onClick={() => remove(l)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
