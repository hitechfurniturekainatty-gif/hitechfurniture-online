import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Image as ImageIcon, Ruler, MapPin, BookOpen, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type Group = {
  key: string;
  label: string;
  icon: typeof ImageIcon;
  urls: string[];
};

const split = (v: string | null | undefined): string[] =>
  (v ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Compact thumbnail strip shown at the top of each quotation item so office
 * staff / admins can instantly see (and click to enlarge) every photo,
 * measurement image, sketch, or site photo that the measurement staff
 * attached — without expanding any collapsed field.
 *
 * Click any thumbnail → fullscreen preview with prev/next inside the group.
 */
export const AttachmentThumbStrip = ({
  itemImageUrl,
  measurementImageUrl,
  sitePhotos,
  catalogImageUrl,
  sketchUrl,
  className,
}: {
  itemImageUrl?: string | null;
  measurementImageUrl?: string | null;
  sitePhotos?: string | null;
  catalogImageUrl?: string | null;
  sketchUrl?: string | null;
  className?: string;
}) => {
  const groups: Group[] = useMemo(
    () =>
      [
        { key: "item", label: "Item", icon: ImageIcon, urls: split(itemImageUrl) },
        { key: "measurement", label: "Measurement", icon: Ruler, urls: split(measurementImageUrl) },
        { key: "site", label: "Site", icon: MapPin, urls: split(sitePhotos) },
        { key: "catalog", label: "Catalog/Cloth", icon: BookOpen, urls: split(catalogImageUrl) },
        { key: "sketch", label: "Sketch", icon: Pencil, urls: split(sketchUrl) },
      ].filter((g) => g.urls.length > 0),
    [itemImageUrl, measurementImageUrl, sitePhotos, catalogImageUrl, sketchUrl],
  );

  const [previewUrls, setPreviewUrls] = useState<string[] | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewLabel, setPreviewLabel] = useState("");

  if (groups.length === 0) return null;

  const openPreview = (g: Group, idx: number) => {
    setPreviewUrls(g.urls);
    setPreviewIdx(idx);
    setPreviewLabel(g.label);
  };

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        {groups.map((g) => {
          const Icon = g.icon;
          return (
            <div key={g.key} className="flex items-center gap-2 rounded-md border bg-background/60 px-2 py-1.5">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {g.label}
              </span>
              <div className="flex items-center gap-1.5">
                {g.urls.slice(0, 4).map((u, i) => (
                  <button
                    key={u + i}
                    type="button"
                    onClick={() => openPreview(g, i)}
                    className="relative h-16 w-16 overflow-hidden rounded-md border bg-muted transition hover:ring-2 hover:ring-primary"
                    title={`Preview ${g.label} ${i + 1}`}
                  >
                    <img src={u} alt={`${g.label} ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
                {g.urls.length > 4 && (
                  <button
                    type="button"
                    onClick={() => openPreview(g, 4)}
                    className="h-16 rounded-md border bg-muted px-2 text-xs font-semibold text-muted-foreground hover:bg-muted/80"
                  >
                    +{g.urls.length - 4}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!previewUrls} onOpenChange={(o) => !o && setPreviewUrls(null)}>
        <DialogContent className="max-w-3xl">
          {previewUrls && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {previewLabel} — {previewIdx + 1} / {previewUrls.length}
                </p>
              </div>
              <div className="flex items-center justify-center bg-black/90 rounded-md">
                <img
                  src={previewUrls[previewIdx]}
                  alt={`${previewLabel} ${previewIdx + 1}`}
                  className="max-h-[70vh] w-auto object-contain"
                />
              </div>
              {previewUrls.length > 1 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {previewUrls.map((u, i) => (
                    <button
                      key={u + i}
                      type="button"
                      onClick={() => setPreviewIdx(i)}
                      className={cn(
                        "h-14 w-14 overflow-hidden rounded border",
                        i === previewIdx ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100",
                      )}
                    >
                      <img src={u} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AttachmentThumbStrip;