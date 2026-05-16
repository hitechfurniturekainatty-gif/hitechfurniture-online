import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package2, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/brand";
import { toast } from "@/hooks/use-toast";

type Bundle = {
  id: string;
  bundle_code: string;
  name: string;
  main_image_url: string | null;
  mrp: number;
  offer_price: number | null;
  stock_status: string;
  is_published: boolean;
  main_category_id: string;
};

/**
 * Admin list page for product bundles (combos / sets).
 * Mirrors AdminProducts but for the additive `product_bundles` table — the
 * existing product catalog is untouched.
 */
const AdminBundles = () => {
  const navigate = useNavigate();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("product_bundles")
      .select("id, bundle_code, name, main_image_url, mrp, offer_price, stock_status, is_published, main_category_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setBundles((data ?? []) as Bundle[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createNew = async () => {
    // Need at least one main category to attach to.
    const { data: cats } = await supabase
      .from("main_categories").select("id").is("deleted_at", null).order("display_order").limit(1);
    const mainId = cats?.[0]?.id;
    if (!mainId) {
      toast({ title: "Add a main category first", variant: "destructive" });
      return;
    }
    const code = "BND-" + Date.now().toString().slice(-6);
    const { data, error } = await (supabase as any)
      .from("product_bundles")
      .insert({ bundle_code: code, name: "New bundle", main_category_id: mainId, mrp: 0, is_published: false })
      .select("id").maybeSingle();
    if (error || !data) {
      toast({ title: "Create failed", description: error?.message, variant: "destructive" });
      return;
    }
    navigate(`/admin/bundles/${data.id}`);
  };

  const filtered = bundles.filter(
    (b) =>
      !search ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.bundle_code.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl">Bundles / Combo sets</h1>
            <p className="text-sm text-muted-foreground">
              Combine individual catalog items into a single sellable set. Stock auto-syncs from linked items.
            </p>
          </div>
          <Button onClick={createNew}><Plus className="mr-1 h-4 w-4" /> New bundle</Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bundles…" className="pl-9" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            No bundles yet. Click "New bundle" to create one.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((b) => (
              <Link
                key={b.id}
                to={`/admin/bundles/${b.id}`}
                className="flex gap-3 rounded-xl border bg-card p-3 transition hover:shadow-md"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {b.main_image_url ? (
                    <img src={b.main_image_url} alt={b.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Package2 className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium">{b.name}</p>
                    {!b.is_published && <Badge variant="secondary">Draft</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{b.bundle_code}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm font-semibold">{formatINR(b.offer_price ?? b.mrp)}</span>
                    {b.offer_price && b.offer_price < b.mrp && (
                      <span className="text-xs text-muted-foreground line-through">{formatINR(b.mrp)}</span>
                    )}
                  </div>
                  <Badge
                    variant={b.stock_status === "out_of_stock" ? "destructive" : "outline"}
                    className="mt-1"
                  >
                    {b.stock_status === "out_of_stock" ? "Out of stock" : "In stock"}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
};

export default AdminBundles;