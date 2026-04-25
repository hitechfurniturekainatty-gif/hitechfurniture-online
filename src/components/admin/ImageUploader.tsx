import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, X, Link as LinkIcon, Camera, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { compressProductImage } from "@/lib/imageCompression";
import { AiImageDialog } from "@/components/admin/AiImageDialog";

export type UploadedImage = { url: string; path: string };

export const ImageUploader = ({
  value,
  onChange,
}: {
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
}) => {
  const [urlInput, setUrlInput] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ id: string; preview: string }[]>([]);

  // Latest refs to avoid stale closures during background uploads.
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; });
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    return () => { pending.forEach((p) => URL.revokeObjectURL(p.preview)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addUrl = () => {
    const u = urlInput.trim();
    if (!u) return;
    try { new URL(u); } catch { return toast({ title: "Invalid URL", variant: "destructive" }); }
    onChangeRef.current([...valueRef.current, { url: u, path: u }]);
    setUrlInput("");
  };

  const uploadOne = useCallback(async (file: File, previewId: string, previewUrl: string) => {
    try {
      // Catalog images are forced to 1080×1080 WebP at 100–300 KB.
      const compressed = await compressProductImage(file);
      const ext = (compressed.type.split("/")[1] || "webp").replace("jpeg", "jpg");
      const path = `products/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, compressed, {
          upsert: false,
          contentType: compressed.type,
          // 1-year immutable cache — images are content-addressed by UUID so
          // the URL changes whenever the image changes, making it safe to
          // let browsers cache them forever.
          cacheControl: "31536000, immutable",
        });
      if (error) {
        toast({ title: `Failed: ${file.name}`, description: error.message, variant: "destructive" });
        return;
      }
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      onChangeRef.current([...valueRef.current, { url: data.publicUrl, path }]);
    } finally {
      URL.revokeObjectURL(previewUrl);
      setPending((prev) => prev.filter((p) => p.id !== previewId));
    }
  }, []);

  const uploadFiles = useCallback((files: File[]) => {
    if (!files.length) return;
    const newPending = files.map((f) => ({ id: crypto.randomUUID(), preview: URL.createObjectURL(f), file: f }));
    setPending((prev) => [...prev, ...newPending.map(({ id, preview }) => ({ id, preview }))]);
    newPending.forEach(({ id, preview, file }) => { void uploadOne(file, id, preview); });
  }, [uploadOne]);

  const onDrop = useCallback((files: File[]) => uploadFiles(files), [uploadFiles]);

  const onCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) uploadFiles(files);
    e.target.value = "";
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: true,
  });

  const remove = (i: number) => {
    const next = [...value];
    next.splice(i, 1);
    onChange(next);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const makeCover = (i: number) => move(i, 0);

  const uploading = pending.length > 0;

  const handleAiGenerated = (url: string) => {
    onChangeRef.current([...valueRef.current, { url, path: url }]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Upload, capture, paste a URL — or generate one with AI.
        </p>
        <AiImageDialog
          onGenerated={handleAiGenerated}
          existingImageUrls={value.map((v) => v.url)}
        />
      </div>
      <Tabs defaultValue="upload">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload"><Upload className="mr-1.5 h-3.5 w-3.5" /> Upload</TabsTrigger>
          <TabsTrigger value="camera"><Camera className="mr-1.5 h-3.5 w-3.5" /> Camera</TabsTrigger>
          <TabsTrigger value="url"><LinkIcon className="mr-1.5 h-3.5 w-3.5" /> URL</TabsTrigger>
        </TabsList>
        <TabsContent value="upload">
          <div
            {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-smooth ${
              isDragActive ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              {isDragActive ? "Drop images here" : uploading ? `Uploading ${pending.length}…` : "Drag & drop or click to upload"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Auto-compressed · multiple allowed.</p>
          </div>
        </TabsContent>
        <TabsContent value="camera">
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onCameraCapture}
            />
            <Camera className="mb-2 h-7 w-7 text-primary" />
            <p className="text-sm font-medium">Take a photo with your camera</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Opens camera on mobile · falls back to file picker on desktop.
            </p>
            <Button type="button" className="mt-3" onClick={() => cameraInputRef.current?.click()}>
              <Camera className="mr-1.5 h-4 w-4" /> Open camera
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="url">
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())}
            />
            <Button type="button" onClick={addUrl}>Add</Button>
          </div>
        </TabsContent>
      </Tabs>

      {(value.length > 0 || pending.length > 0) && (
        <>
        {value.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            First image is the catalog thumbnail (Straight view). Use the arrows to reorder, or tap the star to make any angle the cover.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {value.map((img, i) => (
            <div key={img.path} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              <img src={img.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-1" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute right-1 top-1 rounded-full bg-foreground/80 p-1 text-background opacity-90 transition-smooth hover:bg-foreground sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
              {i === 0 ? (
                <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">
                  Cover
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => makeCover(i)}
                  className="absolute left-1 top-1 rounded-full bg-foreground/70 p-1 text-background opacity-90 transition-smooth hover:bg-accent hover:text-accent-foreground sm:opacity-0 sm:group-hover:opacity-100"
                  title="Make this the cover (Straight view)"
                  aria-label="Make cover"
                >
                  <Star className="h-3 w-3" />
                </button>
              )}
              {value.length > 1 && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-foreground/55 px-1 py-0.5 opacity-90 transition-smooth sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    className="rounded p-0.5 text-background hover:bg-background/20 disabled:opacity-30"
                    aria-label="Move left"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[10px] font-medium text-background">{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => move(i, i + 1)}
                    disabled={i === value.length - 1}
                    className="rounded p-0.5 text-background hover:bg-background/20 disabled:opacity-30"
                    aria-label="Move right"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {pending.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              <img src={p.preview} alt="uploading" className="h-full w-full object-contain p-1 opacity-60" />
              <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
};
