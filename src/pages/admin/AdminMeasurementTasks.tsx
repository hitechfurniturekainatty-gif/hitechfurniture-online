import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, MapPin, Phone, Ruler, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

type Task = {
  id: string;
  customer_name: string;
  customer_place: string;
  customer_phone: string | null;
  customer_address: string | null;
  requirement: string | null;
  status: string;
  assigned_to: string;
  created_at: string;
  completed_at: string | null;
  draft_quotation_id: string | null;
};

type StaffOpt = { user_id: string; email: string | null; display_name: string | null; role: string | null };

const AdminMeasurementTasks = () => {
  const { user, isOfficeStaff, isMeasurementStaff } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_place: "",
    customer_phone: "",
    customer_address: "",
    requirement: "",
    assigned_to: "",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("measurement_tasks").select("*").order("created_at", { ascending: false });
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  };

  const loadStaff = async () => {
    if (!isOfficeStaff) return;
    const { data } = await supabase.functions.invoke("list-staff-users");
    const all = (data?.users ?? []) as StaffOpt[];
    setStaff(all.filter((u) => u.role === "measurement_staff" || u.role === "staff" || u.role === "admin"));
  };

  useEffect(() => {
    load();
    loadStaff();
  }, [isOfficeStaff]);

  const create = async () => {
    if (!form.customer_name || !form.customer_place || !form.assigned_to) {
      toast({ title: "Customer name, place and assignee required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("measurement_tasks").insert({
      customer_name: form.customer_name.trim(),
      customer_place: form.customer_place.trim(),
      customer_phone: form.customer_phone.trim() || null,
      customer_address: form.customer_address.trim() || null,
      requirement: form.requirement.trim() || null,
      assigned_to: form.assigned_to,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Measurement task assigned" });
    setOpen(false);
    setForm({ customer_name: "", customer_place: "", customer_phone: "", customer_address: "", requirement: "", assigned_to: "" });
    load();
  };

  const startMeasurement = async (t: Task) => {
    // Measurement staff: open or create draft quotation tied to this task
    if (t.draft_quotation_id) {
      navigate(`/admin/quotations/${t.draft_quotation_id}`);
      return;
    }
    // create draft quotation
    const { data: qid, error: qidErr } = await supabase.rpc("next_quotation_id", {
      _party: t.customer_name,
      _place: t.customer_place,
    });
    if (qidErr) {
      toast({ title: "Failed to create draft", description: qidErr.message, variant: "destructive" });
      return;
    }
    const { data: q, error } = await supabase.from("quotations").insert({
      quotation_id: qid as string,
      party_name: t.customer_name,
      party_place: t.customer_place,
      party_phone: t.customer_phone,
      party_address: t.customer_address,
      notes: t.requirement,
      status: "draft",
      created_by: user?.id ?? null,
      source_task_id: t.id,
    }).select("id").single();
    if (error || !q) {
      toast({ title: "Failed to create draft", description: error?.message, variant: "destructive" });
      return;
    }
    await supabase.from("measurement_tasks").update({ draft_quotation_id: q.id, status: "in_progress" }).eq("id", t.id);
    navigate(`/admin/quotations/${q.id}`);
  };

  const staffName = (id: string) => {
    const s = staff.find((x) => x.user_id === id);
    return s ? (s.display_name || s.email || id.slice(0, 8)) : id.slice(0, 8);
  };

  const myTasks = tasks.filter((t) => t.assigned_to === user?.id);
  const otherTasks = tasks.filter((t) => t.assigned_to !== user?.id);
  const pending = (list: Task[]) => list.filter((t) => t.status !== "completed");
  const done = (list: Task[]) => list.filter((t) => t.status === "completed");

  const TaskCard = ({ t, mine }: { t: Task; mine: boolean }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{t.customer_name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{t.customer_place}</p>
            {t.customer_phone && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{t.customer_phone}</p>}
            {t.requirement && <p className="text-sm mt-2 text-foreground/80">{t.requirement}</p>}
            {!mine && isOfficeStaff && (
              <p className="text-xs mt-2 text-muted-foreground">Assigned to: <span className="font-medium text-foreground">{staffName(t.assigned_to)}</span></p>
            )}
          </div>
          <Badge variant={t.status === "completed" ? "default" : t.status === "in_progress" ? "secondary" : "outline"}>
            {t.status === "completed" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <Clock className="mr-1 h-3 w-3" />}
            {t.status}
          </Badge>
        </div>
        <div className="mt-3 flex gap-2">
          {mine && t.status !== "completed" && (
            <Button size="sm" onClick={() => startMeasurement(t)}>
              <Ruler className="mr-1.5 h-3.5 w-3.5" /> {t.draft_quotation_id ? "Continue" : "Start measurement"}
            </Button>
          )}
          {t.draft_quotation_id && (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/admin/quotations/${t.draft_quotation_id}`}>Open draft <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminShell>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Measurement Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">Assign field staff to capture customer measurements.</p>
        </div>
        {isOfficeStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New task</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign measurement task</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Customer name *</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Place *</Label><Input value={form.customer_place} onChange={(e) => setForm({ ...form, customer_place: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Phone</Label><Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5"><Label>Address</Label><Textarea rows={2} value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Requirement / brief</Label><Textarea rows={2} value={form.requirement} onChange={(e) => setForm({ ...form, requirement: e.target.value })} placeholder="e.g. L-shape sofa for living room, modular wardrobe..." /></div>
                <div className="space-y-1.5">
                  <Label>Assign to *</Label>
                  <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                    <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                    <SelectContent>
                      {staff.map((s) => (
                        <SelectItem key={s.user_id} value={s.user_id}>
                          {s.display_name || s.email} {s.role === "measurement_staff" ? "(Field)" : s.role === "admin" ? "(Admin)" : "(Staff)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={create} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine">My tasks ({pending(myTasks).length})</TabsTrigger>
            {isOfficeStaff && <TabsTrigger value="all">All ({pending(otherTasks).length + pending(myTasks).length})</TabsTrigger>}
            <TabsTrigger value="done">Completed ({done(tasks).length})</TabsTrigger>
          </TabsList>
          <TabsContent value="mine" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {pending(myTasks).map((t) => <TaskCard key={t.id} t={t} mine />)}
              {pending(myTasks).length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">No pending tasks.</p>}
            </div>
          </TabsContent>
          {isOfficeStaff && (
            <TabsContent value="all" className="mt-4">
              <div className="grid gap-3 md:grid-cols-2">
                {pending(tasks).map((t) => <TaskCard key={t.id} t={t} mine={t.assigned_to === user?.id} />)}
                {pending(tasks).length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">No pending tasks.</p>}
              </div>
            </TabsContent>
          )}
          <TabsContent value="done" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {done(tasks).map((t) => <TaskCard key={t.id} t={t} mine={t.assigned_to === user?.id} />)}
              {done(tasks).length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">No completed tasks yet.</p>}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </AdminShell>
  );
};

export default AdminMeasurementTasks;
