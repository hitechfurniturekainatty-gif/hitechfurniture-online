import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, ArrowRight, HardHat, Loader2, MessageCircle, FileText, Clock,
  ShoppingCart, History, Camera, Pencil, Save, X,
} from "lucide-react";
import { docTagClasses, isPO, type DocType } from "@/lib/docType";
import { Textarea } from "@/components/ui/textarea";

type Worker = {
  id: string;
  name: string;
  trade: string | null;
  whatsapp_number: string;
  phone: string | null;
  is_active: boolean;
};

type Job = {
  id: string;
  status: string;
  notes: string | null;
  item_ids: string[];
  quotation_id: string;
  created_at: string;
  status_updated_at: string;
  // Joined
  quotation_code: string;
  party_name: string;
  party_place: string;
  document_type: DocType;
};

type StatusUpdate = {
  id: string;
  job_id: string;
  status: string;
  note: string | null;
  photo_url: string | null;
  created_at: string;
  created_by: string | null;
};

export const JOB_STATUSES = [
  { value: "assigned", label: "Job Assigned", tone: "secondary" as const },
  { value: "started", label: "Work Started", tone: "outline" as const },
  { value: "in_progress", label: "In Progress", tone: "default" as const },
  { value: "ready", label: "Ready for Delivery", tone: "default" as const },
  { value: "delivered", label: "Delivered", tone: "outline" as const },
];

export const jobStatusLabel = (s: string) =>
  JOB_STATUSES.find((j) => j.value === s)?.label ?? s;
export const jobStatusTone = (s: string) =>
  JOB_STATUSES.find((j) => j.value === s)?.tone ?? "secondary";

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const AdminWorkerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOfficeStaff } = useAuth();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [historyByJob, setHistoryByJob] = useState<Record<string, StatusUpdate[]>>({});
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [savingNote, setSavingNote] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: w }, { data: js }] = await Promise.all([
      supabase.from("workers").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("job_work_orders")
        .select("id, status, notes, item_ids, quotation_id, created_at, status_updated_at, quotations!inner(quotation_id, party_name, party_place, document_type)")
        .eq("worker_id", id)
        .order("created_at", { ascending: false }),
    ]);
    if (!w) {
      toast({ title: "Worker not found", variant: "destructive" });
      navigate("/admin/workers");
      return;
    }
    setWorker(w as Worker);
    const flat: Job[] = (js ?? []).map((row: any) => ({
      id: row.id,
      status: row.status,
      notes: row.notes,
      item_ids: row.item_ids ?? [],
      quotation_id: row.quotation_id,
      created_at: row.created_at,
      status_updated_at: row.status_updated_at,
      quotation_code: row.quotations?.quotation_id ?? "",
      party_name: row.quotations?.party_name ?? "",
      party_place: row.quotations?.party_place ?? "",
      document_type: (row.quotations?.document_type ?? "quotation") as DocType,
    }));
    setJobs(flat);

    // Bulk-load status history for all of this worker's jobs
    const jobIds = flat.map((j) => j.id);
    if (jobIds.length) {
      const { data: hist } = await supabase
        .from("worker_status_updates")
        .select("id, job_id, status, note, photo_url, created_at, created_by")
        .in("job_id", jobIds)
        .order("created_at", { ascending: false });
      const byJob: Record<string, StatusUpdate[]> = {};
      for (const u of (hist ?? []) as StatusUpdate[]) {
        (byJob[u.job_id] ??= []).push(u);
      }
      setHistoryByJob(byJob);
    } else {
      setHistoryByJob({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const updateStatus = async (job: Job, next: string) => {
    if (next === job.status) return;
    setSavingId(job.id);
    const { error } = await supabase.from("job_work_orders").update({ status: next }).eq("id", job.id);
    setSavingId(null);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Status updated", description: `${job.quotation_code} → ${jobStatusLabel(next)}` });
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, status: next, status_updated_at: new Date().toISOString() } : j)),
    );
  };

  const startEditNote = (job: Job) => {
    setEditingNoteId(job.id);
    setNoteDraft(job.notes ?? "");
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setNoteDraft("");
  };

  const saveNote = async (job: Job) => {
    setSavingNote(true);
    const trimmed = noteDraft.trim() || null;
    const { error } = await supabase
      .from("job_work_orders")
      .update({ notes: trimmed })
      .eq("id", job.id);
    setSavingNote(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Note saved" });
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, notes: trimmed } : j)));
    setEditingNoteId(null);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobs.length };
    for (const s of JOB_STATUSES) c[s.value] = jobs.filter((j) => j.status === s.value).length;
    c.active = jobs.filter((j) => j.status !== "delivered").length;
    return c;
  }, [jobs]);

  const [tab, setTab] = useState<string>("active");
  const filtered = useMemo(() => {
    if (tab === "all") return jobs;
    if (tab === "active") return jobs.filter((j) => j.status !== "delivered");
    return jobs.filter((j) => j.status === tab);
  }, [jobs, tab]);

  if (loading || !worker) {
    return (
      <AdminShell>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-4 flex items-start gap-3">
        <Button variant="outline" size="sm" asChild className="h-9 shrink-0">
          <Link to="/admin/workers" aria-label="Back">
            <ArrowLeft className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Workers</span>
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <HardHat className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl sm:text-2xl">{worker.name}</h1>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {worker.trade && <span>{worker.trade} · </span>}
              <MessageCircle className="inline h-3 w-3 -mt-0.5" /> {worker.whatsapp_number}
              {!worker.is_active && <Badge variant="outline" className="ml-2">Inactive</Badge>}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatPill label="Active" value={counts.active} />
        <StatPill label="Assigned" value={counts.assigned} />
        <StatPill label="In Progress" value={counts.in_progress} />
        <StatPill label="Ready" value={counts.ready} />
        <StatPill label="Delivered" value={counts.delivered} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          {JOB_STATUSES.map((s) => (
            <TabsTrigger key={s.value} value={s.value} className="whitespace-nowrap">
              {s.label} ({counts[s.value] ?? 0})
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="mt-4 grid gap-3">
          {filtered.map((job) => (
            <Card key={job.id} className="overflow-hidden">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {isPO(job.document_type) ? (
                        <ShoppingCart className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                      )}
                      <span className="font-mono text-sm font-semibold">{job.quotation_code}</span>
                      <Badge variant="outline" className={docTagClasses(job.document_type)}>
                        {isPO(job.document_type) ? "PO" : "Quotation"}
                      </Badge>
                      <Badge variant={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm">{job.party_name} · {job.party_place}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.item_ids.length} item(s) · Assigned {fmtDateTime(job.created_at)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> Updated {fmtDateTime(job.status_updated_at)}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="h-9">
                    <Link to={`/admin/quotations/${job.quotation_id}`}>
                      Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>

                {isOfficeStaff && (
                  <div className="rounded-md border border-border/50 bg-muted/30 p-2">
                    {editingNoteId === job.id ? (
                      <div className="space-y-2">
                        <Textarea
                          rows={2}
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="Office note for the worker"
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveNote(job)} disabled={savingNote} className="h-8">
                            {savingNote ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEditNote} disabled={savingNote} className="h-8">
                            <X className="mr-1 h-3.5 w-3.5" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <p className="flex-1 text-xs italic text-muted-foreground">
                          {job.notes ? `"${job.notes}"` : "No office note"}
                        </p>
                        <Button size="sm" variant="ghost" onClick={() => startEditNote(job)} className="h-7 px-2">
                          <Pencil className="mr-1 h-3 w-3" /> Edit
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {!isOfficeStaff && job.notes && (
                  <p className="text-xs italic text-muted-foreground">"{job.notes}"</p>
                )}

                {isOfficeStaff && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                    <span className="text-xs font-medium text-muted-foreground">Update status:</span>
                    <Select
                      value={job.status}
                      onValueChange={(v) => updateStatus(job, v)}
                      disabled={savingId === job.id}
                    >
                      <SelectTrigger className="h-9 w-full sm:w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {savingId === job.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                )}

                {(historyByJob[job.id]?.length ?? 0) > 0 && (
                  <div className="border-t border-border/50 pt-3">
                    <button
                      type="button"
                      onClick={() => setOpenHistory((p) => ({ ...p, [job.id]: !p[job.id] }))}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      <History className="h-3.5 w-3.5" />
                      {openHistory[job.id] ? "Hide" : "Show"} status history ({historyByJob[job.id].length})
                    </button>
                    {openHistory[job.id] && (
                      <ol className="mt-2 space-y-2 border-l-2 border-border pl-3">
                        {historyByJob[job.id].map((u) => (
                          <li key={u.id} className="text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={jobStatusTone(u.status)} className="text-[10px]">
                                {jobStatusLabel(u.status)}
                              </Badge>
                              <span className="text-muted-foreground">{fmtDateTime(u.created_at)}</span>
                            </div>
                            {u.note && (
                              <p className="mt-1 italic text-muted-foreground">"{u.note}"</p>
                            )}
                            {u.photo_url && (
                              <a
                                href={u.photo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                <Camera className="h-3 w-3" /> View photo
                              </a>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">No jobs in this view.</p>
          )}
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
};

const StatPill = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="font-display text-lg font-semibold">{value}</p>
  </div>
);

export default AdminWorkerDetail;