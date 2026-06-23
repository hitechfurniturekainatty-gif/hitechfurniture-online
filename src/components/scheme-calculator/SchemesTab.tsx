import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SchemeConfigEditor } from "./SchemeConfigEditor";
import { SCHEME_LABEL, defaultConfig } from "./utils";
import type { Period, SchemeKind, SchemeRow } from "./types";

export function SchemesTab({ schemes, setSchemes, onApply }: { schemes: SchemeRow[]; setSchemes: (s: SchemeRow[]) => void; onApply: (s: SchemeRow) => void }) {
  const [form, setForm] = useState<{ name: string; kind: SchemeKind; period: Period; config: any; notes: string }>(
    { name: "", kind: "company", period: "monthly", config: defaultConfig("company"), notes: "" }
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  const save = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (editingId) {
      const { data, error } = await supabase.from("scheme_rules").update(form).eq("id", editingId).select().single();
      if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
      setSchemes(schemes.map((s) => (s.id === editingId ? (data as any) : s)));
    } else {
      const { data, error } = await supabase.from("scheme_rules").insert(form).select().single();
      if (error) return toast({ title: "Create failed", description: error.message, variant: "destructive" });
      setSchemes([data as any, ...schemes]);
    }
    setForm({ name: "", kind: "company", period: "monthly", config: defaultConfig("company"), notes: "" });
    setEditingId(null);
    toast({ title: "Saved" });
  };

  const edit = (s: SchemeRow) => {
    setEditingId(s.id);
    setForm({ name: s.name, kind: s.kind, period: s.period, config: s.config || defaultConfig(s.kind), notes: s.notes || "" });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this scheme?")) return;
    const { error } = await supabase.from("scheme_rules").delete().eq("id", id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    setSchemes(schemes.filter((s) => s.id !== id));
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-medium">{editingId ? "Edit scheme" : "New scheme"}</h3>
        <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diwali Dealer Slab" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as SchemeKind, config: defaultConfig(v as SchemeKind) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(SCHEME_LABEL) as SchemeKind[]).map((k) => (<SelectItem key={k} value={k}>{SCHEME_LABEL[k]}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Period</Label>
            <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v as Period })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <SchemeConfigEditor scheme={{ kind: form.kind, config: form.config }} onChange={(config) => setForm({ ...form, config })} />
        <div><Label className="text-xs">Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="flex gap-2">
          <Button onClick={save} className="flex-1"><Save className="h-4 w-4" /> {editingId ? "Update" : "Save scheme"}</Button>
          {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm({ name: "", kind: "company", period: "monthly", config: defaultConfig("company"), notes: "" }); }}>Cancel</Button>}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 font-medium">Saved schemes</h3>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Period</TableHead><TableHead className="w-40"></TableHead></TableRow></TableHeader>
          <TableBody>
            {schemes.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No schemes yet</TableCell></TableRow>}
            {schemes.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{SCHEME_LABEL[s.kind]}</TableCell>
                <TableCell className="capitalize">{s.period}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => onApply(s)}>Apply</Button>
                    <Button size="icon" variant="ghost" onClick={() => edit(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
