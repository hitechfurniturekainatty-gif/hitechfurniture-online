import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Boxes, Activity, MapPin } from "lucide-react";
import { KpiCard } from "@/components/overview/KpiCard";
import { AnomalyBadges, type Anomaly } from "@/components/overview/AnomalyBadge";
import { CategoryStockBarChart, type CategoryStock } from "@/components/overview/charts/CategoryStockBarChart";

type LocationRow = {
  id: string;
  building: string | null;
  floor: string | null;
  section: string | null;
  part: string | null;
  is_active: boolean;
  display_order: number;
};

const AdminWarehouseAnalyticsDashboard = () => {
  const { loading: authLoading, user, isOfficeStaff, isWarehouse } = useAuth();
  const canAccess = isOfficeStaff || isWarehouse;

  const [loading, setLoading] = useState(true);
  const [skusTracked, setSkusTracked] = useState(0);
  const [recentMovements, setRecentMovements] = useState(0);
  const [locationsCount, setLocationsCount] = useState(0);
  const [activeLocationsCount, setActiveLocationsCount] = useState(0);
  const [categoryStock, setCategoryStock] = useState<CategoryStock[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  const load = async () => {
    setLoading(true);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

    const [{ data: vsRows }, { count: movementsCount }, { data: locRows }] = await Promise.all([
      supabase.from("product_variant_stock").select("id, variant_id, quantity"),
      supabase.from("stock_movements").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      supabase.from("product_locations").select("id, building, floor, section, part, is_active, display_order").order("display_order", { ascending: true }),
    ]);

    setSkusTracked((vsRows ?? []).length);
    setRecentMovements(movementsCount ?? 0);
    setLocations((locRows ?? []) as LocationRow[]);
    setLocationsCount((locRows ?? []).length);
    setActiveLocationsCount((locRows ?? []).filter((l: any) => l.is_active).length);

    // ---- Stock by category: product_variant_stock -> product_variants ->
    // products -> main_categories. Done as separate lookups (not a nested
    // embed) so it degrades cleanly to an empty chart rather than risking
    // a broken join while the tracking tables are still empty. ----
    let categoryData: CategoryStock[] = [];
    const stockRows = (vsRows ?? []) as { variant_id: string; quantity: number }[];
    if (stockRows.length > 0) {
      const variantIds = Array.from(new Set(stockRows.map((r) => r.variant_id)));
      const { data: variants } = await supabase.from("product_variants").select("id, product_id").in("id", variantIds);
      const productIdByVariant = new Map((variants ?? []).map((v: any) => [v.id, v.product_id]));
      const productIds = Array.from(new Set(Array.from(productIdByVariant.values()).filter(Boolean)));
      if (productIds.length) {
        const { data: products } = await supabase.from("products").select("id, main_category_id").in("id", productIds);
        const categoryIdByProduct = new Map((products ?? []).map((p: any) => [p.id, p.main_category_id]));
        const categoryIds = Array.from(new Set(Array.from(categoryIdByProduct.values()).filter(Boolean)));
        const { data: cats } = categoryIds.length
          ? await supabase.from("main_categories").select("id, name").in("id", categoryIds)
          : { data: [] as any[] };
        const categoryNameById = new Map((cats ?? []).map((c: any) => [c.id, c.name]));
        const qtyByCategory: Record<string, number> = {};
        stockRows.forEach((r) => {
          const productId = productIdByVariant.get(r.variant_id);
          const categoryId = productId ? categoryIdByProduct.get(productId) : null;
          const name = (categoryId && categoryNameById.get(categoryId)) || "Uncategorized";
          qtyByCategory[name] = (qtyByCategory[name] ?? 0) + (Number(r.quantity) || 0);
        });
        categoryData = Object.entries(qtyByCategory).map(([category, quantity]) => ({ category, quantity }));
      }
    }
    setCategoryStock(categoryData);

    // ---- Anomaly: any SKU at zero stock — only once tracking has real
    // rows, so an empty table doesn't read as "everything is at zero". ----
    const nextAnomalies: Anomaly[] = [];
    if (stockRows.length > 0) {
      const zeroStockCount = stockRows.filter((r) => (Number(r.quantity) || 0) <= 0).length;
      if (zeroStockCount > 0) {
        nextAnomalies.push({
          key: "zero-stock",
          severity: "critical",
          message: `${zeroStockCount} SKU${zeroStockCount === 1 ? "" : "s"} at zero stock`,
        });
      }
    }
    setAnomalies(nextAnomalies);

    setLoading(false);
  };

  useEffect(() => { if (canAccess) load(); }, [canAccess]);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;
  if (!authLoading && !canAccess) {
    return (
      <AdminShell>
        <p className="text-muted-foreground">Warehouse, office staff or admin access required.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Warehouse Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">Stock tracking and location capacity — live from Supabase.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="mr-2 h-4 w-4" /> Refresh</>}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          <AnomalyBadges anomalies={anomalies} />

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard
              label="SKUs tracked"
              value={String(skusTracked)}
              icon={Boxes}
              sub={skusTracked === 0 ? "Stock tracking not yet populated" : undefined}
            />
            <KpiCard label="Stock movements (7d)" value={String(recentMovements)} icon={Activity} />
            <KpiCard label="Storage locations" value={String(locationsCount)} icon={MapPin} sub={`${activeLocationsCount} active`} />
          </div>

          <div className="mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base sm:text-lg">Stock by Category</CardTitle>
                <p className="text-xs text-muted-foreground">Current quantity tracked per category</p>
              </CardHeader>
              <CardContent>
                <CategoryStockBarChart
                  data={categoryStock}
                  emptyMessage="No stock movements recorded yet"
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Storage Locations</CardTitle>
              <p className="text-xs text-muted-foreground">Interim view — the location directory, until per-SKU stock levels are populated</p>
            </CardHeader>
            <CardContent>
              {locations.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No storage locations set up yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-left">Building</th>
                        <th className="px-2 py-2 text-left">Floor</th>
                        <th className="px-2 py-2 text-left">Section</th>
                        <th className="px-2 py-2 text-left">Part</th>
                        <th className="px-2 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.map((l) => (
                        <tr key={l.id} className="border-t border-border/60">
                          <td className="px-2 py-2">{l.building ?? "—"}</td>
                          <td className="px-2 py-2">{l.floor ?? "—"}</td>
                          <td className="px-2 py-2">{l.section ?? "—"}</td>
                          <td className="px-2 py-2">{l.part ?? "—"}</td>
                          <td className="px-2 py-2 text-right">
                            <Badge variant={l.is_active ? "default" : "outline"}>{l.is_active ? "Active" : "Inactive"}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AdminShell>
  );
};

export default AdminWarehouseAnalyticsDashboard;
