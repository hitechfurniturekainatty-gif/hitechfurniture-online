import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { OfficeStaffOnly } from "@/components/admin/OfficeStaffOnly";
import { ImageUploader, type UploadedImage } from "@/components/admin/ImageUploader";
import { AutoSuggestInput, type Suggestion } from "@/components/admin/AutoSuggestInput";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, PackagePlus, RefreshCw, Sparkles } from "lucide-react";

type MainCat = { id: string; name: string };
type SubCat = { id: string; main_category_id: string; name: string };
type MatchedProduct = {
  id: string;
  product_name: string;
  mrp: number;
  description: string | null;
  main_category_id: string;
  sub_category_id: string | null;
  is_published: boolean;
  stock_quantity: number;
};

const AdminInventoryReceiving = () => {
  const [mainCats, setMainCats] = useState<MainCat[]>([]);
  const [subCats, setSubCats] = useState<SubCat[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  // Form state
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [name, setName] = useState("");
  const [mainCatId, setMainCatId] = useState("");
  const [subCatId, setSubCatId] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("");
  const [supplierNote, setSupplierNote] = useState("");

  // Match state (set when user picks from autosuggest)
  const [matchedProduct, setMatchedProduct] = useState<MatchedProduct | null>(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("main_categories").select("id, name").is("deleted_at", null).order("display_order"),
      supabase.from("sub_categories").select("id, main_category_id, name").is("deleted_at", null).order("display_order"),
    ]).then(([mc, sc]) => {
      setMainCats((mc.data ?? []) as MainCat[]);
      setSubCats((sc.data ?? []) as SubCat[]);
      setLoadingCats(false);
    });
  }, []);

  const filteredSubs = subCats.filter((s) => s.main_category_id === mainCatId);

  const fetchSuggestions = async (query: string): Promise<Suggestion<MatchedProduct>[]> => {
    if (query.length < 2) return [];
    const { data } = await supabase
      .from("products")
      .select("id, product_name, mrp, description, main_category_id, sub_category_id, is_published, stock_quantity, product_images(image_url, display_order)")
      .ilike("product_name", `%${query}%`)
      .is("deleted_at", null)
      .order("product_name")
      .limit(8);
    return ((data ?? []) as any[]).map((p) => ({
      label: p.product_name,
      sub: `₹${p.mrp} · stock: ${p.stock_quantity}`,
      image: (p.product_images as any[] ?? []).sort((a: any, b: any) => a.display_order - b.display_order)[0]?.image_url ?? null,
      data: p as MatchedProduct,
    }));
  };

  const onPickProduct = (s: Suggestion<MatchedProduct>) => {
    const p = s.data!;
    setMatchedProduct(p);
    setName(p.product_name);
    setMainCatId(p.main_category_id);
    setSubCatId(p.sub_category_id ?? "");
    setPrice(p.mrp.toString());
    setDescription(p.description ?? "");
  };

  const clearMatch = () => {
    setMatchedProduct(null);
    setName("");
    setMainCatId("");
    setSubCatId("");
    setPrice("");
    setDescription("");
  };

  const submit = async () => {
    if (!name.trim()) return toast({ title: "Item name required", variant: "destructive" });
    if (!mainCatId) return toast({ title: "Category required", variant: "destructive" });
    const n = parseInt(qty, 10);
    if (!n || n <= 0) return toast({ title: "Quantity must be > 0", variant: "destructive" });

    setSubmitting(true);

    // Resolve match: autosuggest pick OR case-insensitive DB lookup
    let resolved: MatchedProduct | null = matchedProduct;
    if (!resolved) {
      const { data } = await supabase
        .from("products")
        .select("id, product_name, mrp, description, main_category_id, sub_category_id, is_published, stock_quantity")
        .ilike("product_name", name.trim())
        .is("deleted_at", null)
        .maybeSingle();
      if (data) resolved = data as MatchedProduct;
    }

    const isRestock = !!resolved;
    const priceNum = price ? Number(price) : 0;
    const canPublish = images.length > 0 && !!name.trim() && !!mainCatId && priceNum > 0;

    if (isRestock && resolved) {
      // Only update fields the user explicitly changed from the pre-filled values
      const updates: Record<string, unknown> = {};
      if (priceNum && priceNum !== resolved.mrp) updates.mrp = priceNum;
      if (mainCatId !== resolved.main_category_id) updates.main_category_id = mainCatId;
      if ((subCatId || null) !== resolved.sub_category_id) updates.sub_category_id = subCatId || null;
      if ((description || null) !== resolved.description) updates.description = description || null;
      // Auto-flip draft → published if all 4 required fields are now present
      if (canPublish && !resolved.is_published) updates.is_published = true;

      if (Object.keys(updates).length > 0) {
        const { error: upErr } = await supabase.from("products").update(updates).eq("id", resolved.id);
        if (upErr) {
          toast({ title: "Failed to update product", description: upErr.message, variant: "destructive" });
          setSubmitting(false);
          return;
        }
      }

      // Stock movement (trigger bumps stock_quantity)
      const { error: smErr } = await supabase.from("stock_movements").insert({
        product_id: resolved.id,
        change_qty: n,
        reason: "inbound_receive",
        note: supplierNote || null,
        resulting_stock: 0,
      } as any);
      if (smErr) {
        toast({ title: "Failed to record stock movement", description: smErr.message, variant: "destructive" });
        setSubmitting(false);
        return;
      }

      // Add any new photos
      if (images.length > 0) {
        await supabase.from("product_images").insert(
          images.map((img, i) => ({
            product_id: resolved!.id,
            image_url: img.url,
            display_order: 1000 + i,
          })),
        );
      }

      toast({ title: `Restocked ${n} units`, description: resolved.product_name });
    } else {
      // New product — create, then insert stock movement so trigger sets stock_quantity
      const { data: newProd, error: insertErr } = await supabase
        .from("products")
        .insert({
          product_name: name.trim(),
          product_code: `Auto-${Date.now().toString(36)}`,
          description: description || null,
          mrp: priceNum,
          main_category_id: mainCatId,
          sub_category_id: subCatId || null,
          stock_quantity: 0,
          is_published: canPublish,
          stock_status: n > 0 ? "in_stock" : "out_of_stock",
        } as any)
        .select("id")
        .single();

      if (insertErr || !newProd) {
        toast({ title: "Failed to create product", description: insertErr?.message, variant: "destructive" });
        setSubmitting(false);
        return;
      }

      // Stock movement triggers the stock_quantity bump
      await supabase.from("stock_movements").insert({
        product_id: newProd.id,
        change_qty: n,
        reason: "inbound_receive",
        note: supplierNote || null,
        resulting_stock: 0,
      } as any);

      // Photos
      if (images.length > 0) {
        await supabase.from("product_images").insert(
          images.map((img, i) => ({
            product_id: newProd.id,
            image_url: img.url,
            display_order: i + 1,
          })),
        );
      }

      toast({
        title: canPublish ? "Product added & published" : "Saved as draft",
        description: canPublish
          ? `${name.trim()} is now live in the catalog.`
          : "Missing photo, category, or price — find it in Products → Drafts to complete.",
      });
    }

    // Reset form
    setImages([]);
    setName("");
    setMatchedProduct(null);
    setMainCatId("");
    setSubCatId("");
    setPrice("");
    setDescription("");
    setQty("");
    setSupplierNote("");
    setSubmitting(false);
  };

  return (
    <OfficeStaffOnly>
      <AdminShell>
        <div className="container-page max-w-xl space-y-4 py-6">
          <div className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl">Stock Intake</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            New stock arrival. Matching an existing product name restocks it; a new name creates a product and publishes it automatically if photo + category + price are filled.
          </p>

          {loadingCats ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Card>
              <CardContent className="space-y-5 p-4 sm:p-5">

                {/* 1. Photo */}
                <div className="space-y-1.5">
                  <Label>
                    Photo
                    <span className="ml-1 text-xs text-muted-foreground">(required to publish)</span>
                  </Label>
                  <ImageUploader value={images} onChange={setImages} />
                </div>

                {/* 2. Item name */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Item name *</Label>
                    {matchedProduct && (
                      <button
                        type="button"
                        onClick={clearMatch}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <RefreshCw className="h-3 w-3" /> Clear match
                      </button>
                    )}
                  </div>
                  <AutoSuggestInput
                    value={name}
                    onChange={(v) => {
                      setName(v);
                      if (matchedProduct && v !== matchedProduct.product_name) setMatchedProduct(null);
                    }}
                    onPick={onPickProduct}
                    fetchSuggestions={fetchSuggestions}
                    placeholder="Type to search existing products…"
                    minChars={2}
                  />
                  {matchedProduct && (
                    <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        <strong>Restock</strong> — {matchedProduct.product_name} · current stock: {matchedProduct.stock_quantity}
                      </span>
                    </div>
                  )}
                  {!matchedProduct && name.trim().length >= 2 && (
                    <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span><strong>New product</strong> — will be created on submit</span>
                    </div>
                  )}
                </div>

                {/* 3. Category */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Main category *</Label>
                    <Select
                      value={mainCatId}
                      onValueChange={(v) => { setMainCatId(v); setSubCatId(""); }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
                      <SelectContent>
                        {mainCats.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {filteredSubs.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>Sub-category</Label>
                      <Select value={subCatId || "none"} onValueChange={(v) => setSubCatId(v === "none" ? "" : v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {filteredSubs.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* 4. Price */}
                <div className="space-y-1.5">
                  <Label>Price (MRP ₹) *</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 12500"
                  />
                </div>

                {/* 5. Description */}
                <div className="space-y-1.5">
                  <Label>Description <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <Textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Material, finish, notes…"
                  />
                </div>

                {/* 6. Quantity */}
                <div className="space-y-1.5">
                  <Label>Quantity received *</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="e.g. 4"
                  />
                </div>

                {/* 7. Supplier ref */}
                <div className="space-y-1.5">
                  <Label>Supplier reference / note <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <Input
                    value={supplierNote}
                    onChange={(e) => setSupplierNote(e.target.value)}
                    placeholder="GRN / Invoice # / supplier name"
                  />
                </div>

                {/* Publish status preview */}
                <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">After submit:</span>
                  {images.length > 0 && name.trim() && mainCatId && price && Number(price) > 0 ? (
                    <Badge variant="default" className="bg-emerald-600">Will publish to catalog</Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-400 text-amber-700">Will save as draft</Badge>
                  )}
                  {!(images.length > 0) && <span className="text-xs text-muted-foreground">missing: photo</span>}
                  {!mainCatId && <span className="text-xs text-muted-foreground">· category</span>}
                  {(!price || Number(price) <= 0) && <span className="text-xs text-muted-foreground">· price</span>}
                </div>

                <Button onClick={submit} disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {matchedProduct ? "Record restock" : "Add product & record stock"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </AdminShell>
    </OfficeStaffOnly>
  );
};

export default AdminInventoryReceiving;
