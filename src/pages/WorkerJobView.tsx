import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Image as ImageIcon, Ruler, Hash, FileText, Camera } from "lucide-react";
import { jobStatusLabel, jobStatusTone } from "@/pages/admin/AdminWorkerDetail";
import { firstUrl } from "@/lib/firstUrl";

type ItemFull = {
  id: string;
  description: string;
  quantity: number;
  measurement: string | null;
  item_image_url: string | null;
  measurement_image_url: string | null;
  catalog_text: string | null;
  catalog_image_url: string | null;
  sketch_url: string | null;
  site_photos: string | null;
};

type JobFull = {
  id: string;
  status: string;
  notes: string | null;
  is_urgent: boolean;
  created_at: string;
  item_ids: string[];
  quotation_code: string;
  party_place: string;
};

/**
 * Mobile-first, fully zoomable HTML view of a worker's job sheet.
 * - No prices, no customer phone (worker-safe)
 * - Plain HTML so the browser's native pinch-zoom stays crisp at any level
 * - Big touch targets, tap any image to open it fullscreen for inspection
 */
const WorkerJobView = () => {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const { user, isWorker, loading: authLoading } = useAuth();
  const [job, setJob] = useState<JobFull | null>(null);
  const [items, setItems] = useState<ItemFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isWorker) {
      navigate("/worker/login", { replace: true });
      return;
    }
    if (!jobId) return;
    void load(jobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isWorker, jobId]);

  const load = async (id: string) => {
    setLoading(true);
    const { data: jw, error } = await supabase
      .from("job_work_orders")
      .select("id, status, notes, is_urgent, created_at, item_ids, quotations!inner(quotation_id, party_place)")
      .eq("id", id)
      .maybeSingle();
    if (error || !jw) {
      toast({ title: "Couldn't load job", description: error?.message ?? "Not found", variant: "destructive" });
      navigate("/worker", { replace: true });
      return;
    }
    const j: JobFull = {
      id: jw.id,
      status: jw.status,
      notes: jw.notes,
      is_urgent: jw.is_urgent,
      created_at: jw.created_at,
      item_ids: jw.item_ids ?? [],
      quotation_code: (jw as any).quotations?.quotation_id ?? "",
      party_place: (jw as any).quotations?.party_place ?? "",
    };
    setJob(j);

    if (j.item_ids.length) {
      const { data: lines } = await supabase
        .from("quotation_items")
        .select("id, description, quantity, measurement, item_image_url, measurement_image_url, catalog_text, catalog_image_url, sketch_url, site_photos")
        .in("id", j.item_ids);
      // Preserve assignment order
      const byId: Record<string, ItemFull> = {};
      for (const l of (lines ?? []) as ItemFull[]) byId[l.id] = l;
      setItems(j.item_ids.map((iid) => byId[iid]).filter(Boolean));
    }
    setLoading(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!job) return null;

  return (
    <div className="min-h-[100dvh] bg-muted/30">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/worker")} className="h-9">
            <ArrowLeft className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm font-semibold">{job.quotation_code}</p>
            <p className="truncate text-xs text-muted-foreground">{job.party_place}</p>
          </div>
          <Badge variant={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</Badge>
          {job.is_urgent && <Badge variant="destructive">Urgent</Badge>}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-3 py-3 sm:px-4 sm:py-4">
        {job.notes && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Office note</p>
            <p className="whitespace-pre-line text-foreground/80">{job.notes}</p>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {items.length} item(s) · Tap any image to zoom
        </div>

        {items.map((it, idx) => {
          const sitePics = (it.site_photos ?? "")
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean);
          return (
            <article key={it.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {/* Title row */}
              <div className="flex items-start justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
                <p className="text-base font-semibold leading-tight">
                  <span className="text-muted-foreground">#{idx + 1}</span>{" "}
                  {it.description}
                </p>
                <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">
                  <Hash className="-mt-0.5 mr-0.5 inline h-3 w-3" />
                  {it.quantity}
                </span>
              </div>

              <div className="space-y-3 p-3">
                {/* Big main image */}
                {firstUrl(it.item_image_url) ? (
                  <button
                    type="button"
                    onClick={() => setZoomImage(firstUrl(it.item_image_url)!)}
                    className="block w-full overflow-hidden rounded-lg border border-border bg-background"
                  >
                    <img src={firstUrl(it.item_image_url)!} alt={it.description} className="h-auto w-full object-contain" loading="lazy" />
                  </button>
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}

                {/* Measurement block */}
                {(it.measurement || it.measurement_image_url) && (
                  <div className="rounded-lg border border-border bg-amber-50 p-2 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
                      <Ruler className="h-3 w-3" /> Measurement
                    </p>
                    {it.measurement && (
                      <p className="whitespace-pre-line text-base font-medium leading-snug">
                        {it.measurement}
                      </p>
                    )}
                    {it.measurement_image_url && (
                      <button
                        type="button"
                        onClick={() => setZoomImage(it.measurement_image_url!)}
                        className="mt-2 block w-full overflow-hidden rounded border border-amber-200 bg-white"
                      >
                        <img src={it.measurement_image_url} alt="Measurement" className="h-auto w-full object-contain" loading="lazy" />
                      </button>
                    )}
                  </div>
                )}

                {/* Sketch */}
                {it.sketch_url && (
                  <div className="rounded-lg border border-border bg-background p-2">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sketch</p>
                    <button
                      type="button"
                      onClick={() => setZoomImage(it.sketch_url!)}
                      className="block w-full overflow-hidden rounded border border-border bg-white"
                    >
                      <img src={it.sketch_url} alt="Sketch" className="h-auto w-full object-contain" loading="lazy" />
                    </button>
                  </div>
                )}

                {/* Catalog reference */}
                {(it.catalog_text || it.catalog_image_url) && (
                  <div className="rounded-lg border border-border bg-muted/40 p-2">
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <FileText className="h-3 w-3" /> Catalog reference
                    </p>
                    {it.catalog_text && (
                      <p className="whitespace-pre-line text-sm">{it.catalog_text}</p>
                    )}
                    {it.catalog_image_url && (
                      <button
                        type="button"
                        onClick={() => setZoomImage(it.catalog_image_url!)}
                        className="mt-2 block w-full overflow-hidden rounded border border-border bg-white"
                      >
                        <img src={it.catalog_image_url} alt="Catalog" className="h-auto w-full object-contain" loading="lazy" />
                      </button>
                    )}
                  </div>
                )}

                {/* Site photos */}
                {sitePics.length > 0 && (
                  <div className="rounded-lg border border-border bg-background p-2">
                    <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Camera className="h-3 w-3" /> Site photos ({sitePics.length})
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {sitePics.map((u, k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setZoomImage(u)}
                          className="aspect-square overflow-hidden rounded border border-border bg-white"
                        >
                          <img src={u} alt={`Site ${k + 1}`} loading="lazy" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {items.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">No items on this job.</p>
        )}
      </main>

      {/* Fullscreen image zoom overlay — uses the browser's native pinch-zoom
          so workers can inspect handwritten measurements at any zoom level. */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2"
          onClick={() => setZoomImage(null)}
        >
          <img
            src={zoomImage}
            alt="Zoom"
            className="max-h-full max-w-full object-contain"
            style={{ touchAction: "pinch-zoom" }}
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            variant="secondary"
            size="sm"
            className="absolute right-3 top-3"
            onClick={() => setZoomImage(null)}
          >
            Close
          </Button>
        </div>
      )}
    </div>
  );
};

export default WorkerJobView;