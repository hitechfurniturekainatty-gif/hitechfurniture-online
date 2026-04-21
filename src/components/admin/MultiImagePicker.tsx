import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, X, Link as LinkIcon, Camera } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/imageCompression";

/**
 * Multi-image picker that stores a list of image URLs serialized into a single
 * text field (newline-separated). Lets users add measurement photos AND cloth
 * catalog references for a single quotation/measurement item without any
 * database schema change.
 *
 * `value` is the raw column value (newline-joined URLs) or null.
 * `onChange` receives the new joined string (or null when empty).
 */
type MultiImagePickerProps = {
  value: string | null;
  onChange: (joined: string | null) => void;
  bucket?: string;
  folder?: string;
  label?: string;
};

export const MultiImagePicker = forwardRef<HTMLDivElement, MultiImagePickerProps>(function MultiImagePicker(
  { value, onChange, bucket = "quotation-images", folder = "measurements", label },
  ref,
) {
  const [urlInput, setUrlInput] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  // Pending = local previews (object URLs) currently uploading in background
  const [pending, setPending] = useState<{ id: string; preview: string }[]>([]);

  const urls: string[] = (value ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Stable refs so async uploads always see latest urls without retriggering
  const urlsRef = useRef(urls);
  useEffect(() => {
    urlsRef.current = urls;
  });
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Cleanup object URLs when component unmounts
  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (next: string[]) =>
    onChangeRef.current(next.length ? next.join("\n") : null);

  const uploadOne = useCallback(
    async (file: File, previewId: string, previewUrl: string) => {
      try {
        const compressed = await compressImage(file);
        const ext = (compressed.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
        const path = `${folder}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from(bucket)
          .upload(path, compressed, {
            upsert: false,
            contentType: compressed.type,
            // 1-year immutable browser cache — UUID paths change per image
            cacheControl: "31536000, immutable",
          });
        if (error) {
          toast({ title: "Upload failed", description: error.message, variant: "destructive" });
          return;
        }
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        commit([...urlsRef.current, data.publicUrl]);
      } finally {
        URL.revokeObjectURL(previewUrl);
        setPending((prev) => prev.filter((p) => p.id !== previewId));
      }
    },
    [bucket, folder]
  );

  const uploadFiles = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      // Show previews instantly + kick off uploads in parallel (background)
      const newPending = files.map((f) => ({ id: crypto.randomUUID(), preview: URL.createObjectURL(f), file: f }));
      setPending((prev) => [...prev, ...newPending.map(({ id, preview }) => ({ id, preview }))]);
      newPending.forEach(({ id, preview, file }) => {
        void uploadOne(file, id, preview);
      });
    },
    [uploadOne]
  );

  const onDrop = useCallback((files: File[]) => uploadFiles(files), [uploadFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: true,
  });

  const addUrl = () => {
    const u = urlInput.trim();
    if (!u) return;
    try {
      new URL(u);
    } catch {
      toast({ title: "Invalid URL", variant: "destructive" });
      return;
    }
    commit([...urls, u]);
    setUrlInput("");
  };

  const removeAt = (idx: number) => {
    const next = [...urls];
    next.splice(idx, 1);
    commit(next);
  };

  const uploading = pending.length > 0;

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}

      <Tabs defaultValue="upload">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="upload" className="text-[11px]"><Upload className="mr-1 h-3 w-3" />Upload</TabsTrigger>
          <TabsTrigger value="camera" className="text-[11px]"><Camera className="mr-1 h-3 w-3" />Camera</TabsTrigger>
          <TabsTrigger value="url" className="text-[11px]"><LinkIcon className="mr-1 h-3 w-3" />URL</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-2">
          <div
            {...getRootProps()}
            className={`flex h-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-xs ${
              isDragActive ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <span className="text-muted-foreground">
              {uploading ? `Uploading ${pending.length}…` : "Click or drop images (multiple allowed)"}
            </span>
          </div>
        </TabsContent>

        <TabsContent value="camera" className="mt-2">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) uploadFiles(files);
              e.target.value = "";
            }}
          />
          <Button type="button" size="sm" className="w-full" onClick={() => cameraRef.current?.click()}>
            <Camera className="mr-1.5 h-3.5 w-3.5" />
            Take photo
          </Button>
        </TabsContent>

        <TabsContent value="url" className="mt-2">
          <div className="flex gap-1">
            <Input
              placeholder="https://..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())}
              className="h-8 text-xs"
            />
            <Button type="button" size="sm" onClick={addUrl}>Add</Button>
          </div>
        </TabsContent>
      </Tabs>

      {(urls.length > 0 || pending.length > 0) && (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {urls.map((u, i) => (
            <div key={`${u}-${i}`} className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
              <img
                src={u}
                alt={`image ${i + 1}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain p-0.5"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute right-0.5 top-0.5 rounded-full bg-foreground/80 p-0.5 text-background opacity-90 hover:bg-foreground"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {pending.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
              <img src={p.preview} alt="uploading" className="h-full w-full object-contain p-0.5 opacity-60" />
              <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
