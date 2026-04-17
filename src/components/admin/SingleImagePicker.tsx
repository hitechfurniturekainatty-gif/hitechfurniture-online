import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, X, Link as LinkIcon, Camera } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
  const [urlInput, setUrlInput] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
        setUploading(false);
        return;
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      setUploading(false);
    },
    [bucket, folder, onChange]
  );

  const onDrop = useCallback(
    (files: File[]) => {
      if (files[0]) uploadFile(files[0]);
    },
    [uploadFile]
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

  if (value) {
    return (
      <div className={`relative overflow-hidden rounded-md border border-border bg-muted ${compact ? "h-20 w-20" : "h-32 w-full"}`}>
        <img src={value} alt={label || "image"} className="h-full w-full object-contain p-1" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute right-1 top-1 rounded-full bg-foreground/80 p-1 text-background hover:bg-foreground"
          aria-label="Remove image"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

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
              if (f) uploadFile(f);
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
  );
};
