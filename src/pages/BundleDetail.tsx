import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatINR, buildWhatsAppUrl } from "@/lib/brand";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";
import { ArrowLeft, MessageCircle, Loader2, Package } from "lucide-react";
import { Seo } from "@/components/Seo";

type B = {
  id: string; bundle_code: string; name: string; description: string | null;
  main_image_url: string | null; mrp: number; offer_price: number | null;
  available_colors: string[] | null; material: string | null; dimensions: string | null;
  stock_status: string;
};
type Linked = { product_id: string; quantity: number; product_name?: string; product_code?: string };

const BundleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const settings = useHomepageSettings();
  const hidePrice = !!settings?.hide_public_prices;
  const [b, setB] = useState<B | null>(null);
  const [items, setItems] = useState<Linked[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [b1, b2] = await Promise.all([
        (supabase as any).from("product_bundles").select("*").eq("id", id).eq("is_published", true).is("deleted_at", null).maybeSingle(),
        (supabase as any).from("bundle_items").select("product_id, quantity").eq("bundle_id", id).order("display_order"),
      ]);
      setB(b1.data as B | null);
      const ids = ((b2.data ?? []) as any[]).map((it) => it.product_id);
      if (ids.length) {
        const { data: pr } = await supabase.from("products").select("id, product_name, product_code").in("id", ids);
        const lookup = new Map((pr ?? []).map((p) => [p.id, p]));
        setItems(((b2.data ?? []) as any[]).map((it) => ({
          ...it,
          product_name: lookup.get(it.product_id)?.product_name,
          product_code: lookup.get(it.product_id)?.product_code,
        })));
      }
      setLoading(false);
    })();
  }, [id]);

  const inquire = () => {
    if (!b) return;
    const price = !hidePrice
      ? (b.offer_price && b.offer_price < b.mrp
          ? `*Price:* ${formatINR(b.offer_price)} (MRP ${formatINR(b.mrp)})`
          : `*Price:* ${formatINR(b.mrp)}`)
      : "";
    const msg = [
      "*Bundle Inquiry*",
      `*Bundle:* ${b.name}`, `*Code:* ${b.bundle_code}`, price,
      "", `*Includes:*`,
      ...items.map((it) => `• ${it.quantity}× ${it.product_name ?? it.product_id}`),
      "", `*Link:* ${window.location.origin}/bundle/${b.id}`,
    ].filter(Boolean).join("\n");
    window.open(buildWhatsAppUrl(msg), "_blank", "noopener");
  };

  if (loading) return (
    <><SiteHeader /><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div><SiteFooter /></>
  );
  if (!b) return (
    <><SiteHeader /><div className="container-page py-16 text-center text-muted-foreground">Bundle not found.</div><SiteFooter /></>
  );

  const onOffer = b.offer_price && b.offer_price < b.mrp;
  const oos = b.stock_status === "out_of_stock";

  return (
    <>
      <Seo title={`${b.name} · Bundle`} description={b.description ?? `Combo set: ${b.name}`} />
      <SiteHeader />
      <main className="container-page py-6">
        <Link to="/catalog" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Catalog
        </Link>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl bg-muted">
            {b.main_image_url ? (
              <img src={b.main_image_url} alt={b.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex aspect-square items-center justify-center text-muted-foreground">No image</div>
            )}
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Bundle</Badge>
              {oos && <Badge variant="destructive">Out of stock</Badge>}
            </div>
            <h1 className="font-display text-3xl">{b.name}</h1>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Code · {b.bundle_code}</p>
            {!hidePrice && (
              <div className="flex items-baseline gap-3">
                {onOffer ? (
                  <>
                    <span className="font-display text-3xl font-semibold text-primary">{formatINR(b.offer_price!)}</span>
                    <span className="text-base text-muted-foreground line-through">{formatINR(b.mrp)}</span>
                  </>
                ) : (
                  <span className="font-display text-3xl font-semibold text-primary">{formatINR(b.mrp)}</span>
                )}
              </div>
            )}
            {b.description && <p className="text-foreground/80">{b.description}</p>}
            {(b.material || b.dimensions) && (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {b.material && (<><dt className="text-muted-foreground">Material</dt><dd>{b.material}</dd></>)}
                {b.dimensions && (<><dt className="text-muted-foreground">Dimensions</dt><dd>{b.dimensions}</dd></>)}
              </dl>
            )}
            {b.available_colors && b.available_colors.length > 0 && (
              <p className="text-sm"><span className="text-muted-foreground">Colors: </span>{b.available_colors.join(", ")}</p>
            )}

            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-2 font-display text-lg">What's included</h2>
              <ul className="space-y-1.5 text-sm">
                {items.map((it, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{it.quantity}×</span>
                    <span className="flex-1">{it.product_name ?? "—"}</span>
                    {it.product_code && <span className="text-xs text-muted-foreground">{it.product_code}</span>}
                  </li>
                ))}
              </ul>
            </div>

            <Button onClick={inquire} size="lg" className="w-full bg-[#25D366] hover:bg-[#1ebe57] text-white">
              <MessageCircle className="mr-2 h-5 w-5" /> Inquire on WhatsApp
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
      <WhatsAppFab />
    </>
  );
};

export default BundleDetail;