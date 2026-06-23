import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { OfficeStaffOnly } from "@/components/admin/OfficeStaffOnly";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Movement = {
  id: string;
  product_id: string;
  change_qty: number;
  reason: string;
  note: string | null;
  resulting_stock: number;
  created_at: string;
};
type Product = { id: string; product_name: string; product_code: string };

// Bucket the free-form `reason` field into the four movement types staff care
// about so the filter dropdown stays usable as new reason codes are added.
const classify = (reason: string): "in" | "out" | "transfer" | "adjustment" => {
  const r = (reason || "").toLowerCase();
  if (r.includes("transfer")) return "transfer";
  if (r.includes("adjust") || r.includes("correction") || r.includes("stock_take") || r.includes("audit")) return "adjustment";
  if (r.includes("delivery") || r.includes("dispatch") || r.includes("sale") || r.includes("consume")) return "out";
  if (r.includes("receive") || r.includes("purchase") || r.includes("inbound") || r.includes("return") || r.includes("restock")) return "in";
  return reason ? "adjustment" : "adjustment";
};

const AdminInventoryLedger = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [from, setFrom] = useState<string>(monthAgo);
  const [to, setTo] = useState<string>(today);

  const load = async () => {
    setLoading(true);
    const [m, p] = await Promise.all([
      supabase
        .from("stock_movements")
        .select("id, product_id, change_qty, reason, note, resulting_stock, created_at")
        .gte("created_at", from + "T00:00:00")
        .lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("products").select("id, product_name, product_code").is("deleted_at", null).order("product_name"),
    ]);
    setRows((m.data ?? []) as Movement[]);
    setProducts((p.data ?? []) as Product[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [from, to]);

  const productById = useMemo(() => {
    const m: Record<string, Product> = {};
    products.forEach((p) => { m[p.id] = p; });
    return m;
  }, [products]);

  const filtered = useMemo(() => {
    let list = rows;
    if (productId !== "all") list = list.filter((r) => r.product_id === productId);
    if (typeFilter !== "all") list = list.filter((r) => classify(r.reason) === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => {
        const p = productById[r.product_id];
        return (
          (p?.product_name || "").toLowerCase().includes(q) ||
          (p?.product_code || "").toLowerCase().includes(q) ||
          (r.reason || "").toLowerCase().includes(q) ||
          (r.note || "").toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [rows, productId, typeFilter, search, productById]);

  const totals = useMemo(() => {
    let inQ = 0, outQ = 0;
    filtered.forEach((r) => { if (r.change_qty > 0) inQ += r.change_qty; else outQ += -r.change_qty; });
    return { inQ, outQ, net: inQ - outQ };
  }, [filtered]);

  return (
    <OfficeStaffOnly>
      <AdminShell>
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl">Stock Ledger</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Every stock movement across all products — searchable, filterable, exportable.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="mr-2 h-4 w-4" /> Refresh</>}
          </Button>
        </div>

        <Card className="mb-4">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.product_name} · {p.product_code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Movement type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="in">In (receipts)</SelectItem>
                  <SelectItem value="out">Out (deliveries)</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Search reason / note</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. delivery" />
            </div>
          </CardContent>
        </Card>

        <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border bg-emerald-500/5 p-3"><p className="text-[10px] uppercase text-muted-foreground">In</p><p className="font-display text-xl text-emerald-700 dark:text-emerald-300">+{totals.inQ}</p></div>
          <div className="rounded-lg border bg-rose-500/5 p-3"><p className="text-[10px] uppercase text-muted-foreground">Out</p><p className="font-display text-xl text-rose-700 dark:text-rose-300">−{totals.outQ}</p></div>
          <div className="rounded-lg border p-3"><p className="text-[10px] uppercase text-muted-foreground">Net</p><p className="font-display text-xl">{totals.net >= 0 ? "+" : ""}{totals.net}</p></div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No movements match these filters.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">When</th>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-right">Change</th>
                      <th className="px-3 py-2 text-right">Resulting</th>
                      <th className="px-3 py-2 text-left">Reason / note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const t = classify(r.reason);
                      const p = productById[r.product_id];
                      return (
                        <tr key={r.id} className="border-t">
                          <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                          <td className="px-3 py-2"><div className="font-medium">{p?.product_name ?? r.product_id.slice(0, 8)}</div><div className="text-[11px] text-muted-foreground">{p?.product_code}</div></td>
                          <td className="px-3 py-2"><Badge variant="outline" className="capitalize">{t}</Badge></td>
                          <td className={`px-3 py-2 text-right font-display ${r.change_qty >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{r.change_qty >= 0 ? `+${r.change_qty}` : r.change_qty}</td>
                          <td className="px-3 py-2 text-right font-display">{r.resulting_stock}</td>
                          <td className="px-3 py-2 text-xs"><div>{r.reason}</div>{r.note && <div className="text-muted-foreground">{r.note}</div>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </AdminShell>
    </OfficeStaffOnly>
  );
};

export default AdminInventoryLedger;