import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2, Clock, CheckCircle2, MapPin, Phone, FileText, Ruler, ArrowRight,
  User as UserIcon, CalendarDays, HardHat, Truck, Warehouse as WarehouseIcon,
  AlertTriangle, Flame, IndianRupee, PackageCheck, Sun,
} from "lucide-react";
import { formatINR } from "@/lib/brand";

type Task = {
  id: string;
  customer_name: string;
  customer_place: string;
  customer_phone: string | null;
  customer_address: string | null;
  requirement: string | null;
  status: string;
  assigned_to: string;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  draft_quotation_id: string | null;
};

type Quotation = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string;
  status: string;
  total: number;
  created_at: string;
  created_by: string | null;
};

type WorkerJob = {
  id: string;
  status: string;
  is_urgent: boolean | null;
  created_at: string;
  status_updated_at: string | null;
  quotation_id: string;
  warehouse_status: string | null;
  party_name?: string;
  party_place?: string;
  quotation_code?: string;
};

type DriverTrip = {
  id: string;
  trip_date: string;
  status: string;
  stops: { quotation_id: string; delivered_at: string | null; total: number; balance: number }[];
};

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};

const AdminMyWork = () => {
  const { user, isAdmin, isOfficeStaff, isMeasurementStaff, isWorker, isDelivery, isWarehouse, roles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [profile, setProfile] = useState<{ display_name: string | null; email: string | null } | null>(null);
  const [workerJobs, setWorkerJobs] = useState<WorkerJob[]>([]);
  const [driverTrips, setDriverTrips] = useState<DriverTrip[]>([]);
  const [warehouseJobs, setWarehouseJobs] = useState<WorkerJob[]>([]);

  const primaryRole: "office" | "measurement" | "worker" | "delivery" | "warehouse" =
    isOfficeStaff || isAdmin ? "office"
      : isWorker ? "worker"
        : isDelivery ? "delivery"
          : isWarehouse ? "warehouse"
            : isMeasurementStaff ? "measurement" : "office";

  useEffect(() => {
    if (!user?.id) return;
    const run = async () => {
      setLoading(true);
      const profilePromise = supabase.from("profiles").select("display_name,email").eq("user_id", user.id).maybeSingle();
      // Office/admin: tasks they created OR were assigned. Measurement: assigned only.
      const taskPromise = (isMeasurementStaff && !isOfficeStaff)
        ? supabase.from("measurement_tasks").select("*").eq("assigned_to", user.id).order("created_at", { ascending: false })
        : supabase.from("measurement_tasks").select("*")
            .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
            .order("created_at", { ascending: false });
      const quotePromise = supabase.from("quotations")
        .select("id,quotation_id,party_name,party_place,status,total,created_at,created_by")
        .eq("created_by", user.id).order("created_at", { ascending: false });

      const [pRes, tRes, qRes] = await Promise.all([profilePromise, taskPromise, quotePromise]);
      setProfile(pRes.data ?? { display_name: user.email?.split("@")[0] ?? null, email: user.email ?? null });
      setTasks((tRes.data ?? []) as Task[]);
      setQuotations((qRes.data ?? []) as Quotation[]);

      if (isWorker) {
        const { data: w } = await supabase.from("workers").select("id").eq("user_id", user.id).maybeSingle();
        if (w?.id) {
          const { data: jobs } = await supabase
            .from("job_work_orders")
            .select("id,status,is_urgent,created_at,status_updated_at,quotation_id,warehouse_status")
            .eq("worker_id", w.id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false });
          const list = (jobs ?? []) as WorkerJob[];
          const qids = Array.from(new Set(list.map((j) => j.quotation_id))).filter(Boolean);
          if (qids.length) {
            const { data: qs } = await supabase
              .from("quotations").select("id,quotation_id,party_name,party_place").in("id", qids);
            const map = new Map((qs ?? []).map((q: any) => [q.id, q]));
            list.forEach((j) => {
              const q = map.get(j.quotation_id);
              if (q) { j.party_name = q.party_name; j.party_place = q.party_place; j.quotation_code = q.quotation_id; }
            });
          }
          setWorkerJobs(list);
        }
      }

      if (isDelivery) {
        const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
        const { data: trips } = await supabase
          .from("trips")
          .select("id,trip_date,status")
          .eq("assigned_driver_id", user.id)
          .is("deleted_at", null)
          .gte("trip_date", since)
          .order("trip_date", { ascending: false });
        const tripList = (trips ?? []) as { id: string; trip_date: string; status: string }[];
        if (tripList.length) {
          const { data: tqs } = await supabase
            .from("trip_quotations")
            .select("trip_id,quotation_id,delivered_at")
            .in("trip_id", tripList.map((t) => t.id));
          const qids = Array.from(new Set((tqs ?? []).map((r: any) => r.quotation_id)));
          const qs = qids.length
            ? (await supabase.from("quotations").select("id,total,advance_amount").in("id", qids)).data ?? []
            : [];
          const qMap = new Map((qs as any[]).map((q) => [q.id, q]));
          const enriched: DriverTrip[] = tripList.map((t) => ({
            ...t,
            stops: (tqs ?? [])
              .filter((r: any) => r.trip_id === t.id)
              .map((r: any) => {
                const q = qMap.get(r.quotation_id) ?? {};
                const total = Number((q as any).total ?? 0);
                const adv = Number((q as any).advance_amount ?? 0);
                return { quotation_id: r.quotation_id, delivered_at: r.delivered_at, total, balance: Math.max(total - adv, 0) };
              }),
          }));
          setDriverTrips(enriched);
        }
      }

      if (isWarehouse) {
        const { data: wjobs } = await supabase
          .from("job_work_orders")
          .select("id,status,is_urgent,created_at,status_updated_at,quotation_id,warehouse_status")
          .is("deleted_at", null)
          .order("status_updated_at", { ascending: false })
          .limit(200);
        const list = (wjobs ?? []) as WorkerJob[];
        const qids = Array.from(new Set(list.map((j) => j.quotation_id))).filter(Boolean);
        if (qids.length) {
          const { data: qs } = await supabase
            .from("quotations").select("id,quotation_id,party_name,party_place").in("id", qids);
          const map = new Map((qs ?? []).map((q: any) => [q.id, q]));
          list.forEach((j) => {
            const q = map.get(j.quotation_id);
            if (q) { j.party_name = q.party_name; j.party_place = q.party_place; j.quotation_code = q.quotation_id; }
          });
        }
        setWarehouseJobs(list);
      }

      setLoading(false);
    };
    run();
  }, [user?.id, isMeasurementStaff, isOfficeStaff, isWorker, isDelivery, isWarehouse]);

  const monthStartIso = useMemo(() => startOfMonth(), []);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const pendingTasks = tasks.filter((t) => t.status !== "completed");
  const doneTasks = tasks.filter((t) => t.status === "completed");
  const doneThisMonth = doneTasks.filter((t) => (t.completed_at ?? t.created_at) >= monthStartIso);
  const quotesThisMonth = quotations.filter((q) => q.created_at >= monthStartIso);

  const roleLabel = isAdmin ? "Admin"
    : isOfficeStaff ? "Office Staff"
      : isWorker ? "Workshop"
        : isDelivery ? "Delivery"
          : isWarehouse ? "Warehouse"
            : isMeasurementStaff ? "Measurement Staff" : "Staff";

  const workerOpen = workerJobs.filter((j) => j.status === "assigned" || j.status === "in_progress");
  const workerUrgent = workerOpen.filter((j) => j.is_urgent);
  const workerDoneThisWeek = workerJobs.filter((j) => {
    if (j.status !== "completed") return false;
    const t = new Date(j.status_updated_at ?? j.created_at).getTime();
    return t >= Date.now() - 7 * 86400_000;
  }).length;

  const todayTrip = driverTrips.find((t) => t.trip_date === todayIso);
  const todayRemainingStops = todayTrip ? todayTrip.stops.filter((s) => !s.delivered_at).length : 0;
  const todayCollect = todayTrip ? todayTrip.stops.filter((s) => !s.delivered_at).reduce((s, x) => s + x.balance, 0) : 0;
  const overdueTrips = driverTrips.filter((t) => t.trip_date < todayIso && t.status !== "completed" && t.stops.some((s) => !s.delivered_at));

  const warehouseWaiting = warehouseJobs.filter((j) => j.status === "completed" && j.warehouse_status !== "dispatched");
  const warehouseDispatchedToday = warehouseJobs.filter((j) => {
    if (j.warehouse_status !== "dispatched") return false;
    return (j.status_updated_at ?? "").slice(0, 10) === todayIso;
  }).length;

  // Office tasks "overdue": created more than 2 days ago and still pending.
  const overdueTasks = pendingTasks.filter((t) => new Date(t.created_at).getTime() < Date.now() - 2 * 86400_000);
  const todaysTasks = pendingTasks.filter((t) => (t.created_at).slice(0, 10) === todayIso);

  const TaskCard = ({ t }: { t: Task }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{t.customer_name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />{t.customer_place}
            </p>
            {t.customer_phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3" />{t.customer_phone}
              </p>
            )}
            {t.requirement && <p className="text-sm mt-2 text-foreground/80 line-clamp-2">{t.requirement}</p>}
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {new Date(t.created_at).toLocaleDateString()}
              {t.completed_at && ` • Done ${new Date(t.completed_at).toLocaleDateString()}`}
            </p>
          </div>
          <Badge variant={t.status === "completed" ? "default" : t.status === "in_progress" ? "secondary" : "outline"}>
            {t.status === "completed" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <Clock className="mr-1 h-3 w-3" />}
            {t.status}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/measurement-tasks">
              <Ruler className="mr-1.5 h-3.5 w-3.5" /> Open task
            </Link>
          </Button>
          {t.draft_quotation_id && (
            <Button asChild size="sm">
              <Link to={`/admin/quotations/${t.draft_quotation_id}`}>
                <FileText className="mr-1.5 h-3.5 w-3.5" /> Quotation <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const QuoteCard = ({ q }: { q: Quotation }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{q.party_name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />{q.party_place}
            </p>
            <p className="text-xs font-mono mt-1 text-foreground/70">{q.quotation_id}</p>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />{new Date(q.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <Badge variant={q.status === "drafted" || q.status === "draft" ? "outline" : "secondary"} className="capitalize">{q.status}</Badge>
            <p className="mt-2 font-semibold">₹{Number(q.total ?? 0).toLocaleString("en-IN")}</p>
          </div>
        </div>
        <div className="mt-3">
          <Button asChild size="sm">
            <Link to={`/admin/quotations/${q.id}`}>Open <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const WorkerJobCard = ({ j }: { j: WorkerJob }) => (
    <Card className={j.is_urgent ? "border-rose-400/60" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{j.party_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />{j.party_place ?? "—"}
            </p>
            {j.quotation_code && <p className="text-[11px] font-mono mt-1 text-foreground/70">{j.quotation_code}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            {j.is_urgent && <Badge variant="destructive" className="gap-1"><Flame className="h-3 w-3" /> Urgent</Badge>}
            <Badge variant={j.status === "completed" ? "default" : j.status === "in_progress" ? "secondary" : "outline"}>{j.status}</Badge>
          </div>
        </div>
        <div className="mt-3">
          <Button asChild size="sm">
            <Link to={`/worker/job/${j.id}`}>Open job <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const WarehouseJobCard = ({ j }: { j: WorkerJob }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{j.party_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />{j.party_place ?? "—"}
            </p>
            {j.quotation_code && <p className="text-[11px] font-mono mt-1 text-foreground/70">{j.quotation_code}</p>}
          </div>
          <Badge variant={j.warehouse_status === "dispatched" ? "default" : "secondary"}>
            {j.warehouse_status ?? "none"}
          </Badge>
        </div>
        <div className="mt-3">
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/warehouse">Open warehouse</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminShell>
      <Card className="mb-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <UserIcon className="h-7 w-7" />
            </div>
            <div>
              <p className="font-display text-xl">{profile?.display_name || user?.email?.split("@")[0] || "Welcome"}</p>
              <p className="text-sm text-muted-foreground">{profile?.email || user?.email}</p>
              <Badge variant="secondary" className="mt-1.5">{roleLabel}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(isOfficeStaff || isAdmin) && (
              <Button asChild variant="outline" size="sm"><Link to="/admin">Full dashboard</Link></Button>
            )}
            {primaryRole === "worker" && <Button asChild size="sm"><Link to="/worker">Worker portal</Link></Button>}
            {primaryRole === "delivery" && <Button asChild size="sm"><Link to="/admin/my-trips">All trips</Link></Button>}
            {primaryRole === "warehouse" && <Button asChild size="sm"><Link to="/admin/warehouse">Warehouse</Link></Button>}
            {(primaryRole === "office" || primaryRole === "measurement") && (
              <Button asChild size="sm"><Link to="/admin/measurement-tasks">All tasks</Link></Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TODAY pinned summary */}
      <Card className="mb-4 border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/10">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold">
            <Sun className="h-4 w-4" /> Today
          </div>
          {primaryRole === "worker" && (
            <span className="text-sm">
              {workerUrgent.length > 0
                ? <><Flame className="inline h-3.5 w-3.5 text-rose-600 mr-1" />{workerUrgent.length} urgent · {workerOpen.length} open</>
                : <>{workerOpen.length} open job{workerOpen.length === 1 ? "" : "s"}</>}
            </span>
          )}
          {primaryRole === "delivery" && (
            <span className="text-sm">
              {todayTrip
                ? <>Trip with {todayRemainingStops} stop{todayRemainingStops === 1 ? "" : "s"} remaining · Collect {formatINR(todayCollect)}</>
                : <>No trip assigned for today</>}
              {overdueTrips.length > 0 && <span className="ml-2 text-rose-600">· {overdueTrips.length} overdue</span>}
            </span>
          )}
          {primaryRole === "warehouse" && (
            <span className="text-sm">
              {warehouseWaiting.length} waiting to dispatch · {warehouseDispatchedToday} dispatched today
            </span>
          )}
          {(primaryRole === "office" || primaryRole === "measurement") && (
            <span className="text-sm">
              {todaysTasks.length} new today · {pendingTasks.length} pending
              {overdueTasks.length > 0 && <span className="ml-2 text-rose-600">· {overdueTasks.length} overdue (&gt;2d)</span>}
            </span>
          )}
        </CardContent>
      </Card>

      {/* Role-specific stats */}
      {primaryRole === "worker" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Open jobs" value={workerOpen.length} icon={HardHat} />
          <StatCard label="Urgent" value={workerUrgent.length} icon={Flame} />
          <StatCard label="Done this week" value={workerDoneThisWeek} icon={CheckCircle2} />
          <StatCard label="Total assigned" value={workerJobs.length} icon={FileText} />
        </div>
      )}
      {primaryRole === "delivery" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Today's stops" value={todayTrip?.stops.length ?? 0} icon={Truck} />
          <StatCard label="Remaining" value={todayRemainingStops} icon={Clock} />
          <StatCard label="Overdue trips" value={overdueTrips.length} icon={AlertTriangle} />
          <StatCard label="Trips (14d)" value={driverTrips.length} icon={CalendarDays} />
        </div>
      )}
      {primaryRole === "warehouse" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Waiting" value={warehouseWaiting.length} icon={WarehouseIcon} />
          <StatCard label="Dispatched today" value={warehouseDispatchedToday} icon={PackageCheck} />
          <StatCard label="Urgent waiting" value={warehouseWaiting.filter((j) => j.is_urgent).length} icon={Flame} />
          <StatCard label="Total jobs" value={warehouseJobs.length} icon={FileText} />
        </div>
      )}
      {(primaryRole === "office" || primaryRole === "measurement") && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Pending tasks" value={pendingTasks.length} icon={Clock} />
          <StatCard label="Overdue" value={overdueTasks.length} icon={AlertTriangle} />
          <StatCard label="Done this month" value={doneThisMonth.length} icon={CalendarDays} />
          <StatCard label="My quotations" value={quotations.length} icon={FileText} sub={`${quotesThisMonth.length} this month`} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : primaryRole === "worker" ? (
        <Tabs defaultValue="open" className="mt-6">
          <TabsList className="w-full justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="open" className="whitespace-nowrap">Open ({workerOpen.length})</TabsTrigger>
            <TabsTrigger value="urgent" className="whitespace-nowrap">Urgent ({workerUrgent.length})</TabsTrigger>
            <TabsTrigger value="history" className="whitespace-nowrap">Completed ({workerJobs.filter((j) => j.status === "completed").length})</TabsTrigger>
          </TabsList>
          <TabsContent value="open" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {workerOpen.map((j) => <WorkerJobCard key={j.id} j={j} />)}
              {workerOpen.length === 0 && <p className="col-span-full py-10 text-center text-muted-foreground">No open jobs. 🎉</p>}
            </div>
          </TabsContent>
          <TabsContent value="urgent" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {workerUrgent.map((j) => <WorkerJobCard key={j.id} j={j} />)}
              {workerUrgent.length === 0 && <p className="col-span-full py-10 text-center text-muted-foreground">No urgent jobs.</p>}
            </div>
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {workerJobs.filter((j) => j.status === "completed").map((j) => <WorkerJobCard key={j.id} j={j} />)}
            </div>
          </TabsContent>
        </Tabs>
      ) : primaryRole === "delivery" ? (
        <Tabs defaultValue="today" className="mt-6">
          <TabsList className="w-full justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="today" className="whitespace-nowrap">Today</TabsTrigger>
            <TabsTrigger value="overdue" className="whitespace-nowrap">Overdue ({overdueTrips.length})</TabsTrigger>
            <TabsTrigger value="recent" className="whitespace-nowrap">Recent ({driverTrips.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="mt-4">
            {todayTrip ? (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold flex items-center gap-2"><Truck className="h-4 w-4" /> {todayTrip.stops.length} stops · {todayRemainingStops} remaining</p>
                    <Badge variant="outline">{todayTrip.status}</Badge>
                  </div>
                  <p className="text-sm flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5" /> Collect today: <strong>{formatINR(todayCollect)}</strong></p>
                  <Button asChild size="sm" className="mt-2"><Link to="/admin/my-trips">Open trip details <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                </CardContent>
              </Card>
            ) : (
              <p className="py-10 text-center text-muted-foreground">No trip assigned for today.</p>
            )}
          </TabsContent>
          <TabsContent value="overdue" className="mt-4">
            {overdueTrips.length === 0
              ? <p className="py-10 text-center text-muted-foreground">Nothing overdue. 🌿</p>
              : <div className="grid gap-3">
                  {overdueTrips.map((t) => (
                    <Card key={t.id} className="border-rose-400/60">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{new Date(t.trip_date).toLocaleDateString()}</p>
                          <p className="text-xs text-muted-foreground">{t.stops.filter((s) => !s.delivered_at).length} stops pending</p>
                        </div>
                        <Button asChild size="sm" variant="outline"><Link to="/admin/my-trips">Open</Link></Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>}
          </TabsContent>
          <TabsContent value="recent" className="mt-4">
            <div className="grid gap-3">
              {driverTrips.map((t) => (
                <Card key={t.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{new Date(t.trip_date).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground">{t.stops.length} stops · {t.status}</p>
                    </div>
                    <Button asChild size="sm" variant="outline"><Link to="/admin/my-trips">Open</Link></Button>
                  </CardContent>
                </Card>
              ))}
              {driverTrips.length === 0 && <p className="py-10 text-center text-muted-foreground">No recent trips.</p>}
            </div>
          </TabsContent>
        </Tabs>
      ) : primaryRole === "warehouse" ? (
        <Tabs defaultValue="waiting" className="mt-6">
          <TabsList className="w-full justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="waiting" className="whitespace-nowrap">Waiting ({warehouseWaiting.length})</TabsTrigger>
            <TabsTrigger value="dispatched" className="whitespace-nowrap">Dispatched today ({warehouseDispatchedToday})</TabsTrigger>
          </TabsList>
          <TabsContent value="waiting" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {warehouseWaiting.map((j) => <WarehouseJobCard key={j.id} j={j} />)}
              {warehouseWaiting.length === 0 && <p className="col-span-full py-10 text-center text-muted-foreground">Nothing waiting.</p>}
            </div>
          </TabsContent>
          <TabsContent value="dispatched" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {warehouseJobs.filter((j) => j.warehouse_status === "dispatched" && (j.status_updated_at ?? "").slice(0, 10) === todayIso)
                .map((j) => <WarehouseJobCard key={j.id} j={j} />)}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs defaultValue="current" className="mt-6">
          <TabsList className="w-full justify-start overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="current" className="whitespace-nowrap">Current ({pendingTasks.length})</TabsTrigger>
            <TabsTrigger value="overdue" className="whitespace-nowrap">Overdue ({overdueTasks.length})</TabsTrigger>
            <TabsTrigger value="history" className="whitespace-nowrap">History ({doneTasks.length})</TabsTrigger>
            <TabsTrigger value="quotes" className="whitespace-nowrap">My quotations ({quotations.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {pendingTasks.map((t) => <TaskCard key={t.id} t={t} />)}
              {pendingTasks.length === 0 && (
                <p className="col-span-full py-10 text-center text-muted-foreground">No pending tasks. Enjoy the calm 🌿</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="overdue" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {overdueTasks.map((t) => <TaskCard key={t.id} t={t} />)}
              {overdueTasks.length === 0 && (
                <p className="col-span-full py-10 text-center text-muted-foreground">Nothing overdue. 🌿</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {doneTasks.map((t) => <TaskCard key={t.id} t={t} />)}
              {doneTasks.length === 0 && (
                <p className="col-span-full py-10 text-center text-muted-foreground">No completed tasks yet.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="quotes" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {quotations.map((q) => <QuoteCard key={q.id} q={q} />)}
              {quotations.length === 0 && (
                <p className="col-span-full py-10 text-center text-muted-foreground">You haven't created any quotations yet.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{roles.join(", ") || "user"}</span>
      </p>
    </AdminShell>
  );
};

const StatCard = ({ label, value, icon: Icon, sub }: { label: string; value: number; icon: any; sub?: string }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        <Icon className="h-4 w-4 text-primary" />
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="font-display text-3xl font-semibold text-primary">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </CardContent>
  </Card>
);

export default AdminMyWork;