import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, FolderTree, AlertTriangle, FileText, Ruler, HardHat, Users, Clock, Truck } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { statusBadgeVariant, statusLabel } from "./AdminQuotationEditor";

const QUOTATION_STATUSES = ["draft", "drafted", "finalized", "sent", "accepted", "completed", "rejected"] as const;

const AdminOverview = () => {
  const { isAdmin, isOfficeStaff, isMeasurementStaff, isDelivery, user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    products: 0, categories: 0, lowStock: 0,
    quotations: 0, drafts: 0, myTasks: 0, workers: 0,
  });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const run = async () => {
      const queries = [
        supabase.from("products").select("id", { count: "exact", head: true }).then((r) => r),
        supabase.from("main_categories").select("id", { count: "exact", head: true }).then((r) => r),
        supabase.from("products").select("id", { count: "exact", head: true }).lte("stock_quantity", 5).then((r) => r),
        supabase.from("quotations").select("id", { count: "exact", head: true }).then((r) => r),
        supabase.from("quotations").select("id", { count: "exact", head: true }).eq("status", "draft").then((r) => r),
        supabase.from("workers").select("id", { count: "exact", head: true }).eq("is_active", true).then((r) => r),
      ];
      if (user?.id && isMeasurementStaff) {
        queries.push(
          supabase.from("measurement_tasks").select("id", { count: "exact", head: true })
            .eq("assigned_to", user.id).neq("status", "completed").then((r) => r)
        );
      }
      const r = await Promise.all(queries);
      setStats({
        products: r[0].count ?? 0,
        categories: r[1].count ?? 0,
        lowStock: r[2].count ?? 0,
        quotations: r[3].count ?? 0,
        drafts: r[4].count ?? 0,
        workers: r[5].count ?? 0,
        myTasks: r[6]?.count ?? 0,
      });

      // Status breakdown for office staff
      if (isOfficeStaff) {
        const statusResults = await Promise.all(
          QUOTATION_STATUSES.map((s) =>
            supabase.from("quotations").select("id", { count: "exact", head: true }).eq("status", s).then((r) => ({ s, count: r.count ?? 0 }))
          )
        );
        const map: Record<string, number> = {};
        statusResults.forEach((x) => { map[x.s] = x.count; });
        setStatusCounts(map);
      }
    };
    run();
  }, [user?.id, isMeasurementStaff, isOfficeStaff]);

  // Measurement-only staff: redirect to personal page
  if (!authLoading && user && isMeasurementStaff && !isOfficeStaff && !isDelivery) {
    return <Navigate to="/admin/my-work" replace />;
  }
  // Delivery-only users: send straight to their trip list
  if (!authLoading && user && isDelivery && !isOfficeStaff && !isMeasurementStaff) {
    return <Navigate to="/admin/my-trips" replace />;
  }

  const cards = [
    isMeasurementStaff && { label: "My pending tasks", value: stats.myTasks, icon: Clock, to: "/admin/measurement-tasks" },
    isOfficeStaff && { label: "Quotations", value: stats.quotations, icon: FileText, to: "/admin/quotations" },
    isOfficeStaff && { label: "Draft quotations", value: stats.drafts, icon: Ruler, to: "/admin/quotations?status=draft" },
    isOfficeStaff && { label: "Workers", value: stats.workers, icon: HardHat, to: "/admin/workers" },
    isOfficeStaff && { label: "Products", value: stats.products, icon: Package, to: "/admin/products" },
    isOfficeStaff && { label: "Categories", value: stats.categories, icon: FolderTree, to: "/admin/categories" },
    isOfficeStaff && { label: "Low stock (≤5)", value: stats.lowStock, icon: AlertTriangle, to: "/admin/products" },
  ].filter(Boolean) as { label: string; value: number; icon: any; to: string }[];

  return (
    <AdminShell>
      <div className="mb-6 sm:mb-8">
        <h1 className="font-display text-2xl sm:text-3xl">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          {isMeasurementStaff && !isOfficeStaff ? "Your assigned measurement tasks." : "Quick snapshot of your business."}
        </p>
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

      {isOfficeStaff && (
        <Card className="mt-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-xl">Quotations by status</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/admin/quotations">View all</Link></Button>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {QUOTATION_STATUSES.map((s) => (
              <Link key={s} to={`/admin/quotations?status=${s}`} className="block">
                <div className="flex flex-col items-start gap-2 rounded-lg border bg-card p-3 transition-smooth hover:border-primary hover:shadow-sm">
                  <Badge variant={statusBadgeVariant(s)} className="text-[10px]">{statusLabel(s)}</Badge>
                  <p className="font-display text-2xl font-semibold text-foreground">{statusCounts[s] ?? 0}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {isOfficeStaff && (
        <Card className="mt-8">
          <CardHeader><CardTitle className="font-display text-xl">Quick actions</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild><Link to="/admin/quotations"><FileText className="mr-2 h-4 w-4" />New quotation</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/measurement-tasks"><Ruler className="mr-2 h-4 w-4" />Assign measurement</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/workers"><HardHat className="mr-2 h-4 w-4" />Manage workers</Link></Button>
            {isAdmin && <Button asChild variant="outline"><Link to="/admin/staff"><Users className="mr-2 h-4 w-4" />Staff management</Link></Button>}
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
};

export default AdminOverview;
