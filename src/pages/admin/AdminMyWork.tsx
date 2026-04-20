import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Clock, CheckCircle2, MapPin, Phone, FileText, Ruler, ArrowRight, User as UserIcon, CalendarDays } from "lucide-react";

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

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};

const AdminMyWork = () => {
  const { user, isAdmin, isOfficeStaff, isMeasurementStaff, roles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [profile, setProfile] = useState<{ display_name: string | null; email: string | null } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const run = async () => {
      setLoading(true);
      const monthStart = startOfMonth();
      const profilePromise = supabase.from("profiles").select("display_name,email").eq("user_id", user.id).maybeSingle();
      const taskPromise = (isMeasurementStaff && !isOfficeStaff)
        ? supabase.from("measurement_tasks").select("*").eq("assigned_to", user.id).order("created_at", { ascending: false })
        : supabase.from("measurement_tasks").select("*").eq("created_by", user.id).order("created_at", { ascending: false });
      const quotePromise = supabase.from("quotations")
        .select("id,quotation_id,party_name,party_place,status,total,created_at,created_by")
        .eq("created_by", user.id).order("created_at", { ascending: false });

      const [pRes, tRes, qRes] = await Promise.all([profilePromise, taskPromise, quotePromise]);
      setProfile(pRes.data ?? { display_name: user.email?.split("@")[0] ?? null, email: user.email ?? null });
      setTasks((tRes.data ?? []) as Task[]);
      setQuotations((qRes.data ?? []) as Quotation[]);
      setLoading(false);
      // unused but referenced for clarity
      void monthStart;
    };
    run();
  }, [user?.id, isMeasurementStaff, isOfficeStaff]);

  const monthStartIso = useMemo(() => startOfMonth(), []);

  const pendingTasks = tasks.filter((t) => t.status !== "completed");
  const doneTasks = tasks.filter((t) => t.status === "completed");
  const doneThisMonth = doneTasks.filter((t) => (t.completed_at ?? t.created_at) >= monthStartIso);
  const quotesThisMonth = quotations.filter((q) => q.created_at >= monthStartIso);

  const roleLabel = isAdmin
    ? "Admin"
    : isMeasurementStaff && !isOfficeStaff
      ? "Measurement Staff"
      : "Office Staff";

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
            <Badge variant={q.status === "draft" ? "outline" : "secondary"} className="capitalize">{q.status}</Badge>
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

  return (
    <AdminShell>
      {/* Profile header */}
      <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
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
            <Button asChild size="sm"><Link to="/admin/measurement-tasks">All tasks</Link></Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pending tasks" value={pendingTasks.length} icon={Clock} />
        <StatCard label="Tasks completed" value={doneTasks.length} icon={CheckCircle2} />
        <StatCard label="Done this month" value={doneThisMonth.length} icon={CalendarDays} />
        <StatCard label="My quotations" value={quotations.length} icon={FileText} sub={`${quotesThisMonth.length} this month`} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="current" className="mt-6">
          <TabsList className="w-full justify-start overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="current" className="whitespace-nowrap">Current ({pendingTasks.length})</TabsTrigger>
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
