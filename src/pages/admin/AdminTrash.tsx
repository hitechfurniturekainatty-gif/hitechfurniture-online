import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, RotateCcw, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import {
  TRASH_LABELS, TRASH_RETENTION_DAYS, type TrashTable,
  restoreFromTrash, purgeRow,
} from "@/lib/softDelete";

type Row = {
  id: string;
  primary: string;
  secondary?: string;
  deleted_at: string;
  deleted_by: string | null;
};

type GroupKey = TrashTable;

const TABLES: { key: GroupKey; selectCols: string; primaryKey: string; secondaryKey?: string }[] = [
  { key: "quotations",          selectCols: "id, deleted_at, deleted_by, quotation_id, party_name, party_place", primaryKey: "quotation_id", secondaryKey: "party_name" },
  { key: "job_work_orders",     selectCols: "id, deleted_at, deleted_by, status, notes",                          primaryKey: "status",       secondaryKey: "notes" },
  { key: "customer_services",   selectCols: "id, deleted_at, deleted_by, service_code, customer_name",            primaryKey: "service_code", secondaryKey: "customer_name" },
  { key: "customer_complaints", selectCols: "id, deleted_at, deleted_by, complaint_code, customer_name",          primaryKey: "complaint_code", secondaryKey: "customer_name" },
  { key: "products",            selectCols: "id, deleted_at, deleted_by, product_code, product_name",             primaryKey: "product_name", secondaryKey: "product_code" },
  { key: "main_categories",     selectCols: "id, deleted_at, deleted_by, name",                                   primaryKey: "name" },
  { key: "sub_categories",      selectCols: "id, deleted_at, deleted_by, name",                                   primaryKey: "name" },
  { key: "workers",             selectCols: "id, deleted_at, deleted_by, name, trade",                            primaryKey: "name", secondaryKey: "trade" },
  { key: "delivery_routes",     selectCols: "id, deleted_at, deleted_by, name, destination_name",                 primaryKey: "name", secondaryKey: "destination_name" },
  { key: "trips",               selectCols: "id, deleted_at, deleted_by, trip_date, status",                      primaryKey: "trip_date", secondaryKey: "status" },
  { key: "measurement_tasks",   selectCols: "id, deleted_at, deleted_by, customer_name, customer_place",          primaryKey: "customer_name", secondaryKey: "customer_place" },
];

const fmtRemaining = (deletedAt: string) => {
  const purgeAt = new Date(deletedAt).getTime() + TRASH_RETENTION_DAYS * 86400_000;
  const ms = purgeAt - Date.now();
  if (ms <= 0) return "Purging soon";
  const days = Math.floor(ms / 86400_000);
  if (days >= 1) return `${days}d left`;
  const hrs = Math.floor(ms / 3600_000);
  return `${hrs}h left`;
};

const AdminTrash = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [data, setData] = useState<Record<GroupKey, Row[]>>({} as Record<GroupKey, Row[]>);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const result: Record<GroupKey, Row[]> = {} as Record<GroupKey, Row[]>;
    await Promise.all(
      TABLES.map(async (t) => {
        const { data: rows, error } = await supabase
          .from(t.key)
          .select(t.selectCols)
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false });
        if (error) {
          result[t.key] = [];
          return;
        }
        result[t.key] = (rows ?? []).map((r: any) => ({
          id: r.id,
          primary: String(r[t.primaryKey] ?? "(unnamed)"),
          secondary: t.secondaryKey ? (r[t.secondaryKey] ?? undefined) : undefined,
          deleted_at: r.deleted_at,
          deleted_by: r.deleted_by,
        }));
      }),
    );
    setData(result);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && isAdmin) void load();
  }, [authLoading, isAdmin]);

  const totals = useMemo(() => {
    const t: Record<GroupKey, number> = {} as Record<GroupKey, number>;
    let all = 0;
    for (const k of Object.keys(data) as GroupKey[]) {
      t[k] = data[k]?.length ?? 0;
      all += t[k];
    }
    return { ...t, _all: all };
  }, [data]);

  const restore = async (table: GroupKey, row: Row) => {
    setBusyId(row.id);
    const { error } = await restoreFromTrash(table, row.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Restore failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Restored", description: row.primary });
    setData((prev) => ({ ...prev, [table]: (prev[table] ?? []).filter((r) => r.id !== row.id) }));
  };

  const purge = async (table: GroupKey, row: Row) => {
    if (!confirm(`Permanently delete "${row.primary}"? This cannot be undone.`)) return;
    setBusyId(row.id);
    const { error } = await purgeRow(table, row.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Permanently deleted" });
    setData((prev) => ({ ...prev, [table]: (prev[table] ?? []).filter((r) => r.id !== row.id) }));
  };

  const purgeAllExpired = async () => {
    if (!confirm(`Permanently delete every item that has been in the Trash for more than ${TRASH_RETENTION_DAYS} days?`)) return;
    const { error } = await supabase.rpc("purge_old_trash");
    if (error) {
      toast({ title: "Purge failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Old trash purged" });
    void load();
  };

  if (authLoading) {
    return <AdminShell><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AdminShell>;
  }
  if (!isAdmin) return <Navigate to="/admin" replace />;

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl">Trash</h1>
          <p className="text-sm text-muted-foreground">
            Deleted items stay here for {TRASH_RETENTION_DAYS} days, then are removed automatically.
          </p>
        </div>
        <Button variant="outline" onClick={purgeAllExpired}>
          <AlertTriangle className="mr-2 h-4 w-4" /> Purge expired now
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : totals._all === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Trash is empty.</CardContent></Card>
      ) : (
        <Tabs defaultValue={TABLES[0].key}>
          <TabsList className="w-full justify-start overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABLES.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="whitespace-nowrap">
                {TRASH_LABELS[t.key]} ({totals[t.key] ?? 0})
              </TabsTrigger>
            ))}
          </TabsList>
          {TABLES.map((t) => (
            <TabsContent key={t.key} value={t.key} className="mt-4 grid gap-2">
              {(data[t.key] ?? []).length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">No items in this category.</p>
              ) : (
                (data[t.key] ?? []).map((row) => (
                  <Card key={row.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{row.primary}</p>
                        {row.secondary && (
                          <p className="truncate text-xs text-muted-foreground">{row.secondary}</p>
                        )}
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>Deleted {new Date(row.deleted_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          <Badge variant="outline" className="text-[10px]">{fmtRemaining(row.deleted_at)}</Badge>
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" onClick={() => restore(t.key, row)} disabled={busyId === row.id}>
                          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => purge(t.key, row)} disabled={busyId === row.id}>
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </AdminShell>
  );
};

export default AdminTrash;