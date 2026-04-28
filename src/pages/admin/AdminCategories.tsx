import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { ImageUploader, type UploadedImage } from "@/components/admin/ImageUploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, Loader2, ImageIcon, Pencil, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { scrollFocusedIntoView } from "@/lib/mobileFocusScroll";

type MainCat = { id: string; name: string; slug: string; display_order: number; image_url: string | null };
type SubCat = { id: string; main_category_id: string; name: string; slug: string; display_order: number; image_url: string | null };

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type EditMainState = { id: string; name: string; image: UploadedImage[] } | null;
type EditSubState = { id: string; name: string; main_category_id: string; image: UploadedImage[] } | null;

const AdminCategories = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [mainCats, setMainCats] = useState<MainCat[]>([]);
  const [subCats, setSubCats] = useState<SubCat[]>([]);
  const [newMain, setNewMain] = useState("");
  const [newMainImg, setNewMainImg] = useState<UploadedImage[]>([]);
  const [newSub, setNewSub] = useState("");
  const [newSubParent, setNewSubParent] = useState<string>("");
  const [newSubImg, setNewSubImg] = useState<UploadedImage[]>([]);
  const [busy, setBusy] = useState(false);

  const [editMain, setEditMain] = useState<EditMainState>(null);
  const [editSub, setEditSub] = useState<EditSubState>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const load = async () => {
    const [{ data: m }, { data: s }] = await Promise.all([
      supabase.from("main_categories").select("*").is("deleted_at", null).order("display_order"),
      supabase.from("sub_categories").select("*").is("deleted_at", null).order("display_order"),
    ]);
    setMainCats((m ?? []) as MainCat[]);
    setSubCats((s ?? []) as SubCat[]);
  };

  useEffect(() => { load(); }, []);

  // Persist a new order for main categories. Optimistic UI + parallel writes.
  const persistMainOrder = async (next: MainCat[]) => {
    const prev = mainCats;
    const withOrder = next.map((c, i) => ({ ...c, display_order: i }));
    setMainCats(withOrder);
    setReordering(true);
    const updates = withOrder
      .filter((c, i) => prev.find((o) => o.id === c.id)?.display_order !== i)
      .map((c) =>
        supabase.from("main_categories").update({ display_order: c.display_order }).eq("id", c.id)
      );
    const results = await Promise.all(updates);
    setReordering(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast({ title: "Reorder failed", description: failed.error.message, variant: "destructive" });
      load();
    } else {
      toast({ title: "Order saved" });
    }
  };

  const moveMain = (id: string, dir: -1 | 1) => {
    const idx = mainCats.findIndex((c) => c.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= mainCats.length) return;
    const next = [...mainCats];
    [next[idx], next[target]] = [next[target], next[idx]];
    persistMainOrder(next);
  };

  const onDropMain = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const from = mainCats.findIndex((c) => c.id === dragId);
    const to = mainCats.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) { setDragId(null); return; }
    const next = [...mainCats];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragId(null);
    persistMainOrder(next);
  };

  const addMain = async () => {
    if (!newMain.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("main_categories").insert({
      name: newMain.trim(),
      slug: slugify(newMain),
      display_order: mainCats.length,
      image_url: newMainImg[0]?.url ?? null,
    });
    setBusy(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setNewMain("");
    setNewMainImg([]);
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
      image_url: newSubImg[0]?.url ?? null,
    });
    setBusy(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setNewSub("");
    setNewSubImg([]);
    toast({ title: "Sub-category added" });
    load();
  };

  const remove = async (table: "main_categories" | "sub_categories", id: string) => {
    if (!confirm("Move this to Trash? You can restore it for 30 days.")) return;
    const { softDelete } = await import("@/lib/softDelete");
    const { error } = await softDelete(table, id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    if (table === "main_categories") setMainCats((prev) => prev.filter((c) => c.id !== id));
    else setSubCats((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Moved to Trash" });
    load();
  };

  const startEditMain = (c: MainCat) => {
    setEditMain({
      id: c.id,
      name: c.name,
      image: c.image_url ? [{ url: c.image_url, path: c.image_url }] : [],
    });
  };

  const saveEditMain = async () => {
    if (!editMain || !editMain.name.trim()) return;
    setSavingEdit(true);
    const { error } = await supabase.from("main_categories").update({
      name: editMain.name.trim(),
      slug: slugify(editMain.name),
      image_url: editMain.image[0]?.url ?? null,
    }).eq("id", editMain.id);
    setSavingEdit(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Category updated" });
    setEditMain(null);
    load();
  };

  const startEditSub = (s: SubCat) => {
    setEditSub({
      id: s.id,
      name: s.name,
      main_category_id: s.main_category_id,
      image: s.image_url ? [{ url: s.image_url, path: s.image_url }] : [],
    });
  };

  const saveEditSub = async () => {
    if (!editSub || !editSub.name.trim() || !editSub.main_category_id) return;
    setSavingEdit(true);
    const { error } = await supabase.from("sub_categories").update({
      name: editSub.name.trim(),
      slug: slugify(editSub.name),
      main_category_id: editSub.main_category_id,
      image_url: editSub.image[0]?.url ?? null,
    }).eq("id", editSub.id);
    setSavingEdit(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Sub-category updated" });
    setEditSub(null);
    load();
  };

  return (
    <AdminShell>
      {!authLoading && !isAdmin && (
        <div className="rounded-xl border bg-card p-6 text-center">
          <h1 className="font-display text-xl">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don't have permission to view Categories.</p>
        </div>
      )}
      {!authLoading && isAdmin && (<>
      <div className="mb-6 sm:mb-8">
        <h1 className="font-display text-2xl sm:text-3xl">Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">Organize your catalog with main categories and sub-categories.</p>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="font-display">Main categories</CardTitle>
            <p className="text-xs text-muted-foreground">Drag the handle (or use arrows) to reorder. Top items appear first on the homepage and catalog.</p>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6">
            <div className="space-y-3">
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
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cover image (optional)</Label>
                <div className="mt-1.5">
                  <ImageUploader value={newMainImg} onChange={setNewMainImg} />
                </div>
              </div>
            </div>
            <ul className="space-y-2">
              {mainCats.length === 0 && (
                <li className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                  No categories yet.
                </li>
              )}
              {mainCats.map((c, idx) => (
                <li
                  key={c.id}
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); onDropMain(c.id); }}
                  onDragEnd={() => setDragId(null)}
                  className={`flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-opacity ${dragId === c.id ? "opacity-50" : ""}`}
                >
                  <button
                    type="button"
                    aria-label="Drag to reorder"
                    className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} className="h-full w-full object-contain p-1" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">/{c.slug}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {subCats.filter((s) => s.main_category_id === c.id).length} sub-categories
                    </p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveMain(c.id, -1)} disabled={idx === 0 || reordering} aria-label="Move up">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveMain(c.id, 1)} disabled={idx === mainCats.length - 1 || reordering} aria-label="Move down">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => startEditMain(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
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

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="font-display">Sub-categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6">
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Parent category</Label>
                <Select value={newSubParent} onValueChange={setNewSubParent}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Choose main category" /></SelectTrigger>
                  <SelectContent>
                    {mainCats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. L-Shape, 3-Seater"
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSub()}
                  disabled={!newSubParent}
                />
                <Button onClick={addSub} disabled={busy || !newSub.trim() || !newSubParent}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cover image (optional)</Label>
                <div className="mt-1.5">
                  <ImageUploader value={newSubImg} onChange={setNewSubImg} />
                </div>
              </div>
            </div>
            <ul className="space-y-2">
              {subCats.length === 0 && (
                <li className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                  No sub-categories yet.
                </li>
              )}
              {subCats.map((s) => {
                const parent = mainCats.find((m) => m.id === s.main_category_id);
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-4 rounded-lg border border-border bg-background p-3"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                      {s.image_url ? (
                        <img src={s.image_url} alt={s.name} className="h-full w-full object-contain p-1" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{parent?.name ?? "—"} · /{s.slug}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => startEditSub(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
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

      {/* Edit Main Category Dialog */}
      <Dialog open={!!editMain} onOpenChange={(o) => !o && setEditMain(null)}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle className="font-display text-xl sm:text-2xl">Edit main category</DialogTitle>
          </DialogHeader>
          {editMain && (
            <div
              className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6"
              onFocusCapture={scrollFocusedIntoView}
            >
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
                <Input
                  value={editMain.name}
                  onChange={(e) => setEditMain({ ...editMain, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cover image</Label>
                <ImageUploader
                  value={editMain.image}
                  onChange={(image) => setEditMain({ ...editMain, image })}
                />
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:px-6 sm:py-4">
            <Button variant="outline" onClick={() => setEditMain(null)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={saveEditMain} disabled={savingEdit || !editMain?.name.trim()} className="w-full sm:w-auto">
              {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sub Category Dialog */}
      <Dialog open={!!editSub} onOpenChange={(o) => !o && setEditSub(null)}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle className="font-display text-xl sm:text-2xl">Edit sub-category</DialogTitle>
          </DialogHeader>
          {editSub && (
            <div
              className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6"
              onFocusCapture={scrollFocusedIntoView}
            >
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Parent category</Label>
                <Select
                  value={editSub.main_category_id}
                  onValueChange={(v) => setEditSub({ ...editSub, main_category_id: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {mainCats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
                <Input
                  value={editSub.name}
                  onChange={(e) => setEditSub({ ...editSub, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cover image</Label>
                <ImageUploader
                  value={editSub.image}
                  onChange={(image) => setEditSub({ ...editSub, image })}
                />
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:px-6 sm:py-4">
            <Button variant="outline" onClick={() => setEditSub(null)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={saveEditSub} disabled={savingEdit || !editSub?.name.trim()} className="w-full sm:w-auto">
              {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>)}
    </AdminShell>
  );
};

export default AdminCategories;
