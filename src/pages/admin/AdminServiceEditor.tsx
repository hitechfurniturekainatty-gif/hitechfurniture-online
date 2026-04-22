import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  HardHat,
  Loader2,
  Save,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  SERVICE_STATUSES,
  serviceStatusLabel,
  statusVariant,
} from "@/lib/serviceHub";
import { DeliveryRoutePicker } from "@/components/logistics/DeliveryRoutePicker";
import { MultiImagePicker } from "@/components/admin/MultiImagePicker";

type Service = {
  id: string;
  service_code: string;
  customer_name: string;
  customer_phone: string | null;
  customer_place: string;
  customer_address: string | null;
  item_description: string;
  work_needed: string | null;
  estimated_cost: number;
  notes: string | null;
  photos: string | null;
  status: string;
  delivery_route_id: string | null;
  delivery_place: string | null;
  quotation_id: string | null;
  created_at: string;
};

type Worker = { id: string; name: string; whatsapp_number: string; trade: string | null };

const AdminServiceEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [svc, setSvc] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);

  const [linkedQt, setLinkedQt] = useState<{ id: string; quotation_id: string } | null>(null);

  // Worker assignment
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobOpen, setJobOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [jobNotes, setJobNotes] = useState("");
  const [assigningJob, setAssigningJob] = useState(false);
  const [existingJobs, setExistingJobs] = useState<Array<{ id: string; worker_name: string; status: string; created_at: string }>>([]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [svcRes, workersRes] = await Promise.all([
      supabase.from("customer_services").select("*").eq("id", id).maybeSingle(),
      supabase.from("workers").select("id, name, whatsapp_number, trade").eq("is_active", true).order("name"),
    ]);
    if (!svcRes.data) {
      toast({ title: "Service not found", variant: "destructive" });
      navigate("/admin/services");
      return;
    }
    setSvc(svcRes.data as Service);
    setWorkers((workersRes.data ?? []) as Worker[]);

    if (svcRes.data.quotation_id) {
      const { data: qData } = await supabase.from("quotations").select("id, quotation_id").eq("id", svcRes.data.quotation_id).maybeSingle();
      setLinkedQt(qData ?? null);
    } else {
      setLinkedQt(null);
    }

    // Fetch existing job orders for this service
    const { data: jobsData } = await supabase
      .from("job_work_orders")
      .select("id, status, created_at, workers(name)")
      .eq("source_service_id", id)
      .order("created_at", { ascending: false });
    setExistingJobs(
      (jobsData ?? []).map((j: any) => ({
        id: j.id,
        status: j.status,
        created_at: j.created_at,
        worker_name: j.workers?.name ?? "—",
      })),
    );

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const update = (patch: Partial<Service>) => setSvc((prev) => (prev ? { ...prev, ...patch } : prev));

  const save = async () => {
    if (!svc) return;
    setSaving(true);
    const { error } = await supabase
      .from("customer_services")
      .update({
        customer_name: svc.customer_name,
        customer_phone: svc.customer_phone,
        customer_place: svc.customer_place,
        customer_address: svc.customer_address,
        item_description: svc.item_description,
        work_needed: svc.work_needed,
        estimated_cost: Number(svc.estimated_cost) || 0,
        notes: svc.notes,
        photos: svc.photos,
        status: svc.status,
        delivery_route_id: svc.delivery_route_id,
        delivery_place: svc.delivery_place,
      })
      .eq("id", svc.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved" });
    }
  };

  const convertToQuotation = async () => {
    if (!svc) return;
    if (svc.quotation_id) {
      navigate(`/admin/quotations/${svc.quotation_id}`);
      return;
    }
    setConverting(true);
    // 1) Generate a real QT-XXX id using the same FY counter as regular quotes
    const { data: qid, error: qidErr } = await supabase.rpc("next_quotation_id" as any, {
      _party: svc.customer_name,
      _place: svc.customer_place || "NA",
    });
    if (qidErr || !qid) {
      setConverting(false);
      toast({ title: "Failed to generate ID", description: qidErr?.message, variant: "destructive" });
      return;
    }
    // 2) Create the quotation tagged service-type with first line pre-filled from the service
    const { data: qData, error: qErr } = await supabase
      .from("quotations")
      .insert({
        quotation_id: qid as string,
        party_name: svc.customer_name,
        party_place: svc.customer_place || "NA",
        party_phone: svc.customer_phone,
        party_address: svc.customer_address,
        delivery_place: svc.delivery_place || svc.customer_place,
        delivery_route_id: svc.delivery_route_id,
        document_type: "quotation",
        service_type: "service",
        source_service_id: svc.id,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (qErr || !qData) {
      setConverting(false);
      toast({ title: "Convert failed", description: qErr?.message, variant: "destructive" });
      return;
    }
    // 3) Pre-fill a starting line item from the service details
    await supabase.from("quotation_items").insert({
      quotation_id: qData.id,
      description: `${svc.item_description}${svc.work_needed ? ` — ${svc.work_needed}` : ""}`,
      quantity: 1,
      unit_price: Number(svc.estimated_cost) || 0,
      display_order: 0,
    });
    // 4) Link back & flip status
    await supabase
      .from("customer_services")
      .update({ quotation_id: qData.id, status: "converted" })
      .eq("id", svc.id);

    setConverting(false);
    toast({ title: "Converted to Quotation", description: qid as string });
    navigate(`/admin/quotations/${qData.id}`);
  };

  const assignWorker = async () => {
    if (!svc || !selectedWorker) {
      toast({ title: "Pick a worker", variant: "destructive" });
      return;
    }
    setAssigningJob(true);
    const { error } = await supabase.from("job_work_orders").insert({
      worker_id: selectedWorker,
      quotation_id: null,
      source_service_id: svc.id,
      job_type: "service",
      is_urgent: true,
      item_ids: [],
      notes: jobNotes || `Service: ${svc.item_description}${svc.work_needed ? ` — ${svc.work_needed}` : ""}`,
      created_by: user?.id ?? null,
    });
    setAssigningJob(false);
    if (error) {
      toast({ title: "Assign failed", description: error.message, variant: "destructive" });
      return;
    }
    setJobOpen(false);
    setJobNotes("");
    setSelectedWorker("");
    toast({ title: "Technician assigned", description: "URGENT SERVICE job sent." });
    load();
  };

  const remove = async () => {
    if (!svc || !confirm(`Delete ${svc.service_code}?`)) return;
    const { error } = await supabase.from("customer_services").delete().eq("id", svc.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); navigate("/admin/services"); }
  };

  const headerBadges = useMemo(() => {
    if (!svc) return null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base font-semibold text-primary">{svc.service_code}</span>
        <Badge variant={statusVariant(svc.status)} className="capitalize">
          {serviceStatusLabel(svc.status)}
        </Badge>
        {linkedQt && (
          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
            <FileText className="mr-1 h-3 w-3" /> {linkedQt.quotation_id}
          </Badge>
        )}
      </div>
    );
  }, [svc, linkedQt]);

  if (loading || !svc) {
    return (
      <AdminShell>
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/services?tab=service"><ArrowLeft className="mr-1 h-4 w-4" /> Back to Hub</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {!linkedQt ? (
            <Button onClick={convertToQuotation} disabled={converting}>
              {converting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileText className="mr-1 h-4 w-4" /> Convert to Quotation
            </Button>
          ) : (
            <Button asChild>
              <Link to={`/admin/quotations/${linkedQt.id}`}>Open Quotation <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          )}
          <Dialog open={jobOpen} onOpenChange={setJobOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><HardHat className="mr-1 h-4 w-4" /> Assign Technician</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign Technician (URGENT SERVICE)</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Worker</Label>
                  <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                    <SelectTrigger><SelectValue placeholder="Select a worker…" /></SelectTrigger>
                    <SelectContent>
                      {workers.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}{w.trade ? ` — ${w.trade}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes for technician</Label>
                  <Textarea rows={3} value={jobNotes} onChange={(e) => setJobNotes(e.target.value)} placeholder="Anything specific…" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setJobOpen(false)}>Cancel</Button>
                <Button onClick={assignWorker} disabled={assigningJob}>
                  {assigningJob && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Assign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {isAdmin && (
            <Button variant="ghost" size="icon" onClick={remove} aria-label="Delete service">
              <Trash2 className="h-5 w-5 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Wrench className="h-6 w-6" />
            </div>
            <div>{headerBadges}<p className="mt-1 text-sm text-muted-foreground">Customer Service</p></div>
          </div>
          <Button onClick={save} disabled={saving} size="lg">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Save className="mr-1 h-4 w-4" /> Save changes
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={svc.customer_name} onChange={(e) => update({ customer_name: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={svc.customer_phone ?? ""} onChange={(e) => update({ customer_phone: e.target.value })} />
            </div>
            <DeliveryRoutePicker
              place={svc.customer_place}
              routeId={svc.delivery_route_id}
              onChange={(next) => update({ customer_place: next.place, delivery_route_id: next.routeId })}
              label="Customer Place / Route *"
            />
            <div>
              <Label>Address</Label>
              <Textarea rows={2} value={svc.customer_address ?? ""} onChange={(e) => update({ customer_address: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={svc.status} onValueChange={(v) => update({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{serviceStatusLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Service Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Item / Product *</Label>
              <Input value={svc.item_description} onChange={(e) => update({ item_description: e.target.value })} />
            </div>
            <div>
              <Label>Work Needed</Label>
              <Textarea rows={3} value={svc.work_needed ?? ""} onChange={(e) => update({ work_needed: e.target.value })} />
            </div>
            <div>
              <Label>Estimated Cost (₹)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={svc.estimated_cost ?? 0}
                onChange={(e) => update({ estimated_cost: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Internal Notes</Label>
              <Textarea rows={2} value={svc.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Site Photos</CardTitle></CardHeader>
          <CardContent>
            <MultiImagePicker
              value={svc.photos}
              onChange={(joined) => update({ photos: joined })}
              folder="service-photos"
              label="Add photos of the item"
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Technician Assignments</CardTitle></CardHeader>
          <CardContent>
            {existingJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No technician assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {existingJobs.map((j) => (
                  <div key={j.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-semibold">{j.worker_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(j.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={statusVariant(j.status)} className="capitalize">{j.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
};

export default AdminServiceEditor;