import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Image as ImageIcon,
  Ruler,
  MapPin,
  BookOpen,
  Pencil,
  Hash,
  Plus,
  X,
  Camera,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/imageCompression";
import { toast } from "@/hooks/use-toast";
import { ImageCropDialog } from "@/components/admin/ImageCropDialog";
import { SketchField } from "@/components/admin/SketchField";

/**
 * Structured, preview-style media stack for a single quotation item row.
 *
 * Replaces the old "tabs + dropzone + dashed mini-editor" cluster inside the
 * editor so the user sees the EXACT same one-by-one vertical layout that
 * appears on the saved Quotation Preview, with inline X buttons to remove
 * each attachment instantly.
 *
 * Behaviour:
 *  - One stacked row per media category.
 *  - Filled rows: show content + per-item X + a tiny "Add more / Replace"
 *    affordance — no big Upload/Camera/URL tabs UI.
 *  - Empty rows: collapsed into compact "+ Add {label}" pills at the bottom
 *    that, when clicked, open a slim inline picker right in that row.
 */

type ItemPatch = Partial<{
  item_image_url: string | null;
  measurement_image_url: string | null;
  site_photos: string | null;
  catalog_image_url: string | null;
  sketch_url: string | null;
  catalog_text: string | null;
  measurement: string | null;
}>;

type Props = {
  item: {
    id: string;
    item_image_url: string | null;
    measurement_image_url: string | null;
    site_photos: string | null;
    catalog_image_url: string | null;
    sketch_url: string | null;
    catalog_text: string | null;
    measurement: string | null;
  };
  onChange: (patch: ItemPatch) => void;
  disabled?: boolean;
};

const splitUrls = (v: string | null | undefined): string[] =>
  (v ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
const joinUrls = (xs: string[]): string | null => (xs.length ? xs.join("\n") : null);

type MultiKey = "item_image_url" | "measurement_image_url" | "site_photos" | "catalog_image_url";
type Category =
  | { kind: "multi"; key: MultiKey; label: string; icon: typeof ImageIcon; folder: string }
  | { kind: "text"; key: "catalog_text"; label: string; icon: typeof ImageIcon; placeholder: string }
  | { kind: "textarea"; key: "measurement"; label: string; icon: typeof ImageIcon; placeholder: string }
  | { kind: "sketch"; key: "sketch_url"; label: string; icon: typeof ImageIcon };

const CATEGORIES: Category[] = [
  { kind: "multi", key: "item_image_url", label: "Photos", icon: ImageIcon, folder: "items" },
  { kind: "text", key: "catalog_text", label: "Catalog #", icon: Hash, placeholder: "e.g. SOFA-1023" },
  { kind: "textarea", key: "measurement", label: "Dimensions", icon: Ruler, placeholder: "e.g. 72 W x 36 D x 30 H inches" },
  { kind: "multi", key: "measurement_image_url", label: "Measurement pics", icon: Ruler, folder: "measurements" },
  { kind: "multi", key: "site_photos", label: "Site pics", icon: MapPin, folder: "site" },
  { kind: "multi", key: "catalog_image_url", label: "Cloth / Catalog pics", icon: BookOpen, folder: "cloth" },
  { kind: "sketch", key: "sketch_url", label: "Sketch", icon: Pencil },
];

export const QuotationItemMediaStack = ({ item, onChange, disabled }: Props) => {
  // Which empty categories are currently expanded inline (waiting for input).
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpened((p) => ({ ...p, [k]: !p[k] }));
  const close = (k: string) => setOpened((p) => ({ ...p, [k]: false }));

  // Lightbox state
  const [preview, setPreview] = useState<{ urls: string[]; idx: number; label: string } | null>(null);

  const isFilled = (c: Category): boolean => {
    const v = (item as Record<string, string | null>)[c.key];
    return !!(v && v.trim());
  };

  const filled = CATEGORIES.filter(isFilled);
  const missing = CATEGORIES.filter((c) => !isFilled(c));

  return (
    <div className="space-y-2">
      {filled.map((c) => (
        <CategoryRow
          key={c.key}
          category={c}
          item={item}
          onChange={onChange}
          disabled={disabled}
          onPreview={(urls, idx) => setPreview({ urls, idx, label: c.label })}
        />
      ))}

      {/* Open-but-still-empty categories: render the same row shell so the
          inline picker sits in its final stacked position. */}
      {missing
        .filter((c) => opened[c.key])
        .map((c) => (
          <CategoryRow
            key={c.key}
            category={c}
            item={item}
            onChange={onChange}
            disabled={disabled}
            forceOpen
            onClose={() => close(c.key)}
            onPreview={(urls, idx) => setPreview({ urls, idx, label: c.label })}
          />
        ))}

      {/* Compact "+ Add X" pills for any category not yet filled or opened. */}
      {(() => {
        const pills = missing.filter((c) => !opened[c.key]);
        if (pills.length === 0) return null;
        return (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {pills.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(c.key)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  <Icon className="h-3 w-3" />
                  {c.label}
                </button>
              );
            })}
          </div>
        );
      })()}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          {preview && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">
                {preview.label} — {preview.idx + 1} / {preview.urls.length}
              </p>
              <div className="flex items-center justify-center rounded-md bg-black/90">
                <img
                  src={preview.urls[preview.idx]}
                  alt={`${preview.label} ${preview.idx + 1}`}
                  className="max-h-[70vh] w-auto object-contain"
                />
              </div>
              {preview.urls.length > 1 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {preview.urls.map((u, i) => (
                    <button
                      key={u + i}
                      type="button"
                      onClick={() => setPreview({ ...preview, idx: i })}
                      className={cn(
                        "h-14 w-14 overflow-hidden rounded border",
                        i === preview.idx ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100",
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
    </div>
  );
};

const CategoryRow = ({
  category,
  item,
  onChange,
  disabled,
  forceOpen,
  onClose,
  onPreview,
}: {
  category: Category;
  item: Props["item"];
  onChange: Props["onChange"];
  disabled?: boolean;
  forceOpen?: boolean;
  onClose?: () => void;
  onPreview: (urls: string[], idx: number) => void;
}) => {
  const Icon = category.icon;

  const clear = () => {
    onChange({ [category.key]: null } as ItemPatch);
    onClose?.();
  };

  const Header = (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {category.label}
      </span>
      <button
        type="button"
        onClick={clear}
        disabled={disabled}
        className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        title={`Remove ${category.label}`}
        aria-label={`Remove ${category.label}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      {Header}
      <div className="mt-1.5">
        {category.kind === "text" && (
          <Input
            autoFocus={forceOpen}
            className="h-9 text-sm"
            value={(item.catalog_text ?? "") as string}
            placeholder={category.placeholder}
            disabled={disabled}
            onChange={(e) => onChange({ catalog_text: e.target.value })}
            onBlur={(e) =>
              onChange({ catalog_text: e.target.value.toUpperCase().trim() || null })
            }
          />
        )}
        {category.kind === "textarea" && (
          <Textarea
            autoFocus={forceOpen}
            className="min-h-[56px] text-sm"
            value={(item.measurement ?? "") as string}
            placeholder={category.placeholder}
            disabled={disabled}
            onChange={(e) => onChange({ measurement: e.target.value || null })}
          />
        )}
        {category.kind === "sketch" && (
          <SketchField
            value={item.sketch_url}
            onChange={(v) => onChange({ sketch_url: v })}
          />
        )}
        {category.kind === "multi" && (
          <MultiInline
            value={(item as Record<string, string | null>)[category.key]}
            onChange={(v) => onChange({ [category.key]: v } as ItemPatch)}
            folder={category.folder}
            label={category.label}
            disabled={disabled}
            onPreview={onPreview}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Slim multi-image editor: thumbnails with per-image X, plus a tiny
 * "Add" + "Camera" pair. No tabs, no URL field, no big drop-zone — matches
 * the saved structured preview aesthetic.
 */
const MultiInline = ({
  value,
  onChange,
  folder,
  label,
  disabled,
  onPreview,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  folder: string;
  label: string;
  disabled?: boolean;
  onPreview: (urls: string[], idx: number) => void;
}) => {
  const urls = splitUrls(value);
  const urlsRef = useRef(urls);
  useEffect(() => {
    urlsRef.current = urls;
  });
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ id: string; preview: string }[]>([]);
  const [cropQueue, setCropQueue] = useState<File[]>([]);

  useEffect(
    () => () => pending.forEach((p) => URL.revokeObjectURL(p.preview)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const uploadOne = useCallback(
    async (file: File, previewId: string, previewUrl: string) => {
      try {
        const compressed = await compressImage(file);
        const ext = (compressed.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
        const path = `${folder}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("quotation-images")
          .upload(path, compressed, {
            upsert: false,
            contentType: compressed.type,
            cacheControl: "31536000, immutable",
          });
        if (error) {
          toast({ title: "Upload failed", description: error.message, variant: "destructive" });
          return;
        }
        const { data } = supabase.storage.from("quotation-images").getPublicUrl(path);
        onChangeRef.current(joinUrls([...urlsRef.current, data.publicUrl]));
      } finally {
        URL.revokeObjectURL(previewUrl);
        setPending((p) => p.filter((x) => x.id !== previewId));
      }
    },
    [folder],
  );

  const startUpload = useCallback(
    (file: File) => {
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      setPending((p) => [...p, { id, preview }]);
      void uploadOne(file, id, preview);
    },
    [uploadOne],
  );

  const queueFiles = (files: File[]) => {
    if (files.length) setCropQueue((q) => [...q, ...files]);
  };

  const removeAt = (idx: number) => {
    const next = [...urls];
    next.splice(idx, 1);
    onChange(joinUrls(next));
  };

  return (
    <div className="space-y-2">
      {(urls.length > 0 || pending.length > 0) && (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {urls.map((u, i) => (
            <div
              key={`${u}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
            >
              <button
                type="button"
                onClick={() => onPreview(urls, i)}
                className="block h-full w-full"
                title={`Preview ${label} ${i + 1}`}
              >
                <img
                  src={u}
                  alt={`${label} ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-foreground/80 p-0.5 text-background opacity-90 hover:bg-foreground"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {pending.map((p) => (
            <div
              key={p.id}
              className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
            >
              <img src={p.preview} alt="uploading" className="h-full w-full object-cover opacity-60" />
              <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            queueFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            queueFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          {urls.length ? "Add more" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-50"
        >
          <Camera className="h-3 w-3" />
          Camera
        </button>
        {pending.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Uploading {pending.length}…
          </span>
        )}
      </div>

      <ImageCropDialog
        file={cropQueue[0] ?? null}
        open={cropQueue.length > 0}
        onCancel={() => setCropQueue((q) => q.slice(1))}
        onConfirm={(f) => {
          startUpload(f);
          setCropQueue((q) => q.slice(1));
        }}
      />
    </div>
  );
};

export default QuotationItemMediaStack;