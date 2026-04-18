import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Trash2, Pencil, MessageCircle, HardHat } from "lucide-react";

type Worker = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp_number: string;
  trade: string | null;
  notes: string | null;
  is_active: boolean;
};

const empty = { name: "", phone: "", whatsapp_number: "", trade: "", notes: "", is_active: true };

const AdminWorkers = () => {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("workers").select("*").order("created_at", { ascending: false });
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    else setRows(data as Worker[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (w: Worker) => {
    setEditing(w);
    setForm({ name: w.name, phone: w.phone ?? "", whatsapp_number: w.whatsapp_number, trade: w.trade ?? "", notes: w.notes ?? "", is_active: w.is_active });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.whatsapp_number.trim()) {
      toast({ title: "Name and WhatsApp number required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      whatsapp_number: form.whatsapp_number.trim(),
      trade: form.trade.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("workers").update(payload).eq("id", editing.id)
      : await supabase.from("workers").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Worker updated" : "Worker added" });
    setOpen(false);
    load();
  };

  const remove = async (w: Worker) => {
    if (!confirm(`Remove ${w.name}?`)) return;
    const { error } = await supabase.from("workers").delete().eq("id", w.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Worker removed" });
    load();
  };

  return (
    <AdminShell>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Workers</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">Contacts for assigning Job Work Orders via WhatsApp.</p>
        </div>
        <Button onClick={startNew} className="w-full sm:w-auto"><UserPlus className="mr-2 h-4 w-4" /> Add worker</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((w) => (
            <Card key={w.id} className={!w.is_active ? "opacity-60" : ""}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="flex gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <HardHat className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{w.name}</p>
                    {w.trade && <p className="text-xs text-muted-foreground">{w.trade}</p>}
                    <p className="mt-1 text-sm flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-primary" /> {w.whatsapp_number}</p>
                    {w.phone && w.phone !== w.whatsapp_number && <p className="text-xs text-muted-foreground">Call: {w.phone}</p>}
                    {!w.is_active && <Badge variant="outline" className="mt-1">Inactive</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(w)}><Pencil className="h-4 w-4" /></Button>
                  {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove(w)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </div>
              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">No workers yet. Add your first one.</p>}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit worker" : "Add worker"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>WhatsApp number * (with country code, e.g. 919526610404)</Label><Input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="91XXXXXXXXXX" /></div>
            <div className="space-y-1.5"><Label>Phone (optional)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Trade</Label><Input value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} placeholder="Carpenter, Polish, Upholstery..." /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <div className="flex items-center justify-between rounded-md border p-3"><Label>Active</Label><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default AdminWorkers;
