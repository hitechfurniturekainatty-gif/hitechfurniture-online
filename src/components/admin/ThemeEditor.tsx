import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ColorCodeInput } from "@/components/admin/ColorCodeInput";
import { DEFAULT_THEME, SiteTheme, applySiteTheme, cacheTheme } from "@/lib/siteTheme";

const COLORS: [keyof SiteTheme, string][] = [
  ["background", "Page background"],
  ["foreground", "Text colour"],
  ["card", "Card / box background"],
  ["primary", "Main brand colour (buttons, links)"],
  ["primaryForeground", "Text on brand buttons"],
  ["accent", "Highlight colour"],
  ["secondary", "Soft section background"],
  ["muted", "Muted background"],
  ["border", "Border colour"],
];

const PRESETS: { name: string; theme: SiteTheme }[] = [
  { name: "Original (Brown & Gold)", theme: {} },
  { name: "Teal", theme: { primary: "#0e5c66", accent: "#e0a43a", background: "#f6faf9", secondary: "#e6f0ef", muted: "#ebf2f1", border: "#cfdedd" } },
  { name: "Charcoal & Gold", theme: { primary: "#2b2b2b", accent: "#c9a14a", background: "#faf8f4", secondary: "#efece6", border: "#ddd6ca" } },
  { name: "Forest Green", theme: { primary: "#28543c", accent: "#d9a441", background: "#f7f9f5", secondary: "#e8efe6", border: "#d2dccd" } },
  { name: "Royal Maroon", theme: { primary: "#6b1f2a", accent: "#e2a93b", background: "#fbf7f5", secondary: "#f1e7e4", border: "#e3d1cc" } },
];

export default function ThemeEditor({ settingsId }: { settingsId: string }) {
  const [theme, setTheme] = useState<SiteTheme>({});
  const [saving, setSaving] = useState(false);
  const saved = useRef<SiteTheme>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    supabase.from("homepage_settings").select("theme").limit(1).maybeSingle().then(({ data }) => {
      const t = ((data as { theme?: SiteTheme } | null)?.theme ?? {}) as SiteTheme;
      saved.current = t;
      setTheme(t);
    });
    // leaving the tab without saving → put the live site theme back
    return () => applySiteTheme(saved.current);
  }, []);

  // live: every change applies to the site immediately (admin panel keeps its own look)
  useEffect(() => {
    applySiteTheme(theme);
    setDirty(JSON.stringify(theme) !== JSON.stringify(saved.current));
  }, [theme]);

  const val = <K extends keyof SiteTheme>(k: K) => (theme[k] ?? DEFAULT_THEME[k]) as NonNullable<SiteTheme[K]>;
  const set = (patch: SiteTheme) => setTheme((t) => ({ ...t, ...patch }));

  const save = async (next = theme) => {
    if (!settingsId) {
      toast({ title: "Save Contact settings once first", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("homepage_settings").update({ theme: next } as never).eq("id", settingsId).select("id");
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else if (!data || data.length === 0) toast({ title: "Not saved — admin login needed", description: "Only Admin role can change the website theme. Log out and log in again.", variant: "destructive" });
    else {
      saved.current = next;
      cacheTheme(next);
      applySiteTheme(next);
      setDirty(false);
      toast({ title: "Theme saved — live on website now" });
    }
  };

  const align = (k: "headingAlign" | "textAlign") => (
    <div className="flex gap-2">
      {(["default", "left", "center"] as const).map((a) => (
        <Button key={a} size="sm" type="button" variant={val(k) === a ? "default" : "outline"} onClick={() => set({ [k]: a })}>
          {a === "default" ? "As designed" : a === "left" ? "Left" : "Center"}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Ready-made themes</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.name} variant="outline" size="sm" onClick={() => setTheme({ ...p.theme, radius: theme.radius, borderWidth: theme.borderWidth, headingAlign: theme.headingAlign, textAlign: theme.textAlign })}>
              <span className="mr-2 inline-block h-4 w-4 rounded-full border" style={{ background: p.theme.primary ?? DEFAULT_THEME.primary }} />
              {p.name}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Colours</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {COLORS.map(([k, label]) => (
            <div key={k} className="flex items-center gap-3 rounded-lg border p-2">
              <span className="flex-1 text-sm">{label}</span>
              <ColorCodeInput value={val(k) as string} onChange={(hex) => set({ [k]: hex })} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Border &amp; corners</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Corner roundness: {val("radius")} rem</Label>
            <input type="range" min={0} max={2} step={0.125} value={val("radius")} onChange={(e) => set({ radius: Number(e.target.value) })} className="w-full" />
          </div>
          <div>
            <Label>Border thickness: {val("borderWidth")} px</Label>
            <input type="range" min={0} max={4} step={1} value={val("borderWidth")} onChange={(e) => set({ borderWidth: Number(e.target.value) })} className="w-full" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Alignment</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Headings</Label>{align("headingAlign")}</div>
          <div className="space-y-2"><Label>Paragraph text</Label>{align("textAlign")}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
        <CardContent>
          <div className="p-5" style={{ background: val("background") as string, color: val("foreground") as string, borderRadius: `${val("radius")}rem` }}>
            <h3 className="font-display text-2xl" style={{ textAlign: val("headingAlign") === "default" ? undefined : (val("headingAlign") as "left") }}>Hitech Furniture</h3>
            <div className="mt-3 p-4" style={{ background: val("card") as string, border: `${val("borderWidth")}px solid ${val("border")}`, borderRadius: `${val("radius")}rem` }}>
              <p className="text-sm" style={{ textAlign: val("textAlign") === "default" ? undefined : (val("textAlign") as "left") }}>Sofa, cot, mattress — every budget.</p>
              <div className="mt-3 flex gap-2">
                <span className="px-4 py-2 text-sm" style={{ background: val("primary") as string, color: val("primaryForeground") as string, borderRadius: `${val("radius")}rem` }}>Enquire</span>
                <span className="px-4 py-2 text-sm" style={{ background: val("accent") as string, borderRadius: `${val("radius")}rem` }}>Offer</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-20 -mx-2 flex flex-wrap items-center gap-2 border-t bg-background/95 p-3 backdrop-blur">
        <span className="mr-auto text-sm text-muted-foreground">{dirty ? "● Unsaved changes" : "All changes saved"}</span>
        <Button variant="outline" size="sm" onClick={() => window.open("/", "_blank")}>View website</Button>
        <Button variant="outline" size="sm" onClick={() => setTheme(saved.current)} disabled={!dirty || saving}>Undo</Button>
        <Button variant="outline" size="sm" onClick={() => { setTheme({}); save({}); }} disabled={saving}>Reset to original</Button>
        <Button onClick={() => save()} disabled={saving || !dirty}>{saving ? "Saving…" : "Save theme"}</Button>
      </div>
    </div>
  );
}
