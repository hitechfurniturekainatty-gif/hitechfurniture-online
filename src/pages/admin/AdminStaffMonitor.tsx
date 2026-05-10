import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminOnly } from "@/components/admin/AdminOnly";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Search, Ruler, FileText, HardHat, Truck, ArrowRight, CheckCircle2, Clock, Sparkles, Layers, Warehouse, Link2, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type StaffUser = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
};

type Counts = {
  pending: number;
  inProgress: number;
  completed: number;
};

type Row = {
  staff: StaffUser;
  measurement: Counts;
  quotations: Counts;     // for office staff: drafted / finalized / delivered
  jobs: Counts;           // worker jobs (only for workers)
  trips: Counts;          // delivery trips (only for delivery)
  workerId?: string | null;
};

const empty = (): Counts => ({ pending: 0, inProgress: 0, completed: 0 });

const roleLabel = (r: string | null) => {
  switch (r) {
    case "admin": return "Admin";
    case "staff": return "Office Staff";
    case "measurement_staff": return "Measurement";
    case "delivery": return "Delivery";
    case "worker": return "Worker";
    default: return r ?? "—";
  }
};

const AdminStaffMonitor = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [roleTab, setRoleTab] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    // 1. staff users
    const { data: staffResp, error: staffErr } = await supabase.functions.invoke("list-staff-users");
    if (staffErr) {
      toast({ title: "Couldn't load staff", description: staffErr.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const staff = ((staffResp?.users ?? []) as StaffUser[]).filter((u) => !!u.role);

    // 2. workers (so we can map role=worker users to worker_id)
    const { data: workers } = await supabase
      .from("workers")
      .select("id, user_id, name")
      .is("deleted_at", null);
    const workerByUser: Record<string, string> = {};
    (workers ?? []).forEach((w: any) => { if (w.user_id) workerByUser[w.user_id] = w.id; });

    // 3. parallel fetch of all relevant work rows (small projections)
    const [tasksRes, qRes, jobsRes, tripsRes] = await Promise.all([
      supabase.from("measurement_tasks").select("assigned_to, status").is("deleted_at", null),
      supabase.from("quotations").select("created_by, status, source_task_id").is("deleted_at", null),
      supabase.from("job_work_orders").select("worker_id, status").is("deleted_at", null),
      supabase.from("trips").select("assigned_driver_id, status").is("deleted_at", null),
    ]);

    const tasks = (tasksRes.data ?? []) as Array<{ assigned_to: string; status: string }>;
    const quotes = (qRes.data ?? []) as Array<{ created_by: string | null; status: string; source_task_id: string | null }>;
    const jobs = (jobsRes.data ?? []) as Array<{ worker_id: string; status: string }>;
    const trips = (tripsRes.data ?? []) as Array<{ assigned_driver_id: string | null; status: string }>;

    const built: Row[] = staff.map((s) => {
      const m = empty();
      tasks.filter((t) => t.assigned_to === s.user_id).forEach((t) => {
        if (t.status === "completed") m.completed++;
        else if (t.status === "in_progress") m.inProgress++;
        else m.pending++;
      });

      const q = empty();
      quotes.filter((x) => x.created_by === s.user_id).forEach((x) => {
        if (x.status === "drafted") q.pending++;
        else if (x.status === "finalized") q.inProgress++;
        else if (x.status === "delivered") q.completed++;
      });

      const j = empty();
      const wid = workerByUser[s.user_id];
      if (wid) {
        jobs.filter((x) => x.worker_id === wid).forEach((x) => {
          if (x.status === "completed" || x.status === "done") j.completed++;
          else if (x.status === "in_progress" || x.status === "started") j.inProgress++;
          else j.pending++;
        });
      }

      const tr = empty();
      trips.filter((x) => x.assigned_driver_id === s.user_id).forEach((x) => {
        if (x.status === "completed") tr.completed++;
        else if (x.status === "in_progress") tr.inProgress++;
        else tr.pending++;
      });

      return { staff: s, measurement: m, quotations: q, jobs: j, trips: tr, workerId: wid ?? null };
    });

    setRows(built);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleTab !== "all" && r.staff.role !== roleTab) return false;
      if (!term) return true;
      return (
        (r.staff.display_name ?? "").toLowerCase().includes(term) ||
        (r.staff.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [rows, search, roleTab]);

  const totals = useMemo(() => {
    const t = { pending: 0, inProgress: 0, completed: 0 };
    filtered.forEach((r) => {
      [r.measurement, r.quotations, r.jobs, r.trips].forEach((c) => {
        t.pending += c.pending; t.inProgress += c.inProgress; t.completed += c.completed;
      });
    });
    return t;
  }, [filtered]);

  return (
    <AdminOnly>
      <AdminShell>
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl">Staff Monitor</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Live view of every staff member's pending, in-progress and completed work.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff" className="h-10 w-56 pl-8" />
            </div>
            <Button variant="outline" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Org-wide totals */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Pending</p><p className="font-display text-3xl font-semibold text-foreground">{totals.pending}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">In progress</p><p className="font-display text-3xl font-semibold text-foreground">{totals.inProgress}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Completed</p><p className="font-display text-3xl font-semibold text-foreground">{totals.completed}</p></CardContent></Card>
        </div>

        <Tabs value={roleTab} onValueChange={setRoleTab} className="mb-4">
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="staff">Office</TabsTrigger>
            <TabsTrigger value="measurement_staff">Measurement</TabsTrigger>
            <TabsTrigger value="worker">Production Unit</TabsTrigger>
            <TabsTrigger value="delivery">Delivery</TabsTrigger>
            <TabsTrigger value="admin">Admins</TabsTrigger>
          </TabsList>
          <TabsContent value={roleTab} className="mt-4">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No staff in this view.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {filtered.map((r) => (
                  <StaffCard key={r.staff.user_id} row={r} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* What's new — latest platform updates relevant to staff monitoring */}
        <Card className="mb-4 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base sm:text-lg">
              <Sparkles className="h-4 w-4 text-primary" />
              What's new in the workflow
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">May 2026 updates that change how staff move work forward.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-card p-3">
                <Layers className="mb-1.5 h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">6-Stage Auto Pipeline</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Files move automatically: Client Hub → Dimensions → OPS → Production → Warehouse → Logistics.</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <Warehouse className="mb-1.5 h-4 w-4 text-amber-600" />
                <p className="text-sm font-semibold">Per-Item Routing</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Ready Stock items skip Production and go straight to Warehouse — Production Unit only sees custom builds.</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <Users className="mb-1.5 h-4 w-4 text-sky-600" />
                <p className="text-sm font-semibold">Role-Based Dashboards</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Each staff member lands on a screen tailored to their role — Office, Measurement, Production Unit, Delivery.</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <Link2 className="mb-1.5 h-4 w-4 text-emerald-600" />
                <p className="text-sm font-semibold">Live Mobile Share Link</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Share a zoomable, always-up-to-date URL with workers via WhatsApp — no stale PDFs.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Workflow legend so everyone reads the lanes the same way */}
        <Card className="mb-4 border-dashed">
          <CardContent className="grid gap-2 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="mb-1 flex items-center gap-1.5 font-semibold text-foreground"><Ruler className="h-3.5 w-3.5 text-primary" /> Measurement staff</p>
              <p className="text-muted-foreground">Open Dimensions task → fill items + measurements → <span className="font-medium text-emerald-700 dark:text-emerald-300">Submit for pricing</span> = complete.</p>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1.5 font-semibold text-foreground"><FileText className="h-3.5 w-3.5 text-primary" /> Office staff</p>
              <p className="text-muted-foreground">Open quotation → mark each item Ready Stock or Custom → price &amp; assign → <span className="font-medium text-emerald-700 dark:text-emerald-300">delivered</span> = complete.</p>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1.5 font-semibold text-foreground"><HardHat className="h-3.5 w-3.5 text-primary" /> Production Unit</p>
              <p className="text-muted-foreground">Custom job assigned → in progress → <span className="font-medium text-emerald-700 dark:text-emerald-300">done</span> → auto-moves to Warehouse.</p>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1.5 font-semibold text-foreground"><Truck className="h-3.5 w-3.5 text-primary" /> Delivery</p>
              <p className="text-muted-foreground">Trip planned (Out for Delivery / Delayed) → in progress → <span className="font-medium text-emerald-700 dark:text-emerald-300">completed</span> = complete.</p>
            </div>
          </CardContent>
        </Card>
      </AdminShell>
    </AdminOnly>
  );
};

const StaffCard = ({ row }: { row: Row }) => {
  const r = row;
  const all = [r.measurement, r.quotations, r.jobs, r.trips];
  const totalPending = all.reduce((s, c) => s + c.pending + c.inProgress, 0);
  const totalDone = all.reduce((s, c) => s + c.completed, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{r.staff.display_name || r.staff.email}</CardTitle>
            <p className="truncate text-xs text-muted-foreground">{r.staff.email}</p>
          </div>
          <Badge variant="secondary">{roleLabel(r.staff.role)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 text-xs">
          <span className="rounded-md border bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">
            <Clock className="mr-1 inline h-3 w-3" /> {totalPending} open
          </span>
          <span className="rounded-md border bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="mr-1 inline h-3 w-3" /> {totalDone} done
          </span>
        </div>

        <WorkRow icon={Ruler} label="Measurement tasks" counts={r.measurement}
          link={`/admin/measurement-tasks`} />
        <WorkRow icon={FileText} label="Quotations created" counts={r.quotations}
          link={`/admin/quotations?staff=${r.staff.user_id}`} pendingHint="drafted" inProgressHint="finalized" completedHint="delivered" />
        {r.workerId && (
          <WorkRow icon={HardHat} label="Worker jobs" counts={r.jobs}
            link={`/admin/workers/${r.workerId}`} />
        )}
        <WorkRow icon={Truck} label="Delivery trips" counts={r.trips}
          link={`/admin/trips`} />
      </CardContent>
    </Card>
  );
};

const WorkRow = ({
  icon: Icon, label, counts, link, pendingHint, inProgressHint, completedHint,
}: {
  icon: any; label: string; counts: Counts; link: string;
  pendingHint?: string; inProgressHint?: string; completedHint?: string;
}) => {
  const total = counts.pending + counts.inProgress + counts.completed;
  if (total === 0) {
    return (
      <div className="flex items-center justify-between rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {label}</span>
        <span>—</span>
      </div>
    );
  }
  return (
    <Link to={link} className="block rounded-md border bg-card px-3 py-2 transition-smooth hover:border-primary hover:shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-primary" /> {label}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
        <Pill tone="amber" n={counts.pending} word={pendingHint ?? "pending"} />
        <Pill tone="sky" n={counts.inProgress} word={inProgressHint ?? "in progress"} />
        <Pill tone="emerald" n={counts.completed} word={completedHint ?? "completed"} />
      </div>
    </Link>
  );
};

const Pill = ({ tone, n, word }: { tone: "amber" | "sky" | "emerald"; n: number; word: string }) => {
  const cls =
    tone === "amber" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
    : tone === "sky" ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30"
    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  return (
    <span className={`rounded border px-1.5 py-0.5 ${cls}`}>
      <span className="font-semibold">{n}</span> {word}
    </span>
  );
};

export default AdminStaffMonitor;