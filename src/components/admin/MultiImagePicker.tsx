import { useCallback, useEffect, useRef, useState } from "react";
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
export const MultiImagePicker = ({
  value,
  onChange,
  bucket = "quotation-images",
  folder = "measurements",
  label,
}: {
  value: string | null;
  onChange: (joined: string | null) => void;
  bucket?: string;
  folder?: string;
  label?: string;
}) => {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);

  const urls: string[] = (value ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const commit = (next: string[]) => onChange(next.length ? next.join("\n") : null);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setUploading(true);
      const added: string[] = [];
      for (const f of files) {
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${folder}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, f, { upsert: false });
        if (error) {
          toast({ title: `Upload failed: ${f.name}`, description: error.message, variant: "destructive" });
          continue;
        }
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        added.push(data.publicUrl);
      }
      if (added.length) commit([...urls, ...added]);
      setUploading(false);
    },
    [bucket, folder, urls]
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
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <span className="text-muted-foreground">Click or drop images (multiple allowed)</span>
            )}
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
          <Button type="button" size="sm" className="w-full" onClick={() => cameraRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Camera className="mr-1.5 h-3.5 w-3.5" />}
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

      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {urls.map((u, i) => (
            <div key={`${u}-${i}`} className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
              <img src={u} alt={`image ${i + 1}`} className="h-full w-full object-contain p-0.5" />
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
        </div>
      )}
    </div>
  );
};
