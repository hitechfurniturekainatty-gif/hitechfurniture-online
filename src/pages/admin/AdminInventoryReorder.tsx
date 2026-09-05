import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { OfficeStaffOnly } from "@/components/admin/OfficeStaffOnly";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, RefreshCw, AlertTriangle, Boxes, PackageCheck } from "lucide-react";

type Product = {
  id: string;
  product_name: string;
  product_code: string;
  stock_quantity: number;
  reorder_level: number;
  material: string | null;
  dimensions: string | null;
};

const csvEscape = (v: unknown) => {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const AdminInventoryReorder = () => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [reservedMap, setReservedMap] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const [pr, rs] = await Promise.all([
      supabase
        .from("products")
        .select("id, product_name, product_code, stock_quantity, reorder_level, material, dimensions")
        .is("deleted_at", null)
        .order("product_name"),
      (supabase as any).rpc("get_reserved_stock"),
    ]);
    setProducts((pr.data ?? []) as Product[]);
    const m: Record<string, number> = {};
    ((rs.data ?? []) as { product_id: string; reserved: number }[]).forEach((r) => {
      m[r.product_id] = Number(r.reserved) || 0;
    });
    setReservedMap(m);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const list = products.map((p) => {
      const reserved = reservedMap[p.id] ?? 0;
      const available = Math.max(0, (p.stock_quantity || 0) - reserved);
      const suggested = Math.max(0, (p.reorder_level ?? 5) - available);
      return { ...p, reserved, available, suggested };
    }).filter((r) => r.available <= (r.reorder_level ?? 5));
    if (!search) return list.sort((a, b) => a.available - b.available);
    const q = search.toLowerCase();
    return list
      .filter((r) => r.product_name.toLowerCase().includes(q) || r.product_code.toLowerCase().includes(q))
      .sort((a, b) => a.available - b.available);
  }, [products, reservedMap, search]);

  const outOfStock = rows.filter((r) => r.available === 0).length;
  const suggestedTotal = rows.reduce((sum, r) => sum + r.suggested, 0);

  const exportCsv = () => {
    const header = ["Product", "Code", "Material", "Dimensions", "On hand", "Reserved", "Available", "Reorder level", "Suggested order qty"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      lines.push([r.product_name, r.product_code, r.material ?? "", r.dimensions ?? "", r.stock_quantity, r.reserved, r.available, r.reorder_level, r.suggested].map(csvEscape).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reorder-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <OfficeStaffOnly>
      <AdminShell>
        <div className="space-y-4">
          <div className="admin-page-head flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="admin-accent-tile admin-accent-blush flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-2xl sm:text-3xl">Reorder Report</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Items where available stock is at or below the reorder level. Reserved stock is already deducted.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="mr-2 h-4 w-4" /> Refresh</>}
              </Button>
              <Button onClick={exportCsv} disabled={rows.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Card className="p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Needs Reorder</p><p className="mt-1 text-2xl font-semibold">{rows.length}</p></Card>
            <Card className={outOfStock ? "border-destructive/20 bg-destructive/10 p-3" : "p-3"}><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Out of Stock</p><p className="mt-1 text-2xl font-semibold">{outOfStock}</p></Card>
            <Card className="col-span-2 p-3 sm:col-span-1"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Suggested Order Qty</p><p className="mt-1 text-2xl font-semibold">{suggestedTotal}</p></Card>
          </div>

          <Card className="p-3">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product name or code" className="max-w-md" />
          </Card>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><PackageCheck className="mx-auto mb-2 h-6 w-6 text-muted-foreground" /><p className="text-sm font-medium">Stock looks healthy</p><p className="mt-1 text-xs text-muted-foreground">No item is currently at or below its reorder level.</p></CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center gap-2 border-b px-4 py-3 text-xs text-muted-foreground"><AlertTriangle className="h-4 w-4" />{rows.length} item{rows.length === 1 ? "" : "s"} need purchasing attention</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-right">On hand</th>
                        <th className="px-3 py-2 text-right">Reserved</th>
                        <th className="px-3 py-2 text-right">Available</th>
                        <th className="px-3 py-2 text-right">Reorder level</th>
                        <th className="px-3 py-2 text-right">Suggested order</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="px-3 py-3">
                            <div className="font-medium">{r.product_name}</div>
                            <div className="text-[11px] text-muted-foreground">{r.product_code}{r.material ? ` · ${r.material}` : ""}{r.dimensions ? ` · ${r.dimensions}` : ""}</div>
                          </td>
                          <td className="px-3 py-3 text-right font-display">{r.stock_quantity}</td>
                          <td className="px-3 py-3 text-right font-display">{r.reserved}</td>
                          <td className="px-3 py-3 text-right font-display"><Badge variant={r.available === 0 ? "destructive" : "secondary"}>{r.available}</Badge></td>
                          <td className="px-3 py-3 text-right font-display">{r.reorder_level}</td>
                          <td className="px-3 py-3 text-right font-display font-semibold">{r.suggested}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </AdminShell>
    </OfficeStaffOnly>
  );
};

export default AdminInventoryReorder;