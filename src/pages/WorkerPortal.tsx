import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { HardHat, Loader2, LogOut, Camera, Clock, FileText, ShoppingCart, Image as ImageIcon, CheckCircle2, Eye } from "lucide-react";
import { JOB_STATUSES, jobStatusLabel, jobStatusTone } from "@/pages/admin/AdminWorkerDetail";
import { docTagClasses, isPO, type DocType } from "@/lib/docType";
import { BRAND_NAME } from "@/lib/brand";
import { compressImage } from "@/lib/imageCompression";
import { DownloadShareMenu } from "@/components/admin/DownloadShareMenu";
import { downloadBlob } from "@/lib/pdf";

type WorkerRow = { id: string; name: string; trade: string | null };

type Job = {
  id: string;
  status: string;
  notes: string | null;
  item_ids: string[];
  quotation_id: string;
  created_at: string;
  status_updated_at: string;
  is_urgent: boolean;
  quotation_code: string;
  party_place: string;
  document_type: DocType;
  items: ItemBrief[];
  last_office_edit: OfficeEdit | null;
};

type ItemBrief = {
  id: string;
  description: string;
  quantity: number;
  measurement: string | null;
  item_image_url: string | null;
  measurement_image_url: string | null;
  sketch_url: string | null;
};

type OfficeEdit = {
  status: string;
  note: string | null;
  created_at: string;
  editor_name: string | null;
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const WorkerPortal = () => {
  const navigate = useNavigate();
  const { user, isWorker, loading: authLoading, signOut } = useAuth();
  const [worker, setWorker] = useState<WorkerRow | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [dialogJob, setDialogJob] = useState<Job | null>(null);
  const [nextStatus, setNextStatus] = useState<string>("");
  const [note, setNote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/worker/login", { replace: true }); return; }
    if (!isWorker) { navigate("/worker/login", { replace: true }); return; }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isWorker]);

  const load = async () => {
    setLoading(true);
    const { data: w } = await supabase
      .from("workers")
      .select("id, name, trade")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (!w) {
      toast({ title: "Worker profile not linked", description: "Contact the office.", variant: "destructive" });
      setLoading(false);
      return;
    }
    setWorker(w as WorkerRow);

    const { data: js, error } = await supabase
      .from("job_work_orders")
      .select("id, status, notes, item_ids, quotation_id, created_at, status_updated_at, is_urgent, quotations!inner(quotation_id, party_place, document_type)")
      .eq("worker_id", w.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Pull items for these jobs in one go
    const allItemIds = Array.from(new Set((js ?? []).flatMap((j: any) => j.item_ids ?? [])));
    let itemsById: Record<string, ItemBrief> = {};
    if (allItemIds.length) {
      const { data: items } = await supabase
        .from("quotation_items")
        .select("id, description, quantity, measurement, item_image_url, measurement_image_url, sketch_url")
        .in("id", allItemIds);
      for (const it of (items ?? []) as ItemBrief[]) itemsById[it.id] = it;
    }

    // Pull latest office edits per job (status updates created by office staff/admin, not the worker)
    const jobIds = (js ?? []).map((j: any) => j.id);
    const lastOfficeEditByJob: Record<string, OfficeEdit> = {};
    if (jobIds.length) {
      const { data: updates } = await supabase
        .from("worker_status_updates")
        .select("job_id, status, note, created_at, created_by, worker_id")
        .in("job_id", jobIds)
        .order("created_at", { ascending: false });
      // An office edit is one whose created_by is NOT the worker's linked user
      const officeUpdates = (updates ?? []).filter((u: any) => u.created_by && u.created_by !== user!.id);
      const editorIds = Array.from(new Set(officeUpdates.map((u: any) => u.created_by)));
      let editorNames: Record<string, string> = {};
      if (editorIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", editorIds);
        for (const p of (profs ?? []) as any[]) {
          editorNames[p.user_id] = p.display_name || p.email || "Office";
        }
      }
      for (const u of officeUpdates as any[]) {
        if (!lastOfficeEditByJob[u.job_id]) {
          lastOfficeEditByJob[u.job_id] = {
            status: u.status,
            note: u.note,
            created_at: u.created_at,
            editor_name: editorNames[u.created_by] ?? "Office",
          };
        }
      }
    }

    setJobs((js ?? []).map((row: any) => ({
      id: row.id,
      status: row.status,
      notes: row.notes,
      item_ids: row.item_ids ?? [],
      quotation_id: row.quotation_id,
      created_at: row.created_at,
      status_updated_at: row.status_updated_at,
      is_urgent: row.is_urgent,
      quotation_code: row.quotations?.quotation_id ?? "",
      party_place: row.quotations?.party_place ?? "",
      document_type: (row.quotations?.document_type ?? "quotation") as DocType,
      items: (row.item_ids ?? []).map((id: string) => itemsById[id]).filter(Boolean),
      last_office_edit: lastOfficeEditByJob[row.id] ?? null,
    })));
    setLoading(false);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobs.length };
    for (const s of JOB_STATUSES) c[s.value] = jobs.filter((j) => j.status === s.value).length;
    c.active = jobs.filter((j) => j.status !== "delivered").length;
    return c;
  }, [jobs]);

  const [tab, setTab] = useState("active");
  const filtered = useMemo(() => {
    if (tab === "all") return jobs;
    if (tab === "active") return jobs.filter((j) => j.status !== "delivered");
    return jobs.filter((j) => j.status === tab);
  }, [jobs, tab]);

  const openUpdate = (job: Job) => {
    setDialogJob(job);
    setNextStatus(job.status);
    setNote("");
    setPhotoFile(null);
  };

  const submitUpdate = async () => {
    if (!dialogJob) return;
    setSubmitting(true);
    try {
      let photoUrl: string | null = null;
      if (photoFile) {
        const compressed = await compressImage(photoFile);
        const path = `worker-updates/${dialogJob.id}/${Date.now()}-${photoFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("quotation-images").upload(path, compressed);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("quotation-images").getPublicUrl(path);
        photoUrl = pub.publicUrl;
      }

      // 1) Update the job status (trigger will auto-create a status row, but we want note+photo too)
      const statusChanged = nextStatus !== dialogJob.status;
      if (statusChanged) {
        const { error } = await supabase
          .from("job_work_orders")
          .update({ status: nextStatus })
          .eq("id", dialogJob.id);
        if (error) throw error;
      }

      // 2) Insert a manual status update record carrying note + photo (always, so admin sees the note)
      if (note.trim() || photoUrl || !statusChanged) {
        const { error } = await supabase.from("worker_status_updates").insert({
          job_id: dialogJob.id,
          worker_id: worker!.id,
          status: nextStatus,
          note: note.trim() || null,
          photo_url: photoUrl,
        });
        if (error) throw error;
      }

      toast({ title: "Update sent", description: jobStatusLabel(nextStatus) });
      setDialogJob(null);
      void load();
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message ?? "Try again", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/worker/login", { replace: true });
  };

  // Download the worker-safe job sheet (no prices, no customer phone) as
  // either a multi-page PDF or page-by-page JPG images that are easy to share
  // on WhatsApp from the phone.
  const downloadJobSheet = async (job: Job, format: "pdf" | "jpg") => {
    if (!job.items.length) {
      toast({ title: "No items on this job", variant: "destructive" });
      return;
    }
    setDownloadingJobId(job.id);
    try {
      // Need full item details for catalog fields (load list only carries a brief).
      const { data: fullItems, error } = await supabase
        .from("quotation_items")
        .select("id, description, quantity, measurement, item_image_url, measurement_image_url, sketch_url, catalog_text, catalog_image_url, site_photos")
        .in("id", job.item_ids);
      if (error) throw error;

      const { generateJobWorkPdf } = await import("@/lib/quotationPdf");
      // Smaller images keep the rasterised JPGs phone-friendly for WhatsApp.
      const COMPRESSED_PDF_OPTIONS = { image: { maxSide: 700, jpegQuality: 0.6 } } as const;
      const pdfBlob = await generateJobWorkPdf({
        quotation_id: job.quotation_code,
        worker_name: worker?.name ?? "Worker",
        date: new Date().toLocaleDateString("en-IN"),
        notes: job.notes,
        items: (fullItems ?? []).map((it: any) => ({
          description: it.description,
          item_image_url: it.item_image_url,
          measurement: it.measurement,
          measurement_image_url: it.measurement_image_url,
          catalog_text: it.catalog_text,
          catalog_image_url: it.catalog_image_url,
          sketch_url: it.sketch_url,
          site_photos: it.site_photos,
          quantity: it.quantity,
        })),
      }, format === "jpg" ? COMPRESSED_PDF_OPTIONS : undefined);

      const baseFilename = `JobWork-${job.quotation_code}`;
      if (format === "pdf") {
        downloadBlob(pdfBlob, `${baseFilename}.pdf`);
        toast({ title: "PDF downloaded", description: baseFilename });
      } else {
        const { pdfBlobToJpgPages } = await import("@/lib/pdfToJpg");
        const blobs = await pdfBlobToJpgPages(pdfBlob);
        blobs.forEach((b, i) => {
          const name = blobs.length === 1 ? `${baseFilename}.jpg` : `${baseFilename}-p${i + 1}.jpg`;
          downloadBlob(b, name);
        });
        toast({ title: "Images downloaded", description: `${blobs.length} page(s)` });
      }
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message ?? "Try again", variant: "destructive" });
    } finally {
      setDownloadingJobId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-muted/30">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <HardHat className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-base">{worker?.name ?? "Worker"}</p>
              <p className="truncate text-xs text-muted-foreground">{worker?.trade ?? BRAND_NAME}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Active" value={counts.active} tone="primary" />
          <Stat label="Assigned" value={counts.assigned ?? 0} />
          <Stat label="In Progress" value={counts.in_progress ?? 0} />
          <Stat label="Ready" value={counts.ready ?? 0} />
          <Stat label="Done" value={counts.delivered ?? 0} tone="success" />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full justify-start overflow-x-auto [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            {JOB_STATUSES.map((s) => (
              <TabsTrigger key={s.value} value={s.value} className="whitespace-nowrap">
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={tab} className="mt-4 grid gap-3">
            {filtered.map((job) => (
              <Card key={job.id} className="overflow-hidden">
                <CardContent className="space-y-3 p-4">
                  {job.last_office_edit && (
                    <div className="-mx-4 -mt-4 mb-2 border-b border-primary/30 bg-primary/5 px-4 py-2 text-xs">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium text-primary">
                        <Clock className="h-3 w-3" />
                        Office updated this job
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        Set to <span className="font-semibold text-foreground">{jobStatusLabel(job.last_office_edit.status)}</span>
                        {" "}by <span className="font-medium text-foreground">{job.last_office_edit.editor_name}</span>
                        {" "}· {fmtDateTime(job.last_office_edit.created_at)}
                      </p>
                      {job.last_office_edit.note && (
                        <p className="mt-1 italic text-muted-foreground">"{job.last_office_edit.note}"</p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
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
                        {job.is_urgent && <Badge variant="destructive">Urgent</Badge>}
                      </div>
                      <p className="mt-1 text-sm font-medium">{job.party_place}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.items.length} item(s) · Assigned {fmtDateTime(job.created_at)}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> Updated {fmtDateTime(job.status_updated_at)}
                      </p>
                      {job.notes && (
                        <p className="mt-1 rounded bg-muted px-2 py-1 text-xs italic text-muted-foreground">
                          Office note: "{job.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {job.items.length > 0 && (
                    <div className="grid gap-2 border-t border-border/50 pt-3">
                      {job.items.map((it, idx) => (
                        <div key={it.id} className="flex gap-3 rounded-md border border-border/50 bg-muted/30 p-2">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-background">
                            {it.item_image_url ? (
                              <img src={it.item_image_url} alt={it.description} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-tight">
                              <span className="text-muted-foreground">#{idx + 1}</span> {it.description}
                            </p>
                            <p className="text-xs text-muted-foreground">Qty: {it.quantity}</p>
                            {it.measurement && (
                              <p className="mt-0.5 text-xs"><span className="text-muted-foreground">Size:</span> {it.measurement}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
                    <Button
                      size="lg"
                      onClick={() => openUpdate(job)}
                      disabled={updating === job.id}
                      className="h-11 flex-1 min-w-[140px]"
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Update status
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => navigate(`/worker/job/${job.id}`)}
                      className="h-11 flex-1 min-w-[100px]"
                    >
                      <Eye className="mr-1.5 h-4 w-4" />
                      View
                    </Button>
                    <DownloadShareMenu
                      onPdf={() => downloadJobSheet(job, "pdf")}
                      onJpg={() => downloadJobSheet(job, "jpg")}
                      busy={downloadingJobId === job.id}
                      label="Download"
                      triggerClassName="h-11"
                      pdfTooltip="PDF — full job sheet"
                      jpgTooltip="JPG — easy to share on WhatsApp"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <p className="py-12 text-center text-muted-foreground">No jobs in this view.</p>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!dialogJob} onOpenChange={(o) => !o && setDialogJob(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update status</DialogTitle>
          </DialogHeader>
          {dialogJob && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-mono">{dialogJob.quotation_code}</span> · {dialogJob.party_place}
              </p>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={nextStatus} onValueChange={setNextStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JOB_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Note (optional)</Label>
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. polish done, ready for tomorrow's truck"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2"><Camera className="h-4 w-4" /> Photo (optional)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
                {photoFile && <p className="text-xs text-muted-foreground">Selected: {photoFile.name}</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogJob(null)} disabled={submitting}>Cancel</Button>
            <Button onClick={submitUpdate} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "primary" | "success";
}) => (
  <div
    className={
      tone === "primary"
        ? "rounded-lg border border-primary/40 bg-primary/10 px-2 py-2 text-center"
        : tone === "success"
        ? "rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-2 text-center"
        : "rounded-lg border border-border bg-card px-2 py-2 text-center"
    }
  >
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="font-display text-lg font-semibold">{value}</p>
  </div>
);

// dummy import to silence lints when updating used externally
const _u = () => null;
export { _u };

export default WorkerPortal;