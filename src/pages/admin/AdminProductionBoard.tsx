import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { OfficeStaffOnly } from "@/components/admin/OfficeStaffOnly";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, HardHat, FileText, LifeBuoy, Wrench } from "lucide-react";

type JobRow = {
  id: string;
  status: string;
  warehouse_status: string | null;
  job_type: string | null;
  is_urgent: boolean | null;
  worker_id: string | null;
  quotation_id: string | null;
  source_complaint_id: string | null;
  source_service_id: string | null;
  created_at: string;
  status_updated_at: string;
  worker_name: string | null;
  source_code: string | null;
  party_name: string | null;
};

type ColumnKey = "assigned" | "in_progress" | "completed" | "dispatched";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "dispatched", label: "Dispatched" },
];

const columnFor = (j: JobRow): ColumnKey => {
  if (j.warehouse_status === "dispatched") return "dispatched";
  if (j.status === "completed" || j.status === "ready" || j.status === "done") return "completed";
  if (j.status === "started" || j.status === "in_progress") return "in_progress";
  return "assigned";
};

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const jobTypeMeta = (t: string | null) => {
  if (t === "complaint") return { label: "Complaint", icon: LifeBuoy, variant: "destructive" as const };
  if (t === "service") return { label: "Service", icon: Wrench, variant: "secondary" as const };
  return { label: "Production", icon: HardHat, variant: "outline" as const };
};

const Inner = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [workerFilter, setWorkerFilter] = useState<string>("all");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_work_orders")
      .select("id,status,warehouse_status,job_type,is_urgent,worker_id,quotation_id,source_complaint_id,source_service_id,created_at,status_updated_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load jobs", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as any[];
    const workerIds = Array.from(new Set(rows.map((r) => r.worker_id).filter(Boolean)));
    const qIds = Array.from(new Set(rows.map((r) => r.quotation_id).filter(Boolean)));
    const cIds = Array.from(new Set(rows.map((r) => r.source_complaint_id).filter(Boolean)));
    const sIds = Array.from(new Set(rows.map((r) => r.source_service_id).filter(Boolean)));

    const [{ data: ws }, { data: qs }, { data: cs }, { data: ss }] = await Promise.all([
      workerIds.length
        ? supabase.from("workers").select("id,name").in("id", workerIds)
        : Promise.resolve({ data: [] as any[] }),
      qIds.length
        ? supabase.from("quotations").select("id,quotation_id,party_name").in("id", qIds)
        : Promise.resolve({ data: [] as any[] }),
      cIds.length
        ? supabase.from("customer_complaints").select("id,complaint_code,customer_name").in("id", cIds)
        : Promise.resolve({ data: [] as any[] }),
      sIds.length
        ? supabase.from("customer_services").select("id,service_code,customer_name").in("id", sIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const wMap = new Map((ws ?? []).map((w: any) => [w.id, w.name]));
    const qMap = new Map((qs ?? []).map((q: any) => [q.id, q]));
    const cMap = new Map((cs ?? []).map((c: any) => [c.id, c]));
    const sMap = new Map((ss ?? []).map((s: any) => [s.id, s]));

    const flat: JobRow[] = rows.map((r) => {
      let source_code: string | null = null;
      let party_name: string | null = null;
      if (r.source_complaint_id && cMap.has(r.source_complaint_id)) {
        const c: any = cMap.get(r.source_complaint_id);
        source_code = c.complaint_code;
        party_name = c.customer_name;
      } else if (r.source_service_id && sMap.has(r.source_service_id)) {
        const s: any = sMap.get(r.source_service_id);
        source_code = s.service_code;
        party_name = s.customer_name;
      } else if (r.quotation_id && qMap.has(r.quotation_id)) {
        const q: any = qMap.get(r.quotation_id);
        source_code = q.quotation_id;
        party_name = q.party_name;
      }
      return {
        ...r,
        worker_name: r.worker_id ? (wMap.get(r.worker_id) ?? null) : null,
        source_code,
        party_name,
      };
    });
    setJobs(flat);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const workers = useMemo(() => {
    const m = new Map<string, string>();
    for (const j of jobs) if (j.worker_id && j.worker_name) m.set(j.worker_id, j.worker_name);
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      // Hide dispatched + delivered older noise: keep all but allow filter view.
      if (workerFilter !== "all" && j.worker_id !== workerFilter) return false;
      if (urgentOnly && !j.is_urgent) return false;
      if (q && !(j.source_code ?? "").toLowerCase().includes(q) && !(j.party_name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [jobs, workerFilter, urgentOnly, search]);

  const byColumn = useMemo(() => {
    const g: Record<ColumnKey, JobRow[]> = { assigned: [], in_progress: [], completed: [], dispatched: [] };
    for (const j of filtered) g[columnFor(j)].push(j);
    return g;
  }, [filtered]);

  const moveTo = async (job: JobRow, target: ColumnKey) => {
    if (columnFor(job) === target) return;
    setSavingId(job.id);
    const patch: { status: string; warehouse_status?: string } =
      target === "assigned" ? { status: "assigned" }
        : target === "in_progress" ? { status: "in_progress" }
        : target === "completed" ? { status: "completed", warehouse_status: "in_warehouse" }
        : { status: "completed", warehouse_status: "dispatched" };

    const { error } = await supabase.from("job_work_orders").update(patch as any).eq("id", job.id);
    setSavingId(null);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Status updated", description: `Moved to ${target.replace("_", " ")}` });
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, ...patch, status_updated_at: new Date().toISOString() } : j)));
  };

  const openJob = (j: JobRow) => {
    if (j.source_complaint_id) navigate(`/admin/enquiries?open=complaint:${j.source_complaint_id}`);
    else if (j.source_service_id) navigate(`/admin/enquiries?open=service:${j.source_service_id}`);
    else if (j.quotation_id) navigate(`/admin/quotations/${j.quotation_id}`);
  };

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl md:text-3xl">Production Board</h1>
            <p className="text-sm text-muted-foreground">All open job work orders across the workshop.</p>
          </div>
        </div>

        <Card className="flex flex-wrap items-end gap-3 p-3">
          <div className="min-w-[180px] flex-1">
            <Label className="text-xs">Search</Label>
            <Input
              placeholder="Quotation #, complaint/service code, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="min-w-[180px]">
            <Label className="text-xs">Worker</Label>
            <Select value={workerFilter} onValueChange={setWorkerFilter}>
              <SelectTrigger><SelectValue placeholder="All workers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workers</SelectItem>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch id="urgent" checked={urgentOnly} onCheckedChange={setUrgentOnly} />
            <Label htmlFor="urgent" className="cursor-pointer text-sm">Urgent only</Label>
          </div>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-4 md:mx-0 md:px-0">
            {COLUMNS.map((col) => {
              const items = byColumn[col.key];
              return (
                <div key={col.key} className="w-[280px] shrink-0 md:w-[300px]">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {col.label}
                    </h2>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <div className="space-y-2 rounded-lg bg-muted/40 p-2 min-h-[120px]">
                    {items.length === 0 && (
                      <p className="px-2 py-6 text-center text-xs text-muted-foreground">No jobs</p>
                    )}
                    {items.map((j) => {
                      const meta = jobTypeMeta(j.job_type);
                      const Icon = meta.icon;
                      return (
                        <Card
                          key={j.id}
                          className={`p-3 transition hover:shadow-md ${j.is_urgent ? "border-destructive/60" : ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => openJob(j)}
                            className="block w-full text-left"
                          >
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              <Badge variant={meta.variant} className="gap-1">
                                <Icon className="h-3 w-3" /> {meta.label}
                              </Badge>
                              {j.is_urgent && (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertTriangle className="h-3 w-3" /> URGENT
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-sm font-medium">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="truncate">{j.source_code ?? "—"}</span>
                            </div>
                            {j.party_name && (
                              <p className="truncate text-xs text-muted-foreground">{j.party_name}</p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                              {j.worker_name ?? "Unassigned"} · {timeAgo(j.created_at)}
                            </p>
                          </button>
                          <div className="mt-2">
                            <Select
                              value={columnFor(j)}
                              onValueChange={(v) => moveTo(j, v as ColumnKey)}
                              disabled={savingId === j.id}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {COLUMNS.map((c) => (
                                  <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
};

const AdminProductionBoard = () => (
  <OfficeStaffOnly>
    <Inner />
  </OfficeStaffOnly>
);

export default AdminProductionBoard;