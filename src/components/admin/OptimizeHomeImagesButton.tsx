import { useState } from "react";
import { supabase, uploadedMediaUrl } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, Zap } from "lucide-react";

/**
 * One-click: converts old JPG/PNG home-page images to WebP (max 1600px),
 * uploads the WebP copy to homepage-media and points the home page at it.
 * Originals are NOT deleted — they stay in storage as a backup.
 */
const BUCKET = "homepage-media";
const MARK = `/storage/v1/object/public/${BUCKET}/`;
const needs = (u?: string | null) => !!u && u.includes(MARK) && !/\.webp(\?|$)/i.test(u);

async function toWebp(url: string): Promise<Blob | null> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const bmp = await createImageBitmap(await res.blob());
  const scale = Math.min(1, 1600 / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b), "image/webp", 0.82));
}

export const OptimizeHomeImagesButton = () => {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const map = new Map<string, string>();
    const convert = async (u: string) => {
      if (map.has(u)) return map.get(u)!;
      const blob = await toWebp(u);
      if (!blob) return u;
      const path = u.split(MARK)[1].split("?")[0].replace(/\.(jpe?g|png)$/i, "") + ".webp";
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        upsert: true, contentType: "image/webp", cacheControl: "31536000, immutable",
      });
      if (error) throw error;
      const nu = await uploadedMediaUrl(BUCKET, path);
      map.set(u, nu);
      return nu;
    };
    try {
      // 1) homepage_settings hero images
      const { data: st } = await supabase.from("homepage_settings").select("*").limit(1).maybeSingle();
      if (st) {
        const patch: Record<string, string> = {};
        for (const k of ["hero_arch_image_url", "hero_glass_door_image_url", "hero_interior_image_url"] as const) {
          const v = (st as Record<string, unknown>)[k] as string | null;
          if (needs(v)) patch[k] = await convert(v!);
        }
        if (Object.keys(patch).length) await supabase.from("homepage_settings").update(patch).eq("id", (st as { id: string }).id);
      }
      // 2) hero slides
      const { data: slides } = await supabase.from("homepage_hero_slides").select("id,image_url");
      for (const s of slides || []) if (needs(s.image_url)) await supabase.from("homepage_hero_slides").update({ image_url: await convert(s.image_url!) }).eq("id", s.id);
      // 3) sections + layout images
      const { data: secs } = await supabase.from("homepage_sections").select("id,section_key,image_url,body");
      for (const s of secs || []) {
        if (needs(s.image_url)) await supabase.from("homepage_sections").update({ image_url: await convert(s.image_url!) }).eq("id", s.id);
        if (s.section_key === "__home_layout" && s.body) {
          const layout = JSON.parse(s.body);
          let changed = false;
          for (const k of Object.keys(layout.images || {})) if (needs(layout.images[k])) { layout.images[k] = await convert(layout.images[k]); changed = true; }
          if (changed) await supabase.from("homepage_sections").update({ body: JSON.stringify(layout) }).eq("id", s.id);
        }
      }
      toast({ title: "Images optimised", description: `${map.size} photo(s) converted to WebP. Originals kept as backup.` });
    } catch (e) {
      toast({ title: "Optimise failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant="outline" onClick={run} disabled={busy} className="min-h-11">
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
      Speed up home photos (WebP)
    </Button>
  );
};
