import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type Vehicle = {
  id: string;
  vehicle_number: string;
  label: string | null;
  driver_user_id: string | null;
  is_active: boolean;
  display_order: number;
};

type StaffUser = { user_id: string; display_name: string | null; email: string | null; roles: string[] };

const AdminVehicles = () => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<StaffUser[]>([]);
  const [newNumber, setNewNumber] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: vs }, staffRes] = await Promise.all([
      supabase
        .from("delivery_vehicles")
        .select("id, vehicle_number, label, driver_user_id, is_active, display_order")
        .order("display_order"),
      supabase.functions.invoke("list-staff-users"),
    ]);
    setVehicles((vs ?? []) as Vehicle[]);
    const users = ((staffRes.data as { users?: StaffUser[] } | null)?.users ?? []).filter((u) =>
      (u.roles ?? []).includes("delivery"),
    );
    setDrivers(users);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const updateVehicle = async (id: string, patch: Partial<Vehicle>) => {
    const { error } = await supabase.from("delivery_vehicles").update(patch).eq("id", id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    toast({ title: "Saved" });
  };

  const addVehicle = async () => {
    if (!newNumber.trim()) return;
    const { data, error } = await supabase
      .from("delivery_vehicles")
      .insert({
        vehicle_number: newNumber.trim(),
        label: newLabel.trim() || null,
        display_order: vehicles.length + 1,
      })
      .select("id, vehicle_number, label, driver_user_id, is_active, display_order")
      .single();
    if (error) return toast({ title: "Add failed", description: error.message, variant: "destructive" });
    setVehicles((prev) => [...prev, data as Vehicle]);
    setNewNumber("");
    setNewLabel("");
  };

  const removeVehicle = async (id: string) => {
    if (!confirm("Remove this vehicle?")) return;
    const { error } = await supabase.from("delivery_vehicles").delete().eq("id", id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  };

  if (!isAdmin) {
    return (
      <AdminShell>
        <p className="text-muted-foreground">Admin access required.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-4">
        <h1 className="font-display text-2xl sm:text-3xl">Delivery Vehicles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Link each vehicle to a driver login. The driver will only see quotations dispatched on their vehicle.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <Card key={v.id}>
              <CardContent className="grid gap-3 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div>
                  <Label className="text-xs">Vehicle number</Label>
                  <Input
                    value={v.vehicle_number}
                    onChange={(e) => setVehicles((prev) => prev.map((x) => x.id === v.id ? { ...x, vehicle_number: e.target.value } : x))}
                    onBlur={(e) => e.target.value !== v.vehicle_number && updateVehicle(v.id, { vehicle_number: e.target.value })}
                    className="font-mono"
                  />
                  <Input
                    placeholder="Label (e.g. Vehicle 1)"
                    value={v.label ?? ""}
                    onChange={(e) => setVehicles((prev) => prev.map((x) => x.id === v.id ? { ...x, label: e.target.value } : x))}
                    onBlur={(e) => updateVehicle(v.id, { label: e.target.value || null })}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Driver login</Label>
                  <Select
                    value={v.driver_user_id ?? "none"}
                    onValueChange={(val) => updateVehicle(v.id, { driver_user_id: val === "none" ? null : val })}
                  >
                    <SelectTrigger><SelectValue placeholder="Pick driver" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Not linked —</SelectItem>
                      {drivers.map((d) => (
                        <SelectItem key={d.user_id} value={d.user_id}>
                          {d.display_name || d.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeVehicle(v.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="grid gap-2 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div>
                <Label className="text-xs">New vehicle number</Label>
                <Input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="e.g. KL12G8207" className="font-mono" />
              </div>
              <div>
                <Label className="text-xs">Label (optional)</Label>
                <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Vehicle 3" />
              </div>
              <Button onClick={addVehicle} disabled={!newNumber.trim()}>
                <Plus className="mr-1.5 h-4 w-4" /> Add
              </Button>
            </CardContent>
          </Card>

          {drivers.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No users with the <span className="font-semibold">delivery</span> role yet. Create them under Staff Management first.
            </p>
          )}
        </div>
      )}
    </AdminShell>
  );
};

export default AdminVehicles;