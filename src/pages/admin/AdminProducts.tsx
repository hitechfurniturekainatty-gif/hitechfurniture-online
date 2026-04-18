import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { ImageUploader, type UploadedImage } from "@/components/admin/ImageUploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/brand";

type MainCat = { id: string; name: string };
type SubCat = { id: string; main_category_id: string; name: string };
type Product = {
  id: string;
  product_name: string;
  product_code: string;
  description: string | null;
  cost_price: number | null;
  mrp: number;
  offer_price: number | null;
  available_colors: string[] | null;
  material: string | null;
  dimensions: string | null;
  stock_quantity: number;
  is_featured: boolean;
  is_published: boolean;
  main_category_id: string;
  sub_category_id: string | null;
  product_images: { id: string; image_url: string; display_order: number }[];
};

type FormState = {
  product_name: string;
  product_code: string;
  description: string;
  cost_price: string;
  mrp: string;
  offer_price: string;
  available_colors: string;
  material: string;
  dimensions: string;
  stock_quantity: string;
  is_featured: boolean;
  is_published: boolean;
  main_category_id: string;
  sub_category_id: string;
  images: UploadedImage[];
};

const emptyForm: FormState = {
  product_name: "", product_code: "", description: "",
  cost_price: "", mrp: "", offer_price: "",
  available_colors: "", material: "", dimensions: "",
  stock_quantity: "0",
  is_featured: false, is_published: true,
  main_category_id: "", sub_category_id: "",
  images: [],
};

const AdminProducts = () => {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [mainCats, setMainCats] = useState<MainCat[]>([]);
  const [subCats, setSubCats] = useState<SubCat[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("products")
      .select("*, product_images(id, image_url, display_order)")
      .order("created_at", { ascending: false });
    setProducts((data ?? []) as Product[]);
  };

  useEffect(() => {
    load();
    supabase.from("main_categories").select("id, name").order("display_order").then(({ data }) => setMainCats((data ?? []) as MainCat[]));
    supabase.from("sub_categories").select("id, main_category_id, name").order("display_order").then(({ data }) => setSubCats((data ?? []) as SubCat[]));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.product_name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q));
  }, [products, search]);

  const subsForForm = subCats.filter((s) => s.main_category_id === form.main_category_id);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      product_name: p.product_name,
      product_code: p.product_code,
      description: p.description ?? "",
      cost_price: p.cost_price?.toString() ?? "",
      mrp: p.mrp.toString(),
      offer_price: p.offer_price?.toString() ?? "",
      available_colors: (p.available_colors ?? []).join(", "),
      material: p.material ?? "",
      dimensions: p.dimensions ?? "",
      stock_quantity: p.stock_quantity.toString(),
      is_featured: p.is_featured,
      is_published: p.is_published,
      main_category_id: p.main_category_id,
      sub_category_id: p.sub_category_id ?? "",
      images: p.product_images
        .sort((a, b) => a.display_order - b.display_order)
        .map((i) => ({ url: i.image_url, path: i.image_url })),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.product_name || !form.product_code || !form.mrp || !form.main_category_id) {
      toast({ title: "Missing required fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      product_name: form.product_name,
      product_code: form.product_code,
      description: form.description || null,
      mrp: Number(form.mrp),
      offer_price: form.offer_price ? Number(form.offer_price) : null,
      available_colors: form.available_colors
        ? form.available_colors.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      material: form.material || null,
      dimensions: form.dimensions || null,
      stock_quantity: Number(form.stock_quantity || 0),
      is_featured: form.is_featured,
      is_published: form.is_published,
      main_category_id: form.main_category_id,
      sub_category_id: form.sub_category_id || null,
    };
    if (isAdmin) payload.cost_price = form.cost_price ? Number(form.cost_price) : null;

    let productId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); return toast({ title: "Failed", description: error.message, variant: "destructive" }); }
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error || !data) { setSaving(false); return toast({ title: "Failed", description: error?.message, variant: "destructive" }); }
      productId = data.id;
    }

    // Sync images: delete all then re-insert in order (simple approach)
    if (productId) {
      await supabase.from("product_images").delete().eq("product_id", productId);
      if (form.images.length > 0) {
        const rows = form.images.map((img, i) => ({
          product_id: productId!,
          image_url: img.url,
          display_order: i,
        }));
        await supabase.from("product_images").insert(rows);
      }
    }

    setSaving(false);
    setOpen(false);
    toast({ title: editing ? "Product updated" : "Product created" });
    load();
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.product_name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Deleted" });
    load();
  };

  return (
    <AdminShell>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">{products.length} items in your catalog.</p>
        </div>
        <Button onClick={openNew} className="w-full sm:w-auto"><Plus className="mr-1 h-4 w-4" /> Add product</Button>
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or code…" className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {filtered.length === 0 && (
              <li className="p-12 text-center text-muted-foreground">No products yet. Click "Add product" to begin.</li>
            )}
            {filtered.map((p) => {
              const cover = p.product_images.sort((a, b) => a.display_order - b.display_order)[0]?.image_url;
              return (
                <li key={p.id} className="flex items-center gap-4 p-3 sm:p-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {cover ? <img src={cover} alt="" className="h-full w-full object-contain p-1" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{p.product_name}</p>
                      {p.is_featured && <Badge className="bg-accent text-accent-foreground">Featured</Badge>}
                      {!p.is_published && <Badge variant="secondary">Hidden</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">Code · {p.product_code}</p>
                    <p className="text-sm">
                      <span className="font-semibold text-primary">{formatINR(p.offer_price ?? p.mrp)}</span>
                      {" · "}
                      <span className={p.stock_quantity > 0 ? "text-foreground/70" : "text-destructive"}>
                        Stock {p.stock_quantity}
                      </span>
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" onClick={() => remove(p)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle className="font-display text-xl sm:text-2xl">
              {editing ? "Edit product" : "New product"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid flex-1 gap-4 overflow-y-auto px-4 py-4 sm:grid-cols-2 sm:px-6">
            <Field label="Product name *">
              <Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
            </Field>
            <Field label="Product code *">
              <Input value={form.product_code} onChange={(e) => setForm({ ...form, product_code: e.target.value })} placeholder="e.g. HS-234" />
            </Field>
            <Field label="Main category *">
              <Select value={form.main_category_id} onValueChange={(v) => setForm({ ...form, main_category_id: v, sub_category_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {mainCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Sub-category">
              <Select value={form.sub_category_id || "__none"} onValueChange={(v) => setForm({ ...form, sub_category_id: v === "__none" ? "" : v })} disabled={!form.main_category_id}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— None —</SelectItem>
                  {subsForForm.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="MRP (₹) *">
              <Input type="number" min={0} value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} />
            </Field>
            <Field label="Offer price (₹)">
              <Input type="number" min={0} value={form.offer_price} onChange={(e) => setForm({ ...form, offer_price: e.target.value })} />
            </Field>
            {isAdmin && (
              <Field label="Cost price (₹) — admin only">
                <Input type="number" min={0} value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
              </Field>
            )}
            <Field label="Stock quantity">
              <Input type="number" min={0} value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
            </Field>
            <Field label="Material">
              <Input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="e.g. Solid wood, fabric" />
            </Field>
            <Field label="Dimensions">
              <Input value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder='e.g. 84" x 36" x 32"' />
            </Field>
            <Field label="Available colors (comma-separated)" wide>
              <Input value={form.available_colors} onChange={(e) => setForm({ ...form, available_colors: e.target.value })} placeholder="e.g. Beige, Charcoal, Teal" />
            </Field>
            <Field label="Description" wide>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Images" wide>
              <ImageUploader value={form.images} onChange={(images) => setForm({ ...form, images })} />
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Featured on homepage</p>
                <p className="text-xs text-muted-foreground">Shown in the "Hand-picked" section.</p>
              </div>
              <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Published</p>
                <p className="text-xs text-muted-foreground">Hide to keep as draft.</p>
              </div>
              <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

const Field = ({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) => (
  <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export default AdminProducts;
