import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, X, Link as LinkIcon, Camera } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/imageCompression";
import { ImageCropDialog } from "@/components/admin/ImageCropDialog";

/**
 * Single image picker with Upload / Camera / URL tabs.
 * Used for quotation item photos and measurement-sketch photos.
 * Stores in the `quotation-images` bucket by default.
 */
export const SingleImagePicker = ({
  value,
  onChange,
  bucket = "quotation-images",
  folder = "items",
  label,
  compact = false,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
  label?: string;
  compact?: boolean;
}) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  // Pending file awaiting crop confirmation. When set, the crop dialog is open.
  const [cropFile, setCropFile] = useState<File | null>(null);

  // When the parent commits the real URL, drop the temporary blob preview.
  useEffect(() => {
    if (value && preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
  }, [value, preview]);

  // Cleanup any leftover blob preview on unmount
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      // Instant preview
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);
      setUploading(true);
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
          setPreview(null);
          URL.revokeObjectURL(localUrl);
          return;
        }
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        onChange(data.publicUrl);
      } finally {
        setUploading(false);
        // Keep local preview until parent value updates; cleanup runs on unmount/replace
      }
    },
    [bucket, folder, onChange]
  );

  const onDrop = useCallback(
    (files: File[]) => {
      // Open crop dialog first — user can still hit "Use as-is" to skip.
      if (files[0]) setCropFile(files[0]);
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
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
    onChange(u);
    setUrlInput("");
  };

  // Show committed value, OR live preview while uploading in background
  const displayUrl = value || preview;

  const cropDialog = (
    <ImageCropDialog
      file={cropFile}
      open={!!cropFile}
      onCancel={() => setCropFile(null)}
      onConfirm={(f) => {
        setCropFile(null);
        uploadFile(f);
      }}
    />
  );

  if (displayUrl) {
    return (
      <>
      <div className={`relative overflow-hidden rounded-md border border-border bg-muted ${compact ? "h-20 w-20" : "h-32 w-full"}`}>
        <img src={displayUrl} alt={label || "image"} loading="lazy" decoding="async" className={`h-full w-full object-contain p-1 ${uploading ? "opacity-70" : ""}`} />
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/30">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
        {!uploading && (
          <button
            type="button"
            onClick={() => {
              if (preview) {
                URL.revokeObjectURL(preview);
                setPreview(null);
              }
              onChange(null);
            }}
            className="absolute right-1 top-1 rounded-full bg-foreground/80 p-1 text-background hover:bg-foreground"
            aria-label="Remove image"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {cropDialog}
      </>
    );
  }

  return (
    <>
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
            {uploading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <span className="text-muted-foreground">Click or drop image</span>}
          </div>
        </TabsContent>
        <TabsContent value="camera" className="mt-2">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setCropFile(f);
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
    </div>
    {cropDialog}
    </>
  );
};
