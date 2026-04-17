import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type MainCat = { id: string; name: string; slug: string; display_order: number };
type SubCat = { id: string; main_category_id: string; name: string; slug: string; display_order: number };

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const AdminCategories = () => {
  const { isAdmin } = useAuth();
  const [mainCats, setMainCats] = useState<MainCat[]>([]);
  const [subCats, setSubCats] = useState<SubCat[]>([]);
  const [newMain, setNewMain] = useState("");
  const [newSub, setNewSub] = useState("");
  const [newSubParent, setNewSubParent] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: m }, { data: s }] = await Promise.all([
      supabase.from("main_categories").select("*").order("display_order"),
      supabase.from("sub_categories").select("*").order("display_order"),
    ]);
    setMainCats((m ?? []) as MainCat[]);
    setSubCats((s ?? []) as SubCat[]);
  };

  useEffect(() => { load(); }, []);

  const addMain = async () => {
    if (!newMain.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("main_categories").insert({
      name: newMain.trim(),
      slug: slugify(newMain),
      display_order: mainCats.length,
    });
    setBusy(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setNewMain("");
    toast({ title: "Category added" });
    load();
  };

  const addSub = async () => {
    if (!newSub.trim() || !newSubParent) return;
    setBusy(true);
    const siblings = subCats.filter((s) => s.main_category_id === newSubParent);
    const { error } = await supabase.from("sub_categories").insert({
      main_category_id: newSubParent,
      name: newSub.trim(),
      slug: slugify(newSub),
      display_order: siblings.length,
    });
    setBusy(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setNewSub("");
    toast({ title: "Sub-category added" });
    load();
  };

  const remove = async (table: "main_categories" | "sub_categories", id: string) => {
    if (!confirm("Delete this? This cannot be undone.")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Deleted" });
    load();
  };

  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="font-display text-3xl">Categories</h1>
        <p className="mt-1 text-muted-foreground">Organize your catalog with main categories and sub-categories.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Main categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Sofa, Bed, Wardrobe"
                value={newMain}
                onChange={(e) => setNewMain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMain()}
              />
              <Button onClick={addMain} disabled={busy || !newMain.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border bg-background">
              {mainCats.length === 0 && <li className="p-4 text-sm text-muted-foreground">No categories yet.</li>}
              {mainCats.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.slug}</p>
                  </div>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" onClick={() => remove("main_categories", c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Sub-categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Parent category</Label>
              <Select value={newSubParent} onValueChange={setNewSubParent}>
                <SelectTrigger><SelectValue placeholder="Choose main category" /></SelectTrigger>
                <SelectContent>
                  {mainCats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="e.g. L-Shape, 3-Seater"
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSub()}
                  disabled={!newSubParent}
                />
                <Button onClick={addSub} disabled={busy || !newSub.trim() || !newSubParent}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border bg-background">
              {subCats.length === 0 && <li className="p-4 text-sm text-muted-foreground">No sub-categories yet.</li>}
              {subCats.map((s) => {
                const parent = mainCats.find((m) => m.id === s.main_category_id);
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 p-3">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{parent?.name ?? "—"}</p>
                    </div>
                    {isAdmin && (
                      <Button size="icon" variant="ghost" onClick={() => remove("sub_categories", s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
};

export default AdminCategories;
