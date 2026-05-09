import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, Loader2, Sparkles, X, MapPin, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/imageCompression";
import { formatINR } from "@/lib/brand";

type Match = { product_id: string; confidence: number; reason: string };
type ResultRow = {
  match: Match;
  product: {
    id: string;
    product_name: string;
    product_code: string;
    mrp: number;
    offer_price: number | null;
    cover: string | null;
    locations: { building: string; floor: string; section: string | null; quantity: number; color?: string | null }[];
  };
};

/**
 * SnapSearch — staff-only AI vision lookup.
 * Snap or upload a photo → AI compares against the catalog → list of matching
 * products with price + every physical location they're stocked in.
 */
export const SnapSearchDialog = ({
  open,
  onOpenChange,
  catalogPin,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  catalogPin: string;
}) => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setImage(null);
    setResults(null);
    setLoading(false);
  };

  const handleFile = async (file: File) => {
    try {
      const compressed = await compressImage(file);
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(new Error("read failed"));
        r.readAsDataURL(compressed);
      });
      setImage(dataUrl);
      setResults(null);
    } catch (e) {
      toast({ title: "Image read failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const identify = async () => {
    if (!image) return;
    setLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("snap-search", {
        body: { image, catalog_pin: catalogPin },
      });
      if (error) throw new Error(error.message);
      const matches: Match[] = data?.matches ?? [];
      if (matches.length === 0) {
        setResults([]);
        return;
      }
      // Hydrate matches with product details + every stocked location.
      const ids = matches.map((m) => m.product_id);
      const { data: prods } = await supabase
        .from("products")
        .select("id, product_name, product_code, mrp, offer_price, location_id, stock_quantity, product_images(image_url, display_order), product_variants(color_name, image_url, location_id, stock_quantity, product_variant_stock(location_id, quantity))")
        .in("id", ids);
      const { data: locs } = await supabase
        .from("product_locations")
        .select("id, building, floor, section");
      const locMap = new Map((locs ?? []).map((l) => [l.id as string, l]));

      const rows: ResultRow[] = matches
        .map((m) => {
          const p = (prods ?? []).find((x) => x.id === m.product_id);
          if (!p) return null;
          const cover = (p.product_images ?? [])
            .slice()
            .sort((a, b) => a.display_order - b.display_order)[0]?.image_url ?? null;

          const locations: ResultRow["product"]["locations"] = [];
          // Per-variant stock rows (color-specific)
          for (const v of (p.product_variants ?? [])) {
            for (const s of (v.product_variant_stock ?? [])) {
              if (!s.quantity || s.quantity <= 0) continue;
              const l = locMap.get(s.location_id as string);
              if (!l) continue;
              locations.push({
                building: l.building as string,
                floor: l.floor as string,
                section: (l.section as string | null) ?? null,
                quantity: s.quantity as number,
                color: v.color_name as string,
              });
            }
            // Variant pinned location (legacy)
            if (v.location_id && (!v.product_variant_stock || v.product_variant_stock.length === 0) && (v.stock_quantity ?? 0) > 0) {
              const l = locMap.get(v.location_id as string);
              if (l) locations.push({
                building: l.building as string,
                floor: l.floor as string,
                section: (l.section as string | null) ?? null,
                quantity: v.stock_quantity as number,
                color: v.color_name as string,
              });
            }
          }
          // Product main location fallback
          if (locations.length === 0 && p.location_id) {
            const l = locMap.get(p.location_id as string);
            if (l) locations.push({
              building: l.building as string,
              floor: l.floor as string,
              section: (l.section as string | null) ?? null,
              quantity: p.stock_quantity as number,
            });
          }

          return {
            match: m,
            product: {
              id: p.id as string,
              product_name: p.product_name as string,
              product_code: p.product_code as string,
              mrp: p.mrp as number,
              offer_price: (p.offer_price as number | null) ?? null,
              cover,
              locations,
            },
          } as ResultRow;
        })
        .filter((x): x is ResultRow => !!x);
      setResults(rows);
    } catch (e) {
      toast({
        title: "SnapSearch failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg">
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            SnapSearch
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Snap a photo of any item on the floor — AI finds it in your catalog with price &amp; location.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
          {/* Image picker */}
          <div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />

            {image ? (
              <div className="relative overflow-hidden rounded-lg border bg-muted">
                <img src={image} alt="snap" className="max-h-72 w-full object-contain" />
                <button
                  type="button"
                  onClick={() => { setImage(null); setResults(null); }}
                  className="absolute right-2 top-2 rounded-full bg-foreground/80 p-1 text-background hover:bg-foreground"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="default" size="lg" onClick={() => cameraRef.current?.click()} className="h-24 flex-col gap-1.5">
                  <Camera className="h-6 w-6" />
                  Take photo
                </Button>
                <Button variant="outline" size="lg" onClick={() => fileRef.current?.click()} className="h-24 flex-col gap-1.5">
                  <Upload className="h-6 w-6" />
                  Upload image
                </Button>
              </div>
            )}
          </div>

          {image && !loading && (
            <Button onClick={identify} className="w-full" size="lg">
              <Search className="mr-2 h-4 w-4" /> Identify product
            </Button>
          )}

          {/* Scanning animation */}
          {loading && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex flex-col items-center gap-3 py-8">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
                  <div className="relative rounded-full bg-primary/20 p-4">
                    <Sparkles className="h-8 w-8 animate-pulse text-primary" />
                  </div>
                </div>
                <p className="font-medium text-primary">Identifying product…</p>
                <p className="text-xs text-muted-foreground">Scanning catalog with AI vision</p>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {results && !loading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm uppercase tracking-wider text-muted-foreground">
                  {results.length === 0 ? "No matches" : `${results.length} match${results.length === 1 ? "" : "es"}`}
                </h3>
                {results.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">Sorted by confidence</Badge>
                )}
              </div>
              {results.length === 0 && (
                <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                  AI couldn't confidently match this photo to any product in the catalog.
                  Try a clearer angle or different lighting.
                </p>
              )}
              {results.map((row) => (
                <Card key={row.product.id} className="overflow-hidden">
                  <div className="flex gap-3 p-3">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                      {row.product.cover && (
                        <img src={row.product.cover} alt="" className="h-full w-full object-contain" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium leading-tight truncate">{row.product.product_name}</p>
                          <p className="text-xs text-muted-foreground">{row.product.product_code}</p>
                        </div>
                        <Badge variant={row.match.confidence >= 0.7 ? "default" : "secondary"} className="shrink-0 text-[10px]">
                          {Math.round(row.match.confidence * 100)}%
                        </Badge>
                      </div>
                      <div className="flex items-baseline gap-2">
                        {row.product.offer_price && row.product.offer_price < row.product.mrp ? (
                          <>
                            <span className="font-display text-lg text-primary">{formatINR(row.product.offer_price)}</span>
                            <span className="text-xs text-muted-foreground line-through">{formatINR(row.product.mrp)}</span>
                          </>
                        ) : (
                          <span className="font-display text-lg">{formatINR(row.product.mrp)}</span>
                        )}
                      </div>
                      {row.match.reason && (
                        <p className="text-[11px] italic text-muted-foreground line-clamp-2">"{row.match.reason}"</p>
                      )}
                    </div>
                  </div>
                  {row.product.locations.length > 0 ? (
                    <div className="border-t bg-muted/30 px-3 py-2 space-y-1">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Locations</p>
                      {row.product.locations.map((l, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <MapPin className="h-3 w-3 text-primary shrink-0" />
                          <span className="font-medium">{l.building}</span>
                          <span className="text-muted-foreground">·</span>
                          <span>{l.floor}</span>
                          {l.section && (<><span className="text-muted-foreground">·</span><span>{l.section}</span></>)}
                          {l.color && <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px]">{l.color}</Badge>}
                          <span className="ml-auto text-muted-foreground">qty {l.quantity}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border-t bg-muted/30 px-3 py-2">
                      <p className="text-xs text-muted-foreground">No physical location set for this product.</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};