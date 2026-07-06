import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Search, AlertTriangle, GripVertical, RefreshCw } from "lucide-react";
import { formatINR } from "@/lib/brand";
import { useDraggable } from "@dnd-kit/core";

// Row shape from the `products_staff_catalog` view. `cost_price` deliberately
// is NOT selected below — it must never reach this panel's state or render.
export type CatalogProduct = {
  id: string;
  product_name: string;
  product_code: string;
  mrp: number;
  offer_price: number | null;
  stock_status: string | null;
  primary_image_url: string | null;
  main_category_id: string | null;
  sub_category_id: string | null;
};

type MainCat = { id: string; name: string; image_url: string | null };
type SubCat = { id: string; main_category_id: string; name: string; image_url: string | null };

const DraggableProductCard = ({ p, onPick }: { p: CatalogProduct; onPick: (p: CatalogProduct) => void }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `catalog-product-${p.id}`,
    data: { product: p },
  });
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border bg-card p-2 text-left shadow-sm transition-smooth ${
        isDragging ? "opacity-50" : "hover:border-primary hover:bg-muted"
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 -m-1 text-muted-foreground active:cursor-grabbing shrink-0"
        aria-label={`Drag ${p.product_name} into the quotation`}
        title="Drag into the quotation form"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded bg-muted">
        {p.primary_image_url && (
          <img src={p.primary_image_url} alt="" className="h-full w-full object-contain p-0.5" />
        )}
      </div>
      <button type="button" onClick={() => onPick(p)} className="min-w-0 flex-1 text-left" title="Click to add">
        <p className="truncate text-sm font-medium">{p.product_name}</p>
        <p className="truncate text-xs text-muted-foreground">{p.product_code}</p>
      </button>
      <span className="shrink-0 font-mono text-xs">{formatINR(p.offer_price ?? p.mrp)}</span>
    </div>
  );
};

export const CatalogDndPanel = ({ onPick }: { onPick: (p: CatalogProduct) => void }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [mainCats, setMainCats] = useState<MainCat[]>([]);
  const [subCats, setSubCats] = useState<SubCat[]>([]);
  const [mainId, setMainId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    const [prRes, mcRes, scRes] = await Promise.all([
      (supabase as any)
        .from("products_staff_catalog")
        .select(
          "id, product_name, product_code, mrp, offer_price, stock_status, primary_image_url, main_category_id, sub_category_id",
        )
        .order("product_name", { ascending: true })
        .limit(1000),
      supabase.from("main_categories").select("id, name, image_url").is("deleted_at", null).order("display_order"),
      supabase
        .from("sub_categories")
        .select("id, main_category_id, name, image_url")
        .is("deleted_at", null)
        .order("display_order"),
    ]);
    if (prRes.error) {
      setError(prRes.error.message || "Couldn't load the catalog");
      setLoading(false);
      return;
    }
    setProducts((prRes.data ?? []) as CatalogProduct[]);
    setMainCats((mcRes.data ?? []) as MainCat[]);
    setSubCats((scRes.data ?? []) as SubCat[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const needle = search.trim().toLowerCase();
  const searching = needle.length > 0;

  const searchResults = useMemo(() => {
    if (!searching) return [];
    return products.filter(
      (p) =>
        p.product_name.toLowerCase().includes(needle) || p.product_code.toLowerCase().includes(needle),
    );
  }, [products, needle, searching]);

  const visibleSubCats = useMemo(
    () => subCats.filter((s) => s.main_category_id === mainId),
    [subCats, mainId],
  );
  const countInMain = (id: string) => products.filter((p) => p.main_category_id === id).length;
  const countInSub = (id: string) => products.filter((p) => p.sub_category_id === id).length;
  const modelsInSub = useMemo(
    () => products.filter((p) => p.sub_category_id === subId),
    [products, subId],
  );
  // Some categories have no sub-category tier — fall back to listing that
  // main category's products directly.
  const modelsInMainDirect = useMemo(
    () => products.filter((p) => p.main_category_id === mainId && !p.sub_category_id),
    [products, mainId],
  );

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Loading catalog…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
        {(mainId || subId) && !searching && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 shrink-0 px-2"
            onClick={() => (subId ? setSubId(null) : setMainId(null))}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {searching ? (
          searchResults.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No products match "{search}".</p>
          ) : (
            <div className="space-y-1.5">
              {searchResults.map((p) => (
                <DraggableProductCard key={p.id} p={p} onPick={onPick} />
              ))}
            </div>
          )
        ) : subId ? (
          modelsInSub.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No items in this category yet.</p>
          ) : (
            <div className="space-y-1.5">
              {modelsInSub.map((p) => (
                <DraggableProductCard key={p.id} p={p} onPick={onPick} />
              ))}
            </div>
          )
        ) : mainId ? (
          visibleSubCats.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {visibleSubCats.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSubId(s.id)}
                  className="flex flex-col items-center gap-1.5 rounded-lg border bg-card p-2 text-center transition-smooth hover:border-primary hover:bg-muted"
                >
                  <div className="h-14 w-14 overflow-hidden rounded bg-muted">
                    {s.image_url && <img src={s.image_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <p className="line-clamp-2 text-xs font-medium">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground">{countInSub(s.id)} items</p>
                </button>
              ))}
            </div>
          ) : modelsInMainDirect.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No items in this category yet.</p>
          ) : (
            <div className="space-y-1.5">
              {modelsInMainDirect.map((p) => (
                <DraggableProductCard key={p.id} p={p} onPick={onPick} />
              ))}
            </div>
          )
        ) : mainCats.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No categories set up yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {mainCats.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMainId(m.id)}
                className="flex flex-col items-center gap-1.5 rounded-lg border bg-card p-2 text-center transition-smooth hover:border-primary hover:bg-muted"
              >
                <div className="h-14 w-14 overflow-hidden rounded bg-muted">
                  {m.image_url && <img src={m.image_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <p className="line-clamp-2 text-xs font-medium">{m.name}</p>
                <p className="text-[10px] text-muted-foreground">{countInMain(m.id)} items</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
