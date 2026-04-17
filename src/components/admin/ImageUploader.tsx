import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export type UploadedImage = { url: string; path: string };

export const ImageUploader = ({
  value,
  onChange,
}: {
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
}) => {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (files: File[]) => {
      setUploading(true);
      const uploaded: UploadedImage[] = [];
      for (const f of files) {
        const ext = f.name.split(".").pop() || "jpg";
        const path = `products/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("product-images").upload(path, f, { upsert: false });
        if (error) {
          toast({ title: `Failed: ${f.name}`, description: error.message, variant: "destructive" });
          continue;
        }
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        uploaded.push({ url: data.publicUrl, path });
      }
      onChange([...value, ...uploaded]);
      setUploading(false);
    },
    [value, onChange]
  );

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

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-smooth ${
          isDragActive ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:border-primary/50"
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : (
          <>
            <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              {isDragActive ? "Drop images here" : "Drag & drop or click to upload"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WebP. Multiple allowed.</p>
          </>
        )}
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {value.map((img, i) => (
            <div key={img.path} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute right-1 top-1 rounded-full bg-foreground/80 p-1 text-background opacity-0 transition-smooth group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">
                  Cover
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
