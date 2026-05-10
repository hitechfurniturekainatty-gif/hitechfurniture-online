import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Hash, Ruler, FileText, Camera, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Item = {
  id: string;
  description: string | null;
  quantity: number | null;
  measurement: string | null;
  item_image_url: string | null;
  measurement_image_url: string | null;
  catalog_text: string | null;
  catalog_image_url: string | null;
  sketch_url: string | null;
  site_photos: string | null;
};

type Payload = {
  job: { id: string; status: string; notes: string | null; is_urgent: boolean; created_at: string; item_ids: string[] };
  quotation_code: string;
  party_place: string | null;
  items: Item[];
};

const SharedJobView = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      setLoading(true);
      const { data: payload, error: rpcErr } = await supabase.rpc("get_shared_job_work_order", {
        p_token: token,
      });
      if (rpcErr || !payload) {
        setError(rpcErr?.message ?? "This link is invalid or has been revoked.");
      } else {
        setData(payload as any);
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-semibold">Job sheet not available</p>
          <p className="mt-2 text-sm text-muted-foreground">{error ?? "Not found."}</p>
        </div>
      </div>
    );
  }

  const { job, items, quotation_code, party_place } = data;

  return (
    <div className="min-h-[100dvh] bg-muted/30">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm font-semibold">{quotation_code}</p>
            {party_place && <p className="truncate text-xs text-muted-foreground">{party_place}</p>}
          </div>
          <Badge variant="outline" className="capitalize">{job.status.replace(/_/g, " ")}</Badge>
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
          {items.length} item(s) · Live view — always shows latest version · Tap any image to zoom
        </div>

        {items.map((it, idx) => {
          const sitePics = (it.site_photos ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
          return (
            <article key={it.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-start justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
                <p className="text-base font-semibold leading-tight">
                  <span className="text-muted-foreground">#{idx + 1}</span> {it.description}
                </p>
                <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">
                  <Hash className="-mt-0.5 mr-0.5 inline h-3 w-3" />{it.quantity ?? 1}
                </span>
              </div>
              <div className="space-y-3 p-3">
                {it.item_image_url ? (
                  <button type="button" onClick={() => setZoom(it.item_image_url!)} className="block w-full overflow-hidden rounded-lg border border-border bg-background">
                    <img src={it.item_image_url} alt={it.description ?? ""} className="h-auto w-full object-contain" loading="lazy" />
                  </button>
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                {(it.measurement || it.measurement_image_url) && (
                  <div className="rounded-lg border border-border bg-amber-50 p-2 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
                      <Ruler className="h-3 w-3" /> Measurement
                    </p>
                    {it.measurement && <p className="whitespace-pre-line text-base font-medium">{it.measurement}</p>}
                    {it.measurement_image_url && (
                      <button type="button" onClick={() => setZoom(it.measurement_image_url!)} className="mt-2 block w-full overflow-hidden rounded border border-amber-200 bg-white">
                        <img src={it.measurement_image_url} alt="Measurement" className="h-auto w-full object-contain" loading="lazy" />
                      </button>
                    )}
                  </div>
                )}
                {it.sketch_url && (
                  <div className="rounded-lg border border-border bg-background p-2">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sketch</p>
                    <button type="button" onClick={() => setZoom(it.sketch_url!)} className="block w-full overflow-hidden rounded border border-border bg-white">
                      <img src={it.sketch_url} alt="Sketch" className="h-auto w-full object-contain" loading="lazy" />
                    </button>
                  </div>
                )}
                {(it.catalog_text || it.catalog_image_url) && (
                  <div className="rounded-lg border border-border bg-muted/40 p-2">
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <FileText className="h-3 w-3" /> Catalog reference
                    </p>
                    {it.catalog_text && <p className="whitespace-pre-line text-sm">{it.catalog_text}</p>}
                    {it.catalog_image_url && (
                      <button type="button" onClick={() => setZoom(it.catalog_image_url!)} className="mt-2 block w-full overflow-hidden rounded border border-border bg-white">
                        <img src={it.catalog_image_url} alt="Catalog" className="h-auto w-full object-contain" loading="lazy" />
                      </button>
                    )}
                  </div>
                )}
                {sitePics.length > 0 && (
                  <div className="rounded-lg border border-border bg-background p-2">
                    <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Camera className="h-3 w-3" /> Site photos ({sitePics.length})
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {sitePics.map((u, k) => (
                        <button key={k} type="button" onClick={() => setZoom(u)} className="aspect-square overflow-hidden rounded border border-border bg-white">
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
      </main>

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2" onClick={() => setZoom(null)}>
          <img src={zoom} alt="Zoom" className="max-h-full max-w-full object-contain" style={{ touchAction: "pinch-zoom" }} onClick={(e) => e.stopPropagation()} />
          <Button variant="secondary" size="sm" className="absolute right-3 top-3" onClick={() => setZoom(null)}>Close</Button>
        </div>
      )}
    </div>
  );
};

export default SharedJobView;