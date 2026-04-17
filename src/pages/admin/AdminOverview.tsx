import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, FolderTree, Layers, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const AdminOverview = () => {
  const [stats, setStats] = useState({ products: 0, categories: 0, subCategories: 0, lowStock: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("main_categories").select("id", { count: "exact", head: true }),
      supabase.from("sub_categories").select("id", { count: "exact", head: true }),
      supabase.from("products").select("id", { count: "exact", head: true }).lte("stock_quantity", 5),
    ]).then(([p, c, s, l]) =>
      setStats({
        products: p.count ?? 0,
        categories: c.count ?? 0,
        subCategories: s.count ?? 0,
        lowStock: l.count ?? 0,
      })
    );
  }, []);

  const cards = [
    { label: "Products", value: stats.products, icon: Package, to: "/admin/products" },
    { label: "Main categories", value: stats.categories, icon: FolderTree, to: "/admin/categories" },
    { label: "Sub-categories", value: stats.subCategories, icon: Layers, to: "/admin/categories" },
    { label: "Low stock (≤5)", value: stats.lowStock, icon: AlertTriangle, to: "/admin/products" },
  ];

  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="font-display text-3xl">Overview</h1>
        <p className="mt-1 text-muted-foreground">Quick snapshot of your live catalog.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="block">
            <Card className="transition-smooth hover:shadow-product">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {c.label}
                  <c.icon className="h-4 w-4 text-primary" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl font-semibold text-primary">{c.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="font-display text-xl">Get started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            1. Create your main categories (e.g. Sofa, Bed, Wardrobe).<br />
            2. Add sub-categories under each (e.g. L-Shape, 3-Seater).<br />
            3. Add products with images, MRP and stock — they'll appear instantly on the public catalog.
          </p>
          <div className="flex gap-2">
            <Button asChild><Link to="/admin/categories">Manage categories</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/products">Add a product</Link></Button>
          </div>
        </CardContent>
      </Card>
    </AdminShell>
  );
};

export default AdminOverview;
