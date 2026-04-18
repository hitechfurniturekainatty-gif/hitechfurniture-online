import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
  const [prompt, setPrompt] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setPrompt("");
    setSourceUrl("");
    setMode("generate");
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
            <TabsTrigger value="edit" disabled={existingImageUrls.length === 0}>
              Edit existing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Describe the image
              </Label>
              <Textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. A modern 3-seater sofa in beige linen fabric, wooden legs, on a clean white studio background, professional product photography, soft lighting"
              />
              <p className="text-[11px] text-muted-foreground">
                Tip: mention background ("white studio"), angle ("front 3/4 view"), and style for best results.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Source image
              </Label>
              {existingImageUrls.length > 0 ? (
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
              ) : (
                <p className="text-xs text-muted-foreground">Upload an image first to edit it.</p>
              )}
              <Input
                placeholder="Or paste an image URL"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="mt-2"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Editing instruction
              </Label>
              <Textarea
                rows={3}
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
