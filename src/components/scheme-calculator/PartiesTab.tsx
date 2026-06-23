import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Party } from "./types";

export function PartiesTab({ parties, setParties }: { parties: Party[]; setParties: (p: Party[]) => void }) {
  const empty = { name: "", phone: "", place: "", address: "", gst_number: "", category: "", notes: "" };
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const save = async () => {
    if (!form.name?.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (editingId) {
      const { data, error } = await supabase.from("scheme_parties").update(form).eq("id", editingId).select().single();
      if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
      setParties(parties.map((p) => (p.id === editingId ? (data as any) : p)));
      toast({ title: "Party updated" });
    } else {
      const { data, error } = await supabase.from("scheme_parties").insert(form).select().single();
      if (error) return toast({ title: "Create failed", description: error.message, variant: "destructive" });
      setParties([data as any, ...parties]);
      toast({ title: "Party created" });
    }
    setForm(empty); setEditingId(null);
  };

  const edit = (p: Party) => { setEditingId(p.id); setForm({ name: p.name, phone: p.phone || "", place: p.place || "", address: p.address || "", gst_number: p.gst_number || "", category: p.category || "", notes: p.notes || "" }); };
  const remove = async (id: string) => {
    if (!confirm("Delete this party?")) return;
    const { error } = await supabase.from("scheme_parties").delete().eq("id", id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    setParties(parties.filter((p) => p.id !== id));
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return parties;
    return parties.filter((p) => [p.name, p.phone, p.place, p.category].filter(Boolean).some((v) => String(v).toLowerCase().includes(s)));
  }, [parties, q]);

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-medium">{editingId ? "Edit party" : "Add party"}</h3>
        <div className="space-y-2">
          <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label className="text-xs">Place</Label><Input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">Address</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">GST number</Label><Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} /></div>
            <div><Label className="text-xs">Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Dealer / Retail / VIP" /></div>
          </div>
          <div><Label className="text-xs">Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1"><Save className="h-4 w-4" /> {editingId ? "Update" : "Save"}</Button>
            {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(empty); }}>Cancel</Button>}
          </div>
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">Saved parties</h3>
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Place</TableHead><TableHead>Phone</TableHead><TableHead>Category</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No parties yet</TableCell></TableRow>}
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.place}</TableCell>
                  <TableCell>{p.phone}</TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => edit(p)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
