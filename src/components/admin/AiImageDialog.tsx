import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Upload, Wand2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/imageCompression";

// One-click prompt presets. Selecting a preset replaces the prompt textarea.
const PRESETS: { label: string; description: string; prompt: string }[] = [
  {
    label: "Studio shot (light gray)",
    description: "Seamless light-gray backdrop, soft contact shadow, eye-level.",
    prompt:
      "A professional-grade, seamless studio photograph of the furniture item from the input image. The subject is centered and placed on a perfectly smooth, uniform light gray studio backdrop that has a matte finish. The flooring subtly blends into the wall, creating an infinite, minimalist background. Soft, diffuse lighting illuminates the furniture item evenly, highlighting its texture. Crucially, a realistic, soft, natural contact shadow is cast directly beneath and slightly around the base of the furniture onto the light gray floor, anchoring it in the space. No harsh shadows or reflections. The perspective is front-on and at eye level. High resolution, 8k, photorealistic.",
  },
  {
    label: "Pure white catalog",
    description: "Clean e-commerce white background, no shadow.",
    prompt:
      "A high-resolution e-commerce catalog photograph of the furniture item from the input image. Pure white seamless background (#FFFFFF), evenly lit with soft diffused studio lighting from multiple angles to eliminate all shadows and reflections. Subject perfectly centered, front 3/4 view at eye level, sharp focus, true-to-life colors and material textures. 8k, photorealistic.",
  },
  {
    label: "Lifestyle room",
    description: "Furniture placed in a tasteful real-world interior.",
    prompt:
      "A photorealistic lifestyle interior photograph featuring the furniture item from the input image, naturally placed in a warm, modern Indian living room with neutral wall paint, hardwood flooring, soft natural daylight from a large window, a few tasteful decor elements (plant, rug, art) without overpowering the subject. Front 3/4 angle, eye-level, magazine-quality composition, 8k, photorealistic.",
  },
  {
    label: "Top-down flat lay",
    description: "Bird's-eye view on a soft neutral surface.",
    prompt:
      "A top-down flat-lay photograph of the furniture item from the input image, perfectly centered on a soft beige linen surface, evenly lit with soft daylight, subtle natural shadows, minimal styling, magazine-quality composition, 8k, photorealistic.",
  },
];

// Default prompt that auto-fills when the dialog opens.
const DEFAULT_PROMPT = PRESETS[0].prompt;

const PresetRow = ({ onPick }: { onPick: (p: string) => void }) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
      Quick presets
    </Label>
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onPick(p.prompt)}
          title={p.description}
          className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium hover:border-primary hover:bg-primary/10 hover:text-primary transition"
        >
          ✨ {p.label}
        </button>
      ))}
    </div>
  </div>
);

/**
 * Dialog wrapping the `ai-generate-image` edge function.
 * Two modes:
 *  - Generate: prompt only → new image
 *  - Edit: prompt + existing image URL → refined image
 *
 * On success it calls `onGenerated(url)` so the host (ImageUploader) can append
 * the image to its list. The image is already stored in `product-images` bucket.
 */
export const AiImageDialog = ({
  onGenerated,
  existingImageUrls = [],
}: {
  onGenerated: (url: string) => void;
  existingImageUrls?: string[];
}) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"generate" | "edit">("generate");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [sourceUrl, setSourceUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingSource, setUploadingSource] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPrompt(DEFAULT_PROMPT);
    setSourceUrl("");
    setMode("generate");
  };

  // Read attached file as a base64 data URL — no storage round-trip needed,
  // the model accepts data URLs directly. Much faster than upload-then-edit.
  const handleAttachFile = async (file: File) => {
    setUploadingSource(true);
    try {
      const compressed = await compressImage(file);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(compressed);
      });
      setSourceUrl(dataUrl);
      toast({ title: "Image attached", description: "Ready to edit instantly." });
    } catch (e) {
      toast({
        title: "Attach failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setUploadingSource(false);
    }
  };

  const run = async () => {
    if (!prompt.trim()) {
      toast({ title: "Enter a prompt", variant: "destructive" });
      return;
    }
    if (mode === "edit" && !sourceUrl.trim()) {
      toast({ title: "Pick or paste a source image", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-image", {
        body: {
          prompt: prompt.trim(),
          source_image_url: mode === "edit" ? sourceUrl.trim() : undefined,
        },
      });
      if (error) {
        // Try to extract a friendly server-provided message
        let serverMsg = error.message;
        try {
          const ctx = await (error as { context?: Response }).context?.json?.();
          if (ctx?.error) serverMsg = ctx.error;
        } catch { /* ignore */ }
        throw new Error(serverMsg);
      }
      if (!data?.url) throw new Error("No image returned");
      onGenerated(data.url);
      toast({ title: "Image added", description: "AI image saved to your product." });
      setOpen(false);
      reset();
    } catch (e) {
      toast({
        title: "Generation failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Generate with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            AI image studio
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Powered by Gemini Nano Banana. Generates a square catalog image and saves it to this product.
          </p>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Generate new</TabsTrigger>
            <TabsTrigger value="edit">Edit existing</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-3 pt-3">
            <PresetRow onPick={setPrompt} />
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Describe the image
              </Label>
              <Textarea
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. A modern 3-seater sofa in beige linen fabric, wooden legs, on a clean white studio background, professional product photography, soft lighting"
              />
              <p className="text-[11px] text-muted-foreground">
                Tip: pick a preset above, then tweak the wording for your product.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Source image
              </Label>

              {sourceUrl && (
                <div className="relative inline-block">
                  <img
                    src={sourceUrl}
                    alt="Source"
                    className="h-24 w-24 rounded-md border border-border object-contain bg-muted/30 p-1"
                  />
                  <button
                    type="button"
                    onClick={() => setSourceUrl("")}
                    className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5 hover:scale-110 transition"
                    aria-label="Clear source"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {existingImageUrls.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {existingImageUrls.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setSourceUrl(u)}
                      className={`relative aspect-square overflow-hidden rounded-md border-2 transition ${
                        sourceUrl === u ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <img src={u} alt="" className="h-full w-full object-contain p-0.5" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAttachFile(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingSource}
                  className="gap-1.5 shrink-0"
                >
                  {uploadingSource ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {uploadingSource ? "Uploading…" : "Attach image"}
                </Button>
                <Input
                  placeholder="Or paste image URL"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            <PresetRow onPick={setPrompt} />
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Editing instruction
              </Label>
              <Textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Change the background to plain white, brighten the lighting, remove the wrinkles on the cushion"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={run} disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> {mode === "edit" ? "Apply edit" : "Generate"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
