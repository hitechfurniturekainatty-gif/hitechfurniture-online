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
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  FileText,
  HardHat,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  COMPLAINT_STATUSES,
  complaintStatusLabel,
  statusVariant,
} from "@/lib/serviceHub";
import { DeliveryRoutePicker } from "@/components/logistics/DeliveryRoutePicker";
import { MultiImagePicker } from "@/components/admin/MultiImagePicker";

type Complaint = {
  id: string;
  complaint_code: string;
  customer_name: string;
  customer_phone: string | null;
  customer_place: string;
  customer_address: string | null;
  original_quotation_id: string | null;
  original_quotation_code: string | null;
  issue_description: string;
  photos: string | null;
  paid_parts_amount: number;
  paid_parts_description: string | null;
  notes: string | null;
  status: string;
  delivery_route_id: string | null;
  delivery_place: string | null;
  service_quotation_id: string | null;
  created_at: string;
};

type Worker = { id: string; name: string; whatsapp_number: string; trade: string | null };

const AdminComplaintEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [cp, setCp] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [linkedQt, setLinkedQt] = useState<{ id: string; quotation_id: string } | null>(null);

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobOpen, setJobOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [jobNotes, setJobNotes] = useState("");
  const [assigningJob, setAssigningJob] = useState(false);
  const [existingJobs, setExistingJobs] = useState<Array<{ id: string; worker_name: string; status: string; created_at: string }>>([]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [cpRes, workersRes] = await Promise.all([
      supabase.from("customer_complaints").select("*").eq("id", id).maybeSingle(),
      supabase.from("workers").select("id, name, whatsapp_number, trade").eq("is_active", true).order("name"),
    ]);
    if (!cpRes.data) {
      toast({ title: "Complaint not found", variant: "destructive" });
      navigate("/admin/services?tab=complaint");
      return;
    }
    setCp(cpRes.data as Complaint);
    setWorkers((workersRes.data ?? []) as Worker[]);

    if (cpRes.data.service_quotation_id) {
      const { data: qData } = await supabase.from("quotations").select("id, quotation_id").eq("id", cpRes.data.service_quotation_id).maybeSingle();
      setLinkedQt(qData ?? null);
    } else {
      setLinkedQt(null);
    }

    const { data: jobsData } = await supabase
      .from("job_work_orders")
      .select("id, status, created_at, workers(name)")
      .eq("source_complaint_id", id)
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

  const update = (patch: Partial<Complaint>) => setCp((prev) => (prev ? { ...prev, ...patch } : prev));

  const save = async () => {
    if (!cp) return;
    setSaving(true);
    const { error } = await supabase
      .from("customer_complaints")
      .update({
        customer_name: cp.customer_name,
        customer_phone: cp.customer_phone,
        customer_place: cp.customer_place,
        customer_address: cp.customer_address,
        original_quotation_code: cp.original_quotation_code,
        issue_description: cp.issue_description,
        photos: cp.photos,
        paid_parts_amount: Number(cp.paid_parts_amount) || 0,
        paid_parts_description: cp.paid_parts_description,
        notes: cp.notes,
        status: cp.status,
        delivery_route_id: cp.delivery_route_id,
        delivery_place: cp.delivery_place,
      })
      .eq("id", cp.id);
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved" });
  };

  const generateServiceQuotation = async () => {
    if (!cp) return;
    if (cp.service_quotation_id) {
      navigate(`/admin/quotations/${cp.service_quotation_id}`);
      return;
    }
    setGenerating(true);
    const { data: qid, error: qidErr } = await supabase.rpc("next_quotation_id" as any, {
      _party: cp.customer_name,
      _place: cp.customer_place || "NA",
    });
    if (qidErr || !qid) {
      setGenerating(false);
      toast({ title: "Failed to generate ID", description: qidErr?.message, variant: "destructive" });
      return;
    }
    const { data: qData, error: qErr } = await supabase
      .from("quotations")
      .insert({
        quotation_id: qid as string,
        party_name: cp.customer_name,
        party_place: cp.customer_place || "NA",
        party_phone: cp.customer_phone,
        party_address: cp.customer_address,
        delivery_place: cp.delivery_place || cp.customer_place,
        delivery_route_id: cp.delivery_route_id,
        document_type: "quotation",
        service_type: "complaint-repair",
        source_complaint_id: cp.id,
        notes: `Complaint Ref: ${cp.complaint_code}${cp.original_quotation_code ? `\nOriginal: ${cp.original_quotation_code}` : ""}`,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (qErr || !qData) {
      setGenerating(false);
      toast({ title: "Convert failed", description: qErr?.message, variant: "destructive" });
      return;
    }
    // Pre-fill a starting line item from the paid parts (if any) or generic repair
    await supabase.from("quotation_items").insert({
      quotation_id: qData.id,
      description: cp.paid_parts_description || `Repair: ${cp.issue_description.slice(0, 100)}`,
      quantity: 1,
      unit_price: Number(cp.paid_parts_amount) || 0,
      display_order: 0,
    });
    await supabase.from("customer_complaints").update({ service_quotation_id: qData.id }).eq("id", cp.id);
    setGenerating(false);
    toast({ title: "Service Quotation generated", description: qid as string });
    navigate(`/admin/quotations/${qData.id}`);
  };

  const assignWorker = async () => {
    if (!cp || !selectedWorker) {
      toast({ title: "Pick a worker", variant: "destructive" });
      return;
    }
    setAssigningJob(true);
    const { error } = await supabase.from("job_work_orders").insert({
      worker_id: selectedWorker,
      quotation_id: null,
      source_complaint_id: cp.id,
      job_type: "complaint",
      is_urgent: true,
      item_ids: [],
      notes: jobNotes || `Complaint ${cp.complaint_code}: ${cp.issue_description}`,
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
    if (!cp || !confirm(`Delete ${cp.complaint_code}?`)) return;
    const { error } = await supabase.from("customer_complaints").delete().eq("id", cp.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); navigate("/admin/services?tab=complaint"); }
  };

  const headerBadges = useMemo(() => {
    if (!cp) return null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base font-semibold text-amber-600 dark:text-amber-400">{cp.complaint_code}</span>
        <Badge variant={statusVariant(cp.status)} className="capitalize">
          {complaintStatusLabel(cp.status)}
        </Badge>
        {cp.original_quotation_code && (
          <Badge variant="outline">Re: {cp.original_quotation_code}</Badge>
        )}
        {linkedQt && (
          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
            <FileText className="mr-1 h-3 w-3" /> {linkedQt.quotation_id}
          </Badge>
        )}
      </div>
    );
  }, [cp, linkedQt]);

  if (loading || !cp) {
    return (
      <AdminShell>
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      </AdminShell>
    );
  }

  const hasPaidParts = Number(cp.paid_parts_amount) > 0;

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/services?tab=complaint"><ArrowLeft className="mr-1 h-4 w-4" /> Back to Hub</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {!linkedQt ? (
            <Button onClick={generateServiceQuotation} disabled={generating} variant={hasPaidParts ? "default" : "outline"}>
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileText className="mr-1 h-4 w-4" /> Generate Service Quotation
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
                        <SelectItem key={w.id} value={w.id}>{w.name}{w.trade ? ` — ${w.trade}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes for technician</Label>
                  <Textarea rows={3} value={jobNotes} onChange={(e) => setJobNotes(e.target.value)} />
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
            <Button variant="ghost" size="icon" onClick={remove} aria-label="Delete complaint">
              <Trash2 className="h-5 w-5 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-4 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>{headerBadges}<p className="mt-1 text-sm text-muted-foreground">Customer Complaint</p></div>
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
              <Input value={cp.customer_name} onChange={(e) => update({ customer_name: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={cp.customer_phone ?? ""} onChange={(e) => update({ customer_phone: e.target.value })} />
            </div>
            <DeliveryRoutePicker
              place={cp.customer_place}
              routeId={cp.delivery_route_id}
              onChange={(next) => update({ customer_place: next.place, delivery_route_id: next.routeId })}
              label="Customer Place / Route *"
            />
            <div>
              <Label>Address</Label>
              <Textarea rows={2} value={cp.customer_address ?? ""} onChange={(e) => update({ customer_address: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={cp.status} onValueChange={(v) => update({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPLAINT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{complaintStatusLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Issue (warranty / service)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Original Invoice / Quotation ID</Label>
              <Input
                value={cp.original_quotation_code ?? ""}
                onChange={(e) => update({ original_quotation_code: e.target.value })}
                placeholder="e.g. 2026/27-024 / Rahul / Kalpetta"
              />
            </div>
            <div>
              <Label>Issue Description *</Label>
              <Textarea rows={4} value={cp.issue_description} onChange={(e) => update({ issue_description: e.target.value })} />
            </div>
            <div>
              <Label>Internal Notes</Label>
              <Textarea rows={2} value={cp.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Paid replacement parts (optional)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Leave empty for warranty work. Add a price only if the customer is paying for a replacement part.
              No GST or discount is shown here — for formal billing, click "Generate Service Quotation".
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label>Part description</Label>
              <Input
                value={cp.paid_parts_description ?? ""}
                onChange={(e) => update({ paid_parts_description: e.target.value })}
                placeholder="e.g. New foam cushion"
              />
            </div>
            <div>
              <Label>Part price (₹)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={cp.paid_parts_amount ?? 0}
                onChange={(e) => update({ paid_parts_amount: Number(e.target.value) || 0 })}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Photos of Complaint</CardTitle></CardHeader>
          <CardContent>
            <MultiImagePicker
              value={cp.photos}
              onChange={(joined) => update({ photos: joined })}
              folder="complaint-photos"
              label="Add photos showing the issue"
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
                      <p className="text-xs text-muted-foreground">{new Date(j.created_at).toLocaleString()}</p>
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

export default AdminComplaintEditor;